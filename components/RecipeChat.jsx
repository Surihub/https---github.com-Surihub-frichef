import React, { useEffect, useRef } from 'react';
import { ArrowUp, ArrowUpRight, RotateCcw } from 'lucide-react';

export default function RecipeChat({ conversation, onOpenRecipe }) {
  const { messages, input, setInput, busy, error, send, retry, reset } = conversation;
  const end = useRef(null);
  useEffect(() => { if (messages.length) end.current?.scrollIntoView({ behavior: 'auto', block: 'nearest' }); }, [messages.length, busy]);
  return <div className="recipe-chat">
    <div className="chat-intro"><p>있는 재료부터 말해주세요. 입맛에 맞을 때까지 같이 골라드릴게요.</p>{messages.length > 0 && <button type="button" onClick={reset} disabled={busy} aria-label="새 대화" title="새 대화"><RotateCcw size={17} strokeWidth={1.6} /></button>}</div>
    <div className="chat-messages" role="log" aria-label="요리 대화" aria-live="polite" aria-relevant="additions text">
      {messages.map(message => <div key={message.id} className={`chat-message is-${message.role}`}><span className="sr-only">{message.role === 'user' ? '나' : '뭐먹지?'}</span><p>{message.text}</p>{message.recipe && <button type="button" className="chat-recipe" onClick={() => onOpenRecipe(message.recipe)}><span><strong>{message.recipe.dishName}</strong><small>{[message.recipe.time, '레시피 보기 · 수정 · 저장'].filter(Boolean).join(' · ')}</small></span><ArrowUpRight size={19} strokeWidth={1.6} /></button>}</div>)}
      {busy && <p role="status" className="chat-thinking">메뉴를 생각하고 있습니다<span aria-hidden="true">…</span></p>}
      <div ref={end} />
    </div>
    {error && <div className="chat-error" role="alert">{error}<button type="button" onClick={retry} disabled={busy}>다시 시도</button></div>}
    {messages.some(message => message.role === 'model') && !busy && <div className="chat-suggestions" aria-label="이어서 말하기">{['그건 싫어요. 다른 메뉴요', '10분 안에 만들고 싶어요', '그걸로 할게요. 레시피 알려주세요'].map(text => <button type="button" key={text} onClick={() => send(text)}>{text}</button>)}</div>}
    <form className="chat-composer" onSubmit={event => { event.preventDefault(); send(); }}>
      <textarea aria-label="요리 대화 입력" rows={2} value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); send(); } }} placeholder="계란이랑 두부 있는데 뭐 먹을까요?" />
      <button type="submit" disabled={busy || !input.trim()} aria-label="메시지 보내기"><ArrowUp size={20} strokeWidth={1.8} /></button>
    </form>
  </div>;
}
