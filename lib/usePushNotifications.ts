'use client';

import { useState, useEffect, useCallback } from 'react';

export type NotificationPermission = 'default' | 'granted' | 'denied';

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const isSupported =
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator;
    setSupported(isSupported);
    if (isSupported) {
      setPermission(Notification.permission as NotificationPermission);
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!supported) return 'denied';
    try {
      const result = await Notification.requestPermission();
      setPermission(result as NotificationPermission);
      return result as NotificationPermission;
    } catch {
      return 'denied';
    }
  }, [supported]);

  /** Send an immediate local notification via the service worker */
  const sendNotification = useCallback(
    async (title: string, options: { body?: string; url?: string; tag?: string } = {}) => {
      if (permission !== 'granted') return;
      try {
        const reg = await navigator.serviceWorker.ready;
        reg.showNotification(title, {
          body: options.body ?? '',
          icon: '/icons/icon-192.svg',
          badge: '/icons/icon-192.svg',
          tag: options.tag ?? 'notescape-local',
          data: { url: options.url ?? '/' },
        });
      } catch (err) {
        console.warn('Failed to send notification:', err);
      }
    },
    [permission],
  );

  /** Schedule a notification after a delay (ms) via SW message */
  const scheduleNotification = useCallback(
    async (
      title: string,
      options: { body?: string; url?: string; delayMs?: number } = {},
    ) => {
      if (permission !== 'granted') return;
      try {
        const reg = await navigator.serviceWorker.ready;
        reg.active?.postMessage({
          type: 'SCHEDULE_NOTIFICATION',
          payload: {
            title,
            body: options.body ?? '',
            url: options.url ?? '/',
            delay: options.delayMs ?? 0,
          },
        });
      } catch (err) {
        console.warn('Failed to schedule notification:', err);
      }
    },
    [permission],
  );

  return { supported, permission, requestPermission, sendNotification, scheduleNotification };
}
