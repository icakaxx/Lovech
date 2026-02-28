'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'hmwspro_promo_dismissed_until';
const SHOW_AFTER_MS = 60_000;
const HIDE_FOR_MS = 24 * 60 * 60 * 1000; // 1 day

function PromoContent() {
  return (
    <>
      Искаш професионален уебсайт или дигитализирано решение? Свържи се с нас:{' '}
      <a
        href="https://www.hmwspro.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:no-underline text-amber-900 font-medium"
      >
        hmwspro.com
      </a>
      {' или '}
      <a href="tel:+359879191128" className="underline hover:no-underline text-amber-900 font-medium">
        Viber: 0879 191 128
      </a>
      {' • '}
      <a
        href="viber://chat?number=+359879191128"
        className="underline hover:no-underline text-amber-900 font-medium"
        aria-label="Viber чат"
      >
        Viber чат
      </a>
    </>
  );
}

export function PromoTicker() {
  const [visible, setVisible] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const until = window.localStorage.getItem(STORAGE_KEY);
    const now = Date.now();
    if (until != null && now < Number(until)) return;

    const timer = window.setTimeout(() => {
      const untilAgain = window.localStorage.getItem(STORAGE_KEY);
      if (untilAgain != null && Date.now() < Number(untilAgain)) return;
      setVisible(true);
    }, SHOW_AFTER_MS);

    return () => window.clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, String(Date.now() + HIDE_FOR_MS));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="promo-ticker fixed left-0 right-0 bottom-0 z-[1500] flex items-center h-11 bg-amber-400 text-slate-900 text-sm border-t border-amber-500 pb-[env(safe-area-inset-bottom)]"
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-amber-400 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-10 top-0 bottom-0 w-12 bg-gradient-to-l from-amber-400 to-transparent z-10 pointer-events-none" />

      <div className="flex-1 min-w-0 overflow-hidden h-full flex items-center">
        <div
          className={`marquee-inner flex items-center whitespace-nowrap text-sm ${
            paused ? 'promo-ticker--paused' : ''
          }`}
        >
          <span className="inline-block pr-[2em]">
            <PromoContent />
          </span>
          <span className="inline-block pr-[2em]" aria-hidden>
            <PromoContent />
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleDismiss}
        className="absolute right-0 top-0 bottom-0 w-10 flex items-center justify-center text-slate-700 hover:text-slate-900 hover:bg-amber-500 transition-colors z-20"
        aria-label="Затвори"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
