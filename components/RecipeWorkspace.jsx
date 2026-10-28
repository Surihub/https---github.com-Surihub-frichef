import React, { useEffect, useRef, useState } from 'react';
import { completeIngredientAmounts, repairExistingRecipe } from '../services/geminiService';
import { compactStep, splitLines, youtubeUrl, ingredientsWithStepAmounts, needsRecipeRepair } from './recipeFormat';

const fieldClass = 'w-full rounded-xl border border-slate-200 p-2.5 bg-white text-base';
const quantityPattern = /(\d+(?:[./]\d+)?(?:\s*~\s*\d+)?\s*(?:큰술|작은술|공기|꼬집|스푼|컵|개|장|쪽|대|줌|봉|팩|인분|ml|mL|kg|g|L)|반\s*(?:큰술|작은술|컵|개|공기)|약간|적당량)/g;
function Quantity({ text }) {
  return String(text).split(quantityPattern).map((part, index) => index % 2
    ? <strong key={index} className="text-amber-800 bg-amber-100 rounded px-1">{part}</strong> : part);
}
function Step({ text }) {
  const heat = String(text).match(/(?:중\s*약|중\s*강|약|중|강)\s*불/g) || [];
  const body = compactStep(text).replace(/(?:중\s*약|중\s*강|약|중|강)\s*불(?:에서|로)?\s*/g, '').trim();
  return <p className="min-w-0 break-words">{body.replace(/\[\[\s*\]\]/g, '')}{[...new Set(heat)].map(value => <strong key={value} className="inline-block align-baseline ml-1 px-1.5 rounded bg-orange-100 text-orange-800 text-[0.85em] whitespace-nowrap">{value.replace(/\s/g, '')}</strong>)}</p>;
}

export default function RecipeWorkspace({ recipe, onClose, onSave }) {
  const [draft, setDraft] = useState(() => ({ ...recipe, ingredients: ingredientsWithStepAmounts(recipe), extraNeeded: [] }));
  const [editing, setEditing] = useState(!recipe.id);
  const [error, setError] = useState('');
  const [fontSize, setFontSize] = useState(() => {
    const stored = Number(localStorage.getItem('frichef_recipe_font_size'));
    return Number.isFinite(stored) && stored >= 16 && stored <= 28 ? stored : 18;
  });
  const changeFontSize = delta => setFontSize(previous => {
    const next = Math.min(28, Math.max(16, previous + delta));
    localStorage.setItem('frichef_recipe_font_size', String(next));
    return next;
  });
  const [filling, setFilling] = useState(false);
  const [ingredientInput, setIngredientInput] = useState(ingredientsWithStepAmounts(recipe).join('\n'));
  const [stepInput, setStepInput] = useState((recipe.steps || []).join('\n'));
  const close = useRef(null);
  const repairRequest = useRef(null);
  const [repairing, setRepairing] = useState(needsRecipeRepair(recipe));
  const [repairAttempt, setRepairAttempt] = useState(0);
  useEffect(() => {
    if (!needsRecipeRepair(recipe)) return;
    let active = true;
    setRepairing(true);
    setError('');
    if (!repairRequest.current) repairRequest.current = repairExistingRecipe(recipe);
    repairRequest.current.then(async repaired => {
      if (!active) return;
      setDraft(repaired);
      setIngredientInput(repaired.ingredients.join('\n'));
      setStepInput(repaired.steps.join('\n'));
      if (recipe.id) {
        const saved = await onSave(repaired, { keepOpen: true, expectedRecipe: recipe });
        if (active && !saved) setError('분량 보완됨 · 수정창에서 저장 재시도');
      }
    }).catch(() => {
      if (active) setError('분량 자동 보완 실패');
      repairRequest.current = null;
    }).finally(() => { if (active) setRepairing(false); });
    return () => { active = false; };
  }, [repairAttempt]);
  useEffect(() => {
    close.current?.focus();
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const escape = event => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', escape);
    return () => { document.body.style.overflow = old; document.removeEventListener('keydown', escape); };
  }, [onClose]);
  const update = (key, value) => setDraft(previous => ({ ...previous, [key]: value }));
  const fillAmounts = async () => {
    setFilling(true); setError('');
    try {
      const ingredients = await completeIngredientAmounts(draft);
      update('ingredients', ingredients);
      setIngredientInput(ingredients.join('\n'));
      update('extraNeeded', []);
    } catch { setError('분량 보완 실패 · 다시 시도'); }
    finally { setFilling(false); }
  };
  const save = event => {
    event.preventDefault();
    const link = draft.youtubeUrl?.trim();
    if (!draft.dishName?.trim() || !draft.steps?.length) { setError('요리 이름과 조리 순서 확인'); return; }
    if (link && !youtubeUrl(link)) { setError('유효한 유튜브 영상 링크 입력'); return; }
    onSave({ ...draft, dishName: draft.dishName.trim(), youtubeUrl: link ? youtubeUrl(link) : '' });
  };
  return <div role="dialog" aria-modal="true" aria-label="레시피 상세" className="fixed inset-0 z-50 bg-[#fffdf8]">
    <div className="mx-auto max-w-lg flex flex-col" style={{ height: '100dvh', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <header className="flex items-center justify-between px-3 py-1 border-b shrink-0">
        <div role="group" aria-label="레시피 글자 크기" className="flex items-center gap-1"><button type="button" aria-label="글자 작게" disabled={fontSize <= 16} onClick={() => changeFontSize(-1)} className="w-7 h-7 rounded bg-slate-100 text-sm disabled:opacity-30">−</button><span aria-live="polite" className="text-[11px] text-slate-500 w-7 text-center">{fontSize}</span><button type="button" aria-label="글자 크게" disabled={fontSize >= 28} onClick={() => changeFontSize(1)} className="w-7 h-7 rounded bg-slate-100 text-sm disabled:opacity-30">+</button></div><div className="flex gap-1">{!editing && <button disabled={repairing} onClick={() => setEditing(true)} className="px-2 py-1 text-xs">수정</button>}<button ref={close} onClick={onClose} className="rounded-lg px-2 py-1 text-xs bg-slate-100">닫기</button></div>
      </header>
      {repairing && <p role="status" className="px-3 py-2 text-xs text-amber-800 bg-amber-50">재료 분량·조리 문구 정리 중…</p>}
      {!editing && error && <div role="alert" className="px-3 py-2 text-xs text-rose-600">{error} <button onClick={() => setRepairAttempt(value => value + 1)} className="underline">다시 시도</button></div>}
      {editing ? <form onSubmit={save} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        <label className="block"><span className="text-xs text-slate-500">요리 이름</span><input required className={fieldClass} value={draft.dishName || ''} onChange={e => update('dishName', e.target.value)} /></label>
        {[['ingredients', '재료 · 분량 포함, 한 줄에 하나'], ['steps', '순서 · 약불/중불/강불 포함, 한 줄에 한 단계']].map(([key, title]) => <label key={key} className="block"><span className="text-xs text-slate-500">{title}</span><textarea className={fieldClass} style={{ fontSize }} rows={key === 'steps' ? 6 : 4} value={key === 'ingredients' ? ingredientInput : stepInput} onChange={e => { (key === 'ingredients' ? setIngredientInput : setStepInput)(e.target.value); update(key, splitLines(e.target.value)); }} /></label>)}
        <button type="button" disabled={filling} onClick={fillAmounts} className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-900 disabled:opacity-40">{filling ? '분량 계산 중…' : 'AI로 분량 보완'}</button>
        <label className="block"><span className="text-xs text-slate-500">내 메모</span><textarea className={fieldClass} rows={2} value={draft.notes || ''} onChange={e => update('notes', e.target.value)} placeholder="다음엔 간장 반 큰술 줄이기" /></label>
        <label className="block"><span className="text-xs text-slate-500">유튜브 링크</span><input type="url" className={fieldClass} value={draft.youtubeUrl || ''} onChange={e => update('youtubeUrl', e.target.value)} placeholder="https://youtu.be/…" /></label>
        {error && <p role="alert" className="text-rose-600 text-sm">{error}</p>}
        <button type="submit" className="w-full bg-slate-900 text-white rounded-xl py-3 font-bold">저장</button>
        {recipe.id && <button type="button" onClick={() => { setDraft({ ...recipe }); setIngredientInput(ingredientsWithStepAmounts(recipe).join('\n')); setStepInput((recipe.steps || []).join('\n')); setEditing(false); }} className="w-full py-2 text-sm">취소</button>}
      </form> : <>
        <div className="flex-1 min-h-0 overflow-y-auto px-3 pt-2">
          <article className="space-y-2 pb-2" style={{ fontSize }}>
            <h1 className="font-black leading-tight break-words" style={{ fontSize: fontSize + 4 }}>{draft.dishName}</h1>
            <div aria-label="재료와 분량" className="flex flex-wrap gap-x-3 gap-y-1 leading-[1.5] border-y border-amber-200 py-2">{[...(draft.ingredients || []), ...(draft.extraNeeded || [])].filter((item, index, all) => all.indexOf(item) === index).map((item, index) => <span key={index}><Quantity text={item} /></span>)}</div>
            <ol aria-label="조리 순서" className="space-y-2 leading-[1.5]">{(draft.steps || []).map((text, index) => <li key={index} className="flex gap-2"><span className="text-amber-700 font-black shrink-0">{index + 1}</span><Step text={text} /></li>)}</ol>
            {youtubeUrl(draft.youtubeUrl) && <a className="inline-block text-xs text-red-700 underline" href={youtubeUrl(draft.youtubeUrl)} target="_blank" rel="noopener noreferrer">유튜브 영상 ↗</a>}
          </article>
        </div>
        <details className="mx-3 mb-1 border-t border-slate-200 pt-1 shrink-0">
          <summary className="cursor-pointer text-xs text-slate-500 py-1">내 메모{draft.notes ? ' · 있음' : ' 추가'}</summary>
          <textarea aria-label="내 메모" className={`${fieldClass} mt-2`} style={{ fontSize }} rows={2} value={draft.notes || ''} onChange={e => update('notes', e.target.value)} placeholder="내가 적는 요리 메모" />
          <button disabled={repairing} onClick={() => onSave(draft, { keepOpen: true })} className="text-xs py-1 px-2 rounded-lg bg-slate-900 text-white">메모 저장</button>
        </details>
      </>}
    </div>
  </div>;
}
