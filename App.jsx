import React, { useState, useEffect } from 'react';
import { UtensilsCrossed, Flame, Soup, Wind, Microwave, ChefHat, Sparkles, Ban, ClipboardList, Youtube, Settings } from 'lucide-react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import useSharedKitchen from './hooks/useSharedKitchen';
import SettingsDialog from './components/SettingsDialog';
import YoutubeRecipes from './components/YoutubeRecipes';
import RecipeWorkspace from './components/RecipeWorkspace';
import { generateRecipe } from './services/geminiService';
import { auth, googleProvider } from './src/services/firebaseClient';

const getDefaultIngredients = () => ([
  { id: 1, name: '계란', expiryDate: '2026-02-05', selected: false },
  { id: 2, name: '스팸', expiryDate: '2026-01-27', selected: false },
  { id: 3, name: '양파', expiryDate: '2026-02-15', selected: false },
]);

const App = () => {
  const TOOL_DEFINITIONS = [
    { id: 'no-tools', name: '조리도구 없이', icon: <Ban className="w-5 h-5" /> },
    { id: 'pan', name: '프라이팬', icon: <Flame className="w-5 h-5" /> },
    { id: 'pot', name: '냄비', icon: <Soup className="w-5 h-5" /> },
    { id: 'airfryer', name: '에어프라이어', icon: <Wind className="w-5 h-5" /> },
    { id: 'microwave', name: '전자레인지', icon: <Microwave className="w-5 h-5" /> },
    { id: 'oven', name: '오븐', icon: <ChefHat className="w-5 h-5" /> },
  ];

  const [user, setUser] = useState(null);
  const [isAuthInitialized, setIsAuthInitialized] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const [ingredients, setIngredients] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fridge_ingredients');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Failed to parse ingredients', e);
        }
      }
    }
    return getDefaultIngredients();
  });

  const [savedRecipes, setSavedRecipes] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('frichef_recipes');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Failed to parse saved recipes', e);
        }
      }
    }
    return [];
  });
  const [feedbacks, setFeedbacks] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('frichef_feedbacks');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Failed to parse feedbacks', e);
        }
      }
    }
    return [];
  });
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');

  const [tools, setTools] = useState(() => {
    let savedSelection = {};
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fridge_tools');
      if (saved) {
        try {
          savedSelection = JSON.parse(saved);
        } catch (e) {
          console.error('Failed to parse tools', e);
        }
      }
    }

    return TOOL_DEFINITIONS.map(def => ({
      ...def,
      selected: savedSelection[def.id] ?? (def.id === 'no-tools'),
    }));
  });

  const [recipeResult, setRecipeResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const kitchen = useSharedKitchen(user, setIngredients, setSavedRecipes);
  const isRemoteDataLoading = kitchen.loading;
  const hasLoadedRemoteData = kitchen.ready;
  const remoteSyncError = kitchen.error;
  const [activeTab, setActiveTab] = useState('saved');
  const [ingredientText, setIngredientText] = useState('');
  const [openRecipe, setOpenRecipe] = useState(null);
  const [recipeSearch, setRecipeSearch] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, currentUser => {
      setUser(currentUser);
      setIsAuthInitialized(true);
      if (currentUser) {
        setAuthError(null);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    localStorage.setItem('fridge_ingredients', JSON.stringify(ingredients));
  }, [ingredients]);

  useEffect(() => {
    localStorage.setItem('frichef_recipes', JSON.stringify(savedRecipes));
  }, [savedRecipes]);

  useEffect(() => {
    localStorage.setItem('frichef_feedbacks', JSON.stringify(feedbacks));
  }, [feedbacks]);

  useEffect(() => {
    const selectionMap = tools.reduce((acc, tool) => ({
      ...acc,
      [tool.id]: tool.selected,
    }), {});
    localStorage.setItem('fridge_tools', JSON.stringify(selectionMap));
  }, [tools]);

  const handleToggleTool = id => {
    setTools(prev => {
      const target = prev.find(tool => tool.id === id);
      const nextSelected = target ? !target.selected : true;

      return prev.map(tool => {
        if (tool.id === id) {
          return { ...tool, selected: nextSelected };
        }

        if (nextSelected) {
          if (id === 'no-tools' || tool.id === 'no-tools') {
            return { ...tool, selected: false };
          }
        }

        return tool;
      });
    });
  };

  const handleDeleteSavedRecipe = async id => {
    try { await kitchen.mutateRecipes(previous => previous.filter(recipe => recipe.id !== id)); }
    catch { alert('삭제 실패 · 레시피함 연결 상태 확인'); }
  };
  const handleGenerateRecipe = async () => {
    const selectedIngs = ingredientText.split(/[,，\n]/).map(value => value.trim()).filter(Boolean);
    const selectedTools = [];


    if (selectedIngs.length === 0) {
      alert('재료를 최소 하나 이상 입력해주세요!');
      return;
    }

    setActiveTab('recipe');
    setIsLoading(true);
    setRecipeResult(null);

    try {
      const result = await generateRecipe(selectedIngs, selectedTools);
      setRecipeResult(result);
      setOpenRecipe({ ...result, ingredients: result.ingredients || selectedIngs, notes: '' });
    } catch (error) {
      setRecipeResult({ error: '레시피를 생성하는 도중 문제가 발생했습니다.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveRecipe = async (draft, options = {}) => {
    const record = {
      ...draft,
      id: draft.id ?? crypto.randomUUID(),
      createdAt: draft.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await kitchen.mutateRecipes(previous => {
        if (options.expectedRecipe && JSON.stringify(previous.find(recipe => recipe.id === draft.id)) !== JSON.stringify(options.expectedRecipe)) throw new Error('다른 기기에서 수정된 레시피');
        if (draft.id && !previous.some(recipe => recipe.id === draft.id)) throw new Error('삭제된 레시피');
        return draft.id ? previous.map(recipe => recipe.id === draft.id ? record : recipe) : [record, ...previous];
      });
    } catch {
      alert('저장 실패 · 연결 상태 확인 후 다시 저장');
      return false;
    }
    setOpenRecipe(options.keepOpen ? record : null);
    setRecipeResult(null);
    if (draft.type !== 'youtube') setActiveTab('saved');
    return true;
  };

  const handleSubmitFeedback = () => {
    if (!feedbackComment.trim()) {
      alert('피드백 내용을 입력해주세요.');
      return;
    }

    const feedbackEntry = {
      id: Date.now(),
      rating: feedbackRating,
      comment: feedbackComment.trim(),
      createdAt: new Date().toLocaleString('ko-KR'),
    };

    setFeedbacks(prev => [feedbackEntry, ...prev]);
    setFeedbackComment('');
  };

  const handleDeleteFeedback = id => {
    setFeedbacks(prev => prev.filter(entry => entry.id !== id));
  };

  const handleLogin = async () => {
    try {
      setAuthError(null);
      setIsAuthenticating(true);
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Google login failed', error);
      setAuthError('로그인에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed', error);
      setAuthError('로그아웃에 실패했습니다.');
    }
  };

  const canGenerateRecipe = ingredientText.split(/[,，\n]/).some(value => value.trim()) && !isLoading;
  const displayName = user?.displayName || user?.email || '숩숩';

  const myRecipes = savedRecipes.filter(recipe => recipe.type !== 'youtube');
  const videoRecipes = savedRecipes.filter(recipe => recipe.type === 'youtube');
  const renderSavedSection = () => (
    <section className="bg-white border border-slate-100 rounded-3xl p-4 space-y-4 shadow-sm">
      <div className="flex items-center justify-between px-1">
        <h2 className="font-bold text-slate-700 text-sm">내 레시피 · {myRecipes.length}</h2>
        {remoteSyncError && (
          <span className="text-[10px] text-rose-500 font-semibold">Firebase 동기화 실패</span>
        )}
      </div>
      <label className="block"><span className="sr-only">내 레시피 검색</span><input value={recipeSearch} onChange={e => setRecipeSearch(e.target.value)} placeholder="요리 이름이나 재료 검색" className="w-full border rounded-xl p-3" /></label>
      {isRemoteDataLoading && <p role="status" className="text-sm text-slate-500">저장된 레시피를 불러오고 있습니다.</p>}
      {myRecipes.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">저장한 레시피 없음</p>
      ) : (
        <div className="space-y-3">
          {myRecipes.filter(recipe => [recipe.dishName, ...(recipe.ingredients || [])].join(' ').toLowerCase().includes(recipeSearch.toLowerCase())).map(recipe => (
            <div key={recipe.id} className="border border-slate-100 rounded-2xl p-4 bg-slate-50/60">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[11px] text-slate-400">{new Date(recipe.createdAt).toLocaleString()}</p>
                  <button onClick={() => setOpenRecipe(recipe)} className="text-left font-bold text-slate-800 text-lg py-2">{recipe.dishName} →</button>
                </div>
                <button
                  onClick={() => { if (window.confirm('이 레시피를 삭제하시겠습니까?')) handleDeleteSavedRecipe(recipe.id); }}
                  className="text-[10px] text-rose-500 border border-rose-200 px-2 py-0.5 rounded-full"
                >
                  삭제
                </button>
              </div>
              <p className="text-[12px] text-slate-500 mt-2">
                재료: {recipe.ingredients && recipe.ingredients.length > 0 ? recipe.ingredients.join(', ') : '정보 없음'}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );

  const renderTabContent = () => activeTab === 'recipe' ? (
    <section className="space-y-5">
      <div><p className="text-sm text-amber-700 font-bold">AI 셰프와 함께</p><h2 className="text-2xl font-black mt-2">오늘은 무엇을 만들까요?</h2><p className="text-sm text-slate-500 mt-2">재료를 입력하고, 만들어진 레시피를 내 입맛에 맞게 수정해보세요.</p></div>
      <label className="block space-y-2"><span className="font-bold">사용할 재료</span><textarea value={ingredientText} onChange={e => setIngredientText(e.target.value)} rows={3} placeholder="계란 2개, 양파 반 개, 밥 1공기" className="w-full rounded-2xl border p-4 text-base" /></label>
      <button disabled={!canGenerateRecipe} onClick={handleGenerateRecipe} className="w-full bg-slate-900 text-white rounded-2xl p-4 font-bold disabled:opacity-40">{isLoading ? '레시피를 만들고 있습니다…' : 'AI 레시피 생성'}</button>
      {recipeResult?.error && <p role="alert" className="text-rose-600">{recipeResult.error} 다시 생성해주세요.</p>}
    </section>
  ) : activeTab === 'youtube' ? <YoutubeRecipes recipes={videoRecipes} onSave={handleSaveRecipe} onDelete={handleDeleteSavedRecipe} /> : renderSavedSection();

  if (!isAuthInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 to-slate-700 text-white">
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3 text-2xl font-black">
            <ChefHat className="w-7 h-7" />
            frichef
          </div>
          <p className="text-sm text-slate-200">주방을 불러오는 중입니다...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0c111d] via-[#131c2b] to-[#1b2435] flex items-center justify-center px-6">
        <div className="max-w-md w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 space-y-6 text-white shadow-2xl">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/10 text-xs font-bold tracking-[0.3em] uppercase text-amber-200">
              <ChefHat className="w-4 h-4" /> ai kitchen
            </div>
            <h1 className="text-3xl font-black tracking-tight">frichef</h1>
            <p className="text-sm text-slate-200 leading-relaxed">
              냉장고 속 재료와 도구를 선택하면 frichef가 한국어 레시피를 만들어 드립니다.
              Google 로그인 후 나만의 AI 셰프를 만나보세요.
            </p>
          </div>
          <div className="space-y-3">
            <button
              onClick={handleLogin}
              disabled={isAuthenticating}
              className={`w-full py-3 rounded-2xl font-bold flex items-center justify-center gap-2 text-slate-900 ${isAuthenticating ? 'bg-slate-200' : 'bg-white hover:bg-amber-100'} transition-colors`}
            >
              {isAuthenticating ? '로그인 중...' : 'Google 계정으로 로그인'}
            </button>
            {authError && <p className="text-xs text-rose-300 text-center">{authError}</p>}
            <p className="text-[11px] text-slate-300 text-center">
              로그인 시 Google 계정 정보와 냉장고 리스트를 안전하게 동기화합니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F6FB] pb-10 max-w-lg mx-auto shadow-2xl shadow-slate-200">
      <header className="fixed top-0 left-0 right-0 z-40 bg-[#F4F6FB]/95 backdrop-blur-md border-b border-white/60 px-4 py-3">
        <div className="max-w-lg mx-auto flex justify-between items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="bg-slate-900 p-2 rounded-xl shadow-lg shadow-slate-200">
              <UtensilsCrossed className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-slate-800">frichef</h1>
              <p className="text-[11px] text-slate-500">나만의 레시피 노트</p>
            </div>
          </div>
          <button aria-label="설정" onClick={() => setShowSettings(true)} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"><Settings className="w-5 h-5" /></button>
        </div>
      </header>

      <main className="p-4 pt-[90px] pb-32 space-y-5">
        {remoteSyncError && <p role="alert" className="text-sm text-rose-600">{remoteSyncError}</p>}
        {isRemoteDataLoading ? <p role="status" className="text-center text-slate-500 py-10">내 레시피를 불러오고 있습니다…</p> : hasLoadedRemoteData ? renderTabContent() : null}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <nav aria-label="주 메뉴" className="max-w-lg mx-auto grid grid-cols-3">
          {[['saved', '내 레시피', ClipboardList], ['youtube', '유튜브 레시피', Youtube], ['recipe', '레시피 만들기', Sparkles]].map(([tab, title, Icon]) => <button key={tab} aria-current={activeTab === tab ? 'page' : undefined} onClick={() => setActiveTab(tab)} className={`py-4 flex flex-col items-center gap-1 text-xs font-bold ${activeTab === tab ? 'text-slate-900' : 'text-slate-400'}`}><Icon className="w-5 h-5" />{title}</button>)}
        </nav>
      </footer>
      {openRecipe && <RecipeWorkspace key={openRecipe.id || 'draft'} recipe={openRecipe} onClose={() => setOpenRecipe(null)} onSave={handleSaveRecipe} />}

      {showSettings && <SettingsDialog user={user} kitchen={kitchen} onClose={() => setShowSettings(false)} onLogout={handleLogout} error={authError} />}
    </div>
  );
};

export default App;
