import React, { useState, useEffect } from 'react';
import { UtensilsCrossed, Flame, Soup, Wind, Microwave, ChefHat, Sparkles, Ban } from 'lucide-react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import ToolBar from './components/ToolBar';
import IngredientManager from './components/IngredientManager';
import RecipeResult from './components/RecipeResult';
import { generateRecipe } from './services/geminiService';
import { auth, googleProvider, db } from './src/services/firebaseClient';

const getDefaultIngredients = () => ([
  { id: 1, name: '계란', expiryDate: '2026-02-05', selected: false },
  { id: 2, name: '스팸', expiryDate: '2026-01-27', selected: false },
  { id: 3, name: '양파', expiryDate: '2026-02-15', selected: false },
]);

const App = () => {
  // --- Static Definitions ---
  // Icons cannot be saved to localStorage, so we define the base structure here
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

  // --- State with Persistence ---
  
  // 1. Ingredients
  const [ingredients, setIngredients] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fridge_ingredients');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error("Failed to parse ingredients", e);
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

  // 2. Tools
  const [tools, setTools] = useState(() => {
    let savedSelection = {};
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fridge_tools');
      if (saved) {
        try {
          savedSelection = JSON.parse(saved);
        } catch (e) {
          console.error("Failed to parse tools", e);
        }
      }
    }

    return TOOL_DEFINITIONS.map(def => ({
      ...def,
      selected: savedSelection[def.id] ?? (def.id === 'no-tools')
    }));
  });

  const [recipeResult, setRecipeResult] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRemoteDataLoading, setIsRemoteDataLoading] = useState(false);
  const [hasLoadedRemoteData, setHasLoadedRemoteData] = useState(false);
  const [remoteSyncError, setRemoteSyncError] = useState(null);
  const [lastSelectedIngredients, setLastSelectedIngredients] = useState([]);
  const [lastSelectedTools, setLastSelectedTools] = useState([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthInitialized(true);
      if (currentUser) {
        setAuthError(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // --- Persistence Effects ---
  useEffect(() => {
    localStorage.setItem('fridge_ingredients', JSON.stringify(ingredients));
  }, [ingredients]);

  useEffect(() => {
    localStorage.setItem('frichef_recipes', JSON.stringify(savedRecipes));
  }, [savedRecipes]);

  useEffect(() => {
    // Only save the selection state (id -> boolean map) to avoid circular refs/icon issues
    const selectionMap = tools.reduce((acc, tool) => ({
      ...acc,
      [tool.id]: tool.selected
    }), {});
    localStorage.setItem('fridge_tools', JSON.stringify(selectionMap));
  }, [tools]);

  useEffect(() => {
    if (!user) {
      setIsRemoteDataLoading(false);
      setHasLoadedRemoteData(false);
      setRemoteSyncError(null);
      return;
    }

    let isActive = true;
    const loadIngredients = async () => {
      setIsRemoteDataLoading(true);
      try {
        const docRef = doc(db, 'users', user.uid);
        const snapshot = await getDoc(docRef);
        if (!isActive) return;

        if (snapshot.exists()) {
          const data = snapshot.data();
          setIngredients(Array.isArray(data.ingredients) ? data.ingredients : getDefaultIngredients());
          setSavedRecipes(Array.isArray(data.recipes) ? data.recipes : []);
        } else {
          const defaults = getDefaultIngredients();
          await setDoc(docRef, { ingredients: defaults, recipes: [] }, { merge: true });
          if (!isActive) return;
          setIngredients(defaults);
          setSavedRecipes([]);
        }
        setHasLoadedRemoteData(true);
        setRemoteSyncError(null);
      } catch (error) {
        if (isActive) {
          console.error('Failed to load ingredients from Firebase', error);
          setRemoteSyncError('Firebase 동기화에 실패했습니다. 로컬 데이터만 사용합니다.');
          setHasLoadedRemoteData(true);
        }
      } finally {
        if (isActive) {
          setIsRemoteDataLoading(false);
        }
      }
    };

    loadIngredients();

    return () => {
      isActive = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user || !hasLoadedRemoteData || remoteSyncError) return;

    const syncIngredients = async () => {
      try {
        const docRef = doc(db, 'users', user.uid);
        await setDoc(docRef, { ingredients }, { merge: true });
      } catch (error) {
        console.error('Failed to sync ingredients to Firebase', error);
        setRemoteSyncError('Firebase에 재료를 저장하지 못했습니다.');
      }
    };

    syncIngredients();
  }, [user, ingredients, hasLoadedRemoteData, remoteSyncError]);

  useEffect(() => {
    if (!user || !hasLoadedRemoteData || remoteSyncError) return;

    const syncRecipes = async () => {
      try {
        const docRef = doc(db, 'users', user.uid);
        await setDoc(docRef, { recipes: savedRecipes }, { merge: true });
      } catch (error) {
        console.error('Failed to sync recipes to Firebase', error);
        setRemoteSyncError('Firebase에 레시피를 저장하지 못했습니다.');
      }
    };

    syncRecipes();
  }, [user, savedRecipes, hasLoadedRemoteData, remoteSyncError]);

  // --- Handlers ---
  const handleToggleTool = (id) => {
    setTools(prev => {
      const target = prev.find(tool => tool.id === id);
      const nextSelected = target ? !target.selected : true;

      return prev.map(tool => {
        if (tool.id === id) {
          return { ...tool, selected: nextSelected };
        }

        if (nextSelected) {
          if (id === 'no-tools') {
            return { ...tool, selected: false };
          }

          if (tool.id === 'no-tools') {
            return { ...tool, selected: false };
          }
        }

        return tool;
      });
    });
  };

  const handleAddIngredient = (name, date) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setIngredients(prev => [
      ...prev,
      { id: Date.now(), name: trimmedName, expiryDate: date || '', selected: true },
    ]);
  };

  const handleToggleIngredient = (id) => {
    setIngredients(prev => prev.map(i => i.id === id ? { ...i, selected: !i.selected } : i));
  };

  const handleDeleteIngredient = (id) => {
    setIngredients(prev => prev.filter(i => i.id !== id));
  };

  const handleUpdateIngredientExpiry = (id, date) => {
    setIngredients(prev => prev.map(item => (
      item.id === id ? { ...item, expiryDate: date || '' } : item
    )));
  };

  const handleGenerateRecipe = async () => {
    const selectedIngs = ingredients.filter(i => i.selected).map(i => i.name);
    const selectedTools = tools.filter(t => t.selected).map(t => t.name);

    setLastSelectedIngredients(selectedIngs);
    setLastSelectedTools(selectedTools);

    if (selectedIngs.length === 0) {
      alert("재료를 최소 하나 이상 선택해주세요!");
      return;
    }

    setIsModalOpen(true);
    setIsLoading(true);
    setRecipeResult(null);

    try {
      const result = await generateRecipe(selectedIngs, selectedTools);
      setRecipeResult(result);
    } catch (error) {
      setRecipeResult({ error: "레시피를 생성하는 도중 문제가 발생했습니다." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveRecipe = () => {
    if (!recipeResult || 'error' in recipeResult) {
      alert('저장할 레시피가 없습니다. 먼저 레시피를 생성해주세요.');
      return;
    }

    const recipeRecord = {
      id: Date.now(),
      dishName: recipeResult.dishName || 'AI 셰프의 레시피',
      difficulty: recipeResult.difficulty || '',
      time: recipeResult.time || '',
      steps: recipeResult.steps || [],
      extraNeeded: recipeResult.extraNeeded || [],
      proTip: recipeResult.proTip || '',
      ingredients: lastSelectedIngredients,
      tools: lastSelectedTools,
      createdAt: new Date().toISOString(),
    };

    setSavedRecipes(prev => [recipeRecord, ...prev]);
    alert('레시피가 저장되었습니다.');
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

  const selectedCount = ingredients.filter(i => i.selected).length;
  const canGenerateRecipe = selectedCount > 0 && !isLoading;

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
      {/* Header */}
      <header className="sticky top-0 z-40 bg-transparent border-none p-4 transition-all">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="bg-slate-900 p-2 rounded-xl shadow-lg shadow-slate-200">
              <UtensilsCrossed className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-slate-800">frichef</h1>
              <p className="text-[11px] text-slate-500 font-semibold tracking-tight">냉장고 기반 AI 셰프</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 rounded-full border border-amber-100">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-[10px] font-bold text-amber-700">AI READY</span>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-8">
        <section className="bg-white border border-slate-100 rounded-3xl p-4 space-y-3 shadow-sm">
          <div className="space-y-1">
            <p className="text-[11px] font-black text-amber-600 uppercase tracking-widest">오늘의 셰프</p>
            <p className="text-sm text-slate-600 leading-relaxed">
              frichef는 냉장고 속 재료와 사용 가능한 도구를 기반으로 한국어 레시피를 만들어 주는 개인 셰프입니다.
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {user.photoURL ? (
                <img src={user.photoURL} alt="프로필" className="w-10 h-10 rounded-2xl object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 font-bold">
                  {user.displayName ? user.displayName.charAt(0) : 'G'}
                </div>
              )}
              <div>
                <p className="text-sm font-bold text-slate-800">{user.displayName || user.email}</p>
                <p className="text-[11px] text-slate-500">Google 로그인 완료</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-3 py-2 rounded-xl hover:bg-slate-100"
            >
              로그아웃
            </button>
          </div>
        </section>

        <ToolBar tools={tools} onToggle={handleToggleTool} />
        
        <IngredientManager 
          ingredients={ingredients}
          onAdd={handleAddIngredient}
          onToggle={handleToggleIngredient}
          onDelete={handleDeleteIngredient}
          onUpdate={handleUpdateIngredientExpiry}
          syncError={remoteSyncError}
          syncLoading={isRemoteDataLoading}
        />

        <section className="bg-white border border-slate-100 rounded-3xl p-4 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 px-1">
            <div className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px] font-bold">4</div>
            <h2 className="font-bold text-slate-700 text-sm">저장된 레시피</h2>
            {remoteSyncError && (
              <span className="text-[10px] text-rose-500 font-semibold">Firebase 동기화 실패</span>
            )}
          </div>
          {savedRecipes.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">아직 저장한 레시피가 없습니다. 마음에 드는 레시피를 저장해보세요.</p>
          ) : (
            <div className="space-y-3">
              {savedRecipes.map(recipe => (
                <div key={recipe.id} className="border border-slate-100 rounded-2xl p-4 bg-slate-50/60">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[11px] text-slate-400">{new Date(recipe.createdAt).toLocaleString()}</p>
                      <h3 className="font-bold text-slate-800 text-base">{recipe.dishName}</h3>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500">
                      {recipe.time || '시간 정보 없음'}
                    </span>
                  </div>
                  <p className="text-[12px] text-slate-500 mt-2">
                    재료: {recipe.ingredients && recipe.ingredients.length > 0 ? recipe.ingredients.join(', ') : '정보 없음'}
                  </p>
                  <p className="text-[12px] text-slate-500">
                    도구: {recipe.tools && recipe.tools.length > 0 ? recipe.tools.join(', ') : '조리도구 없이'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Floating Action Button */}
      <div className={`fixed bottom-6 left-0 right-0 px-6 max-w-lg mx-auto z-40 transition-transform duration-300 ${selectedCount > 0 ? 'translate-y-0' : 'translate-y-24 opacity-0'}`}>
        <button
          onClick={handleGenerateRecipe}
          disabled={!canGenerateRecipe}
          className={`w-full text-white py-4 rounded-[1.5rem] font-black shadow-2xl shadow-slate-900/30 flex items-center justify-center gap-3 group active:scale-[0.98] transition-all ${canGenerateRecipe ? 'bg-slate-900 hover:bg-slate-800' : 'bg-slate-300 cursor-not-allowed'}`}
        >
          <div className="relative">
            <Sparkles className="w-5 h-5 text-amber-400 group-hover:rotate-12 transition-transform" />
          </div>
          <span className="text-base">레시피 생성하기</span>
          <span className="bg-white/20 px-2 py-0.5 rounded-md text-xs ml-1 font-bold">
            {selectedCount}
          </span>
        </button>
      </div>

      <RecipeResult 
        isOpen={isModalOpen}
        isLoading={isLoading}
        result={recipeResult}
        onClose={() => setIsModalOpen(false)}
        contextIngredients={lastSelectedIngredients}
        contextTools={lastSelectedTools}
        onRegenerate={handleGenerateRecipe}
        onSave={handleSaveRecipe}
      />
    </div>
  );
};

export default App;
