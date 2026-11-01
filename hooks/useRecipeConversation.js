import { useEffect, useRef, useState } from 'react';
import { converseRecipe } from '../services/geminiService';

export default function useRecipeConversation(scopeId) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const epoch = useRef(0);
  const locked = useRef(false);
  const reset = () => { epoch.current++; locked.current = false; setMessages([]); setInput(''); setBusy(false); setError(''); };
  useEffect(() => { reset(); return () => { epoch.current++; locked.current = false; }; }, [scopeId]);

  const request = async history => {
    if (locked.current || !scopeId) return;
    locked.current = true; setBusy(true); setError('');
    const version = epoch.current;
    try {
      const reply = await converseRecipe(history);
      if (version !== epoch.current) return;
      setMessages(previous => [...previous, { id: crypto.randomUUID(), role: 'model', ...reply }]);
    } catch {
      if (version === epoch.current) setError('답변을 받지 못했습니다. 다시 시도해주세요.');
    } finally {
      if (version === epoch.current) { locked.current = false; setBusy(false); }
    }
  };
  const send = async (value = input) => {
    const text = value.trim();
    if (!text || locked.current || !scopeId) return;
    const next = [...messages, { id: crypto.randomUUID(), role: 'user', text }];
    setMessages(next); setInput('');
    await request(next);
  };
  const retry = async () => { if (messages.at(-1)?.role === 'user') await request(messages); };
  return { messages, input, setInput, busy, error, send, retry, reset };
}
