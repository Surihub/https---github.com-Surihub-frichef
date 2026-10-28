import { useEffect, useState } from 'react';
import { collection, doc, getDoc, onSnapshot, query, runTransaction, setDoc, where } from 'firebase/firestore';
import { db } from '../src/services/firebaseClient';

export default function useSharedKitchen(user, setIngredients, setRecipes) {
  const [workspaceId, setWorkspaceId] = useState(null);
  const [invitations, setInvitations] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [sharingError, setSharingError] = useState('');
  const [switchVersion, setSwitchVersion] = useState(0);

  useEffect(() => {
    setWorkspaceId(null); setInvitations([]); setMembers([]); setReady(false); setError(null); setSharingError('');
    if (!user) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    const initialize = async () => {
      try {
        const ownRef = doc(db, 'users', user.uid);
        const own = await getDoc(ownRef);
        if (!active) return;
        if (!own.exists()) await setDoc(ownRef, { recipes: [], ingredients: [], sharedWith: [] });
        if (active) setWorkspaceId(user.uid);
      } catch {
        if (active) { setError('레시피함 연결 실패 · 새로고침 후 다시 시도'); setLoading(false); }
      }
    };
    initialize();
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!user?.email) return;
    const invited = query(collection(db, 'users'), where('sharedWith', 'array-contains', user.email.toLowerCase()));
    return onSnapshot(invited, snapshot => {
      setInvitations(snapshot.docs.filter(item => item.id !== user.uid).map(item => ({ id: item.id })));
      setSharingError('');
    }, () => setSharingError('공유 기능 연결 실패 · Firestore 공유 규칙 적용 필요'));
  }, [user]);

  useEffect(() => {
    if (!user || !workspaceId) return;
    setLoading(true); setReady(false); setError(null);
    return onSnapshot(doc(db, 'users', workspaceId), snapshot => {
      if (!snapshot.exists()) { setError('레시피함을 찾을 수 없음'); setLoading(false); return; }
      const data = snapshot.data();
      setIngredients(previous => JSON.stringify(previous) === JSON.stringify(data.ingredients || []) ? previous : data.ingredients || []);
      setRecipes(previous => JSON.stringify(previous) === JSON.stringify(data.recipes || []) ? previous : data.recipes || []);
      setMembers(data.sharedWith || []);
      setReady(true); setLoading(false); setError(null);
    }, () => { setReady(false); setLoading(false); setError('레시피함 접근 실패 · 공유 권한 또는 연결 상태 확인'); });
  }, [user, workspaceId, switchVersion, setIngredients, setRecipes]);

  const selectWorkspace = id => {
    setReady(false); setLoading(true); setWorkspaceId(id); setSwitchVersion(value => value + 1);
  };
  const mutateField = async (field, transform) => {
    if (!user || !workspaceId || !ready || loading) throw new Error('레시피함 연결 대기 중');
    await runTransaction(db, async transaction => {
      const ref = doc(db, 'users', workspaceId);
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists()) throw new Error('레시피함 없음');
      transaction.update(ref, { [field]: transform(snapshot.data()[field] || []) });
    });
  };
  const mutateRecipes = transform => mutateField('recipes', transform);
  const mutateIngredients = transform => mutateField('ingredients', transform);
  const invite = async email => {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error('구글 계정 이메일 확인');
    if (!user || workspaceId !== user.uid || !ready) throw new Error('내 레시피함에서 초대 가능');
    if (normalized === user.email?.toLowerCase()) throw new Error('상대방 이메일 입력');
    await setDoc(doc(db, 'users', user.uid), { sharedWith: [normalized] }, { merge: true });
  };
  return { workspaceId, invitations, members, loading, ready, error, sharingError, selectWorkspace, mutateRecipes, mutateIngredients, invite };
}
