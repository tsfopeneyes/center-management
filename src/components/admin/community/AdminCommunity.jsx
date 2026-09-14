import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Copy, Eye, EyeOff, Hash, Link2, MessageCircle, Pencil, Plus, Search, Send, UserPlus, Users, X } from 'lucide-react';
import { communityChannelsApi } from '../../../api/communityChannelsApi';
import { challengeCommunityApi } from '../../../api/challengeCommunityApi';
import { commentReactionsApi } from '../../../api/commentReactionsApi';
import { supabase } from '../../../supabaseClient';
import NoticeReactions from '../../student/NoticeReactions';
import UserAvatar from '../../common/UserAvatar';
import useCommentReactionLongPress from '../../../hooks/useCommentReactionLongPress';
import { isAdminOrStaff } from '../../../utils/userUtils';

const countOf = value => value?.[0]?.count || 0;
const sourceLabel = channel => channel.source_notice?.title || null;
const MISSION_COLORS = [
    'bg-blue-50 text-blue-600', 'bg-violet-50 text-violet-600', 'bg-emerald-50 text-emerald-700',
    'bg-amber-50 text-amber-700', 'bg-rose-50 text-rose-600', 'bg-cyan-50 text-cyan-700',
];
const missionColor = mission => {
    const key = String(mission?.id || mission?.title || '');
    const hash = [...key].reduce((value, character) => ((value * 31) + character.charCodeAt(0)) >>> 0, 0);
    return MISSION_COLORS[hash % MISSION_COLORS.length];
};

export default function AdminCommunity() {
    const [channels, setChannels] = useState([]);
    const [posts, setPosts] = useState([]);
    const [activeChannel, setActiveChannel] = useState(null);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [postsLoading, setPostsLoading] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [saving, setSaving] = useState(false);
    const [members, setMembers] = useState([]);
    const [users, setUsers] = useState([]);
    const [challenges, setChallenges] = useState([]);
    const [memberQuery, setMemberQuery] = useState('');
    const [programQuery, setProgramQuery] = useState('');
    const [showEdit, setShowEdit] = useState(false);
    const [commentInputs, setCommentInputs] = useState({});
    const adminUser = useMemo(() => {
        try { return JSON.parse(localStorage.getItem('admin_user') || 'null'); }
        catch { return null; }
    }, []);
    const { pickerRequest: commentPickerRequest, bindLongPress } = useCommentReactionLongPress();

    const loadChannels = async () => {
        setLoading(true);
        try { setChannels(await communityChannelsApi.fetchChannels()); }
        catch (error) { console.error(error); }
        finally { setLoading(false); }
    };
    useEffect(() => { loadChannels(); }, []);

    const openChannel = async channel => {
        setActiveChannel(channel);
        setPostsLoading(true);
        setQuery('');
        setMemberQuery('');
        setProgramQuery('');
        try {
            const [postRows, memberRows, userRows, challengeRows] = await Promise.all([
                communityChannelsApi.fetchPosts(channel.id),
                communityChannelsApi.fetchMembers(channel),
                communityChannelsApi.fetchUsers(),
                communityChannelsApi.fetchLinkableChallenges(),
            ]);
            setPosts(postRows);
            setMembers(memberRows);
            setUsers(userRows);
            setChallenges(challengeRows);
        }
        catch (error) { console.error(error); setPosts([]); }
        finally { setPostsLoading(false); }
    };

    const filteredChannels = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return channels.filter(channel => !needle || `${channel.name} ${sourceLabel(channel) || ''}`.toLowerCase().includes(needle));
    }, [channels, query]);
    const filteredPosts = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return posts.filter(post => !needle || `${post.content} ${post.author?.name || ''}`.toLowerCase().includes(needle));
    }, [posts, query]);

    const createChannel = async event => {
        event.preventDefault();
        if (!newName.trim() || saving) return;
        setSaving(true);
        try {
            const created = await communityChannelsApi.createStandaloneChannel({ name: newName, description: newDescription });
            setShowCreate(false);
            setNewName('');
            setNewDescription('');
            await loadChannels();
            await openChannel(created);
        } catch (error) { alert(error.message || '커뮤니티를 만들지 못했습니다.'); }
        finally { setSaving(false); }
    };

    const addMember = async userId => {
        if (!userId || !activeChannel || saving) return;
        setSaving(true);
        try {
            await communityChannelsApi.addMember(activeChannel.id, userId);
            setMembers(await communityChannelsApi.fetchMembers(activeChannel));
            setMemberQuery('');
            await loadChannels();
        } catch (error) { alert(error.message || '멤버를 추가하지 못했습니다.'); }
        finally { setSaving(false); }
    };

    const removeMember = async member => {
        if (member.source !== 'DIRECT' || !confirm(`${member.user?.name || '이 멤버'} 님을 커뮤니티에서 제외할까요?`)) return;
        try {
            await communityChannelsApi.removeMember(activeChannel.id, member.user_id);
            setMembers(await communityChannelsApi.fetchMembers(activeChannel));
            await loadChannels();
        } catch (error) { alert(error.message || '멤버를 제외하지 못했습니다.'); }
    };

    const saveChannelInfo = async event => {
        event.preventDefault();
        if (!newName.trim() || saving) return;
        setSaving(true);
        try {
            const updated = await communityChannelsApi.updateChannel(activeChannel.id, { name: newName, description: newDescription });
            setActiveChannel(current => ({ ...current, ...updated }));
            setShowEdit(false);
            await loadChannels();
        } catch (error) { alert(error.message || '커뮤니티 정보를 저장하지 못했습니다.'); }
        finally { setSaving(false); }
    };

    const linkChallenge = async noticeId => {
        if (!activeChannel || saving) return;
        setSaving(true);
        try {
            await communityChannelsApi.linkToChallenge(activeChannel.id, noticeId ? Number(noticeId) : null);
            const refreshed = await communityChannelsApi.fetchChannel(activeChannel.id);
            await loadChannels();
            await openChannel(refreshed);
        } catch (error) { alert(error.message || '프로그램 연결을 변경하지 못했습니다.'); }
        finally { setSaving(false); }
    };

    const copyInvite = async channel => {
        const url = `${window.location.origin}/community/${channel.id}`;
        try { await navigator.clipboard.writeText(url); alert('초대 링크를 복사했습니다.'); }
        catch { window.prompt('초대 링크를 복사해주세요.', url); }
    };

    const toggleHidden = async post => {
        const { error } = await supabase.from('community_channel_posts').update({ is_hidden: !post.is_hidden }).eq('id', post.id);
        if (error) return alert('게시글 상태를 변경하지 못했습니다.');
        setPosts(current => current.map(item => item.id === post.id ? { ...item, is_hidden: !item.is_hidden } : item));
    };

    const toggleReaction = async (postId, emoji) => {
        if (!adminUser?.id) return;
        try {
            const active = await challengeCommunityApi.toggleReaction(postId, adminUser.id, emoji);
            setPosts(current => current.map(post => {
                if (post.id !== postId) return post;
                const reactions = (post.community_channel_reactions || []).filter(item => !(item.user_id === adminUser.id && item.emoji === emoji));
                if (active) reactions.push({ user_id: adminUser.id, emoji, users: adminUser });
                return { ...post, community_channel_reactions: reactions };
            }));
        } catch (error) { alert(error.message || '이모지 반응을 저장하지 못했습니다.'); }
    };

    const submitComment = async postId => {
        const value = (commentInputs[postId] || '').trim();
        if (!value || !adminUser?.id) return;
        try {
            const commentId = await challengeCommunityApi.createComment(postId, adminUser.id, value);
            setPosts(current => current.map(post => post.id === postId ? {
                ...post,
                community_channel_comments: [...(post.community_channel_comments || []), { id: commentId, user_id: adminUser.id, author: adminUser, content: value, created_at: new Date().toISOString() }],
            } : post));
            setCommentInputs(current => ({ ...current, [postId]: '' }));
        } catch (error) { alert(error.message || '댓글을 저장하지 못했습니다.'); }
    };

    const toggleCommentReaction = async (postId, commentId, emoji) => {
        if (!adminUser?.id) return;
        try {
            const active = await commentReactionsApi.toggleChannelComment(commentId, adminUser.id, emoji);
            setPosts(current => current.map(post => {
                if (post.id !== postId) return post;
                return { ...post, community_channel_comments: (post.community_channel_comments || []).map(comment => {
                    if (comment.id !== commentId) return comment;
                    const reactions = (comment.community_channel_comment_reactions || []).filter(item => !(item.user_id === adminUser.id && item.emoji === emoji));
                    if (active) reactions.push({ user_id: adminUser.id, emoji, users: adminUser });
                    return { ...comment, community_channel_comment_reactions: reactions };
                }) };
            }));
        } catch (error) { alert(error.message || '댓글 반응을 저장하지 못했습니다.'); }
    };

    const normalizedMemberQuery = memberQuery.trim().toLowerCase();
    const availableUsers = normalizedMemberQuery
        ? users.filter(user => !members.some(member => member.user_id === user.id))
            .filter(user => `${user.name || ''} ${user.school || ''}`.toLowerCase().includes(normalizedMemberQuery))
            .slice(0, 8)
        : [];
    const normalizedProgramQuery = programQuery.trim().toLowerCase();
    const availableChallenges = normalizedProgramQuery
        ? challenges.filter(challenge => challenge.id !== activeChannel?.source_notice_id)
            .filter(challenge => (challenge.title || '').toLowerCase().includes(normalizedProgramQuery))
            .slice(0, 8)
        : [];

    return <div className="space-y-6 p-5 animate-fade-in-up md:p-8">
        {!activeChannel ? <>
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div><h1 className="text-2xl font-black text-slate-900">커뮤니티 관리</h1><p className="mt-1 text-sm font-semibold text-slate-400">함께 모여서 이야기 나누는 커뮤니티를 관리합니다.</p></div>
                <button onClick={() => setShowCreate(true)} className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-blue-700"><Plus size={17}/>새 커뮤니티</button>
            </div>
            <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white">
                <div className="border-b border-slate-100 p-4"><label className="relative block"><Search size={17} className="absolute left-3 top-3 text-slate-400"/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="커뮤니티 이름 또는 연결 프로그램 검색" className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm outline-none focus:border-blue-500"/></label></div>
                {loading ? <p className="p-12 text-center text-slate-400">불러오는 중...</p> : filteredChannels.length === 0 ? <p className="p-12 text-center text-slate-400">커뮤니티가 없습니다.</p> : <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">{filteredChannels.map(channel => <button key={channel.id} type="button" onClick={() => openChannel(channel)} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5 text-left transition hover:border-blue-200 hover:bg-blue-50/50 hover:shadow-sm"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm"><Hash size={19}/></span><div className="min-w-0 flex-1"><h2 className="truncate font-black text-slate-900">{channel.name}</h2><p className="mt-1 text-xs font-bold text-slate-400">{channel.source_notice_id ? '연결 커뮤니티' : '독립 커뮤니티'}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-black ${channel.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>{channel.status === 'ACTIVE' ? '운영 중' : channel.status}</span></div>{channel.description && <p className="mt-3 line-clamp-2 text-xs font-medium leading-5 text-slate-500">{channel.description}</p>}{sourceLabel(channel) && <span className="mt-4 inline-flex max-w-full items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-[11px] font-black text-blue-600"><Link2 size={12}/><span className="truncate">{sourceLabel(channel)}</span></span>}<div className="mt-4 flex gap-4 border-t border-slate-200/70 pt-3 text-[11px] font-bold text-slate-400"><span className="flex items-center gap-1"><MessageCircle size={13}/>{countOf(channel.community_channel_posts)}개 글</span><span className="flex items-center gap-1"><Users size={13}/>{channel.participant_count || 0}명</span></div></button>)}</div>}
            </section>
        </> : <>
            <div className="flex items-center gap-3"><button onClick={() => { setActiveChannel(null); setPosts([]); setMembers([]); setQuery(''); }} className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-50"><ArrowLeft size={18}/></button><p className="text-sm font-bold text-slate-500">커뮤니티 목록</p></div>
            <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-black text-slate-900">{activeChannel.name}</h1>{sourceLabel(activeChannel) && <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-600"><Link2 size={12}/>{sourceLabel(activeChannel)}</span>}</div><p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-500">{activeChannel.description || '커뮤니티 설명이 아직 없습니다.'}</p></div><div className="flex shrink-0 gap-2"><button onClick={() => { setNewName(activeChannel.name); setNewDescription(activeChannel.description || ''); setShowEdit(true); }} className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-black text-slate-600"><Pencil size={14}/>정보 수정</button><button onClick={() => copyInvite(activeChannel)} className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs font-black text-blue-600"><Copy size={14}/>초대 링크</button></div></div>
                <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 lg:grid-cols-2">
                    <div>
                        <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-black text-slate-800"><Users size={16} className="text-blue-600"/>참여자 {members.length}명</h2></div>
                        <div className="relative mt-3">
                            <Search size={15} className="pointer-events-none absolute left-3 top-3 text-slate-400"/>
                            <input value={memberQuery} onChange={event => setMemberQuery(event.target.value)} placeholder="추가할 이용자 이름 또는 학교 검색" className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-blue-500"/>
                            {normalizedMemberQuery && <div className="absolute left-0 right-0 top-12 z-20 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
                                {availableUsers.length === 0 ? <p className="px-3 py-4 text-center text-xs font-semibold text-slate-400">추가할 수 있는 이용자가 없습니다.</p> : availableUsers.map(user => {
                                    const isStaff = isAdminOrStaff(user);
                                    return <button key={user.id} type="button" onClick={() => addMember(user.id)} disabled={saving} className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left hover:bg-slate-50 disabled:opacity-40"><span><span className="flex items-center gap-1.5"><strong className="block text-xs text-slate-800">{user.name || '이름 없음'}</strong>{isStaff && <span className="rounded-full bg-violet-50 px-1.5 py-0.5 text-[9px] font-black text-violet-600">스탭</span>}</span>{user.school && <span className="mt-0.5 block text-[11px] font-medium text-slate-400">{user.school}</span>}</span><span className="flex items-center gap-1 text-[11px] font-black text-blue-600"><UserPlus size={13}/>추가</span></button>;
                                })}
                            </div>}
                        </div>
                        <div className="mt-3 flex max-h-32 flex-wrap gap-2 overflow-y-auto">{members.length === 0 ? <span className="text-xs font-medium text-slate-400">아직 참여자가 없습니다.</span> : members.map(member => <span key={member.user_id} className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700">{member.user?.name || '이름 없음'}{member.user?.school && <span className="font-medium text-slate-400">· {member.user.school}</span>}{member.source === 'DIRECT' && <button onClick={() => removeMember(member)} className="ml-1 text-slate-400 hover:text-red-500" aria-label="멤버 제외"><X size={12}/></button>}</span>)}</div>
                    </div>
                    <div>
                        <h2 className="flex items-center gap-2 text-sm font-black text-slate-800"><Link2 size={16} className="text-blue-600"/>프로그램 연결</h2>
                        <div className="relative mt-3">
                            <Search size={15} className="pointer-events-none absolute left-3 top-3 text-slate-400"/>
                            <input value={programQuery} onChange={event => setProgramQuery(event.target.value)} placeholder="연결할 온라인 챌린지 검색" className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-blue-500"/>
                            {normalizedProgramQuery && <div className="absolute left-0 right-0 top-12 z-20 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
                                {availableChallenges.length === 0 ? <p className="px-3 py-4 text-center text-xs font-semibold text-slate-400">연결할 수 있는 프로그램이 없습니다.</p> : availableChallenges.map(challenge => <button key={challenge.id} type="button" onClick={() => linkChallenge(challenge.id)} disabled={saving} className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left hover:bg-slate-50 disabled:opacity-40"><span className="min-w-0 truncate text-xs font-bold text-slate-800">{challenge.title}</span><span className="ml-3 shrink-0 text-[11px] font-black text-blue-600">연결</span></button>)}
                            </div>}
                        </div>
                        {sourceLabel(activeChannel) ? <div className="mt-3 flex items-center justify-between rounded-xl bg-blue-50 px-3 py-2.5"><span className="min-w-0 truncate text-xs font-black text-blue-700">{sourceLabel(activeChannel)}</span><button type="button" onClick={() => linkChallenge(null)} disabled={saving} className="ml-3 shrink-0 text-[11px] font-black text-slate-500 disabled:opacity-40">연결 해제</button></div> : <p className="mt-3 text-xs font-medium text-slate-400">연결된 프로그램이 없습니다.</p>}
                    </div>
                </div>
            </section>
            <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white">
                <div className="border-b border-slate-100 p-4"><label className="relative block"><Search size={17} className="absolute left-3 top-3 text-slate-400"/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="작성자 또는 게시글 내용 검색" className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm outline-none focus:border-blue-500"/></label></div>
                {postsLoading ? <p className="p-12 text-center text-slate-400">게시글을 불러오는 중...</p> : filteredPosts.length === 0 ? <p className="p-12 text-center text-slate-400">게시글이 없습니다.</p> : <div className="space-y-4 bg-slate-50/70 p-4">{filteredPosts.map(post => {
                    const mission = post.submission?.online_challenge_missions;
                    return <article key={post.id} className={`mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-4 shadow-sm ${post.is_hidden ? 'opacity-60' : ''}`}>
                        <div className="flex items-start gap-3"><UserAvatar user={post.author} size="w-9 h-9"/><div className="min-w-0 flex-1"><p className="text-sm font-black text-slate-900">{post.author?.name}</p><p className="text-[10px] text-slate-400">{new Date(post.created_at).toLocaleString('ko-KR')}</p></div><button onClick={() => toggleHidden(post)} className="rounded-xl border border-slate-200 p-2 text-slate-500" title={post.is_hidden ? '숨김 해제' : '게시글 숨기기'}>{post.is_hidden ? <Eye size={17}/> : <EyeOff size={17}/>}</button></div>
                        {mission && <span className={`mt-3 inline-block rounded-full px-2.5 py-1 text-[10px] font-black ${missionColor(mission)}`}>{mission.title}</span>}
                        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">{post.content}</p>
                        {post.media?.[0]?.media_url && <img src={post.media[0].media_url} alt="커뮤니티 첨부" className="mt-3 max-h-[460px] w-full rounded-2xl object-cover"/>}
                        <div className="mt-3"><NoticeReactions reactions={post.community_channel_reactions || []} currentUserId={adminUser?.id} onToggleReaction={emoji => toggleReaction(post.id, emoji)}/></div>
                        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                            {(post.community_channel_comments || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).map(comment => <div key={comment.id} {...bindLongPress(comment.id)} className="flex select-none gap-3 py-1"><UserAvatar user={comment.author} size="w-8 h-8"/><div className="min-w-0 flex-1"><div className="flex items-baseline gap-2"><p className="text-xs font-black text-slate-900">{comment.author?.name}</p><span className="text-[10px] text-slate-400">{new Date(comment.created_at).toLocaleDateString('ko-KR')}</span></div><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-slate-700">{comment.content}</p><div className="mt-1 origin-left scale-90"><NoticeReactions reactions={comment.community_channel_comment_reactions || []} currentUserId={adminUser?.id} onToggleReaction={emoji => toggleCommentReaction(post.id, comment.id, emoji)} hideAddButtonOnMobile pickerOpenToken={commentPickerRequest.commentId === comment.id ? commentPickerRequest.token : 0}/></div></div></div>)}
                            {adminUser?.id && <div className="flex items-center gap-2"><MessageCircle size={16} className="text-slate-400"/><input value={commentInputs[post.id] || ''} onChange={event => setCommentInputs(current => ({ ...current, [post.id]: event.target.value }))} onKeyDown={event => { if (event.key === 'Enter') submitComment(post.id); }} placeholder="댓글 남기기" className="flex-1 rounded-xl bg-slate-50 px-3 py-2 text-xs outline-none"/><button onClick={() => submitComment(post.id)} className="p-2 text-blue-600"><Send size={16}/></button></div>}
                        </div>
                    </article>;
                })}</div>}
            </section>
        </>}
        {showCreate && <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/45 p-4" onClick={() => setShowCreate(false)}><form onSubmit={createChannel} onClick={event => event.stopPropagation()} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h2 className="text-xl font-black text-slate-900">새 커뮤니티</h2><p className="mt-1 text-xs font-semibold text-slate-400">먼저 독립 채널로 만들고 필요할 때 프로그램에 연결합니다.</p></div><button type="button" onClick={() => setShowCreate(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><X size={18}/></button></div><label className="mt-6 block text-sm font-bold text-slate-700">커뮤니티 이름<input autoFocus value={newName} onChange={event => setNewName(event.target.value)} placeholder="예: 청소년 리더 모임" className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-sm font-bold outline-none focus:border-blue-500"/></label><label className="mt-4 block text-sm font-bold text-slate-700">커뮤니티 설명 <span className="font-medium text-slate-400">(선택)</span><textarea value={newDescription} onChange={event => setNewDescription(event.target.value)} placeholder="이 커뮤니티의 목적과 이용 방법을 적어주세요" rows={3} className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"/></label><p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-medium leading-5 text-slate-500">만든 뒤 이용자를 직접 추가하거나 초대 링크를 공유하고, 온라인 챌린지와 연결할 수 있습니다.</p><button type="submit" disabled={!newName.trim() || saving} className="mt-5 w-full rounded-xl bg-blue-600 py-3.5 text-sm font-black text-white disabled:opacity-40">{saving ? '만드는 중...' : '커뮤니티 만들기'}</button></form></div>}
        {showEdit && <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/45 p-4" onClick={() => setShowEdit(false)}><form onSubmit={saveChannelInfo} onClick={event => event.stopPropagation()} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-xl font-black text-slate-900">커뮤니티 정보 수정</h2><button type="button" onClick={() => setShowEdit(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><X size={18}/></button></div><label className="mt-6 block text-sm font-bold text-slate-700">커뮤니티 이름<input autoFocus value={newName} onChange={event => setNewName(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-sm font-bold outline-none focus:border-blue-500"/></label><label className="mt-4 block text-sm font-bold text-slate-700">커뮤니티 설명<textarea value={newDescription} onChange={event => setNewDescription(event.target.value)} rows={4} className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"/></label><button type="submit" disabled={!newName.trim() || saving} className="mt-5 w-full rounded-xl bg-blue-600 py-3.5 text-sm font-black text-white disabled:opacity-40">{saving ? '저장 중...' : '저장'}</button></form></div>}
    </div>;
}
