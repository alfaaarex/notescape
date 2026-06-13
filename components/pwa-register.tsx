'use client';

import { useEffect } from 'react';

export function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    const register = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js');
      } catch (error) {
        console.warn('Service worker registration failed:', error);
      }
    };

    window.addEventListener('load', register);
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
