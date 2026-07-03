import React from 'react';

const MarkdownRenderer = ({ content }) => {
    if (!content) return <p className="text-gray-300 italic">내용이 없습니다.</p>;

    const SECTION_COLORS = {
        '근황': { border: 'border-indigo-500', bg: 'bg-indigo-50/30' },
        '스쿨처치': { border: 'border-emerald-500', bg: 'bg-emerald-50/30' },
        '기도제목': { border: 'border-amber-500', bg: 'bg-amber-50/30' },
        '추후방향': { border: 'border-rose-500', bg: 'bg-rose-50/30' },
        '향후 일정': { border: 'border-rose-500', bg: 'bg-rose-50/30' }
    };

    const lines = content.split('\n');
    return (
        <div className="space-y-3">
            {lines.map((line, idx) => {
                const trimmed = line.trim();
                // Bold Title: **Title**
                if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
                    const title = trimmed.replace(/\*\*/g, '');
                    const style = SECTION_COLORS[title] || { border: 'border-gray-400', bg: 'bg-gray-50/50' };

                    return (
                        <div key={idx} className={`text-[13px] font-black text-gray-900 mt-5 first:mt-0 mb-2 flex items-center gap-2 border-l-[3px] ${style.border} pl-3 ${style.bg} py-1.5 rounded-r-lg shadow-sm/10`}>
                            {title}
                        </div>
                    );
                }
                // Bullet Point: * text
                if (trimmed.startsWith('*')) {
                    return (
                        <div key={idx} className="flex gap-2.5 group ml-0.5 px-0.5">
                            <div className="mt-1.5 shrink-0 w-1 h-1 rounded-full bg-indigo-300" />
                            <p className="text-[12.5px] font-bold text-gray-700 leading-relaxed">
                                {trimmed.replace(/^\*/, '').trim()}
                            </p>
                        </div>
                    );
                }
                // Empty line
                if (trimmed === '') return <div key={idx} className="h-1" />;

                // Regular line
                return (
                    <p key={idx} className="text-[12.5px] font-bold text-gray-500 ml-4 pl-0.5 leading-relaxed">
                        {trimmed}
                    </p>
                );
            })}
        </div>
    );
};

export default MarkdownRenderer;
