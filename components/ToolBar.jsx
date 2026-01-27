import React from 'react';

const ToolBar = ({ tools, onToggle }) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <div className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px] font-bold">1</div>
        <h2 className="font-bold text-slate-700 text-sm">조리도구 선택</h2>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar -mx-4 px-4 scroll-smooth">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onToggle(tool.id)}
            className={`flex flex-col items-center justify-center min-w-[72px] h-[72px] rounded-2xl border transition-all duration-200 active:scale-95 ${
              tool.selected
                ? 'bg-amber-50 border-amber-400 text-amber-700 shadow-sm'
                : 'bg-white border-slate-200 text-slate-400 grayscale hover:grayscale-0'
            }`}
            aria-pressed={tool.selected}
          >
            <div className="mb-1">{tool.icon}</div>
            <span className="text-[10px] font-bold truncate w-full text-center px-1">
              {tool.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ToolBar;
