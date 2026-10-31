import React, { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import LinkIcon from './LinkIcon';
import './savedLinks.css';
import { youtubeUrl } from './recipeFormat';
import { cityDistrict, naverMapUrl, parseNaverShare } from '../services/placeFormat.js';

const field = 'w-full rounded-xl border border-slate-200 bg-white p-3 text-base';
function VideoImage({ url, title }) {
  const [failed, setFailed] = useState(false);
  const id = youtubeUrl(url) ? new URL(youtubeUrl(url)).searchParams.get('v') : null;
  return id && !failed ? <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt={title} loading="lazy" onError={() => setFailed(true)} className="aspect-video w-full object-cover" /> : <div className="aspect-video bg-gradient-to-br from-amber-50 to-stone-100" />;
}

function LinkEditor({ item, mode, type, onClose, onSave }) {
  const place = type === 'place';
  const [draft, setDraft] = useState(() => ({ dishName: '', notes: '', address: '', mapUrl: '', youtubeUrl: '', ...item }));
  const [linkText, setLinkText] = useState(item ? place ? item.mapUrl : item.youtubeUrl : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const root = useRef(null);
  const base = useRef(item);
  const title = mode === 'notes' ? '메모' : item ? '수정' : '링크 추가';
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    root.current?.querySelector(mode === 'notes' ? 'textarea' : 'button')?.focus();
    const keydown = event => {
      if (event.key === 'Escape' && !busy) onClose();
      if (event.key !== 'Tab') return;
      const nodes = [...root.current.querySelectorAll('button:not(:disabled), input, textarea, a[href]')];
      const first = nodes[0], last = nodes.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [onClose, busy]);
  const changeLink = value => {
    setLinkText(value);
    if (place) {
      const parsed = parseNaverShare(value);
      setDraft(previous => ({ ...previous, mapUrl: parsed.mapUrl, ...(parsed.dishName ? { dishName: parsed.dishName } : {}), ...(parsed.address ? { address: parsed.address } : {}) }));
    } else setDraft(previous => ({ ...previous, youtubeUrl: value }));
  };
  const submit = async event => {
    event.preventDefault();
    const link = place ? naverMapUrl(draft.mapUrl) : youtubeUrl(draft.youtubeUrl);
    if (mode !== 'notes' && (!link || !draft.dishName.trim())) { setError('이름과 유효한 링크를 입력해주세요.'); return; }
    setBusy(true); setError('');
    try {
      const options = mode === 'notes' ? { notesOnly: true, expectedNotes: base.current.notes || '' } : base.current ? { expectedRecipe: base.current } : {};
      const value = mode === 'notes' ? { ...base.current, notes: draft.notes } : { ...draft, type, dishName: draft.dishName.trim(), ...(place ? { mapUrl: link, address: cityDistrict(draft.address) } : { youtubeUrl: link }) };
      if (await onSave(value, options)) onClose();
      else setError('저장하지 못했습니다. 최신 내용과 연결 상태를 확인해주세요.');
    } catch { setError('저장하지 못했습니다. 다시 시도해주세요.'); }
    finally { setBusy(false); }
  };
  return <div className={`fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex justify-center ${mode === 'notes' ? 'items-center p-4' : 'items-end sm:items-center'}`} onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section ref={root} role="dialog" aria-modal="true" aria-labelledby="link-editor-title" className={`w-full max-w-lg link-editor shadow-2xl p-5 max-h-[90dvh] overflow-y-auto ${mode === 'notes' ? 'rounded-3xl' : 'rounded-t-3xl sm:rounded-3xl'}`} style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
      <header className="flex items-center justify-between mb-4"><h2 id="link-editor-title" className="text-lg font-bold">{title}</h2><button type="button" disabled={busy} aria-label="닫기" onClick={onClose} className="p-2 rounded-full bg-slate-100"><X className="w-5 h-5" /></button></header>
      <form onSubmit={submit} className="space-y-4">
        {mode === 'notes' ? <p className="font-bold">{draft.dishName}</p> : <>
          <label className="block space-y-1 text-sm"><span>{place ? '네이버지도 링크 또는 공유 내용' : '유튜브 링크'}</span><textarea required rows={place ? 4 : 2} className={field} value={linkText} onChange={event => changeLink(event.target.value)} placeholder={place ? '[네이버지도]\n장소 이름\n주소\nhttps://naver.me/…' : 'https://youtu.be/…'} /></label>
          <label className="block space-y-1 text-sm"><span>이름</span><input required className={field} value={draft.dishName} onChange={event => setDraft(previous => ({ ...previous, dishName: event.target.value }))} /></label>
          {place && cityDistrict(draft.address) && <p className="text-sm text-slate-500">{cityDistrict(draft.address)}</p>}
        </>}
        <label className="block space-y-1 text-sm"><span>메모</span><textarea rows={4} className={field} value={draft.notes} onChange={event => setDraft(previous => ({ ...previous, notes: event.target.value }))} placeholder="기억해둘 내용을 적어주세요." /></label>
        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
        <button disabled={busy} className={`w-full rounded-xl py-3 font-bold text-white disabled:opacity-40 ${place ? 'bg-emerald-700' : 'bg-amber-700'}`}>{busy ? '저장 중…' : '저장'}</button>
      </form>
    </section>
  </div>;
}

export default function SavedLinks({ items, type, onSave, onDelete }) {
  const place = type === 'place';
  const [editor, setEditor] = useState(null);
  const close = React.useCallback(() => setEditor(null), []);
  return <section className="link-collection" data-kind={type}>
    <header><div className="link-collection-heading"><h2>{place ? '갈 곳' : '유튜브 레시피'}</h2><span className="link-collection-count">{String(items.length).padStart(2, '0')}</span></div><p className="link-collection-caption">{place ? '가보고 싶은 곳, 기억해둘 한마디.' : '다시 만들고 싶은 요리와 나만의 메모.'}</p></header>
    {!items.length && <p className="text-sm text-slate-400 text-center py-10">저장한 링크가 없습니다. + 버튼으로 추가해주세요.</p>}
    <div className="grid grid-cols-2 gap-3">{items.map(item => {
      const link = place ? naverMapUrl(item.mapUrl) : youtubeUrl(item.youtubeUrl);
      return <article key={item.id} className="link-card">
        <a href={link || undefined} target="_blank" rel="noopener noreferrer" aria-label={`${item.dishName} 링크 열기`} className="link-card-hit"><span className="sr-only">{item.dishName}</span></a>
        <div className="link-card-tools">
          <button type="button" aria-label={`${item.dishName} 수정`} title="수정" onClick={() => setEditor({ item, mode: 'edit' })} className="link-card-tool"><LinkIcon name="edit" /></button>
          <button type="button" aria-label={`${item.dishName} 삭제`} title="삭제" onClick={() => { if (window.confirm('이 링크를 삭제하시겠습니까?')) onDelete(item.id); }} className="link-card-tool is-delete"><LinkIcon name="trash" /></button>
        </div>
        {!place && <VideoImage url={item.youtubeUrl} title={item.dishName} />}
        <div className={`link-card-body ${place ? 'is-place' : ''}`}>
          <div><div className="link-card-title"><h3>{item.dishName}</h3><LinkIcon name="arrow" /></div>
          {place && cityDistrict(item.address) && <p className="link-card-address">{cityDistrict(item.address)}</p>}</div>
          <button type="button" aria-label={`${item.dishName} 메모 수정`} onClick={() => setEditor({ item, mode: 'notes' })} className="link-card-note">
            <span className="link-card-note-label"><LinkIcon name="note" />메모</span>
            <span className={`link-card-note-text ${item.notes ? '' : 'is-empty'}`}>{item.notes || '메모를 남겨보세요'}</span>
          </button>
        </div>
      </article>;
    })}</div>
    <button type="button" aria-label={place ? '갈 곳 링크 추가' : '유튜브 레시피 링크 추가'} onClick={() => setEditor({ item: null, mode: 'add' })} className={`fixed z-40 w-14 h-14 rounded-full text-white shadow-lg flex items-center justify-center link-fab`} style={{ right: 'max(1.25rem, calc((100vw - 32rem) / 2 + 1.25rem))', bottom: 'calc(6.5rem + env(safe-area-inset-bottom))' }}><Plus className="w-7 h-7" /></button>
    {editor && <LinkEditor item={editor.item} mode={editor.mode} type={type} onClose={close} onSave={onSave} />}
  </section>;
}
