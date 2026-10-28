import React, { useState } from 'react';

export default function KitchenSharing({ user, kitchen }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const own = kitchen.workspaceId === user.uid;
  const invite = async event => {
    event.preventDefault(); setBusy(true); setMessage('');
    try { await kitchen.invite(email); setEmail(''); setMessage('초대 등록됨 · 상대방 로그인 후 초대받은 레시피함 선택'); }
    catch (error) { setMessage(error.message.includes('이메일') || error.message.includes('가능') ? error.message : '초대 실패 · 연결 상태와 Firestore 공유 규칙 확인'); }
    finally { setBusy(false); }
  };
  return <details className="rounded-2xl border bg-white p-3 text-sm">
    <summary className="cursor-pointer font-bold">{own ? kitchen.members.length ? '함께 쓰는 내 레시피함' : '레시피함 함께 쓰기' : '초대받은 레시피함 사용 중'}</summary>
    <div className="space-y-3 pt-3">
      <p className="text-xs text-slate-500 break-all">{user.email}</p>
      <div className="flex flex-wrap gap-2"><button onClick={() => kitchen.selectWorkspace(user.uid)} className={`rounded-lg px-3 py-2 ${own ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}>내 레시피함</button>{kitchen.invitations.map((item, index) => <button key={item.id} onClick={() => kitchen.selectWorkspace(item.id)} className={`rounded-lg px-3 py-2 ${kitchen.workspaceId === item.id ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}>초대받은 레시피함{ kitchen.invitations.length > 1 ? ` ${index + 1}` : ''}</button>)}</div>
      {own ? <form onSubmit={invite} className="space-y-2">
        {kitchen.members.length > 0 && <p className="text-xs text-slate-500 break-all">공유 계정: {kitchen.members.join(', ')}</p>}
        <input required type="email" aria-label="함께 쓸 구글 계정" value={email} onChange={event => setEmail(event.target.value)} placeholder="상대방 구글 이메일" className="w-full border rounded-lg p-3" />
        <button disabled={busy || !kitchen.ready} className="w-full bg-slate-900 text-white rounded-lg py-3 disabled:opacity-40">{busy ? '등록 중…' : kitchen.members.length ? '공유 상대 변경' : '함께 쓸 계정 추가'}</button>
        <p className="text-xs text-slate-400">같은 레시피·유튜브·메모를 함께 편집. 기존 개인 데이터는 유지.</p>
      </form> : <p className="text-xs text-slate-500">상대방과 같은 레시피·유튜브·메모 사용 중</p>}
      <p role="status" className="text-xs text-slate-500">{message || kitchen.sharingError}</p>
    </div>
  </details>;
}
