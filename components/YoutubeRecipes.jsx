import React, { useEffect, useRef, useState } from 'react';
import { youtubeUrl } from './recipeFormat';

function Thumbnail({ url, title, large = false }) {
  const link = youtubeUrl(url);
  const id = link ? new URL(link).searchParams.get('v') : null;
  const [failed, setFailed] = useState(false);
  return <div className="relative aspect-video bg-slate-200 overflow-hidden flex items-center justify-center">
    {id && !failed ? <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt={title} loading={large ? 'eager' : 'lazy'} onError={() => setFailed(true)} className="absolute inset-0 w-full h-full object-cover" /> : <span className="text-xs text-slate-500">썸네일 없음</span>}
    <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center"><span className="bg-black/60 text-white rounded-xl px-3 py-1.5 text-lg">▶</span></span>
  </div>;
}

function VideoDetail({ recipe, onClose, onSave, onDelete }) {
  const [notes, setNotes] = useState(recipe.notes || '');
  const [saved, setSaved] = useState(false);
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const keydown = event => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const items = dialogRef.current?.querySelectorAll('button, a[href], textarea');
      if (!items?.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener('keydown', keydown);
      previousFocus?.focus();
    };
  }, [onClose]);
  const link = youtubeUrl(recipe.youtubeUrl);
  return <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="video-title" className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden" style={{ maxHeight: '94dvh', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <header className="flex justify-between items-center gap-3 px-4 py-3 shrink-0"><h2 id="video-title" className="font-bold break-words min-w-0">{recipe.dishName}</h2><button ref={closeRef} onClick={onClose} className="px-3 py-2 text-sm rounded-lg bg-slate-100 shrink-0">닫기</button></header>
      <div className="overflow-y-auto min-h-0">
        {link ? <a href={link} target="_blank" rel="noopener noreferrer" aria-label={`${recipe.dishName} 유튜브에서 보기`}><Thumbnail url={recipe.youtubeUrl} title={recipe.dishName} large /></a> : <Thumbnail url={recipe.youtubeUrl} title={recipe.dishName} large />}
        <div className="p-4 space-y-3">
          {link && <a href={link} target="_blank" rel="noopener noreferrer" className="block text-center rounded-xl py-3 bg-red-50 text-red-700 text-sm font-bold">유튜브에서 보기 ↗</a>}
          <label className="block space-y-2"><span className="text-sm font-bold">내 메모</span><textarea value={notes} onChange={event => { setNotes(event.target.value); setSaved(false); }} rows={5} placeholder="재료 분량, 불 조절, 다음에 바꿀 점" className="w-full rounded-xl border border-slate-200 p-3 text-base" /></label>
          <div className="flex items-center gap-3"><button onClick={async () => { if (await onSave({ ...recipe, notes })) setSaved(true); }} className="flex-1 rounded-xl py-3 bg-slate-900 text-white text-sm font-bold">메모 저장</button><button onClick={() => { if (window.confirm('영상 삭제?')) { onDelete(recipe.id); onClose(); } }} className="text-sm text-rose-600 px-3 py-3">삭제</button></div>
          <p role="status" className="text-xs text-slate-500 min-h-4">{saved ? '메모 저장됨' : notes !== (recipe.notes || '') ? '저장 전 변경사항 있음' : ''}</p>
        </div>
      </div>
    </section>
  </div>;
}

export default function YoutubeRecipes({ recipes, onSave, onDelete }) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const formRef = useRef(null);
  const selected = recipes.find(recipe => recipe.id === selectedId);
  const closeDetail = React.useCallback(() => setSelectedId(null), []);
  const submit = async event => {
    event.preventDefault();
    const link = youtubeUrl(url.trim());
    if (!link || !title.trim()) { setError('제목과 유효한 유튜브 영상 링크 입력'); return; }
    if (!await onSave({ type: 'youtube', dishName: title.trim(), youtubeUrl: link, notes })) return;
    setTitle(''); setUrl(''); setNotes(''); setError('');
    if (formRef.current) formRef.current.open = false;
  };
  return <section className="space-y-4">
    <h2 className="text-xl font-black">유튜브 레시피 <span className="text-sm font-normal text-slate-400">{recipes.length}</span></h2>
    <details ref={formRef} className="rounded-2xl border bg-white p-4">
      <summary className="cursor-pointer text-sm font-bold">유튜브 링크 추가</summary>
      <form onSubmit={submit} className="pt-4 space-y-3">
        <input required aria-label="영상 제목" value={title} onChange={e => setTitle(e.target.value)} placeholder="요리 이름" className="w-full border rounded-xl p-3" />
        <input required type="url" aria-label="유튜브 영상 링크" value={url} onChange={e => setUrl(e.target.value)} placeholder="유튜브 링크" className="w-full border rounded-xl p-3" />
        <textarea aria-label="영상 메모" value={notes} onChange={e => setNotes(e.target.value)} placeholder="내 메모 (선택)" rows={2} className="w-full border rounded-xl p-3" />
        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
        <button className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold">링크 저장</button>
      </form>
    </details>
    {!recipes.length && <p className="text-sm text-slate-400 text-center py-6">저장한 영상 없음</p>}
    <div className="grid grid-cols-2 gap-3">
      {recipes.map(recipe => <button key={recipe.id} onClick={() => setSelectedId(recipe.id)} aria-label={`${recipe.dishName} 상세 보기`} className="text-left border border-slate-200 bg-white rounded-2xl overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500">
        <Thumbnail url={recipe.youtubeUrl} title={recipe.dishName} />
        <div className="px-3 py-2.5"><h3 className="text-sm font-bold leading-snug line-clamp-2 break-words">{recipe.dishName}</h3><p className="text-[11px] text-slate-400 mt-1">{recipe.notes ? '메모 있음' : '메모 추가'}</p></div>
      </button>)}
    </div>
    {selected && <VideoDetail key={selected.id} recipe={selected} onClose={closeDetail} onSave={onSave} onDelete={onDelete} />}
  </section>;
}
