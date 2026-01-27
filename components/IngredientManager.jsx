import React, { useState } from 'react';
import { Search, Calendar, Trash2, CheckCircle2, Plus } from 'lucide-react';

const IngredientManager = ({
  ingredients,
  onAdd,
  onToggle,
  onDelete,
  onUpdate,
  syncError,
  syncLoading,
  onClearSelections,
  onSelectAll,
  showAddSection = true,
  showListSection = true,
  addStepNumber = '1',
  addTitle = '재료 추가',
  listStepNumber = '2',
  listTitle = '냉장고 목록',
}) => {
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState('');
  const [editingIngredient, setEditingIngredient] = useState(null);
  const [editingDate, setEditingDate] = useState('');

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    onAdd(newName, newDate);
    setNewName('');
    setNewDate('');
  };

  const getExpiryStatus = (date) => {
    if (!date) {
      return {
        label: '유통기한 미정',
        color: 'text-slate-500',
        bg: 'bg-slate-100',
        border: 'border-slate-200',
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(date);
    if (Number.isNaN(exp.getTime())) {
      return {
        label: '유통기한 확인 필요',
        color: 'text-orange-600',
        bg: 'bg-orange-50',
        border: 'border-orange-100',
      };
    }

    const diffTime = exp.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: '만료됨', color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-100' };
    if (diffDays <= 3) return { label: `D-${diffDays}`, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' };
    return { label: `D-${diffDays}`, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' };
  };

  const startEditIngredient = (ingredient) => {
    setEditingIngredient(ingredient);
    setEditingDate(ingredient.expiryDate || '');
  };

  const cancelEdit = () => {
    setEditingIngredient(null);
    setEditingDate('');
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!editingIngredient) return;
    onUpdate(editingIngredient.id, editingDate);
    cancelEdit();
  };

  const sortedIngredients = [...ingredients].sort((a, b) => {
    const timeA = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity;
    const timeB = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity;
    return timeA - timeB;
  });

  return (
    <div className="space-y-6">
      {/* Input Section */}
      {showAddSection && (
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <div className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px] font-bold">{addStepNumber}</div>
          <h2 className="font-bold text-slate-700 text-sm">{addTitle}</h2>
        </div>
        {syncLoading && (
          <p className="text-[11px] text-slate-400 px-1">Firebase에서 재료를 불러오는 중이에요...</p>
        )}
        {syncError && !syncLoading && (
          <p className="text-[11px] text-rose-500 px-1">{syncError}</p>
        )}
        
        <form onSubmit={handleAdd} className="bg-white p-3 rounded-[1.5rem] shadow-sm border border-slate-100 flex flex-col gap-3">
            <div className="relative w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="재료명 (예: 감자)"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-1 focus:ring-amber-400 text-sm font-medium placeholder:text-slate-400"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <label className="flex flex-col flex-1 gap-1 text-[11px] font-bold text-slate-500">
                <span>유통기한</span>
                <input
                  type="date"
                  className="w-full pl-4 pr-2 py-3 rounded-xl bg-slate-50 border-none focus:ring-1 focus:ring-amber-400 text-xs font-bold text-slate-600 uppercase"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                />
              </label>
              <button
                type="submit"
                disabled={!newName.trim()}
                className="bg-slate-900 disabled:bg-slate-200 text-white px-5 rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            <p className="text-[11px] text-slate-400 px-1">유통기한이 없다면 비워두고 추가해도 됩니다.</p>
        </form>
      </div>
      )}

      {/* List Section */}
      {showListSection && (
      <div className="space-y-3 pb-24">
        <div className="flex justify-between items-end px-1">
          <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px] font-bold">{listStepNumber}</div>
          <h2 className="font-bold text-slate-700 text-sm">{listTitle}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            {ingredients.length} ITEMS
          </span>
          {onSelectAll && (
            <button
              onClick={onSelectAll}
              className="text-[10px] text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full"
            >
              전체 선택
            </button>
          )}
          {onClearSelections && (
            <button
              onClick={onClearSelections}
                className="text-[10px] text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full"
              >
                전체 해제
              </button>
            )}
          </div>
        </div>
        <p className="text-[11px] text-slate-500 px-1">재료 카드를 누르면 유통기한을 수정할 수 있어요.</p>

        <div className="grid gap-2.5">
          {ingredients.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
              <p className="text-xs text-slate-400 font-medium">재료를 추가해주세요.</p>
            </div>
          ) : (
            sortedIngredients.map((item) => {
              const status = getExpiryStatus(item.expiryDate);
              return (
                <div
                  key={item.id}
                  onClick={() => startEditIngredient(item)}
                  className={`relative flex items-center gap-3 p-3 rounded-2xl transition-all cursor-pointer border select-none ${
                    item.selected
                      ? 'bg-slate-900 border-slate-900 shadow-lg shadow-slate-200/50'
                      : `bg-white ${status.border} shadow-sm active:bg-slate-50`
                  }`}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggle(item.id);
                    }}
                    aria-pressed={item.selected}
                    className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
                      item.selected ? 'bg-amber-400 border-amber-400 text-white' : 'border-slate-200 bg-slate-50 text-slate-400'
                    }`}
                  >
                    {item.selected && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <h3 className={`font-bold text-sm truncate ${item.selected ? 'text-white' : 'text-slate-800'}`}>
                        {item.name}
                      </h3>
                      <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-tight ${item.selected ? 'bg-white/20 text-white' : `${status.bg} ${status.color}`}`}>
                        {status.label}
                      </span>
                    </div>
                    <div className={`flex items-center gap-1 text-[10px] ${item.selected ? 'text-slate-200' : 'text-slate-500'}`}>
                      <Calendar className="w-3 h-3" />
                      <span>{item.expiryDate || '미정'}</span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(item.id);
                    }}
                    className={`p-2 rounded-xl transition-colors ${
                      item.selected 
                          ? 'text-slate-100 hover:text-red-200 hover:bg-slate-800' 
                          : 'text-slate-300 hover:text-red-500 hover:bg-red-50'
                    }`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
      )}

      {editingIngredient && (
        <div className="bg-white border border-slate-100 rounded-3xl p-4 shadow-sm space-y-3">
          <div>
            <p className="text-xs font-black text-amber-500 uppercase tracking-[0.2em]">유통기한 수정</p>
            <h3 className="text-base font-black text-slate-900">{editingIngredient.name}</h3>
          </div>
          <form onSubmit={handleEditSubmit} className="space-y-3">
            <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-600">
              <span>새로운 유통기한</span>
              <input
                type="date"
                className="w-full pl-4 pr-2 py-3 rounded-2xl bg-slate-50 border border-slate-100 focus:ring-1 focus:ring-amber-400 text-xs font-bold text-slate-700 uppercase"
                value={editingDate}
                onChange={(e) => setEditingDate(e.target.value)}
              />
            </label>
            <p className="text-[11px] text-slate-400">입력하지 않으면 유통기한은 비워진 상태로 저장됩니다.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={cancelEdit}
                className="flex-1 border border-slate-200 rounded-2xl py-2 font-semibold text-slate-600 hover:bg-slate-50"
              >
                취소
              </button>
              <button
                type="submit"
                className="flex-1 bg-slate-900 text-white rounded-2xl py-2 font-bold hover:bg-slate-800"
              >
                저장
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default IngredientManager;
