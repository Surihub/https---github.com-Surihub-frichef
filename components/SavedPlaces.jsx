import React, { useState } from 'react';
import { MapPin, ExternalLink } from 'lucide-react';
import { naverMapUrl, parseNaverShare, requestedPlace } from '../services/placeFormat.js';

const blank = { dishName: '', address: '', mapUrl: '', notes: '', category: '평일', imageUrl: '' };
const categories = ['전체', '평일', '주말', '언젠가'];
const field = 'w-full border border-slate-200 rounded-xl p-3 bg-white';
function Preview({ place }) {
  const [failed, setFailed] = useState(false);
  return <div className="aspect-video bg-emerald-50 flex items-center justify-center overflow-hidden rounded-xl">
    {place.imageUrl && !failed ? <img src={place.imageUrl} alt={`${place.dishName} 지도 미리보기`} className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : <div className="text-center text-emerald-700"><MapPin className="w-9 h-9 mx-auto mb-2" /><span className="text-xs">네이버지도</span></div>}
  </div>;
}

export default function SavedPlaces({ places, onSave, onDelete }) {
  const [draft, setDraft] = useState(null);
  const [original, setOriginal] = useState(null);
  const [share, setShare] = useState('');
  const [filter, setFilter] = useState('전체');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const update = (key, value) => setDraft(previous => ({ ...previous, [key]: value }));
  const edit = place => { setOriginal(place?.id ? place : null); setDraft({ ...blank, ...place }); setError(''); };
  const submit = async event => {
    event.preventDefault();
    const mapUrl = naverMapUrl(draft.mapUrl.trim());
    if (!mapUrl || !draft.dishName.trim()) { setError('장소 이름과 네이버지도 링크를 확인해주세요.'); return; }
    setBusy(true); setError('');
    try {
      let imageUrl = draft.imageUrl || '';
      if (!imageUrl || original?.mapUrl !== mapUrl) {
        try {
          const response = await fetch(`/.netlify/functions/place-preview?url=${encodeURIComponent(mapUrl)}`);
          if (response.ok) imageUrl = (await response.json()).imageUrl || '';
        } catch { /* Preview failure must not prevent saving. */ }
      }
      const saved = await onSave({ ...draft, type: 'place', mapUrl, imageUrl, dishName: draft.dishName.trim() }, original ? { expectedRecipe: original } : {});
      if (saved) { setDraft(null); setOriginal(null); setShare(''); }
      else setError('저장하지 못했습니다. 연결 상태를 확인해주세요.');
    } finally { setBusy(false); }
  };
  return <section className="space-y-4">
    <header className="flex items-center justify-between"><h2 className="text-xl font-black">갈 곳 <span className="text-sm text-slate-400 font-normal">{places.length}</span></h2><button onClick={() => edit(blank)} className="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm">장소 추가</button></header>
    <div className="rounded-2xl border bg-white p-4 space-y-2"><label className="block text-sm font-bold" htmlFor="naver-share">네이버지도 공유 내용 붙여넣기</label><textarea id="naver-share" className={field} rows={3} value={share} onChange={event => setShare(event.target.value)} placeholder={'[네이버지도]\n장소 이름\n주소\nhttps://naver.me/…'} /><button onClick={() => edit(parseNaverShare(share))} disabled={!share.trim()} className="text-sm rounded-lg bg-emerald-100 text-emerald-900 px-3 py-2 disabled:opacity-40">내용 가져오기</button></div>
    {!places.some(place => place.mapUrl === requestedPlace.mapUrl) && <button onClick={() => edit(requestedPlace)} className="text-sm text-emerald-800 underline">작은피자집 · 금요일 오픈런 추가</button>}
    {draft && <form onSubmit={submit} className="rounded-2xl border bg-white p-4 space-y-3">
      <h3 className="font-bold">{original ? '장소 수정' : '장소 저장'}</h3>
      <label className="block text-sm">장소 이름<input required className={field} value={draft.dishName} onChange={e => update('dishName', e.target.value)} /></label>
      <label className="block text-sm">네이버지도 링크<input required type="url" className={field} value={draft.mapUrl} onChange={e => update('mapUrl', e.target.value)} /></label>
      <label className="block text-sm">주소<input className={field} value={draft.address} onChange={e => update('address', e.target.value)} /></label>
      <label className="block text-sm">언제 갈까요?<select className={field} value={draft.category} onChange={e => update('category', e.target.value)}>{categories.slice(1).map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="block text-sm">메모<textarea className={field} rows={3} value={draft.notes} onChange={e => update('notes', e.target.value)} placeholder="금요일 오픈런" /></label>
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      <div className="flex gap-2"><button disabled={busy} className="flex-1 bg-slate-900 text-white rounded-xl p-3 disabled:opacity-40">{busy ? '저장 중…' : '저장'}</button><button type="button" disabled={busy} onClick={() => setDraft(null)} className="px-4">취소</button></div>
    </form>}
    <div role="group" aria-label="방문 계획" className="flex gap-2">{categories.map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)} className={`rounded-full px-3 py-2 text-sm ${filter === value ? 'bg-emerald-700 text-white' : 'bg-white text-slate-600'}`}>{value}</button>)}</div>
    <div className="grid grid-cols-2 gap-3">{places.filter(place => filter === '전체' || place.category === filter).map(place => <article key={place.id} className="bg-white border rounded-2xl p-3 space-y-2 min-w-0">
      <a href={naverMapUrl(place.mapUrl) || undefined} target="_blank" rel="noopener noreferrer" aria-label={`${place.dishName} 네이버지도 열기`}><Preview key={place.imageUrl} place={place} /></a>
      <span className="text-[11px] text-emerald-700">{place.category || '언젠가'}</span><h3 className="font-bold break-words">{place.dishName}</h3><p className="text-xs text-slate-500 break-words">{place.address}</p><p className="text-sm whitespace-pre-wrap break-words">{place.notes}</p>
      <a href={naverMapUrl(place.mapUrl) || undefined} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-emerald-800 py-2">지도 열기<ExternalLink className="w-3 h-3" /></a>
      <div className="flex justify-between text-xs"><button onClick={() => edit(place)} className="py-2">수정 · 메모</button><button onClick={() => { if (window.confirm('이 장소를 삭제하시겠습니까?')) onDelete(place.id); }} className="py-2 text-rose-600">삭제</button></div>
    </article>)}</div>
    {!places.length && <p className="text-center text-sm text-slate-400 py-6">평일에 갈 곳을 저장해보세요.</p>}
  </section>;
}
