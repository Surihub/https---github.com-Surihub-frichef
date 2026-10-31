import React, { useState, useEffect } from 'react';
import { UtensilsCrossed, Flame, Soup, Wind, Microwave, ChefHat, Sparkles, Ban, ClipboardList, Youtube, Settings, MapPin } from 'lucide-react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import useSharedKitchen from './hooks/useSharedKitchen';
import LinkIcon from './components/LinkIcon';
import './components/theme.css';
import SettingsDialog from './components/SettingsDialog';
import YoutubeRecipes from './components/YoutubeRecipes';
import SavedPlaces from './components/SavedPlaces';
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
        const current = previous.find(recipe => recipe.id === draft.id);
        if (options.expectedRecipe && JSON.stringify(current) !== JSON.stringify(options.expectedRecipe)) throw new Error('다른 기기에서 수정된 레시피');
        if (Object.hasOwn(options, 'expectedNotes') && (current?.notes || '') !== options.expectedNotes) throw new Error('다른 기기에서 수정된 레시피');
        if (draft.id && !previous.some(recipe => recipe.id === draft.id)) throw new Error('삭제된 레시피');
        const saved = options.notesOnly ? { ...current, notes: draft.notes, updatedAt: record.updatedAt } : record;
        return draft.id ? previous.map(recipe => recipe.id === draft.id ? saved : recipe) : [record, ...previous];
      });
    } catch (error) {
      alert(error.message === '다른 기기에서 수정된 레시피' ? '가족이 이 레시피를 수정했습니다. 최신 내용을 확인한 후 다시 저장해주세요.' : '저장 실패 · 연결 상태 확인 후 다시 저장');
      return false;
    }
    if (draft.type !== 'place') setOpenRecipe(options.keepOpen ? record : null);
    setRecipeResult(null);
    if (draft.type === 'place') setActiveTab('places');
    else if (draft.type !== 'youtube') setActiveTab('saved');
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

  const myRecipes = savedRecipes.filter(recipe => !['youtube', 'place'].includes(recipe.type));
  const places = savedRecipes.filter(recipe => recipe.type === 'place');
  const videoRecipes = savedRecipes.filter(recipe => recipe.type === 'youtube');
  const currentOpenRecipe = openRecipe?.id ? savedRecipes.find(recipe => recipe.id === openRecipe.id) : openRecipe;
  const renderSavedSection = () => (
    <section className="recipe-library">
      <header className="collection-heading"><h2>내 레시피</h2><span>{String(myRecipes.length).padStart(2, '0')}</span></header>
      <label className="recipe-search"><span className="sr-only">내 레시피 검색</span><input value={recipeSearch} onChange={e => setRecipeSearch(e.target.value)} placeholder="요리 이름이나 재료 검색" /></label>
      {isRemoteDataLoading && <p role="status" className="muted-copy">저장된 레시피를 불러오고 있습니다.</p>}
      {!myRecipes.length && <p className="empty-copy">저장한 레시피가 없습니다.</p>}
      <div>{myRecipes.filter(recipe => [recipe.dishName, ...(recipe.ingredients || [])].join(' ').toLowerCase().includes(recipeSearch.toLowerCase())).map(recipe => (
        <article key={recipe.id} className="recipe-row">
          <div className="recipe-row-heading"><button onClick={() => setOpenRecipe(recipe)} className="recipe-row-title">{recipe.dishName}</button><button aria-label={`${recipe.dishName} 삭제`} onClick={() => { if (window.confirm('이 레시피를 삭제하시겠습니까?')) handleDeleteSavedRecipe(recipe.id); }} className="quiet-icon delete-icon"><LinkIcon name="trash" /></button></div>
          <p className="recipe-row-date">{new Date(recipe.createdAt).toLocaleDateString('ko-KR')}</p>
          <p className="recipe-row-ingredients">{recipe.ingredients?.join(', ') || '재료 정보 없음'}</p>
        </article>
      ))}</div>
    </section>
  );

  const renderTabContent = () => activeTab === 'recipe' ? (
    <section className="space-y-5">
      <div><h2 className="text-2xl font-black mt-2">오늘은 무엇을 만들까요?</h2><p className="text-sm text-[#979d97] mt-2">재료를 입력하고, 만들어진 레시피를 내 입맛에 맞게 수정해보세요.</p></div>
      <label className="block space-y-2"><span className="font-bold">사용할 재료</span><textarea value={ingredientText} onChange={e => setIngredientText(e.target.value)} rows={3} placeholder="계란 2개, 양파 반 개, 밥 1공기" className="w-full rounded-2xl border p-4 text-base" /></label>
      <button disabled={!canGenerateRecipe} onClick={handleGenerateRecipe} className="w-full bg-[#e4e6e0] text-[#17191a] rounded-2xl p-4 font-bold disabled:opacity-40">{isLoading ? '레시피를 만들고 있습니다…' : 'AI 레시피 생성'}</button>
      {recipeResult?.error && <p role="alert" className="text-rose-600">{recipeResult.error} 다시 생성해주세요.</p>}
    </section>
  ) : activeTab === 'places' ? <SavedPlaces places={places} onSave={handleSaveRecipe} onDelete={handleDeleteSavedRecipe} /> : activeTab === 'youtube' ? <YoutubeRecipes recipes={videoRecipes} onSave={handleSaveRecipe} onDelete={handleDeleteSavedRecipe} /> : renderSavedSection();

  if (!isAuthInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#141617] text-white">
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3 text-2xl font-black">
            <ChefHat className="w-7 h-7" />
            뭐먹지?
          </div>
          <p className="text-sm text-slate-200">주방을 불러오는 중입니다...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#141617] flex items-center justify-center px-6">
        <div className="max-w-md w-full py-8 space-y-8 text-[#eeeee8]">
          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-tight">뭐먹지?</h1>
            <p className="text-sm text-slate-200 leading-relaxed">
              냉장고 속 재료를 입력하면 한국어 레시피를 만들어 드립니다.
              Google 로그인 후 나만의 AI 셰프를 만나보세요.
            </p>
          </div>
          <div className="space-y-3">
            <button
              onClick={handleLogin}
              disabled={isAuthenticating}
              className={`w-full py-3 rounded-2xl font-bold flex items-center justify-center gap-2 text-[#141617] ${isAuthenticating ? 'bg-[#979d97]' : 'bg-[#e4e6e0] hover:bg-white'} transition-colors`}
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
    <div className="app-shell">
      <header className="app-header"><div className="app-header-inner"><h1>뭐먹지?</h1><button aria-label="설정" onClick={() => setShowSettings(true)} className="quiet-icon"><Settings className="w-5 h-5" strokeWidth={1.6} /></button></div></header>
      <main className="app-main">
        {remoteSyncError && <p role="alert" className="text-sm text-rose-400">{remoteSyncError}</p>}
        {isRemoteDataLoading ? <p role="status" className="empty-copy">내 레시피를 불러오고 있습니다…</p> : hasLoadedRemoteData ? renderTabContent() : null}
      </main>
      <footer className="app-footer" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <nav aria-label="주 메뉴" className="app-navigation">
          {[['saved', '내 레시피', ClipboardList], ['recipe', '레시피 만들기', Sparkles], ['youtube', '유튜브 레시피', Youtube], ['places', '갈 곳', MapPin]].map(([tab, title, Icon]) => <button key={tab} aria-label={title} title={title} aria-current={activeTab === tab ? 'page' : undefined} onClick={() => setActiveTab(tab)} className="app-tab"><Icon size={23} strokeWidth={1.65} aria-hidden="true" /></button>)}
        </nav>
      </footer>
      {currentOpenRecipe && <RecipeWorkspace key={`${kitchen.workspaceId}:${currentOpenRecipe.id || 'draft'}`} recipe={currentOpenRecipe} onClose={() => setOpenRecipe(null)} onSave={handleSaveRecipe} />}

      {showSettings && <SettingsDialog user={user} kitchen={kitchen} onClose={() => setShowSettings(false)} onLogout={handleLogout} error={authError} />}
    </div>
  );
};

export default App;
