import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Bell, ChevronRight, Copy, Eye, ImagePlus, Loader2, MessageCircle, MoreHorizontal, Plus, Search, Send, SmilePlus, Users, X } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { dmApi } from '../../api/dmApi';
import { useDirectMessages } from '../../hooks/useDirectMessages';
import { isAdminOrStaff } from '../../utils/userUtils';
import { userApi } from '../../api/userApi';
import UserAvatar from '../common/UserAvatar';
import { promptAndEnableNotification } from '../../firebase';
import NoticeReactions from './NoticeReactions';
import { confirmApp } from '../../utils/appDialog';
import { calculateAge } from '../../utils/dateUtils';
import { compressImage } from '../../utils/imageUtils';

const isLegacyStaff = user => isAdminOrStaff(user)
    || ['admin', 'master', 'staff', 'rok'].includes(String(user?.role || '').toLowerCase())
    || user?.is_master;

const formatTime = value => value ? new Intl.DateTimeFormat('ko-KR', {
    hour: 'numeric', minute: '2-digit',
}).format(new Date(value)) : '';

const dateKey = value => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(value));
const formatDate = value => new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'long',
}).format(new Date(value));
const sameMinute = (left, right) => left && right
    && Math.floor(new Date(left).getTime() / 60000) === Math.floor(new Date(right).getTime() / 60000);

const conversationTitle = (conversation, currentUserId) => {
    if (conversation.kind === 'GROUP' && conversation.title) return conversation.title;
    const others = (conversation.participants || []).filter(member => member.user_id !== currentUserId);
    if (!others.length) return conversation.membership?.display_title || (conversation.kind === 'GROUP' ? '그룹 대화' : '대화');
    const names = others.map(member => member.user?.name || '알 수 없는 사용자');
    return names.length > 3 ? `${names.slice(0, 3).join(', ')} 외 ${names.length - 3}명` : names.join(', ');
};

const directConversationPartner = (conversation, currentUserId) => conversation.kind === 'DIRECT'
    ? (conversation.participants || []).find(member => member.user_id !== currentUserId)?.user || null
    : null;

const DirectMessagesModal = ({ currentUser, onClose, onUnreadChange, initialConversationId = null }) => {
    const { conversations, unreadCount, loading, refresh } = useDirectMessages(currentUser?.id);
    const [selectedId, setSelectedId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [participants, setParticipants] = useState([]);
    const [composer, setComposer] = useState('');
    const [sending, setSending] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [pickerMessageId, setPickerMessageId] = useState(null);
    const [pickerOpenToken, setPickerOpenToken] = useState(0);
    const [actionMessage, setActionMessage] = useState(null);
    const [participantsOpen, setParticipantsOpen] = useState(false);
    const [renameOpen, setRenameOpen] = useState(false);
    const [renameValue, setRenameValue] = useState('');
    const [peopleMode, setPeopleMode] = useState(null);
    const [candidates, setCandidates] = useState([]);
    const [selectedPeople, setSelectedPeople] = useState([]);
    const [draftRecipients, setDraftRecipients] = useState([]);
    const [search, setSearch] = useState('');
    const [busy, setBusy] = useState(false);
    const [typingUsers, setTypingUsers] = useState([]);
    const [notificationSettingsOpen, setNotificationSettingsOpen] = useState(false);
    const [pushPreferences, setPushPreferences] = useState({ enabled: true, preview_enabled: false, group_enabled: true });
    const [pushPreferencesLoading, setPushPreferencesLoading] = useState(true);
    const [pushPreferencesSaving, setPushPreferencesSaving] = useState(false);
    const [imagePreview, setImagePreview] = useState(null);
    const [copyNotice, setCopyNotice] = useState(false);
    const endRef = useRef(null);
    const imageInputRef = useRef(null);
    const typingTimerRef = useRef(null);
    const lastTypingSentRef = useRef(0);
    const messagePressTimerRef = useRef(null);
    const historyViewRef = useRef(null);
    const handlingHistoryPopRef = useRef(false);
    const selected = conversations.find(conversation => conversation.id === selectedId) || null;
    const draftConversation = draftRecipients.length ? {
        kind: draftRecipients.length > 1 ? 'GROUP' : 'DIRECT',
        title: null,
        participants: draftRecipients.map(person => ({ user_id: person.id, user: person })),
        membership: null,
        draft: true,
    } : null;
    const activeConversation = selected || draftConversation;
    const currentIsStaff = isAdminOrStaff(currentUser);

    const historyView = imagePreview ? 'image' : renameOpen ? 'rename' : participantsOpen ? 'participants' : settingsOpen ? 'settings'
        : notificationSettingsOpen ? 'notifications' : peopleMode ? 'people'
            : activeConversation ? 'thread' : 'list';

    const closeTopLayer = useCallback(() => {
        if (imagePreview) setImagePreview(null);
        else if (renameOpen) setRenameOpen(false);
        else if (participantsOpen) setParticipantsOpen(false);
        else if (actionMessage) setActionMessage(null);
        else if (pickerMessageId) setPickerMessageId(null);
        else if (settingsOpen) setSettingsOpen(false);
        else if (notificationSettingsOpen) setNotificationSettingsOpen(false);
        else if (peopleMode) { setPeopleMode(null); setSelectedPeople([]); }
        else if (activeConversation) { setSelectedId(null); setDraftRecipients([]); setMessages([]); }
        else onClose();
    }, [actionMessage, activeConversation, imagePreview, notificationSettingsOpen, onClose,
        participantsOpen, peopleMode, pickerMessageId, renameOpen, settingsOpen]);

    useEffect(() => {
        const handleEscape = event => {
            if (event.key !== 'Escape' || event.defaultPrevented) return;
            if (document.getElementById('app-confirm-title')) return;
            event.preventDefault();
            closeTopLayer();
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [closeTopLayer]);

    useEffect(() => {
        if (handlingHistoryPopRef.current) {
            handlingHistoryPopRef.current = false;
            historyViewRef.current = historyView;
            return;
        }
        if (historyViewRef.current === historyView) return;
        window.history.pushState({ ...(window.history.state || {}), sciDmView: historyView }, '');
        historyViewRef.current = historyView;
    }, [historyView]);

    useEffect(() => {
        const handlePopState = () => {
            handlingHistoryPopRef.current = true;
            if (imagePreview) setImagePreview(null);
            else if (renameOpen) setRenameOpen(false);
            else if (participantsOpen) setParticipantsOpen(false);
            else if (settingsOpen) setSettingsOpen(false);
            else if (notificationSettingsOpen) setNotificationSettingsOpen(false);
            else if (peopleMode) { setPeopleMode(null); setSelectedPeople([]); }
            else if (activeConversation) { setSelectedId(null); setDraftRecipients([]); setMessages([]); }
            else onClose();
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [activeConversation, imagePreview, notificationSettingsOpen, onClose, participantsOpen, peopleMode, renameOpen, settingsOpen]);

    useEffect(() => {
        if (initialConversationId) setSelectedId(initialConversationId);
    }, [initialConversationId]);

    useEffect(() => {
        let active = true;
        setPushPreferencesLoading(true);
        dmApi.fetchPushPreferences(currentUser.id)
            .then(preferences => { if (active) setPushPreferences(preferences); })
            .catch(error => console.error('DM 알림 설정을 불러오지 못했습니다.', error))
            .finally(() => { if (active) setPushPreferencesLoading(false); });
        return () => { active = false; };
    }, [currentUser.id]);

    const updatePushPreference = async (key, value) => {
        if (pushPreferencesSaving) return;
        const previous = pushPreferences;
        const next = { ...previous, [key]: value };
        setPushPreferences(next);
        setPushPreferencesSaving(true);
        try {
            if (key === 'enabled' && value) {
                const permission = await promptAndEnableNotification(currentUser.id);
                if (!permission.success && ['denied', 'unsupported'].includes(permission.reason)) {
                    throw new Error(permission.reason === 'denied'
                        ? '브라우저 설정에서 알림을 허용해 주세요.'
                        : '이 기기에서는 푸시 알림을 사용할 수 없어요.');
                }
            }
            setPushPreferences(await dmApi.savePushPreferences(currentUser.id, next));
        } catch (error) {
            setPushPreferences(previous);
            window.alert(error.message || 'DM 알림 설정을 저장하지 못했습니다.');
        } finally { setPushPreferencesSaving(false); }
    };

    useEffect(() => { onUnreadChange?.(unreadCount); }, [onUnreadChange, unreadCount]);

    const loadThread = useCallback(async conversationId => {
        const [nextMessages, nextParticipants] = await Promise.all([
            dmApi.fetchMessages(conversationId), dmApi.fetchParticipants(conversationId),
        ]);
        setMessages(nextMessages);
        setParticipants(nextParticipants);
        await dmApi.markRead(conversationId);
        refresh();
        requestAnimationFrame(() => endRef.current?.scrollIntoView({ block: 'end' }));
    }, [refresh]);

    useEffect(() => {
        if (!selectedId) return undefined;
        const activeConversationKey = 'sci_active_dm_conversation';
        const syncForegroundConversation = () => {
            if (document.visibilityState === 'visible') sessionStorage.setItem(activeConversationKey, selectedId);
            else if (sessionStorage.getItem(activeConversationKey) === selectedId) sessionStorage.removeItem(activeConversationKey);
        };
        syncForegroundConversation();
        document.addEventListener('visibilitychange', syncForegroundConversation);
        const refreshTyping = async () => {
            try {
                const rows = await dmApi.fetchTyping(selectedId, currentUser.id);
                setTypingUsers(rows.map(row => ({ userId: row.user_id, name: row.user?.name || '참여자', seenAt: new Date(row.updated_at).getTime() })));
            } catch (error) { console.error('입력 상태를 불러오지 못했습니다.', error); }
        };
        loadThread(selectedId).catch(error => console.error('DM을 불러오지 못했습니다.', error));
        refreshTyping();
        const channel = supabase.channel(`dm-thread:${selectedId}`);
        channel
            .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_messages', filter: `conversation_id=eq.${selectedId}` }, () => loadThread(selectedId))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_message_reactions' }, () => loadThread(selectedId))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_typing_states', filter: `conversation_id=eq.${selectedId}` }, refreshTyping)
            .subscribe();
        const cleanup = window.setInterval(() => {
            setTypingUsers(current => current.filter(item => Date.now() - item.seenAt < 5000));
            refreshTyping();
        }, 2000);
        return () => {
            document.removeEventListener('visibilitychange', syncForegroundConversation);
            if (sessionStorage.getItem(activeConversationKey) === selectedId) sessionStorage.removeItem(activeConversationKey);
            window.clearInterval(cleanup);
            window.clearTimeout(typingTimerRef.current);
            dmApi.clearTyping(selectedId, currentUser.id).catch(() => {});
            supabase.removeChannel(channel);
        };
    }, [currentUser.id, loadThread, selectedId]);

    const signalTyping = () => {
        if (!selectedId) return;
        if (Date.now() - lastTypingSentRef.current > 1500) {
            lastTypingSentRef.current = Date.now();
            dmApi.setTyping(selectedId, currentUser.id).catch(() => {});
        }
        window.clearTimeout(typingTimerRef.current);
        typingTimerRef.current = window.setTimeout(() => {
            dmApi.clearTyping(selectedId, currentUser.id).catch(() => {});
        }, 2500);
    };

    const submitMessage = async event => {
        event.preventDefault();
        const content = composer.trim();
        if (!content || (!selectedId && !draftRecipients.length) || sending) return;
        setSending(true);
        try {
            let conversationId = selectedId;
            if (!conversationId) {
                conversationId = await dmApi.startConversation(draftRecipients.map(person => person.id), content);
                setDraftRecipients([]);
                setSelectedId(conversationId);
            } else {
                await dmApi.send(conversationId, content, currentUser.id);
            }
            setComposer('');
            dmApi.clearTyping(conversationId, currentUser.id).catch(() => {});
            await refresh();
            await loadThread(conversationId);
        } catch (error) { window.alert(error.message || '메시지를 보내지 못했습니다.'); }
        finally { setSending(false); }
    };

    const sendImage = async event => {
        const source = event.target.files?.[0];
        event.target.value = '';
        if (!source || sending || (!selectedId && !draftRecipients.length)) return;
        if (!source.type.startsWith('image/')) {
            window.alert('사진 파일만 보낼 수 있어요.');
            return;
        }
        if (source.size > 20 * 1024 * 1024) {
            window.alert('20MB 이하의 사진을 선택해 주세요.');
            return;
        }
        setSending(true);
        let mediaPath = null;
        try {
            const optimized = await compressImage(source, 1600, 0.82);
            if (optimized.size > 10 * 1024 * 1024) throw new Error('사진 용량을 10MB 이하로 줄여 주세요.');
            mediaPath = `${currentUser.id}/${crypto.randomUUID()}.jpg`;
            await dmApi.uploadImage(mediaPath, optimized);
            let conversationId = selectedId;
            if (!conversationId) {
                conversationId = await dmApi.startImageConversation(
                    draftRecipients.map(person => person.id), mediaPath, optimized.type, currentUser.id,
                );
                setDraftRecipients([]);
                setSelectedId(conversationId);
            } else await dmApi.sendImage(conversationId, mediaPath, optimized.type, currentUser.id);
            mediaPath = null;
            await refresh();
            await loadThread(conversationId);
        } catch (error) {
            if (mediaPath) dmApi.removeUnattachedImage(mediaPath).catch(() => {});
            window.alert(error.message || '사진을 보내지 못했습니다.');
        } finally { setSending(false); }
    };

    const openPeople = async mode => {
        setBusy(true);
        try {
            const rows = currentIsStaff ? await dmApi.fetchCandidates() : await userApi.fetchStaff();
            setCandidates(rows.filter(person => person.id !== currentUser.id));
            setSelectedPeople([]);
            setPeopleMode(mode);
            setSearch('');
            setSettingsOpen(false);
        } catch (error) { window.alert(error.message || '대화 상대를 불러오지 못했습니다.'); }
        finally { setBusy(false); }
    };

    const choosePerson = async person => {
        setSelectedPeople(current => {
            if (current.some(item => item.id === person.id)) return current.filter(item => item.id !== person.id);
            if (!currentIsStaff && peopleMode === 'NEW') return [person];
            return [...current, person];
        });
    };

    const confirmPeopleSelection = async () => {
        if (!selectedPeople.length || busy) return;
        if (peopleMode === 'NEW') {
            setDraftRecipients(selectedPeople);
            setParticipants([]);
            setMessages([]);
            setSelectedId(null);
            setPeopleMode(null);
            setComposer('');
            return;
        }
        setBusy(true);
        try {
            let conversationId = selected.id;
            if (selected.kind === 'DIRECT') conversationId = await dmApi.createGroup(selected.id, selectedPeople.map(person => person.id));
            else for (const person of selectedPeople) await dmApi.invite(selected.id, person.id);
            await refresh();
            setPeopleMode(null);
            setSelectedPeople([]);
            setSelectedId(conversationId);
            await loadThread(conversationId);
        } catch (error) { window.alert(error.message || '선택한 사람을 추가하지 못했습니다.'); }
        finally { setBusy(false); }
    };

    const filteredCandidates = useMemo(() => {
        const needle = search.trim().toLowerCase();
        if (!needle) return !currentIsStaff && peopleMode === 'NEW' ? candidates : [];
        const activeIds = new Set(participants.map(member => member.user_id));
        return candidates.filter(person => {
            if (activeIds.has(person.id) && peopleMode === 'INVITE') return false;
            if (peopleMode === 'NEW') {
                if (!currentIsStaff && !isLegacyStaff(person)) return false;
            }
            return `${person.name || ''} ${person.school || ''}`.toLowerCase().includes(needle);
        });
    }, [candidates, currentIsStaff, participants, peopleMode, search]);

    const renameGroup = async () => {
        if (!renameValue.trim()) return;
        try { await dmApi.rename(selected.id, renameValue); await refresh(); setSettingsOpen(false); setRenameOpen(false); }
        catch (error) { window.alert(error.message || '이름을 변경하지 못했습니다.'); }
    };

    const leave = async () => {
        if (!await confirmApp('대화방에서 나가면 이 대화와 메시지를 더 이상 볼 수 없어요.', { title: '대화방에서 나갈까요?', confirmText: '나가기', tone: 'danger' })) return;
        try { await dmApi.leave(selected.id); setSelectedId(null); setSettingsOpen(false); await refresh(); }
        catch (error) { window.alert(error.message || '대화방에서 나가지 못했습니다.'); }
    };

    const report = async () => {
        if (!await confirmApp('최근 대화 내용이 확인을 위해 전달돼요. 상대방에게 신고한 사람은 표시되지 않아요.', { title: '이 대화를 신고할까요?', confirmText: '신고', tone: 'danger' })) return;
        try { await dmApi.report(selected.id); window.alert('신고가 접수됐어요.'); setSettingsOpen(false); }
        catch (error) { window.alert(error?.code === '23505' ? '이미 신고가 접수된 대화예요.' : (error.message || '신고를 접수하지 못했습니다.')); }
    };

    const revoke = async message => {
        setActionMessage(null);
        if (!await confirmApp('이미 확인했거나 기기 알림에 표시된 내용은 되돌릴 수 없어요.', { title: '메시지를 삭제할까요?', confirmText: '삭제', tone: 'danger' })) return;
        try { await dmApi.revoke(message.id); await loadThread(selected.id); }
        catch (error) { window.alert(error.message || '메시지를 취소하지 못했습니다.'); }
    };

    const react = async (messageId, emoji) => {
        try { await dmApi.toggleReaction(messageId, emoji); setPickerMessageId(null); await loadThread(selected.id); }
        catch (error) { window.alert(error.message || '반응을 남기지 못했습니다.'); }
    };

    const beginMessagePress = message => {
        if (message.revoked_at) return;
        window.clearTimeout(messagePressTimerRef.current);
        messagePressTimerRef.current = window.setTimeout(() => {
            setActionMessage(message);
        }, 420);
    };

    const endMessagePress = () => window.clearTimeout(messagePressTimerRef.current);
    const copyMessage = async message => {
        if (message.message_type !== 'TEXT' || !message.content) return;
        try {
            if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(message.content);
            else {
                const textarea = document.createElement('textarea');
                textarea.value = message.content;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                textarea.remove();
            }
            setActionMessage(null);
            setCopyNotice(true);
            window.setTimeout(() => setCopyNotice(false), 1600);
        } catch { setCopyNotice(false); }
    };
    const openFullReactionPicker = message => {
        setActionMessage(null);
        setPickerMessageId(message.id);
        setPickerOpenToken(token => token + 1);
    };

    const renderList = () => (
        <div className="flex h-full flex-col bg-[#FFFDF9]">
            <div className="relative min-h-[77px] overflow-hidden border-b border-[#B92F20] bg-[#CF3A27] px-5 py-4 text-white">
                <div className="relative z-10 flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/15 shadow-inner"><MessageCircle size={22} strokeWidth={2.2} /></div>
                        <div className="min-w-0"><h2 className="text-xl font-black tracking-tight">DM</h2><p className="mt-0.5 truncate text-xs font-semibold text-white/75">이야기를 나누며 경험하는 연결의 즐거움</p></div>
                    </div>
                    <div className="flex shrink-0 gap-2"><button type="button" onClick={() => setNotificationSettingsOpen(true)} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/20" aria-label="DM 알림 설정"><Bell size={19} /></button><button type="button" onClick={() => openPeople('NEW')} className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F8DF53] text-[#6E2A20] shadow-sm transition-transform active:scale-95" aria-label="새 메시지"><Plus size={19} strokeWidth={2.5} /></button><button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/20" aria-label="메시지 닫기"><X size={19} /></button></div>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#CF3A27]" /></div> : conversations.length === 0 ? <div className="py-20 text-center"><MessageCircle className="mx-auto text-[#D9CABC]" size={44} /><p className="mt-4 font-bold text-[#71665C]">아직 대화가 없어요.</p><button type="button" onClick={() => openPeople('NEW')} className="mt-4 rounded-xl bg-[#CF3A27] px-4 py-2.5 text-sm font-bold text-white">첫 메시지 보내기</button></div> : conversations.map(conversation => { const partner = directConversationPartner(conversation, currentUser.id); return <button type="button" key={conversation.id} onClick={() => setSelectedId(conversation.id)} className="mb-2 flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-[0_2px_12px_rgba(80,52,35,0.06)]">{conversation.kind === 'DIRECT' && partner ? <UserAvatar user={partner} size="h-11 w-11 shrink-0" textSize="text-sm" /> : <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F8E7DE] text-[#CF3A27]"><MessageCircle size={20} /></div>}<div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className="truncate text-sm font-extrabold text-[#332821]">{conversationTitle(conversation, currentUser.id)}</p><span className="shrink-0 text-[10px] text-[#A3958A]">{formatTime(conversation.lastMessage?.created_at)}</span></div><p className="mt-1 truncate text-xs font-medium text-[#8B7B70]">{conversation.lastMessage?.revoked_at ? '메시지가 삭제되었습니다.' : conversation.lastMessage?.message_type === 'IMAGE' ? '사진' : conversation.lastMessage?.content || '대화를 시작해 보세요.'}</p></div>{conversation.unreadCount > 0 && <span className="flex min-w-5 h-5 items-center justify-center rounded-full bg-[#CF3A27] px-1 text-[10px] font-black text-white">{conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}</span>}</button>; })}
            </div>
        </div>
    );

    const PreferenceSwitch = ({ checked, disabled, onChange, label }) => (
        <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
            onClick={() => onChange(!checked)}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#CF3A27]/25 disabled:cursor-not-allowed disabled:opacity-40 ${checked ? 'bg-[#CF3A27]' : 'bg-[#D8CEC5]'}`}>
            <span className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
    );

    const renderNotificationSettings = () => (
        <div className="flex h-full flex-col bg-[#FFFDF9]">
            <div className="flex min-h-[77px] items-center gap-3 border-b border-[#B92F20] bg-[#CF3A27] px-5 py-4 text-white">
                <button type="button" onClick={() => setNotificationSettingsOpen(false)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/20" aria-label="메시지 목록으로"><ArrowLeft size={20} /></button>
                <div><h2 className="text-xl font-black tracking-tight">DM 알림</h2><p className="mt-0.5 text-xs font-semibold text-white/75">이 기기에서 받을 알림을 정해요</p></div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
                <div className="overflow-hidden rounded-2xl bg-white shadow-[0_2px_12px_rgba(80,52,35,0.06)]">
                    <div className="flex items-center gap-3 border-b border-[#EDE3D8] px-4 py-4">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F8E7DE] text-[#CF3A27]"><Bell size={19} /></span>
                        <div className="min-w-0 flex-1"><p className="text-sm font-extrabold text-[#332821]">DM 푸시 알림</p><p className="mt-0.5 text-xs leading-5 text-[#8B7B70]">앱을 보고 있지 않을 때도 새 메시지를 알려줘요.</p></div>
                        <PreferenceSwitch label="DM 푸시 알림" checked={pushPreferences.enabled} disabled={pushPreferencesLoading || pushPreferencesSaving} onChange={value => updatePushPreference('enabled', value)} />
                    </div>
                    <div className="flex items-center gap-3 border-b border-[#EDE3D8] px-4 py-4">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F3EEE8] text-[#71665C]"><Eye size={19} /></span>
                        <div className="min-w-0 flex-1"><p className="text-sm font-extrabold text-[#332821]">메시지 내용 미리보기</p><p className="mt-0.5 text-xs leading-5 text-[#8B7B70]">잠금 화면 알림에 메시지 내용을 표시해요.</p></div>
                        <PreferenceSwitch label="메시지 내용 미리보기" checked={pushPreferences.preview_enabled} disabled={!pushPreferences.enabled || pushPreferencesLoading || pushPreferencesSaving} onChange={value => updatePushPreference('preview_enabled', value)} />
                    </div>
                    <div className="flex items-center gap-3 px-4 py-4">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F3EEE8] text-[#71665C]"><Users size={19} /></span>
                        <div className="min-w-0 flex-1"><p className="text-sm font-extrabold text-[#332821]">그룹 DM 알림</p><p className="mt-0.5 text-xs leading-5 text-[#8B7B70]">그룹 대화의 새 메시지도 푸시로 받아요.</p></div>
                        <PreferenceSwitch label="그룹 DM 알림" checked={pushPreferences.group_enabled} disabled={!pushPreferences.enabled || pushPreferencesLoading || pushPreferencesSaving} onChange={value => updatePushPreference('group_enabled', value)} />
                    </div>
                </div>
                <p className="mt-4 px-1 text-xs leading-5 text-[#9A8C7D]">미리보기를 끄면 보낸 사람이나 대화방 이름만 표시되고 메시지 내용은 숨겨져요.</p>
            </div>
        </div>
    );

    const renderPeople = () => (
        <div className="flex h-full flex-col bg-[#FFFDF9]">
            <div className="flex min-h-[77px] items-center gap-3 border-b border-[#B92F20] bg-[#CF3A27] px-5 py-4 text-white">
                <button type="button" onClick={() => { setPeopleMode(null); setSelectedPeople([]); }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/20" aria-label="메시지 목록으로"><ArrowLeft size={20} /></button>
                <div className="min-w-0">
                    <h2 className="truncate text-xl font-black tracking-tight">{peopleMode === 'NEW' ? '새 DM' : selected?.kind === 'DIRECT' ? '새 그룹 DM 만들기' : '대화에 초대하기'}</h2>
                    <p className="mt-0.5 truncate text-xs font-semibold text-white/75">{selectedPeople.length > 0 ? `${selectedPeople.length}명 선택됨` : '한 명 또는 여러 명을 선택하세요'}</p>
                </div>
            </div>
            <div className="p-4 pb-2"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A3958A]" size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="이름 또는 학교 검색" className="w-full rounded-2xl border border-[#E7D8C4] bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-[#CF3A27]" /></div>{selectedPeople.length > 0 && <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{selectedPeople.map(person => <button type="button" key={person.id} onClick={() => choosePerson(person)} className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#F8E7DE] py-1.5 pl-2.5 pr-2 text-xs font-bold text-[#9F2E20]">{person.name}<X size={13} /></button>)}</div>}</div><div className="flex-1 overflow-y-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{filteredCandidates.map(person => { const picked = selectedPeople.some(item => item.id === person.id); return <button disabled={busy} type="button" key={person.id} onClick={() => choosePerson(person)} className={`mb-2 flex w-full items-center gap-3 rounded-2xl p-3.5 text-left disabled:opacity-50 ${picked ? 'bg-[#FFF0EC] ring-1 ring-[#CF3A27]/30' : 'bg-white'}`}><UserAvatar user={person} size="w-11 h-11" textSize="text-sm" /><div className="min-w-0 flex-1"><p className="font-extrabold text-[#332821]">{person.name}</p><p className="truncate text-xs text-[#8B7B70]">{person.school || (isLegacyStaff(person) ? '스처쌤' : '학교 정보 없음')}</p></div><span className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-black ${picked ? 'border-[#CF3A27] bg-[#CF3A27] text-white' : 'border-[#D8CEC5] text-transparent'}`}>✓</span></button>; })}</div><div className="border-t border-[#E7D8C4] p-3 pb-[max(12px,env(safe-area-inset-bottom))]"><button type="button" disabled={!selectedPeople.length || busy} onClick={confirmPeopleSelection} className="w-full rounded-2xl bg-[#CF3A27] py-3.5 text-sm font-extrabold text-white disabled:bg-[#D8CEC5]">{busy ? '처리 중…' : peopleMode === 'NEW' ? (selectedPeople.length > 1 ? `${selectedPeople.length}명과 그룹 DM 시작` : '선택한 사람과 DM 시작') : `${selectedPeople.length}명 선택 완료`}</button></div>
        </div>
    );

    const renderThread = () => (
        <div className="flex h-full flex-col bg-[#F8F4EE]">
            <div className="flex min-h-[77px] items-center gap-3 border-b border-[#B92F20] bg-[#CF3A27] px-5 py-4 text-white"><button type="button" onClick={() => { setSelectedId(null); setDraftRecipients([]); setMessages([]); }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/20" aria-label="메시지 목록으로"><ArrowLeft size={20} /></button><div className="min-w-0 flex-1"><h2 className="truncate text-xl font-black tracking-tight text-white">{conversationTitle(activeConversation, currentUser.id)}</h2>{activeConversation?.kind === 'GROUP' && <p className="mt-0.5 text-xs font-semibold text-white/70">{activeConversation.draft ? draftRecipients.length + 1 : participants.length}명</p>}</div>{selected && <button type="button" onClick={() => setSettingsOpen(true)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/20" aria-label="대화 설정"><MoreHorizontal size={20} /></button>}</div>
            <div className="flex-1 overflow-y-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {messages.map((message, index) => {
                    const previous = messages[index - 1];
                    const next = messages[index + 1];
                    const showDate = !previous || dateKey(previous.created_at) !== dateKey(message.created_at);
                    const dateSeparator = showDate && <div className="my-3 flex items-center justify-center" key={`date-${message.id}`}><span className="rounded-full bg-[#EDE5DC] px-3 py-1 text-[11px] font-bold text-[#8B7B70]">{formatDate(message.created_at)}</span></div>;
                    const isChatMessage = ['TEXT', 'IMAGE'].includes(message.message_type) && !message.revoked_at;
                    if (!isChatMessage) return <React.Fragment key={message.id}>{dateSeparator}<div className="my-5 flex items-center gap-3"><span className="h-px flex-1 bg-[#DED5CC]" /><p className="max-w-[72%] text-center text-[11px] font-semibold leading-4 text-[#9A8C7D]">{message.revoked_at ? '메시지가 삭제되었습니다.' : message.content}</p><span className="h-px flex-1 bg-[#DED5CC]" /></div></React.Fragment>;
                    const mine = message.sender_id === currentUser.id;
                    const previousIsSameRun = previous && ['TEXT', 'IMAGE'].includes(previous.message_type) && !previous.revoked_at
                        && previous.sender_id === message.sender_id && dateKey(previous.created_at) === dateKey(message.created_at);
                    const nextIsSameMinute = next && ['TEXT', 'IMAGE'].includes(next.message_type) && !next.revoked_at
                        && next.sender_id === message.sender_id && sameMinute(message.created_at, next.created_at);
                    const showName = activeConversation?.kind === 'GROUP' && !mine && !previousIsSameRun;
                    const reactions = (message.reactions || []).map(reaction => ({ ...reaction, users: reaction.user }));
                    return <React.Fragment key={message.id}>{dateSeparator}<div className={`flex w-full ${previousIsSameRun ? 'mt-1' : 'mt-2.5'} ${mine ? 'justify-end' : 'justify-start'}`}>
                        {!mine && (previousIsSameRun ? <div className="mr-2 h-7 w-7 shrink-0" /> : <UserAvatar user={message.sender} size="mr-2 h-7 w-7 shrink-0" textSize="text-[11px]" />)}
                        <div className={`flex max-w-[82%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
                            {showName && <div className="mb-1 ml-0.5 text-[10.5px] font-bold text-[#7E7065]">{message.sender?.name}</div>}
                            <div className={`flex max-w-full items-end gap-1.5 ${mine ? '' : 'flex-row-reverse'}`}>
                                {!nextIsSameMinute && <span className="mb-0.5 shrink-0 whitespace-nowrap text-[9.5px] text-[#A99C91]">{formatTime(message.created_at)}</span>}
                                <button type="button" aria-label="메시지 동작 열기"
                                    onPointerDown={() => beginMessagePress(message)} onPointerUp={endMessagePress} onPointerCancel={endMessagePress} onPointerLeave={endMessagePress}
                                    onContextMenu={event => { event.preventDefault(); setActionMessage(message); }}
                                    className={`max-w-full select-none overflow-hidden whitespace-pre-wrap break-words text-left text-sm leading-5 shadow-sm [touch-action:pan-y] ${message.message_type === 'IMAGE' ? `rounded-2xl ${mine ? 'rounded-br-md bg-[#D93625]' : 'rounded-bl-md border border-[#EEE6DE] bg-white'} p-1` : `rounded-2xl px-3.5 py-2.5 ${mine ? 'rounded-br-md bg-[#D93625] text-white' : 'rounded-bl-md border border-[#EEE6DE] bg-white text-[#40352E]'}`}`}
                                    style={{ WebkitTouchCallout: 'none' }} onClick={() => message.media_url && setImagePreview(message.media_url)}>{message.message_type === 'IMAGE' ? (message.media_url ? <img src={message.media_url} alt="대화에서 보낸 사진" className="max-h-72 w-auto max-w-full rounded-[12px] object-cover" /> : <span className="block px-3 py-5 text-xs text-[#8B7B70]">사진을 불러올 수 없어요.</span>) : message.content}</button>
                            </div>
                            {reactions.length > 0 && <div className={mine ? 'origin-right' : 'origin-left'}><NoticeReactions reactions={reactions} currentUserId={currentUser.id} onToggleReaction={emoji => react(message.id, emoji)} hideAddButton /></div>}
                        </div>
                    </div></React.Fragment>;
                })}
                {typingUsers.length > 0 && <div className="mb-1 mt-2 flex items-end gap-2"><div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#DED5CC] bg-white text-[11px] font-bold text-[#71665C]">{typingUsers[0].name?.[0] || '·'}</div><div><p className="mb-1 ml-1 text-[10px] font-bold text-[#8B7B70]">{typingUsers.length === 1 ? typingUsers[0].name : `${typingUsers[0].name} 외 ${typingUsers.length - 1}명`}</p><div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-[#E7DED5] bg-white px-3.5 py-2.5 shadow-sm"><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#B4A79D] [animation-delay:-0.32s]" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#B4A79D] [animation-delay:-0.16s]" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#B4A79D]" /></div></div></div>}
                <div ref={endRef} />
            </div>
            <form onSubmit={submitMessage} className="flex gap-2 border-t border-[#E7D8C4] bg-[#FFFDF9] p-3 pb-[max(12px,env(safe-area-inset-bottom))]"><input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={sendImage} className="hidden" /><button type="button" disabled={sending} onClick={() => imageInputRef.current?.click()} className="rounded-2xl bg-[#F2ECE5] p-3 text-[#71665C] disabled:opacity-40" aria-label="사진 보내기"><ImagePlus size={20} /></button><input value={composer} maxLength={2000} onChange={event => { setComposer(event.target.value); if (event.target.value) signalTyping(); }} placeholder="메시지를 입력하세요" className="min-w-0 flex-1 rounded-2xl bg-[#F2ECE5] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#CF3A27]/20" /><button disabled={sending || !composer.trim()} className="rounded-2xl bg-[#CF3A27] p-3 text-white disabled:bg-[#D7CCC3]" aria-label="메시지 보내기">{sending ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}</button></form>

            {imagePreview && <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setImagePreview(null)}><button type="button" onClick={() => setImagePreview(null)} className="absolute right-4 top-4 rounded-full bg-white/15 p-2 text-white" aria-label="사진 닫기"><X /></button><img src={imagePreview} alt="대화 사진 크게 보기" className="max-h-full max-w-full object-contain" onClick={event => event.stopPropagation()} /></div>}

            {actionMessage && <div className="absolute inset-0 z-40 flex items-end bg-black/30" onClick={() => setActionMessage(null)}><div className="w-full rounded-t-[26px] bg-white px-5 pb-[max(22px,env(safe-area-inset-bottom))] pt-3 shadow-2xl" onClick={event => event.stopPropagation()}><div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#D8CEC5]" /><div className="flex items-center justify-center gap-2">{['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => <button type="button" key={emoji} onClick={() => { setActionMessage(null); react(actionMessage.id, emoji); }} className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F7F3EF] text-xl active:scale-90">{emoji}</button>)}<button type="button" onClick={() => openFullReactionPicker(actionMessage)} className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F7F3EF] text-[#71665C]" aria-label="다른 이모지"><SmilePlus size={20} /></button></div>{actionMessage.message_type === 'TEXT' && <button type="button" onClick={() => copyMessage(actionMessage)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#F4F0EC] py-3 text-sm font-extrabold text-[#5F544B]"><Copy size={17} /> 메시지 복사</button>}{actionMessage.sender_id === currentUser.id && (Date.now() - new Date(actionMessage.created_at).getTime() <= 600000 ? <button type="button" onClick={() => revoke(actionMessage)} className="mt-2 w-full rounded-2xl bg-[#FFF0ED] py-3 text-sm font-extrabold text-[#CF3A27]">전송 취소</button> : <div className="mt-2 rounded-2xl bg-[#F4F0EC] py-3 text-center text-xs font-bold text-[#9A8C7D]">전송 취소 가능 시간이 지났어요.</div>)}</div></div>}
            {pickerMessageId && <div className="hidden"><NoticeReactions reactions={[]} currentUserId={currentUser.id} onToggleReaction={emoji => react(pickerMessageId, emoji)} hideAddButton pickerOpenToken={pickerOpenToken} /></div>}
            {copyNotice && <div className="pointer-events-none absolute bottom-24 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#332821] px-4 py-2 text-xs font-bold text-white shadow-lg">메시지를 복사했어요.</div>}

            {settingsOpen && <div className="absolute inset-0 z-30 flex items-end bg-black/35" onClick={() => setSettingsOpen(false)}><div className="w-full rounded-t-[28px] bg-[#FFFDF9] p-5 pb-[max(24px,env(safe-area-inset-bottom))]" onClick={event => event.stopPropagation()}><div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-black text-[#332821]">대화방 정보</h3><button type="button" onClick={() => setSettingsOpen(false)} className="p-2 text-[#71665C]"><X size={20} /></button></div><div className="divide-y divide-[#EDE3D8] rounded-2xl bg-white px-4">{selected?.kind === 'GROUP' && <button type="button" onClick={() => { setParticipantsOpen(true); setSettingsOpen(false); }} className="flex w-full items-center justify-between py-4 text-sm font-bold text-[#40352E]">참여자 보기 <span className="text-[#9A8C7D]">{participants.length}명</span></button>}{currentIsStaff && <button type="button" onClick={() => openPeople('INVITE')} className="w-full py-4 text-left text-sm font-bold text-[#40352E]">학생 또는 스처쌤 초대</button>}{currentIsStaff && selected?.kind === 'GROUP' && <button type="button" onClick={() => { setRenameValue(selected?.title || ''); setRenameOpen(true); setSettingsOpen(false); }} className="w-full py-4 text-left text-sm font-bold text-[#40352E]">대화방 이름 변경</button>}</div><div className="mt-4 divide-y divide-[#F0DDD8] rounded-2xl bg-white px-4"><button type="button" onClick={report} className="w-full py-4 text-left text-sm font-bold text-[#B24A3B]">대화 신고하기</button><button type="button" onClick={leave} className="w-full py-4 text-left text-sm font-bold text-[#CF3A27]">대화방 나가기 및 삭제</button></div></div></div>}

            {participantsOpen && <div className="absolute inset-0 z-30 flex items-end bg-black/35" onClick={() => setParticipantsOpen(false)}><div className="flex max-h-[70%] w-full flex-col rounded-t-[28px] bg-[#FFFDF9] shadow-2xl" onClick={event => event.stopPropagation()}><div className="mx-auto mt-3 h-1 w-10 rounded-full bg-[#D8CEC5]" /><div className="flex items-center justify-between px-5 pb-3 pt-4"><h3 className="text-lg font-black text-[#332821]">참여자 {participants.length}명</h3><button type="button" onClick={() => setParticipantsOpen(false)} className="rounded-full p-2 text-[#71665C]" aria-label="참여자 닫기"><X size={20} /></button></div><div className="overflow-y-auto border-t border-[#E7D8C4] px-5 pb-[max(18px,env(safe-area-inset-bottom))] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{participants.map(member => { const staff = member.joined_as_staff || isLegacyStaff(member.user); const age = staff ? null : calculateAge(member.user?.birth); return <div key={member.id} className="flex items-center gap-3 border-b border-[#EEE5DC] py-2.5 last:border-0"><UserAvatar user={member.user} size="h-10 w-10" textSize="text-sm" /><div className="min-w-0 leading-tight"><p className="truncate font-extrabold text-[#332821]">{member.user?.name || '알 수 없는 사용자'} {!staff && <span className="text-xs font-semibold text-[#9A8C7D]">({member.user?.gender || '-'} / {age ? `${age}세` : '-'})</span>}</p><p className="mt-1 truncate text-xs text-[#8B7B70]">{member.user?.school || (staff ? '스처쌤' : '학교 정보 없음')}</p></div></div>; })}</div></div></div>}

            {renameOpen && <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 p-5"><form onSubmit={event => { event.preventDefault(); renameGroup(); }} className="w-full rounded-3xl bg-white p-5 shadow-2xl"><h3 className="text-lg font-black text-[#332821]">대화방 이름 변경</h3><input autoFocus maxLength={40} value={renameValue} onChange={event => setRenameValue(event.target.value)} className="mt-4 w-full rounded-2xl border border-[#E7D8C4] px-4 py-3 text-sm outline-none focus:border-[#CF3A27]" placeholder="대화방 이름" /><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => setRenameOpen(false)} className="rounded-xl bg-[#F1ECE7] py-3 text-sm font-bold text-[#71665C]">취소</button><button type="submit" disabled={!renameValue.trim()} className="rounded-xl bg-[#CF3A27] py-3 text-sm font-bold text-white disabled:opacity-40">변경</button></div></form></div>}
        </div>
    );

    return <div className="fixed inset-0 z-[10030] flex items-stretch justify-center bg-black/45 backdrop-blur-sm md:p-5" onClick={closeTopLayer}><div role="dialog" aria-modal="true" aria-label="DM" onClick={event => event.stopPropagation()} className="relative h-full w-full overflow-hidden bg-[#FFFDF9] shadow-2xl md:h-[min(820px,calc(100vh-40px))] md:max-w-lg md:rounded-[30px]">{notificationSettingsOpen ? renderNotificationSettings() : peopleMode ? renderPeople() : activeConversation ? renderThread() : renderList()}</div></div>;
};

export default DirectMessagesModal;
