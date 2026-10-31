import React, { useState } from 'react';
import { X } from 'lucide-react';
import { normalizeTags } from '../services/tags.js';

export default function TagEditor({ tags, suggestions, onChange }) {
  const [input, setInput] = useState('');
  const selected = normalizeTags(tags);
  const add = value => { onChange(previous => normalizeTags([...normalizeTags(previous), value])); setInput(''); };
  return <div className="tag-editor space-y-3">
    <div className="space-y-1"><label className="block text-sm" htmlFor="link-tags">태그</label><div className="flex items-center gap-2"><input id="link-tags" value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.nativeEvent.isComposing || event.keyCode === 229) return; if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); add(input); } }} onBlur={() => { if (input.trim()) add(input); }} placeholder="태그 입력 후 Enter" className="tag-input" /><button type="button" disabled={!input.trim()} onClick={() => add(input)} className="tag-add">추가</button></div></div>
    {selected.length > 0 && <div className="tag-options" aria-label="선택한 태그">{selected.map(tag => <button type="button" key={tag} className="tag-token is-selected" onClick={() => onChange(previous => normalizeTags(previous).filter(value => value !== tag))} aria-label={`${tag} 태그 제거`}>#{tag}<X size={12} aria-hidden="true" /></button>)}</div>}
    {suggestions.some(tag => !selected.includes(tag)) && <div><p className="text-xs text-[#999e98] mb-2">기존 태그에서 선택</p><div className="tag-options">{suggestions.filter(tag => !selected.includes(tag)).map(tag => <button type="button" key={tag} className="tag-token" onClick={() => add(tag)}>#{tag}</button>)}</div></div>}
  </div>;
}
