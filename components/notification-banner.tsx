'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, BellOff, X } from 'lucide-react';
import { usePushNotifications } from '@/lib/usePushNotifications';

export function NotificationBanner() {
  const { supported, permission, requestPermission } = usePushNotifications();
  const [dismissed, setDismissed] = useState(false);
  const [requesting, setRequesting] = useState(false);

  // Only show once per session; don't nag if already decided
  useEffect(() => {
    const alreadyDismissed = sessionStorage.getItem('notescape-notif-dismissed');
    if (alreadyDismissed) setDismissed(true);
  }, []);

  const dismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('notescape-notif-dismissed', '1');
  };

  const handleEnable = async () => {
    setRequesting(true);
    const result = await requestPermission();
    setRequesting(false);
    if (result !== 'default') dismiss();
  };

  const show = supported && permission === 'default' && !dismissed;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ type: 'spring', damping: 24, stiffness: 260 }}
          className="fixed top-4 left-1/2 z-50 -translate-x-1/2 w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-500 dark:bg-indigo-500/10 dark:text-indigo-400">
              <Bell size={16} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Enable notifications</p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-400">
                Get reminders for tasks and important notes — right in your browser.
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  onClick={handleEnable}
                  disabled={requesting}
                  className="flex items-center gap-1.5 rounded-lg bg-gray-950 px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950"
                >
                  <Bell size={12} />
                  {requesting ? 'Requesting…' : 'Enable'}
                </button>
                <button
                  onClick={dismiss}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  <BellOff size={12} />
                  Not now
                </button>
              </div>
            </div>
            <button
              onClick={dismiss}
              className="flex-shrink-0 rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 dark:text-zinc-500 dark:hover:bg-zinc-800"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
