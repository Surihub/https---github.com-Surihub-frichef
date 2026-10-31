import React, { useState } from 'react';
import { UserRound, UserRoundPlus, X } from 'lucide-react';

export default function KitchenSharing({ user, kitchen }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const own = kitchen.workspaceId === user.uid;
  const reportError = error => {
    setFailed(true);
    setMessage(error.code === 'permission-denied' ? '공유 권한이 적용되지 않았습니다. Firestore 공유 규칙을 확인해주세요.' : error.message.includes('계정') || error.message.includes('이메일') || error.message.includes('상태') ? error.message : '공유 설정을 저장하지 못했습니다. 연결 상태를 확인해주세요.');
  };
  const invite = async event => {
    event.preventDefault(); setBusy(true); setMessage(''); setFailed(false);
    try { await kitchen.invite(email); setEmail(''); setMessage('계정을 추가했습니다. 상대방이 로그인하면 같은 목록이 표시됩니다.'); }
    catch (error) { reportError(error); }
    finally { setBusy(false); }
  };
  const remove = async member => {
    if (!window.confirm(`${member} 계정의 공유를 해제하시겠습니까? 저장된 레시피와 갈 곳은 남아 있습니다.`)) return;
    setBusy(true); setMessage(''); setFailed(false);
    try { await kitchen.removeMember(member); setMessage('공유를 해제했습니다.'); }
    catch (error) { reportError(error); }
    finally { setBusy(false); }
  };
  return <section aria-labelledby="sharing-title" className="bg-transparent py-1 space-y-4">
    <header><h3 id="sharing-title" className="font-bold text-base text-[#ededE8]">공유 계정</h3><p className="text-xs leading-relaxed text-[#979d97] mt-1">레시피·유튜브·갈 곳·메모를 함께 사용합니다.</p></header>
    <div className="flex items-center gap-2.5 border-b border-[#35393b]/70 pb-3"><UserRound aria-hidden="true" className="w-4 h-4 text-[#858c85] shrink-0" /><p className="text-xs text-[#b3b7b1] break-all min-w-0 flex-1">{user.email}</p><span className="text-[11px] text-[#979d97] shrink-0">{own ? '소유자' : '내 계정'}</span></div>
    {kitchen.members.length > 0 ? <ul className="divide-y divide-[#303436]">{kitchen.members.map(member => <li key={member} className="flex items-center gap-2 py-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" /><span className="text-xs text-[#d3d7d0] break-all min-w-0 flex-1">{member}</span>{own && <button type="button" title="공유 해제" aria-label={`${member} 공유 해제`} disabled={busy || !kitchen.ready} onClick={() => remove(member)} className="w-8 h-8 rounded-full flex items-center justify-center text-[#858c85] hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40 shrink-0"><X className="w-4 h-4" /></button>}</li>)}</ul> : <p className="text-xs text-[#858c85]">추가된 공유 계정이 없습니다.</p>}
    {own ? <form onSubmit={invite} className="space-y-2.5">
      <label className="block text-xs font-semibold text-[#b3b7b1]" htmlFor="sharing-email">구글 계정 추가</label>
      <input id="sharing-email" required type="email" autoComplete="email" disabled={busy} value={email} onChange={event => setEmail(event.target.value)} placeholder="example@gmail.com" className="w-full min-w-0 border border-[#35393b] bg-[#1b1e20] rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
      <button disabled={busy || !kitchen.ready || !email.trim()} className="w-full bg-[#414744] text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2"><UserRoundPlus aria-hidden="true" className="w-4 h-4" />{busy ? '저장 중…' : '공유 계정 추가'}</button>
      <p className="text-[11px] leading-relaxed text-[#858c85]">기존 공유 계정은 유지됩니다. 계정을 하나씩 더 추가할 수 있습니다.</p>
    </form> : <p className="text-xs text-[#979d97]">계정 추가와 해제는 레시피함 소유자가 관리합니다.</p>}
    {(message || kitchen.error) && <p role={failed || kitchen.error ? 'alert' : 'status'} className={`text-xs leading-relaxed ${failed || kitchen.error ? 'text-rose-600' : 'text-emerald-700'}`}>{message || kitchen.error}</p>}
  </section>;
}
