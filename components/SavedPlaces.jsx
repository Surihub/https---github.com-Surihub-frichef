import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { naverMapUrl, parseNaverShare, requestedPlace } from '../services/placeFormat.js';

const blank = { dishName: '', address: '', mapUrl: '', notes: '', category: '평일', imageUrl: '' };
const categories = ['전체', '평일', '주말', '언젠가'];
const field = 'w-full border border-slate-200 rounded-xl p-3 bg-white';
export default function SavedPlaces({ places, onSave, onDelete }) {
  const [draft, setDraft] = useState(null);
  const [original, setOriginal] = useState(null);
  const [share, setShare] = useState('');
  const [notes, setNotes] = useState('');
  const [filter, setFilter] = useState('전체');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const update = (key, value) => setDraft(previous => ({ ...previous, [key]: value }));
  const edit = place => { setOriginal(place?.id ? place : null); setDraft({ ...blank, ...place }); setError(''); };
  const submit = async (event, value = draft, expected = original) => {
    const draft = value;
    event.preventDefault();
    const mapUrl = naverMapUrl(draft.mapUrl.trim());
    if (!mapUrl || !draft.dishName.trim()) { setError('장소 이름과 네이버지도 링크를 확인해주세요.'); return; }
    setBusy(true); setError('');
    try {
      const saved = await onSave({ ...draft, type: 'place', mapUrl, dishName: draft.dishName.trim() }, expected ? { expectedRecipe: expected } : {});
      if (saved) { setDraft(null); setOriginal(null); setShare(''); setNotes(''); }
      else setError('저장하지 못했습니다. 연결 상태를 확인해주세요.');
    } finally { setBusy(false); }
  };
  return <section className="space-y-4">
    <header className="flex items-center justify-between"><h2 className="text-xl font-black">갈 곳 <span className="text-sm text-slate-400 font-normal">{places.length}</span></h2></header>
    <form onSubmit={event => {
      const parsed = parseNaverShare(share);
      submit(event, { ...blank, ...parsed, dishName: parsed.dishName || '저장한 장소', notes }, null);
    }} className="rounded-2xl border border-emerald-100 bg-white p-4 space-y-3">
      <label className="block text-sm font-bold" htmlFor="naver-share">네이버지도 링크 또는 공유 내용</label>
      <textarea id="naver-share" required className={field} rows={3} value={share} onChange={event => setShare(event.target.value)} placeholder={'[네이버지도]\n장소 이름\n주소\nhttps://naver.me/…'} />
      {parseNaverShare(share).dishName && <p className="text-sm text-emerald-800">{parseNaverShare(share).dishName}</p>}
      <label className="block text-sm">메모<textarea className={field} rows={2} value={notes} onChange={event => setNotes(event.target.value)} placeholder="금요일 오픈런" /></label>
      {!draft && error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      <button disabled={busy || !share.trim()} className="w-full rounded-xl bg-emerald-700 text-white p-3 disabled:opacity-40">{busy ? '저장 중…' : '장소 저장'}</button>
    </form>
    {!places.some(place => place.mapUrl === requestedPlace.mapUrl) && <button onClick={() => edit(requestedPlace)} className="text-sm text-emerald-800 underline">작은피자집 · 금요일 오픈런 추가</button>}
    {draft && <form onSubmit={event => submit(event)} className="rounded-2xl border bg-white p-4 space-y-3">
      <h3 className="font-bold">{original ? '장소 수정' : '장소 저장'}</h3>
      <p className="font-bold text-emerald-900">{draft.dishName}</p>
      <p className="text-xs text-slate-500">{draft.address}</p>
      <label className="block text-sm">메모<textarea className={field} rows={3} value={draft.notes} onChange={e => update('notes', e.target.value)} placeholder="금요일 오픈런" /></label>
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      <div className="flex gap-2"><button disabled={busy} className="flex-1 bg-slate-900 text-white rounded-xl p-3 disabled:opacity-40">{busy ? '저장 중…' : '저장'}</button><button type="button" disabled={busy} onClick={() => setDraft(null)} className="px-4">취소</button></div>
    </form>}
    <div role="group" aria-label="방문 계획" className="flex gap-2">{categories.map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)} className={`rounded-full px-3 py-2 text-sm ${filter === value ? 'bg-emerald-700 text-white' : 'bg-white text-slate-600'}`}>{value}</button>)}</div>
    <div className="grid grid-cols-2 gap-3">{places.filter(place => filter === '전체' || place.category === filter).map(place => <article key={place.id} className="bg-white border rounded-2xl p-3 space-y-2 min-w-0">
      <span className="text-[11px] text-emerald-700">{place.category || '언젠가'}</span><h3 className="font-bold break-words">{place.dishName}</h3><p className="text-xs text-slate-500 break-words">{place.address}</p><p className="text-sm whitespace-pre-wrap break-words">{place.notes}</p>
      <a href={naverMapUrl(place.mapUrl) || undefined} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-emerald-800 py-2">지도 열기<ExternalLink className="w-3 h-3" /></a>
      <div className="flex justify-between text-xs"><button onClick={() => edit(place)} className="py-2">메모 수정</button><button onClick={() => { if (window.confirm('이 장소를 삭제하시겠습니까?')) onDelete(place.id); }} className="py-2 text-rose-600">삭제</button></div>
    </article>)}</div>
    {!places.length && <p className="text-center text-sm text-slate-400 py-6">평일에 갈 곳을 저장해보세요.</p>}
  </section>;
}
