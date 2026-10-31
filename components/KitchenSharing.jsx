import React, { useState } from 'react';

export default function KitchenSharing({ user, kitchen }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const own = kitchen.workspaceId === user.uid;
  const invite = async event => {
    event.preventDefault(); setBusy(true); setMessage('');
    try { await kitchen.invite(email); setEmail(''); setMessage('가족 공유가 등록되었습니다. 상대방이 로그인하면 자동으로 연결됩니다.'); }
    catch (error) { setMessage(error.message.includes('이메일') || error.message.includes('계정에서') ? error.message : '초대 실패 · 연결 상태와 Firestore 공유 규칙을 확인해주세요.'); }
    finally { setBusy(false); }
  };
  return <details className="rounded-2xl border bg-white p-3 text-sm">
    <summary className="cursor-pointer font-bold">{own && !kitchen.members.length ? '가족과 레시피함 함께 쓰기' : '가족 레시피함'}</summary>
    <div className="space-y-3 pt-3">
      <p className="text-xs text-slate-500 break-all">{user.email}</p>
      {own ? <form onSubmit={invite} className="space-y-2">
        {kitchen.members.length > 0 && <p className="text-xs text-slate-500 break-all">공유 계정: {kitchen.members.join(', ')}</p>}
        <input required type="email" aria-label="함께 쓸 구글 계정" value={email} onChange={event => setEmail(event.target.value)} placeholder="상대방 구글 이메일" className="w-full border rounded-lg p-3" />
        <button disabled={busy || !kitchen.ready} className="w-full bg-slate-900 text-white rounded-lg py-3 disabled:opacity-40">{busy ? '등록 중…' : kitchen.members.length ? '공유 상대 변경' : '함께 쓸 계정 추가'}</button>
        <p className="text-xs text-slate-400">가족의 기존 레시피도 하나로 합쳐집니다. 모든 레시피·유튜브·메모의 추가, 수정, 삭제가 서로 바로 반영됩니다.</p>
      </form> : <p className="text-xs text-slate-500">가족과 하나의 저장소를 사용합니다. 모든 레시피·유튜브·메모가 함께 저장되고, 변경 내용이 바로 반영됩니다.</p>}
      <p role="status" className="text-xs text-slate-500">{message || kitchen.error}</p>
    </div>
  </details>;
}
