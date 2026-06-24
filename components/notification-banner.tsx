'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, BellOff, X } from 'lucide-react';
import { usePushNotifications } from '@/lib/usePushNotifications';

export function NotificationBanner() {
  const { supported, permission, requestPermission } = usePushNotifications();
  const [dismissed, setDismissed] = useState(() => {
    return typeof window !== 'undefined' && sessionStorage.getItem('notescape-notif-dismissed') === '1';
  });
  const [requesting, setRequesting] = useState(false);

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
          className="fixed top-4 left-1/2 z-50 -translate-x-1/2 w-[min(26rem,calc(100vw-2rem))] rounded-xl te-surface px-4 py-3 shadow-2xl relative"
        >
          <div className="absolute top-2 left-2 te-screw" />
          <div className="absolute top-2 right-2 te-screw" />
          <div className="flex items-start gap-3 relative z-10">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg te-inset text-primary">
              <Bell size={16} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-mono font-bold tracking-widest uppercase text-foreground">Enable Alerts</p>
              <p className="mt-1 text-[10px] font-mono text-muted-foreground leading-relaxed">
                Get reminders for tasks and notes — delivered to your browser.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button onClick={handleEnable} disabled={requesting} className="flex items-center gap-1.5 te-button-primary px-3 py-1.5 text-[9px] font-mono font-bold tracking-widest uppercase rounded disabled:opacity-50">
                  <Bell size={11} />
                  {requesting ? 'REQUESTING...' : 'ENABLE'}
                </button>
                <button onClick={dismiss} className="flex items-center gap-1.5 te-button px-3 py-1.5 text-[9px] font-mono font-bold tracking-widest uppercase text-muted-foreground rounded">
                  <BellOff size={11} />
                  DISMISS
                </button>
              </div>
            </div>
            <button onClick={dismiss} className="flex-shrink-0 rounded te-button p-1 text-muted-foreground" aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
