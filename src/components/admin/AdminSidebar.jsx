import React from 'react';
import { LayoutDashboard, MessageSquare, Image, Users, BarChart2, FileText, Settings, LogOut, Send, User, Calendar, School } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useNavigate } from 'react-router-dom';

const AdminSidebar = ({ activeMenu, setActiveMenu, onLogout, isOpen, setIsOpen, isPinned, setIsPinned }) => {
    const navigate = useNavigate();
    const [winWidth, setWinWidth] = React.useState(window.innerWidth);
    const [menus, setMenus] = React.useState([]);

    React.useEffect(() => {
        const handleResize = () => setWinWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const baseMenus = [
        { id: 'STATUS', label: '공간 현황', icon: <LayoutDashboard size={20} /> },
        { id: 'CALENDAR', label: '일정 관리', icon: <Calendar size={20} /> },
        { id: 'PROGRAMS', label: '프로그램 관리', icon: <Users size={20} /> },
        { id: 'BOARD', label: '공지사항', icon: <MessageSquare size={20} /> },
        { id: 'GALLERY', label: '사진첩', icon: <Image size={20} /> },
        { id: 'GUESTBOOK', label: '방명록', icon: <FileText size={20} /> },
        { id: 'USERS', label: '이용자 관리', icon: <Users size={20} /> },
        { id: 'SCHOOLS', label: '학교 관리', icon: <School size={20} /> },
        { id: 'CHALLENGES', label: '챌린지 관리', icon: <BarChart2 size={20} /> },
        { id: 'STATISTICS', label: '통계', icon: <BarChart2 size={20} /> },
        { id: 'LOGS', label: '로그', icon: <FileText size={20} /> },
        { id: 'REPORTS', label: '운영 리포트', icon: <FileText size={20} /> },
        { id: 'SETTINGS', label: '설정', icon: <Settings size={20} /> },
    ];

    React.useEffect(() => {
        const fetchConfig = async () => {
            try {
                const { data } = await supabase
                    .from('notices')
                    .select('content')
                    .eq('category', 'SYSTEM')
                    .eq('title', 'ADMIN_SIDEBAR_CONFIG')
                    .maybeSingle();

                if (data && data.content) {
                    const parsed = JSON.parse(data.content);
                    if (Array.isArray(parsed)) {
                        const orderedMenus = parsed
                            .filter(item => item.isVisible)
                            .map(item => {
                                const base = baseMenus.find(m => m.id === item.id);
                                return base ? { ...base, ...item } : null;
                            })
                            .filter(Boolean);

                        // Add any new base menus that might not be in the config yet
                        const extraMenus = baseMenus.filter(bm => !parsed.find(p => p.id === bm.id));
                        setMenus([...orderedMenus, ...extraMenus]);
                        return;
                    }
                }
                setMenus(baseMenus);
            } catch (e) {
                console.error('Failed to fetch sidebar config:', e);
                setMenus(baseMenus);
            }
        };
        fetchConfig();
    }, []);

    // Helper to handle menu click and auto-close if in overlay mode
    const handleMenuClick = (menuId) => {
        setActiveMenu(menuId);
        // On mobile or unpinned desktop, close the overlay automatically
        if (window.innerWidth < 768 || !isPinned) {
            setIsOpen(false);
        }
    };

    return (
        <>
            {/* Backdrop for Overlay (Always active for isOpen state) */}
            <div
                className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${isOpen && (window.innerWidth < 768 || !isPinned) ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setIsOpen(false)}
            />

            {/* Sidebar Content */}
            <div className={`
                w-64 bg-white border-r border-gray-100 h-screen h-[100dvh] flex flex-col fixed left-0 top-0 shadow-sm z-50 
                transition-transform duration-300 ease-in-out transform gpu-accelerated
                ${(isOpen || (isPinned && winWidth >= 768)) ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="p-8 border-b border-gray-100 flex flex-col items-center relative">
                    {/* PC Pin Toggle - Only shown on wide screens */}
                    <button
                        onClick={() => setIsPinned(!isPinned)}
                        className="hidden md:flex absolute top-4 right-4 p-1.5 text-gray-300 hover:text-blue-500 transition-colors"
                        title={isPinned ? "고정 해제 (오버레이 모드)" : "사이드바 고정"}
                    >
                        <LayoutDashboard size={14} className={isPinned ? 'text-blue-500' : ''} />
                    </button>
                    <h1 className="text-2xl font-black text-blue-600 tracking-tighter">SCI CENTER</h1>
                    <span className="text-gray-400 font-bold text-[10px] tracking-widest uppercase mt-1">Management System</span>
                </div>
                <nav className="flex-1 p-4 py-8 space-y-1.5 overflow-y-auto custom-scrollbar">
                    {menus.map(menu => (
                        <button
                            key={menu.id}
                            onClick={() => handleMenuClick(menu.id)}
                            className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-xl font-bold transition-all duration-200 ${activeMenu === menu.id
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-100 scale-[1.02]'
                                : 'text-gray-400 hover:bg-gray-50 hover:text-blue-500'
                                }`}
                        >
                            {menu.icon}
                            <span className="text-sm">{menu.label}</span>
                        </button>
                    ))}
                </nav>
                <div className="p-6 border-t border-gray-100 space-y-3 bg-gray-50/50">
                    <button
                        onClick={() => navigate('/student')}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl font-extrabold bg-white border border-blue-100 text-blue-600 hover:bg-blue-600 hover:text-white transition-all duration-300 shadow-sm"
                    >
                        <User size={18} />
                        <span className="text-sm">학생용 페이지</span>
                    </button>
                    <button
                        onClick={onLogout}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl font-extrabold bg-gray-100 text-gray-500 hover:bg-red-500 hover:text-white transition-all duration-300"
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
