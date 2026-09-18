import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Hash, Link2, MessageCircle, Pencil, Pin, Send, Trash2, Users } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { communityChannelsApi } from '../api/communityChannelsApi';
import { challengeCommunityApi } from '../api/challengeCommunityApi';
import { commentReactionsApi } from '../api/commentReactionsApi';
import NoticeReactions from '../components/student/NoticeReactions';
import UserAvatar from '../components/common/UserAvatar';
import InterestSessionDialog from '../components/student/modals/InterestSessionDialog';
import ChallengeCommunityModal from '../components/student/modals/ChallengeCommunityModal';
import { supabase } from '../supabaseClient';
import { challengeMissionsApi } from '../api/challengeMissionsApi';
import { isAdminOrStaff } from '../utils/userUtils';
import { communityFeedApi, getUnreadBoundary, sortCommunityPosts } from '../api/communityFeedApi';
import useCommunityUnread from '../hooks/useCommunityUnread';
import { useAuth } from '../auth/AuthProvider';
import useCommentReactionLongPress from '../hooks/useCommentReactionLongPress';

const GuestMobileWelcome = React.lazy(() => import('./GuestMobileWelcome'));
const UnreadDivider = () => <div role="separator" aria-label="읽지 않은 새 글 경계" className="flex items-center gap-3 py-1"><span className="h-px flex-1 bg-[#CF3A27]/45"/><span className="shrink-0 text-[11px] font-black text-[#CF3A27]">새 글</span><span className="h-px flex-1 bg-[#CF3A27]/45"/></div>;

export default function CommunityChannelPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const auth = useAuth();
    const user = ['authenticated', 'refreshing'].includes(auth.status) ? auth.profile : null;
    const [preview, setPreview] = useState(null);
    const [channel, setChannel] = useState(null);
    const [challengeNotice, setChallengeNotice] = useState(null);
    const [accessDenied, setAccessDenied] = useState(false);
    const [posts, setPosts] = useState([]);
    const [content, setContent] = useState('');
    const [isAnnouncement, setIsAnnouncement] = useState(false);
    const [comments, setComments] = useState({});
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [joined, setJoined] = useState(false);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [showSessionDialog, setShowSessionDialog] = useState(false);
    const [loginOpen, setLoginOpen] = useState(false);
    const [editingCommentId, setEditingCommentId] = useState(null);
    const [editingCommentContent, setEditingCommentContent] = useState('');
    const [savingComment, setSavingComment] = useState(false);
    const joiningRef = useRef(false);
    const { pickerRequest: commentPickerRequest, bindLongPress } = useCommentReactionLongPress();
    const description = channel?.description || preview?.description || '';
    const descriptionParagraphs = description.split(/\n\s*\n/).map(part => part.trim()).filter(Boolean);
    const lastReadAt = useCommunityUnread(channel?.id, user?.id, posts, joined);
    const unreadBoundary = getUnreadBoundary(posts, lastReadAt, user?.id);

    const refresh = useCallback(async () => {
        const channelRow = await communityChannelsApi.fetchChannel(id);
        if (channelRow.source_notice_id) {
            const allowed = isAdminOrStaff(user) || await communityChannelsApi.fetchChallengeAccess(channelRow.source_notice_id, user.id);
            if (!allowed) {
                setAccessDenied(true);
                setJoined(false);
                return;
            }
            const [notice, missions] = await Promise.all([
                communityChannelsApi.fetchChallengeNotice(channelRow.source_notice_id),
                challengeMissionsApi.fetchMissions(channelRow.source_notice_id, 'ONLINE'),
            ]);
            setChallengeNotice({ ...notice, challenge_missions: missions });
            setPosts([]);
        } else {
            setPosts(await communityChannelsApi.fetchPosts(id));
        }
        setChannel(channelRow);
        setAccessDenied(false);
        setJoined(true);
    }, [id, user]);

    const joinAndEnter = useCallback(async () => {
        if (!user?.id || joiningRef.current) return;
        joiningRef.current = true;
        setJoining(true);
        setError('');
        try {
            const { data } = await supabase.auth.getSession();
            if (!data?.session) {
                setShowSessionDialog(true);
                return;
            }
            if (!preview?.source_title) {
                await communityChannelsApi.joinStandaloneChannel(id, user.id);
            }
            await refresh();
            setPreview(await communityChannelsApi.fetchInvitePreview(id));
            localStorage.removeItem('pendingCommunityJoin');
        } catch (joinError) {
            if (preview?.source_title) setAccessDenied(true);
            else setError(joinError.message || '이 커뮤니티에 참여하지 못했습니다.');
        } finally {
            joiningRef.current = false;
            setJoining(false);
        }
    }, [id, preview?.source_title, refresh, user?.id]);

    useEffect(() => {
        let cancelled = false;
        communityChannelsApi.fetchInvitePreview(id)
            .then(data => { if (!cancelled) setPreview(data); })
            .catch(() => { if (!cancelled) setError('유효하지 않거나 종료된 초대 링크입니다.'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [id]);

    useEffect(() => {
        if (!user?.id) return;
        let cancelled = false;
        const restoreAccess = async () => {
            try {
                await refresh();
            } catch {
                if (preview?.source_title) {
                    if (!cancelled) setAccessDenied(true);
                    return;
                }
                if (!cancelled && (location.state?.fromCommunityLogin || localStorage.getItem('pendingCommunityJoin') === id)) {
                    await joinAndEnter();
                }
            }
        };
        restoreAccess();
        return () => { cancelled = true; };
    }, [id, joinAndEnter, location.state, preview?.source_title, refresh, user?.id]);

    const handleJoin = async () => {
        if (!user?.id) {
            setLoginOpen(true);
            return;
        }
        await joinAndEnter();
    };

    const submitPost = async () => {
        const value = content.trim();
        if (!value || submitting) return;
        setSubmitting(true);
        try {
            const postId = await communityChannelsApi.createPost(id, user.id, value, isAnnouncement && isAdminOrStaff(user));
            setPosts(current => sortCommunityPosts([{ id: postId, channel_id: id, author_id: user.id, author: user, content: value, is_announcement: isAnnouncement, announced_at: isAnnouncement ? new Date().toISOString() : null, created_at: new Date().toISOString(), media: [], community_channel_reactions: [], community_channel_comments: [] }, ...current]));
            setContent('');
            setIsAnnouncement(false);
            void refresh();
        } catch (submitError) { alert(submitError.message || '글을 등록하지 못했습니다.'); }
        finally { setSubmitting(false); }
    };

    const toggleReaction = async (postId, emoji) => {
        try {
            const active = await challengeCommunityApi.toggleReaction(postId, user.id, emoji);
            setPosts(current => current.map(post => {
                if (post.id !== postId) return post;
                const next = (post.community_channel_reactions || []).filter(item => !(item.user_id === user.id && item.emoji === emoji));
                if (active) next.push({ user_id: user.id, emoji, users: user });
                return { ...post, community_channel_reactions: next };
            }));
        } catch (reactionError) { alert(reactionError.message || '반응을 저장하지 못했습니다.'); }
    };

    const submitComment = async postId => {
        const value = (comments[postId] || '').trim();
        if (!value) return;
        try {
            const commentId = await challengeCommunityApi.createComment(postId, user.id, value);
            setPosts(current => current.map(post => post.id === postId ? { ...post, community_channel_comments: [...(post.community_channel_comments || []), { id: commentId, user_id: user.id, author: user, content: value, created_at: new Date().toISOString() }] } : post));
            setComments(current => ({ ...current, [postId]: '' }));
        } catch (commentError) { alert(commentError.message || '댓글을 저장하지 못했습니다.'); }
    };

    const saveCommentEdit = async (postId, commentId) => {
        const value = editingCommentContent.trim();
        if (!value || savingComment) return;
        setSavingComment(true);
        try {
            const updated = await challengeCommunityApi.updateComment(commentId, value);
            setPosts(current => current.map(post => post.id === postId ? { ...post, community_channel_comments: (post.community_channel_comments || []).map(comment => comment.id === commentId ? { ...comment, content: updated.content } : comment) } : post));
            setEditingCommentId(null);
            setEditingCommentContent('');
        } catch (commentError) { alert(commentError.message || '댓글을 수정하지 못했습니다.'); }
        finally { setSavingComment(false); }
    };

    const deleteComment = async (postId, commentId) => {
        if (!confirm('이 댓글을 삭제할까요?')) return;
        try {
            await challengeCommunityApi.deleteComment(commentId);
            setPosts(current => current.map(post => post.id === postId ? { ...post, community_channel_comments: (post.community_channel_comments || []).filter(comment => comment.id !== commentId) } : post));
        } catch (commentError) { alert(commentError.message || '댓글을 삭제하지 못했습니다.'); }
    };

    const toggleCommentReaction = async (postId, commentId, emoji) => {
        try {
            const active = await commentReactionsApi.toggleChannelComment(commentId, user.id, emoji);
            setPosts(current => current.map(post => {
                if (post.id !== postId) return post;
                return { ...post, community_channel_comments: (post.community_channel_comments || []).map(comment => {
                    if (comment.id !== commentId) return comment;
                    const reactions = (comment.community_channel_comment_reactions || []).filter(item => !(item.user_id === user.id && item.emoji === emoji));
                    if (active) reactions.push({ user_id: user.id, emoji, users: user });
                    return { ...comment, community_channel_comment_reactions: reactions };
                }) };
            }));
        } catch (commentError) { alert(commentError.message || '댓글 반응을 저장하지 못했습니다.'); }
    };

    if (!joined) return <main className="min-h-screen bg-[#F7EFE2] px-5 py-12 font-sans">
        <div className="mx-auto max-w-md">
            <button onClick={() => navigate(-1)} aria-label="뒤로 가기" className="mb-6 rounded-full bg-white p-3 text-[#71665C] shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#CF3A27]"><ArrowLeft size={20}/></button>
            <section className="rounded-[28px] border border-[#E7D8C4] bg-white px-6 py-8 text-center shadow-[0_12px_36px_rgba(83,56,37,0.06)]">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F4DDD4] text-[#CF3A27]"><Hash size={28}/></div>
                {loading ? <p className="mt-7 text-sm font-bold text-slate-400">초대 정보를 불러오는 중...</p> : <>
                    <h1 className="mt-6 text-2xl font-black tracking-tight text-slate-950">{preview?.name || '커뮤니티'}</h1>
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                        {preview?.source_title && <span className="inline-flex items-center gap-1 rounded-full bg-[#F4DDD4] px-3 py-1.5 text-xs font-black text-[#A93021]"><Link2 size={13}/>{preview.source_title}</span>}
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#FBF3E7] px-3 py-1.5 text-xs font-black text-[#71665C]"><Users size={13} className="text-[#CF3A27]"/>{preview?.source_title ? '신청자 전용' : `${Number(preview?.participant_count || 0)}명 참여 중`}</span>
                    </div>
                    <div className="mx-auto mt-5 max-w-sm space-y-3 text-left text-sm font-medium leading-6 text-[#625B55]">{descriptionParagraphs.length ? descriptionParagraphs.map((paragraph, index) => <p key={index} className="whitespace-pre-wrap">{paragraph}</p>) : <p>함께 이야기하고 기록을 나누는 커뮤니티입니다.</p>}</div>
                    {error && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-xs font-bold leading-5 text-red-600">{error}</p>}
                    {accessDenied ? <p className="mt-7 rounded-2xl bg-[#FBF3E7] px-4 py-4 text-sm font-bold leading-6 text-[#A93021]">이 챌린지에 신청한 사람만 커뮤니티에 들어갈 수 있어요.</p> : <button onClick={handleJoin} disabled={!preview || joining} className="mt-7 h-14 w-full rounded-2xl bg-[#CF3A27] text-base font-black text-white transition hover:bg-[#B93223] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CF3A27] disabled:opacity-40">{joining ? '참여 확인 중...' : preview?.source_title ? '참여 확인하기' : '참여하기'}</button>}
                    <p className="mt-3 text-xs font-medium text-slate-400">{preview?.source_title ? '프로그램 신청 상태로 참여 여부를 확인합니다.' : '참여하려면 센터 계정 로그인이 필요합니다.'}</p>
                </>}
            </section>
        </div>
        {showSessionDialog && <InterestSessionDialog
            noticeId={null}
            api={communityChannelsApi}
            onClose={() => setShowSessionDialog(false)}
            onContinue={() => { setShowSessionDialog(false); void joinAndEnter(); }}
        />}
        {loginOpen && <React.Suspense fallback={<div className="fixed inset-0 z-50 bg-black/40"/>}><GuestMobileWelcome
            isQRCheckin={false}
            loginOnly
            communityLoginId={id}
            onCommunityLoginComplete={() => { setLoginOpen(false); void auth.refresh(); }}
            onCommunityLoginCancel={() => setLoginOpen(false)}
        /></React.Suspense>}
    </main>;

    if (challengeNotice) return <ChallengeCommunityModal
        notice={challengeNotice}
        user={user}
        onClose={() => navigate(-1)}
        onMissionCompleted={() => {}}
    />;

    return <main className="min-h-screen bg-[#F7EFE2] font-sans text-[#302A25]">
        <header className="sticky top-0 z-10 border-b border-[#E7D8C4] bg-[#FFFDF9]/95 backdrop-blur"><div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3"><button onClick={() => navigate(-1)} aria-label="뒤로 가기" className="rounded-full p-2 text-[#71665C] hover:bg-[#FBF3E7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#CF3A27]"><ArrowLeft size={21}/></button><div className="min-w-0"><h1 className="truncate text-[17px] font-black tracking-tight text-[#302A25]">{channel?.name || preview?.name || '커뮤니티'}</h1><p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-[#8D7D6F]"><Users size={12}/>{preview?.participant_count || 0}명 참여 중</p></div></div></header>
        <div className="mx-auto max-w-2xl space-y-5 px-4 py-5">
            {descriptionParagraphs.length > 0 && <section aria-labelledby="community-intro-title" className="overflow-hidden rounded-[24px] border border-[#E7D8C4] bg-[#FFFDF9]">
                <div className="flex items-center gap-2 border-b border-[#EEE3D5] px-5 py-4"><span className="h-4 w-1 rounded-full bg-[#CF3A27]"/><h2 id="community-intro-title" className="text-sm font-black text-[#302A25]">모임 소개</h2></div>
                <div className="space-y-3 px-5 py-5 text-[15px] font-medium leading-7 text-[#544B43]">{descriptionParagraphs.map((paragraph, index) => <p key={index} className="whitespace-pre-wrap break-words">{paragraph}</p>)}</div>
            </section>}
            <section aria-label="이야기 작성" className="rounded-[24px] border border-[#E7D8C4] bg-white p-5 shadow-[0_4px_18px_rgba(83,56,37,0.04)]"><label htmlFor="community-post-content" className="mb-3 block text-sm font-black text-[#302A25]">이야기 남기기</label><textarea id="community-post-content" value={content} onChange={event => setContent(event.target.value)} placeholder="오늘의 이야기를 함께 나눠보세요" className="min-h-24 w-full resize-y rounded-xl bg-[#FBF7F0] px-4 py-3 text-sm leading-6 text-[#302A25] outline-none placeholder:text-[#A19487] focus-visible:ring-2 focus-visible:ring-[#CF3A27]/40"/>{isAdminOrStaff(user) && <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-[#544B43]"><input type="checkbox" checked={isAnnouncement} onChange={event => setIsAnnouncement(event.target.checked)} className="h-4 w-4 accent-[#CF3A27]"/>공지로 보내기</label>}<div className="mt-3 flex justify-end"><button onClick={submitPost} disabled={!content.trim() || submitting} className="rounded-xl bg-[#CF3A27] px-5 py-2.5 text-sm font-black text-white hover:bg-[#B93223] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CF3A27] disabled:opacity-40">{submitting ? '등록 중...' : '게시하기'}</button></div></section>
            {posts.length === 0 ? <div className="rounded-[24px] border border-dashed border-[#DCC8B4] bg-[#FFFDF9]/70 px-5 py-10 text-center"><MessageCircle size={26} className="mx-auto text-[#CF3A27]"/><p className="mt-3 text-sm font-bold text-[#71665C]">아직 올라온 이야기가 없어요.</p><p className="mt-1 text-xs text-[#9A8C7D]">첫 번째 이야기를 남겨보세요.</p></div> : posts.map((post, index) => <React.Fragment key={post.id}>{unreadBoundary?.before === index && <UnreadDivider/>}<article className="rounded-[24px] border border-[#E7D8C4] bg-white p-5 shadow-[0_4px_18px_rgba(83,56,37,0.04)]"><div className="flex gap-3"><UserAvatar user={post.author} size="w-9 h-9"/><div><p className="text-sm font-black">{post.author?.name}</p><p className="text-[10px] text-slate-400">{new Date(post.created_at).toLocaleString('ko-KR')}</p></div></div>{post.is_announcement && <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-[#FFF0E9] px-2.5 py-1 text-[10px] font-black text-[#B93223]"><Pin size={11}/>공지{lastReadAt && new Date(post.created_at).getTime() > new Date(lastReadAt).getTime() && post.author_id !== user.id ? ' · 새 글' : ''}</span>}<p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-800">{post.content}</p><NoticeReactions reactions={post.community_channel_reactions || []} currentUserId={user.id} onToggleReaction={emoji => toggleReaction(post.id, emoji)}/><div className="mt-3 space-y-3 border-t border-slate-100 pt-3">{(post.community_channel_comments || []).map(comment => <div key={comment.id} {...bindLongPress(comment.id)} className="group/comment flex select-none gap-3 py-1"><UserAvatar user={comment.author} size="w-8 h-8"/><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="flex items-baseline gap-2"><p className="text-xs font-black text-slate-900">{comment.author?.name}</p><span className="text-[10px] text-slate-400">{new Date(comment.created_at).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })}</span></div>{comment.user_id === user.id && editingCommentId !== comment.id && <div className="flex shrink-0 opacity-100 md:opacity-0 md:group-hover/comment:opacity-100"><button type="button" onClick={() => { setEditingCommentId(comment.id); setEditingCommentContent(comment.content); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-[#CF3A27]" aria-label="댓글 수정"><Pencil size={13}/></button><button type="button" onClick={() => deleteComment(post.id, comment.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500" aria-label="댓글 삭제"><Trash2 size={13}/></button></div>}</div>{editingCommentId === comment.id ? <div className="mt-1"><input value={editingCommentContent} onChange={event => setEditingCommentContent(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') saveCommentEdit(post.id, comment.id); }} className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-[#CF3A27]" autoFocus/><div className="mt-1.5 flex justify-end gap-2"><button type="button" onClick={() => { setEditingCommentId(null); setEditingCommentContent(''); }} className="px-2 py-1 text-[11px] font-bold text-slate-500">취소</button><button type="button" onClick={() => saveCommentEdit(post.id, comment.id)} disabled={!editingCommentContent.trim() || savingComment} className="px-2 py-1 text-[11px] font-black text-[#CF3A27] disabled:opacity-40">{savingComment ? '저장 중' : '저장'}</button></div></div> : <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-slate-700">{comment.content}</p>}<div className="mt-1 origin-left scale-90"><NoticeReactions reactions={comment.community_channel_comment_reactions || []} currentUserId={user.id} onToggleReaction={emoji => toggleCommentReaction(post.id, comment.id, emoji)} hideAddButtonOnMobile pickerOpenToken={commentPickerRequest.commentId === comment.id ? commentPickerRequest.token : 0}/></div></div></div>)}<div className="flex items-center gap-2"><MessageCircle size={16} className="text-slate-400"/><input value={comments[post.id] || ''} onChange={event => setComments(current => ({ ...current, [post.id]: event.target.value }))} onKeyDown={event => { if (event.key === 'Enter') submitComment(post.id); }} placeholder="댓글 남기기" className="flex-1 rounded-xl bg-slate-50 px-3 py-2 text-xs outline-none"/><button onClick={() => submitComment(post.id)} className="rounded-lg p-2 text-[#CF3A27] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#CF3A27]"><Send size={16}/></button></div></div></article>{unreadBoundary?.after === index && <UnreadDivider/>}</React.Fragment>)}
        </div>
    </main>;
}
