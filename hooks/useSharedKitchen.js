import { useEffect, useRef, useState } from 'react';
import { collection, doc, onSnapshot, query, runTransaction, where } from 'firebase/firestore';
import { db } from '../src/services/firebaseClient';
import { mergeKitchenItems, sharedWorkspaceId } from '../services/sharedKitchen.js';

export default function useSharedKitchen(user, setIngredients, setRecipes) {
  const [workspaceId, setWorkspaceId] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const connection = useRef(null);

  useEffect(() => {
    setWorkspaceId(null); setMembers([]); setReady(false); setError(null);
    setIngredients([]); setRecipes([]);
    connection.current = null;
    if (!user) { setLoading(false); return; }
    setLoading(true);
    let active = true;
    let ownData = null;
    let invitations = null;
    let selectedId = null;
    let generation = 0;
    let unsubscribeWorkspace = () => {};
    const ownRef = doc(db, 'users', user.uid);
    const fail = message => {
      if (!active) return;
      generation += 1;
      selectedId = null;
      unsubscribeWorkspace();
      connection.current = null;
      setReady(false); setLoading(false); setError(message);
      setIngredients([]); setRecipes([]);
    };
    const connect = async () => {
      if (!active || !ownData || invitations === null) return;
      const id = sharedWorkspaceId(user.uid, ownData.sharedWith, invitations);
      if (id === selectedId) return;
      selectedId = id;
      const version = ++generation;
      unsubscribeWorkspace();
      connection.current = null;
      setWorkspaceId(id); setReady(false); setLoading(true); setError(null);
      setIngredients([]); setRecipes([]);
      try {
        if (id !== user.uid) {
          // Moving data atomically prevents deleted family recipes from being
          // imported again from a stale personal copy on the next login.
          await runTransaction(db, async transaction => {
            const sharedRef = doc(db, 'users', id);
            const shared = await transaction.get(sharedRef);
            const own = await transaction.get(ownRef);
            if (!active || version !== generation) throw new Error('연결 변경됨');
            if (!shared.exists() || !own.exists()) throw new Error('레시피함 없음');
            const source = own.data();
            if (!source.recipes?.length && !source.ingredients?.length) return;
            transaction.update(sharedRef, {
              recipes: mergeKitchenItems(shared.data().recipes, source.recipes, user.uid),
              ingredients: mergeKitchenItems(shared.data().ingredients, source.ingredients, user.uid),
            });
            transaction.update(ownRef, { recipes: [], ingredients: [] });
          });
        }
        if (!active || version !== generation) return;
        unsubscribeWorkspace = onSnapshot(doc(db, 'users', id), snapshot => {
          if (!active || version !== generation) return;
          if (!snapshot.exists()) { fail('가족 레시피함을 찾을 수 없습니다.'); return; }
          const data = snapshot.data();
          setIngredients(data.ingredients || []);
          setRecipes(data.recipes || []);
          setMembers(data.sharedWith || []);
          if (connection.current?.uid !== user.uid || connection.current.id !== id) connection.current = { uid: user.uid, id };
          setReady(true); setLoading(false); setError(null);
        }, () => {
          if (active && version === generation) fail('가족 레시피함 연결 실패 · 공유 권한과 연결 상태를 확인해주세요.');
        });
      } catch {
        if (active && version === generation) fail('가족 레시피 통합 실패 · 새로고침 후 다시 시도해주세요.');
      }
    };

    let unsubscribeOwn = () => {};
    let unsubscribeInvitations = () => {};
    const initialize = async () => {
      try {
        await runTransaction(db, async transaction => {
          const own = await transaction.get(ownRef);
          if (!own.exists()) transaction.set(ownRef, { recipes: [], ingredients: [], sharedWith: [] });
        });
        if (!active) return;
        unsubscribeOwn = onSnapshot(ownRef, snapshot => {
          if (!active) return;
          if (!snapshot.exists()) { fail('레시피함을 찾을 수 없습니다.'); return; }
          ownData = snapshot.data();
          connect();
        }, () => { ownData = null; fail('레시피함 연결 실패 · 새로고침 후 다시 시도해주세요.'); });
        const invited = query(collection(db, 'users'), where('sharedWith', 'array-contains', user.email.toLowerCase()));
        unsubscribeInvitations = onSnapshot(invited, snapshot => {
          if (!active) return;
          invitations = snapshot.docs.filter(item => item.id !== user.uid).map(item => item.id);
          connect();
        }, () => { invitations = null; fail('가족 공유 연결 실패 · Firestore 공유 규칙과 이메일 인증을 확인해주세요.'); });
      } catch {
        fail('레시피함 연결 실패 · 새로고침 후 다시 시도해주세요.');
      }
    };
    initialize();
    return () => {
      active = false; generation += 1;
      connection.current = null;
      unsubscribeOwn(); unsubscribeInvitations(); unsubscribeWorkspace();
    };
  }, [user, setIngredients, setRecipes]);

  const mutateField = async (field, transform) => {
    const current = connection.current;
    if (!user || current?.uid !== user.uid) throw new Error('레시피함 연결 대기 중');
    await runTransaction(db, async transaction => {
      const ref = doc(db, 'users', current.id);
      const snapshot = await transaction.get(ref);
      if (connection.current !== current) throw new Error('레시피함 연결 변경됨');
      if (!snapshot.exists()) throw new Error('레시피함 없음');
      transaction.update(ref, { [field]: transform(snapshot.data()[field] || []) });
    });
  };
  const invite = async email => {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error('구글 계정 이메일을 확인해주세요.');
    if (!user || connection.current?.uid !== user.uid || connection.current.id !== user.uid) throw new Error('가족 레시피함을 만든 계정에서 초대할 수 있습니다.');
    if (normalized === user.email?.toLowerCase()) throw new Error('상대방 이메일을 입력해주세요.');
    const current = connection.current;
    await runTransaction(db, async transaction => {
      const ref = doc(db, 'users', user.uid);
      const snapshot = await transaction.get(ref);
      if (connection.current !== current || !snapshot.exists()) throw new Error('공유 연결 상태를 확인해주세요.');
      const previous = snapshot.data().sharedWith || [];
      if (previous.includes(normalized)) throw new Error('이미 추가된 계정입니다.');
      transaction.update(ref, { sharedWith: [...previous, normalized] });
    });
  };
  const removeMember = async email => {
    const current = connection.current;
    if (!user || current?.uid !== user.uid || current.id !== user.uid) throw new Error('가족 레시피함을 만든 계정에서 해제할 수 있습니다.');
    await runTransaction(db, async transaction => {
      const ref = doc(db, 'users', user.uid);
      const snapshot = await transaction.get(ref);
      if (connection.current !== current || !snapshot.exists()) throw new Error('공유 연결 상태를 확인해주세요.');
      transaction.update(ref, { sharedWith: (snapshot.data().sharedWith || []).filter(member => member !== email) });
    });
  };
  return { workspaceId, members, loading, ready, error, mutateRecipes: transform => mutateField('recipes', transform), mutateIngredients: transform => mutateField('ingredients', transform), invite, removeMember };
}
