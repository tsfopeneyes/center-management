import React from 'react';
import { LayoutDashboard, MessageSquare, Image, Users, BarChart2, FileText, Settings, LogOut, Send, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AdminSidebar = ({ activeMenu, setActiveMenu, onLogout, isOpen, setIsOpen }) => {
    const navigate = useNavigate();
    const menus = [
        { id: 'STATUS', label: '공간 현황', icon: <LayoutDashboard size={20} /> },
        { id: 'PROGRAMS', label: '센터 프로그램', icon: <Users size={20} /> },
        { id: 'BOARD', label: '공지사항', icon: <MessageSquare size={20} /> },
        { id: 'GALLERY', label: '사진첩', icon: <Image size={20} /> },
        { id: 'GUESTBOOK', label: '방명록', icon: <FileText size={20} /> },
        { id: 'MESSAGES', label: '메시지', icon: <Send size={20} /> },
        { id: 'USERS', label: '이용자 관리', icon: <Users size={20} /> },
        { id: 'STATISTICS', label: '통계', icon: <BarChart2 size={20} /> },
        { id: 'LOGS', label: '로그', icon: <FileText size={20} /> },
        { id: 'SETTINGS', label: '설정', icon: <Settings size={20} /> },
    ];

    return (
        <>
            {/* Backdrop for Mobile */}
            <div
                className={`md:hidden fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setIsOpen(false)}
            />

            {/* Sidebar Content */}
            <div className={`
                w-64 bg-white border-r border-gray-100 min-h-screen flex flex-col fixed left-0 top-0 shadow-sm z-50 
                transition-transform duration-300 transform
                ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}>
                <div className="p-6 border-b border-gray-100 flex items-center justify-center">
                    <h1 className="text-xl font-extrabold text-blue-600 tracking-tight">SCI CENTER <span className="text-gray-400 font-normal text-xs block text-center mt-1">ADMIN</span></h1>
                </div>
                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {menus.map(menu => (
                        <button
                            key={menu.id}
                            onClick={() => setActiveMenu(menu.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-bold transition-all duration-200 ${activeMenu === menu.id
                                ? 'bg-blue-50 text-blue-600 shadow-sm border border-blue-100'
                                : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                                }`}
                        >
                            {menu.icon}
                            <span className="text-sm">{menu.label}</span>
                        </button>
                    ))}
                </nav>
                <div className="p-4 border-t border-gray-100 space-y-2">
                    <button
                        onClick={() => navigate('/student')}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                    >
                        <User size={18} />
                        <span className="text-sm">학생용 페이지</span>
                    </button>
                    <button
                        onClick={onLogout}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                        <LogOut size={18} />
                        <span className="text-sm">로그아웃</span>
                    </button>
                </div>
            </div>
        </>
    );
};

export default AdminSidebar;
