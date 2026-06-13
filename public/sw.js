const CACHE_NAME = 'notescape-v2';
const APP_SHELL = [
  '/',
  '/login',
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
];

// Active background timeout container tracking map context
const activeTimers = new Map();

// Network status - will be updated by the app via NETWORK_STATUS message
let isOnline = navigator.onLine; // Initial guess

// IndexedDB setup for offline queue
const DB_NAME = 'notescape-offline-db';
const DB_VERSION = 1;
const STORE_NAME = 'task-mutations';

let dbPromise = idbOpen();

function idbOpen() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Queue a mutation for offline processing
async function queueMutation(type, payload) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.add({ type, payload, timestamp: Date.now() });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Process all queued mutations by telling the app to handle them
async function processQueue() {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      const mutations = request.result;
      if (mutations.length === 0) {
        resolve();
        return;
      }
      // Tell the app to process each mutation
      mutations.forEach((mutation) => {
        self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: 'PROCESS_MUTATION',
              mutation: mutation,
            });
          });
        });
      });
      // Clear the queue after sending to app
      const clearTx = db.transaction(STORE_NAME, 'readwrite');
      const clearStore = clearTx.objectStore(STORE_NAME);
      clearStore.clear();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

// Sync event listener for background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-task-mutations') {
    event.waitUntil(processQueue());
  }
});

// Listen for changes in online status
self.addEventListener('online', () => {
  isOnline = true;
  // When we come online, process the queue and register a sync to retry if needed
  processQueue().then(() => {
    self.registration.sync.register('sync-task-mutations').catch((err) => {
      console.warn('Sync registration failed:', err);
    });
  });
});

self.addEventListener('offline', () => {
  isOnline = false;
});

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

// ── Fetch (cache strategy) ───────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match('/offline.html');
        }),
    );
    return;
  }

  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.webmanifest'
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        });
      }),
    );
  }
});

// ── Push Notifications ───────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'Notescape', body: "You have a new notification.", icon: '/icons/icon-192.svg', badge: '/icons/icon-192.svg' };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: data.tag || 'notescape-notification',
      renotify: true,
      data: { url: data.url || '/' },
    }),
  );
});

// ── Notification Click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    }),
  );
});

// ── Message Handler for Client Scheduling Reminders and Mutations ──────────
self.addEventListener('message', async (event) => {
  if (!event.data) return;

  // Handle SCHEDULE_NOTIFICATION (existing)
  if (event.data.type === 'SCHEDULE_NOTIFICATION') {
    const { title, body, delay = 0, url = '/', tag = 'notescape-scheduled' } = event.data.payload;

    // If an active reminder already exists under this identifier, clear it out first (prevents duplicates on edit)
    if (activeTimers.has(tag)) {
      clearTimeout(activeTimers.get(tag));
      activeTimers.delete(tag);
    }

    if (delay > 0) {
      const timeoutId = setTimeout(() => {
        self.registration.showNotification(title, {
          body,
          icon: '/icons/icon-192.svg',
          badge: '/icons/icon-192.svg',
          tag: tag,
          data: { url },
        });
        activeTimers.delete(tag);
      }, delay);

      activeTimers.set(tag, timeoutId);
    }
    return;
  }

  // Handle NETWORK_STATUS from the app (to keep our isOnline in sync)
  if (event.data.type === 'NETWORK_STATUS') {
    isOnline = event.data.isOnline;
    // If we just went online, process the queue
    if (isOnline) {
      processQueue().then(() => {
        self.registration.sync.register('sync-task-mutations').catch((err) => {
          console.warn('Sync registration failed:', err);
        });
      });
    }
    return;
  }

  // Handle TASK_MUTATION from the app (create, update, delete)
  if (event.data.type === 'TASK_MUTATION') {
    const { mutation } = event.data; // { type: 'create'|'update'|'delete', payload: task }
    if (isOnline) {
      // If we are online, tell the app to process the mutation immediately
      self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'PROCESS_MUTATION_IMMEDIATE',
            mutation: mutation,
          });
        });
      });
    } else {
      // If we are offline, queue the mutation
      queueMutation(mutation.type, mutation.payload);
    }
    return;
  }
});