import React, { useState } from 'react';
import { ChevronRight, ChevronLeft, MessageSquareHeart, Music, HelpCircle, Star, MessageCircle } from 'lucide-react';
import AzitQT from './azit/AzitQT';
import AzitPlaylist from './azit/AzitPlaylist';
import AzitWeeklyQuestion from './azit/AzitWeeklyQuestion';

const SUBMENUS = [
    { id: 'QT나눔', title: 'QT 나눔', icon: MessageSquareHeart, color: 'text-pink-600', bg: 'bg-pink-100', desc: '오늘 은혜받은 말씀을 나눠요' },
    { id: '플레이리스트', title: '플레이리스트', icon: Music, color: 'text-indigo-600', bg: 'bg-indigo-100', desc: '함께 듣고 싶은 찬양/음악 리뷰' },
    { id: '위클리 퀘스천', title: '위클리 퀘스천', icon: HelpCircle, color: 'text-orange-600', bg: 'bg-orange-100', desc: '매주 주어지는 질문에 답해봐요' },
    { id: '톡톡', title: '톡톡', icon: MessageCircle, color: 'text-teal-600', bg: 'bg-teal-100', desc: '일상의 소소한 이야기나 기도제목' }
];

const StudentAzitTab = ({ user }) => {
    const [activeView, setActiveView] = useState(null);

    const handleBack = () => setActiveView(null);

    if (activeView === 'QT나눔') {
        return <AzitQT user={user} onBack={handleBack} category="QT나눔" />;
    } else if (activeView === '플레이리스트') {
        return <AzitPlaylist user={user} onBack={handleBack} category="플레이리스트" />;
    } else if (activeView === '위클리 퀘스천') {
        return <AzitWeeklyQuestion user={user} onBack={handleBack} category="위클리 퀘스천" />;
    } else if (activeView) {
        return (
            <div className="py-20 text-center animate-fade-in px-5 min-h-screen relative bg-gray-50">
                <button 
                    onClick={handleBack} 
                    className="absolute top-5 left-5 p-3 flex items-center bg-white rounded-full shadow-sm text-gray-700 hover:bg-gray-100 z-10"
                >
                    <ChevronLeft size={24} />
                    <span className="font-bold ml-1">뒤로</span>
                </button>
                <div className="flex flex-col items-center justify-center h-full pt-32">
                    <div className="w-20 h-20 bg-gray-200 rounded-2xl flex items-center justify-center mb-4">
                        <Star size={40} className="text-gray-400" />
                    </div>
                    <h3 className="text-xl font-black text-gray-800 mb-2">준비 중인 커뮤니티입니다</h3>
                    <p className="text-sm font-bold text-gray-500">조금만 기다려주세요! 곧 만나요 👋</p>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in pb-32 bg-gray-50 min-h-screen">
            <div className="px-5 pt-5 pb-4 sticky top-0 bg-gray-50/95 backdrop-blur-xl z-20 border-b border-gray-100/50 mb-6 shadow-sm">
                <div className="flex flex-col gap-1">
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-1.5">
                        커뮤니티 <span className="text-2xl">🏕️</span>
                    </h2>
                    <p className="text-gray-500 text-xs font-medium">솔직한 이야기를 나누는 우리들의 안전한 장소</p>
                </div>
            </div>

            <div className="px-5">
                <div className="bg-white rounded-[2rem] border border-gray-100 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.06)] overflow-hidden flex flex-col">
                    {SUBMENUS.map((menu, idx) => {
                        const Icon = menu.icon;
                        const isLast = idx === SUBMENUS.length - 1;
                        return (
                            <button
                                key={menu.id}
                                onClick={() => setActiveView(menu.id)}
                                className={`w-full p-5 flex items-center gap-5 transition-colors text-left focus:outline-none hover:bg-gray-50 active:bg-gray-100 ${!isLast ? 'border-b border-gray-100' : ''}`}
                            >
                                <div className={`w-14 h-14 rounded-2xl ${menu.bg} flex items-center justify-center shrink-0`}>
                                    <Icon size={28} className={menu.color} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg font-black text-gray-800 tracking-tight truncate">{menu.title}</h3>
                                    <p className="text-[11px] font-bold text-gray-400 mt-0.5 truncate">{menu.desc}</p>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-white border border-gray-100 flex items-center justify-center shrink-0 shadow-sm">
                                    <ChevronRight size={18} className="text-gray-400" />
                                </div>
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    );
};

export default StudentAzitTab;
