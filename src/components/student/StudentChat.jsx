import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { Send, MessageCircle, ArrowLeft, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import LinkPreview from '../LinkPreview';
import { extractUrls } from '../../utils/linkUtils';

const StudentChat = ({ currentUser, onRefreshUnread }) => {
    // State
    const [matches, setMatches] = useState([]); // List of 'other' users we have talked to
    const [selectedMatch, setSelectedMatch] = useState(null); // The user we are currently chatting with
    const [chatHistory, setChatHistory] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [isNewChat, setIsNewChat] = useState(false);
    const [staffList, setStaffList] = useState([]);
    const chatEndRef = useRef(null);

    // 1. Fetch conversations definition (hoisted)
    const fetchConversations = async () => {
        try {
            // Fetch messages where I am sender OR receiver
            const { data, error } = await supabase
                .from('messages')
                .select('*, sender:sender_id(id, name, user_group), receiver:receiver_id(id, name, user_group)')
                .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Group by the "Other" person
            const conversationMap = new Map();

            data.forEach(msg => {
                const isMeSender = msg.sender_id === currentUser.id;
                const otherUser = isMeSender ? msg.receiver : msg.sender;

                // If the other user is null (e.g. deleted account), skip
                if (!otherUser) return;

                if (!conversationMap.has(otherUser.id)) {
                    // Check local read cache
                    const lastRead = localStorage.getItem(`last_read_${otherUser.id}`);
                    const isLocallyRead = lastRead && new Date(msg.created_at) <= new Date(lastRead);
                    const isUnread = !isMeSender && !msg.is_read && !isLocallyRead;

                    conversationMap.set(otherUser.id, {
                        user: otherUser,
                        lastMessage: msg,
                        unreadCount: isUnread ? 1 : 0
                    });
                } else {
                    const entry = conversationMap.get(otherUser.id);
                    // Check local read cache
                    const lastRead = localStorage.getItem(`last_read_${otherUser.id}`);
                    const isLocallyRead = lastRead && new Date(msg.created_at) <= new Date(lastRead);

                    if (!isMeSender && !msg.is_read && !isLocallyRead) {
                        entry.unreadCount += 1;
                    }
                }
            });

            setMatches(Array.from(conversationMap.values()));
            setLoading(false);
            if (onRefreshUnread) onRefreshUnread(); // Sync with parent Nav

        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };
    const fetchStaff = async () => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('id, name, user_group')
                .eq('user_group', 'STAFF')
                .neq('name', 'admin');
            if (error) throw error;
            setStaffList(data || []);
        } catch (err) {
            console.error('Error fetching staff:', err);
        }
    };

    // Initial Fetch & Real-time Subscription
    useEffect(() => {
        fetchConversations();
        fetchStaff();

        // Global subscription for message updates (conversations list & unread badge)
        const subscription = supabase
            .channel('student_chat_global')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'messages'
            }, (payload) => {
                console.log('Real-time message event (Student):', payload.eventType, payload.new?.id);

                if (!payload.new) {
                    fetchConversations();
                    return;
                }

                const isRelatedToMe = payload.new.receiver_id === currentUser.id || payload.new.sender_id === currentUser.id;
                if (!isRelatedToMe) return;

                // Always refresh conversations list for UI consistency
                fetchConversations();
                if (onRefreshUnread) onRefreshUnread();

                // Thread-specific logic
                if (selectedMatch) {
                    const otherId = selectedMatch.user.id;
                    const isInCurrentThread =
                        (payload.new.sender_id === otherId && payload.new.receiver_id === currentUser.id) ||
                        (payload.new.sender_id === currentUser.id && payload.new.receiver_id === otherId);

                    if (isInCurrentThread) {
                        if (payload.eventType === 'INSERT') {
                            setChatHistory(prev => {
                                if (prev.some(m => m.id === payload.new.id)) return prev;
                                return [...prev, payload.new];
                            });

                            // Mark as read if from the other person
                            if (payload.new.sender_id === otherId) {
                                supabase.from('messages').update({ is_read: true }).eq('id', payload.new.id);
                            }
                        } else if (payload.eventType === 'UPDATE') {
                            setChatHistory(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
                        }
                    }
                }
            })
            .subscribe((status) => {
                console.log('Student Chat Sub Status:', status);
            });

        return () => { supabase.removeChannel(subscription); };
    }, [currentUser, selectedMatch]);

    // 2. Fetch specific thread when a match is selected
    useEffect(() => {
        if (!selectedMatch) return;

        const fetchThread = async () => {
            const otherId = selectedMatch.user.id;
            const { data } = await supabase
                .from('messages')
                .select('*')
                .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${currentUser.id})`)
                .order('created_at', { ascending: true });

            setChatHistory(data || []);

            // 1. PRE-EMPTIVE Optimistic Update (Immediate Feedback)
            setMatches(prev => prev.map(m => m.user.id === otherId ? { ...m, unreadCount: 0 } : m));

            // Client-Side Persistence: Save timestamp to ignore stale server counts
            localStorage.setItem(`last_read_${otherId}`, new Date().toISOString());

            if (onRefreshUnread) onRefreshUnread(); // Tell parent to clear global badge too

            // 2. Robust Mark-Read: Update ALL messages from this sender to me as read directly
            const { error: updateError } = await supabase
                .from('messages')
                .update({ is_read: true })
                .eq('receiver_id', currentUser.id)
                .eq('sender_id', otherId)
                .eq('is_read', false);

            if (updateError) {
                console.error('Failed to mark messages as read (Bulk):', updateError);
            } else {
                console.log('Bulk mark-read successful. Final Sync...');

                // 3. Final Sync
                setTimeout(() => {
                    fetchConversations();
                    if (onRefreshUnread) onRefreshUnread();
                }, 500);
            }
        };

        fetchThread();

        // No dependency on 'matches' here to avoid loops, as we update matches inside.
    }, [selectedMatch]);

    // Auto-scroll
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory, selectedMatch]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedMatch) return;

        const payload = {
            sender_id: currentUser.id,
            receiver_id: selectedMatch.user.id,
            content: newMessage,
            is_read: false
        };

        try {
            const { error, data } = await supabase.from('messages').insert([payload]).select();

            if (error) throw error;
            setNewMessage('');

            // Optimistic update
            const newMsg = data ? data[0] : { ...payload, created_at: new Date().toISOString() };
            setChatHistory(prev => [...prev, newMsg]);
        } catch (err) {
            alert('전송 실패: ' + err.message);
        }
    };

    if (loading) return <div className="p-10 text-center text-gray-400">로딩 중...</div>;

    // View: Chat List
    if (!selectedMatch && !isNewChat) {
        return (
            <div className="animate-fade-in pb-20 p-4">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">메시지</h2>
                    <button
                        onClick={() => setIsNewChat(true)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-blue-700 transition active:scale-95"
                    >
                        선생님께 메시지 보내기
                    </button>
                </div>

                {matches.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <MessageCircle size={48} className="mb-4 text-gray-200" />
                        <p>주고받은 메시지가 없습니다.</p>
                        <p className="text-xs mt-2">우측 상단 버튼을 눌러 선생님께 메시지를 보내보세요!</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {matches.map(({ user, lastMessage, unreadCount }) => (
                            <div
                                key={user.id}
                                onClick={() => setSelectedMatch({ user })}
                                className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 cursor-pointer hover:bg-gray-50 transition active:scale-95"
                            >
                                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
                                    {user.name?.[0]}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <h3 className="font-bold text-gray-800 truncate">{user.name} <span className="text-xs text-gray-400 font-normal">({user.user_group || 'STAFF'})</span></h3>
                                        <span className="text-[10px] text-gray-400">{new Date(lastMessage.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-sm text-gray-600 truncate">{lastMessage.content}</p>
                                </div>
                                {unreadCount > 0 && (
                                    <div className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] font-bold">
                                        {unreadCount}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // View: New Chat Selection
    if (isNewChat && !selectedMatch) {
        return (
            <div className="animate-fade-in pb-20 p-4">
                <div className="flex items-center gap-3 mb-6">
                    <button onClick={() => setIsNewChat(false)} className="p-2 hover:bg-gray-100 rounded-full">
                        <ArrowLeft size={24} className="text-gray-600" />
                    </button>
                    <h2 className="text-2xl font-bold text-gray-800">선생님 선택</h2>
                </div>

                <div className="space-y-3">
                    {staffList.length === 0 ? (
                        <div className="text-center py-20 text-gray-400">등록된 선생님이 없습니다.</div>
                    ) : (
                        staffList.map(staff => (
                            <div
                                key={staff.id}
                                onClick={() => {
                                    setSelectedMatch({ user: staff });
                                    setIsNewChat(false);
                                }}
                                className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 cursor-pointer hover:bg-gray-50 transition active:scale-95"
                            >
                                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg">
                                    {staff.name?.[0]}
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-gray-800">{staff.name}</h3>
                                    <p className="text-xs text-gray-500">{staff.user_group || 'STAFF'}</p>
                                </div>
                                <Send size={18} className="text-blue-500" />
                            </div>
                        ))
                    )}
                </div>
            </div>
        );
    }

    // View: Detail Thread
    return (
        <div className="flex flex-col h-[calc(100vh-80px)] bg-gray-50 animate-slide-in-right">
            {/* Header */}
            <div className="bg-white p-4 flex items-center gap-3 shadow-sm z-10 sticky top-0">
                <button onClick={() => setSelectedMatch(null)} className="p-2 hover:bg-gray-100 rounded-full">
                    <ArrowLeft size={24} className="text-gray-600" />
                </button>
                <div>
                    <h3 className="font-bold text-lg text-gray-800">{selectedMatch.user.name}</h3>
                    <p className="text-xs text-gray-500">{selectedMatch.user.user_group || 'STAFF'}</p>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <AnimatePresence initial={false}>
                    {chatHistory.map((msg, idx) => {
                        const isMe = msg.sender_id === currentUser.id;
                        return (
                            <motion.div
                                key={msg.id || idx}
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                            >
                                <div className={`max-w-[80%] p-3.5 px-4 rounded-2xl text-sm leading-relaxed shadow-sm
                                    ${isMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-700 rounded-bl-none border border-gray-100'}`}
                                >
                                    {msg.content}
                                    {extractUrls(msg.content).map((url, i) => (
                                        <LinkPreview key={i} url={url} size="small" />
                                    ))}
                                </div>
                                <div className="flex items-center gap-1.5 mt-1 px-1">
                                    {isMe && (
                                        msg.is_read ? (
                                            <span className="text-[10px] text-blue-500 font-bold">읽음</span>
                                        ) : (
                                            <span className="text-[10px] text-gray-300">전송됨</span>
                                        )
                                    )}
                                    <span className="text-[10px] text-gray-400 font-medium">
                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
                <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 bg-white border-t border-gray-100 sticky bottom-0 mb-[60px]"> {/* mb for tab bar */}
                <form onSubmit={handleSendMessage} className="flex gap-2">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        placeholder="메시지를 입력하세요..."
                        className="flex-1 bg-gray-100 rounded-full px-5 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition"
                    />
                    <button type="submit" disabled={!newMessage.trim()} className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 disabled:bg-gray-300 transition active:scale-90">
                        <Send size={20} />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default StudentChat;
