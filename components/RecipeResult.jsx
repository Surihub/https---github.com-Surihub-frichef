import React from 'react';
import { X, Loader2, UtensilsCrossed, Info, ChefHat, Clock, Signal } from 'lucide-react';

const RecipeResult = ({
  isOpen,
  isLoading,
  result,
  onClose,
  contextIngredients = [],
  contextTools = [],
  onRegenerate = () => {},
  onSave = () => {},
}) => {
  if (!isOpen && !isLoading && (!result || result === null)) {
    return null;
  }

  return (
    <section className="px-4 pb-10">
      <div className="bg-white border border-slate-200 rounded-[2rem] shadow-lg shadow-slate-200/60 overflow-hidden">
        <div className="p-5 flex justify-between items-center border-b border-slate-100 bg-gradient-to-r from-white to-amber-50">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-400">frichef</p>
            <h3 className="text-base font-black text-slate-800">AI 셰프의 제안</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-6 space-y-8">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] space-y-6">
              <div className="relative">
                <div className="absolute inset-0 bg-amber-400/20 blur-xl rounded-full"></div>
                <Loader2 className="w-12 h-12 text-amber-500 animate-spin relative z-10" />
              </div>
              <div className="text-center space-y-2">
                <p className="text-lg font-black text-slate-800">레시피 분석 중...</p>
                <p className="text-xs font-medium text-slate-400">재료 조합을 계산하고 있습니다</p>
              </div>
            </div>
          ) : result && 'error' in result ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
              <p className="text-red-500 font-bold text-center">{result.error}</p>
              <button onClick={onClose} className="text-sm font-bold text-slate-500 underline">닫기</button>
            </div>
          ) : result && 'dishName' in result ? (
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">frichef recipe</p>
                  <h2 className="text-2xl font-black text-slate-900 leading-tight">
                    {result.dishName || 'AI 셰프의 레시피'}
                  </h2>
                </div>
                <div className="flex gap-2">
                  <span className="inline-flex items-center gap-1 bg-white border border-slate-200 px-3 py-1.5 rounded-full text-[10px] font-bold text-slate-600 shadow-sm">
                    <Signal className="w-3 h-3 text-emerald-500" />
                    {result.difficulty || '난이도 정보 없음'}
                  </span>
                  <span className="inline-flex items-center gap-1 bg-white border border-slate-200 px-3 py-1.5 rounded-full text-[10px] font-bold text-slate-600 shadow-sm">
                    <Clock className="w-3 h-3 text-amber-500" />
                    {result.time || '시간 정보 없음'}
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 text-[11px] text-slate-500 space-y-1">
                  <p className="text-xs font-black text-slate-700">
                    {contextIngredients.length > 0 || contextTools.length > 0
                      ? '선택한 재료와 도구로 완성한 레시피'
                      : '선택한 재료 정보를 불러오지 못했습니다.'}
                  </p>
                  {contextIngredients.length > 0 && (
                    <p>
                      <span className="font-semibold text-slate-700">재료</span>: {contextIngredients.join(', ')}
                    </p>
                  )}
                  <p>
                    <span className="font-semibold text-slate-700">조리 도구</span>: {contextTools.length > 0 ? contextTools.join(', ') : '조리도구 없이'}
                  </p>
                </div>
              </div>

              {result.extraNeeded && result.extraNeeded.length > 0 && (
                <div className="bg-amber-50/80 p-5 rounded-3xl border border-amber-100/50">
                  <h4 className="text-xs font-black text-amber-800/70 mb-3 flex items-center gap-1.5 uppercase tracking-wide">
                    <Info className="w-3.5 h-3.5" /> 추가 필요 재료
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {result.extraNeeded.map((ing, idx) => (
                      <span key={idx} className="bg-white px-2.5 py-1 rounded-lg text-xs font-bold text-amber-900 shadow-sm border border-amber-100">
                        {ing}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h4 className="font-black text-slate-800 text-sm flex items-center gap-2">
                  <UtensilsCrossed className="w-4 h-4 text-slate-400" /> 조리 순서
                </h4>
                <div className="space-y-4 relative before:absolute before:left-[15px] before:top-4 before:bottom-4 before:w-[2px] before:bg-slate-100">
                  {result.steps.map((step, idx) => (
                    <div key={idx} className="relative flex gap-4 pl-1">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-xs shadow-md border-4 border-[#F8FAFC] z-10">
                        {idx + 1}
                      </div>
                      <p className="text-slate-600 text-sm font-medium leading-relaxed pt-1">
                        {step}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {result.proTip && (
                <div className="p-5 rounded-[1.5rem] bg-indigo-500 text-white relative overflow-hidden shadow-lg shadow-indigo-200">
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2 opacity-80">
                      <ChefHat className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-wider">Chef's Secret</span>
                    </div>
                    <p className="text-sm font-bold leading-relaxed">
                      "{result.proTip}"
                    </p>
                  </div>
                  <div className="absolute -right-4 -bottom-4 opacity-10.rotate-12">
                    <ChefHat className="w-32 h-32" />
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {!isLoading && result && !('error' in result) && (
          <div className="px-6 pb-6 space-y-3">
            <button
              onClick={onSave}
              className="w-full bg-amber-500 text-white py-3 rounded-2xl font-black text-sm active:scale-[0.98] transition-transform"
            >
              레시피 저장
            </button>
            <button
              onClick={onRegenerate}
              className="w-full bg-white text-slate-800 border border-slate-200 py-3 rounded-2xl font-black text-sm active:scale-[0.98] transition-transform"
            >
              레시피 다시 생성
            </button>
            <button
              onClick={onClose}
              className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-sm active:scale-[0.98] transition-transform"
            >
              창 닫기
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default RecipeResult;
