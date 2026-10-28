import React, { useEffect, useRef } from 'react';
import KitchenSharing from './KitchenSharing';

export default function SettingsDialog({ user, kitchen, onClose, onLogout, error }) {
  const root = useRef(null);
  const close = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    close.current?.focus();
    const keydown = event => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const items = [...root.current.querySelectorAll('button, input, summary')].filter(item => item.getClientRects().length);
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [onClose]);
  return <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={root} role="dialog" aria-modal="true" aria-labelledby="settings-title" className="bg-white rounded-2xl w-full max-w-md p-4 space-y-4 max-h-[90dvh] overflow-y-auto">
      <header className="flex justify-between items-center"><h2 id="settings-title" className="font-bold text-lg">설정</h2><button ref={close} onClick={onClose} className="px-2 py-1 rounded-lg bg-slate-100 text-xs">닫기</button></header>
      <KitchenSharing user={user} kitchen={kitchen} />
      <button onClick={onLogout} className="w-full border rounded-xl py-2 text-sm">로그아웃</button>
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
    </section>
  </div>;
}
