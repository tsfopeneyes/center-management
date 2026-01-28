import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { Search, Send, Check, CheckCheck, User, MessageCircle, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AdminMessages = ({ users }) => {
    // Basic state
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [chatHistory, setChatHistory] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loadingChat, setLoadingChat] = useState(false);
    const [showUserList, setShowUserList] = useState(true);

    // For auto-scroll
    const chatEndRef = useRef(null);

    const filteredUsers = users.filter(u =>
        u.name.includes(searchTerm) ||
        (u.phone_back4 && u.phone_back4.includes(searchTerm))
    );

    // Toggle logic for mobile
    const handleSelectUser = (user) => {
        setSelectedUser(user);
        if (window.innerWidth < 1024) {
            setShowUserList(false);
        }
    };

    const handleBackToList = () => {
        setShowUserList(true);
    };

    // Fetch Chat History
    useEffect(() => {
        if (!selectedUser) return;

        const fetchChat = async () => {
            setLoadingChat(true);
            try {
                const { data, error } = await supabase
                    .from('messages')
                    .select('*')
                    .or(`receiver_id.eq.${selectedUser.id},sender_id.eq.${selectedUser.id}`)
                    .order('created_at', { ascending: true });

                if (error) throw error;
                setChatHistory(data || []);
            } catch (err) {
                console.error(err);
            } finally {
                setLoadingChat(false);
            }
        };

        fetchChat();

        // Subscription for the current conversation
        const subscription = supabase
            .channel(`admin_chat_thread:${selectedUser.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'messages'
            }, (payload) => {
                console.log('Real-time event (Admin):', payload.eventType, payload.new?.id);

                if (!payload.new) {
                    fetchChat(); // Fallback
                    return;
                }

                const adminUser = JSON.parse(localStorage.getItem('admin_user'));
                const isMyCurrentThread =
                    (payload.new.sender_id === selectedUser.id && payload.new.receiver_id === adminUser.id) ||
                    (payload.new.sender_id === adminUser.id && payload.new.receiver_id === selectedUser.id);

                if (!isMyCurrentThread) return;

                if (payload.eventType === 'INSERT') {
                    setChatHistory(prev => {
                        if (prev.some(m => m.id === payload.new.id)) return prev;
                        return [...prev, payload.new];
                    });

                    // Mark as read if from student
                    if (payload.new.sender_id === selectedUser.id) {
                        supabase.from('messages').update({ is_read: true }).eq('id', payload.new.id);
                    }
                } else if (payload.eventType === 'UPDATE') {
                    setChatHistory(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
                }
            })
            .subscribe((status) => console.log('Admin Chat Sub Status:', status));

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [selectedUser]);

    // Auto Scroll
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedUser) return;

        const adminUser = JSON.parse(localStorage.getItem('admin_user'));
        const payload = {
            sender_id: adminUser?.id,
            receiver_id: selectedUser.id,
            content: newMessage,
            is_read: false
        };

        try {
            const { error, data } = await supabase.from('messages').insert([payload]).select();

            if (error) throw error;
            setNewMessage('');

            const newMsg = data ? data[0] : { ...payload, created_at: new Date().toISOString() };
            setChatHistory(prev => [...prev, newMsg]);
        } catch (err) {
            alert('전송 실패');
            console.error(err);
        }
    };

    return (
        <div className="flex h-[calc(100vh-140px)] bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-fade-in-up relative">
            {/* Left: User List */}
            <div className={`
                ${showUserList ? 'flex' : 'hidden'} 
                lg:flex flex-col w-full lg:w-80 border-r border-gray-100 bg-white z-10
            `}>
                <div className="p-4 border-b border-gray-100">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="이름 검색..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 p-2 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:bg-white focus:border-blue-500 transition"
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {filteredUsers.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 text-sm">사용자를 찾을 수 없습니다.</div>
                    ) : (
                        filteredUsers.map(u => (
                            <div
                                key={u.id}
                                onClick={() => handleSelectUser(u)}
                                className={`p-4 flex items-center gap-3 cursor-pointer transition hover:bg-gray-50 ${selectedUser?.id === u.id ? 'bg-blue-50 border-r-2 border-blue-600' : ''}`}
                            >
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-gray-500 ${selectedUser?.id === u.id ? 'bg-white text-blue-600' : 'bg-gray-100'}`}>
                                    {u.profile_image_url ? (
                                        <img src={u.profile_image_url} alt={u.name} className="w-full h-full rounded-full object-cover" />
                                    ) : (
                                        u.name[0]
                                    )}
                                </div>
                                <div>
                                    <h4 className={`text-sm font-bold ${selectedUser?.id === u.id ? 'text-blue-700' : 'text-gray-700'}`}>{u.name}</h4>
                                    <span className="text-xs text-gray-400">{u.school}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Right: Chat Window */}
            <div className={`
                ${!showUserList ? 'flex' : 'hidden'} 
                lg:flex flex-1 flex-col bg-gray-50/30
            `}>
                {selectedUser ? (
                    <>
                        {/* Chat Header */}
                        <div className="p-3 md:p-4 bg-white border-b border-gray-100 flex items-center gap-3">
                            <button onClick={handleBackToList} className="lg:hidden p-2 -ml-1 text-gray-500 hover:bg-gray-50 rounded-lg">
                                <ArrowLeft size={20} />
                            </button>
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs ring-2 ring-white overflow-hidden">
                                {selectedUser.profile_image_url ? (
                                    <img src={selectedUser.profile_image_url} alt={selectedUser.name} className="w-full h-full object-cover" />
                                ) : (
                                    selectedUser.name[0]
                                )}
                            </div>
                            <h3 className="font-bold text-sm md:text-base text-gray-800">
                                {selectedUser.name}
                                <span className="text-gray-400 font-normal text-[10px] md:text-xs ml-2">({selectedUser.school})</span>
                            </h3>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                            {loadingChat ? (
                                <div className="text-center text-gray-400 text-sm mt-10">로딩 중...</div>
                            ) : chatHistory.length === 0 ? (
                                <div className="text-center text-gray-300 text-sm mt-10 px-4">
                                    <MessageCircle className="mx-auto mb-2 opacity-20" size={40} />
                                    대화 기록이 없습니다. 메시지를 보내보세요.
                                </div>
                            ) : (
                                <AnimatePresence initial={false}>
                                    {chatHistory.map((msg, idx) => {
                                        const isMe = msg.receiver_id === selectedUser.id;
                                        return (
                                            <motion.div
                                                key={msg.id || idx}
                                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                                            >
                                                <div className={`max-w-[85%] lg:max-w-[70%] p-3 px-4 rounded-2xl text-sm font-medium shadow-sm 
                                                    ${isMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-700 border border-gray-100 rounded-bl-none'}`}
                                                >
                                                    {msg.content}
                                                </div>
                                                <div className="flex items-center gap-1 mt-1 px-1">
                                                    {isMe && (
                                                        msg.is_read ? (
                                                            <span className="text-[10px] text-blue-400 font-bold">읽음</span>
                                                        ) : (
                                                            <span className="text-[10px] text-gray-300">전송됨</span>
                                                        )
                                                    )}
                                                    <span className="text-[10px] text-gray-300">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </AnimatePresence>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-3 md:p-4 bg-white border-t border-gray-100">
                            <form onSubmit={handleSendMessage} className="flex gap-2">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="메시지 입력..."
                                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 md:py-3 text-sm outline-none focus:bg-white focus:border-blue-500 transition"
                                />
                                <button type="submit" disabled={!newMessage.trim()} className="bg-blue-600 text-white p-2.5 md:p-3 rounded-xl hover:bg-blue-700 transition disabled:bg-gray-300 shadow-lg shadow-blue-200">
                                    <Send size={18} />
                                </button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-300 p-8 text-center">
                        <MessageCircle size={64} className="mb-4 text-gray-100" />
                        <h4 className="text-gray-400 font-bold mb-1">메시지 관리</h4>
                        <p className="text-xs">대화할 상대를 왼쪽 목록에서 선택해주세요.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminMessages;
