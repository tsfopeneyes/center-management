import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Camera, Check, MessageCircle, Pencil, Pin, Send, Trash2, X } from 'lucide-react';
import NoticeReactions from '../NoticeReactions';
import UserAvatar from '../../common/UserAvatar';
import InterestSessionDialog from './InterestSessionDialog';
import { challengeCommunityApi } from '../../../api/challengeCommunityApi';
import { commentReactionsApi } from '../../../api/commentReactionsApi';
import { challengeMissionsApi } from '../../../api/challengeMissionsApi';
import { compressImage } from '../../../utils/imageUtils';
import { supabase, supabaseUrl } from '../../../supabaseClient';
import { getKSTDateString } from '../../../utils/dateUtils';
import { isAccountAuthEnabled } from '../../../auth/accountAuthRuntime';
import { uploadAccountImage } from '../../../auth/accountMedia';
import useCommentReactionLongPress from '../../../hooks/useCommentReactionLongPress';
import { isAdminOrStaff } from '../../../utils/userUtils';
import { communityImagePath } from '../../../utils/communityImageStorage';
import { communityFeedApi, getUnreadBoundary, sortCommunityPosts } from '../../../api/communityFeedApi';
import useCommunityUnread from '../../../hooks/useCommunityUnread';

const requiredCount = (mission, notice) => {
    if (mission.schedule_type === 'DAILY') {
        const start = new Date(`${notice.program_start_date}T00:00:00+09:00`);
        const end = new Date(`${notice.program_end_date}T00:00:00+09:00`);
        return Math.max(1, Math.round((end - start) / 86400000) + 1);
    }
    return mission.schedule_type === 'FLEXIBLE' ? Math.max(1, Number(mission.target_count) || 1) : 1;
};

const MISSION_BADGE_COLORS = [
    { backgroundColor: '#E8F3FF', color: '#1B64DA' },
    { backgroundColor: '#F2EDFF', color: '#6D3DD1' },
    { backgroundColor: '#E8FAF2', color: '#087F5B' },
    { backgroundColor: '#FFF4E5', color: '#B75D00' },
    { backgroundColor: '#FFECEF', color: '#C3325A' },
    { backgroundColor: '#E7F8FA', color: '#087A8C' },
    { backgroundColor: '#F4F0E8', color: '#765B2B' },
    { backgroundColor: '#EEF1FF', color: '#4056B4' },
];

const UnreadDivider = ({ anchorRef }) => <div ref={anchorRef} role="separator" aria-label="여기부터 읽지 않은 새 글" className="flex items-center gap-3 py-1"><span className="h-px flex-1 bg-[#CF3A27]/45"/><span className="shrink-0 text-[11px] font-black text-[#CF3A27]">새 글</span><span className="h-px flex-1 bg-[#CF3A27]/45"/></div>;

export default function ChallengeCommunityModal({ notice, user, initialFilter = null, onClose, onMissionCompleted }) {
    const [posts, setPosts] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [content, setContent] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [selectedMissionId, setSelectedMissionId] = useState('');
    const [isAnnouncement, setIsAnnouncement] = useState(false);
    const [channelId, setChannelId] = useState(null);
    const [applicantCount, setApplicantCount] = useState(null);
    const [adminHasJoined, setAdminHasJoined] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [commentInputs, setCommentInputs] = useState({});
    const [activeFilter, setActiveFilter] = useState(initialFilter);
    const [editingPostId, setEditingPostId] = useState(null);
    const [editingContent, setEditingContent] = useState('');
    const [editingMissionId, setEditingMissionId] = useState('');
    const [editingImageFile, setEditingImageFile] = useState(null);
    const [editingRemoveImage, setEditingRemoveImage] = useState(false);
    const [savingEdit, setSavingEdit] = useState(false);
    const [editingCommentId, setEditingCommentId] = useState(null);
    const [editingCommentContent, setEditingCommentContent] = useState('');
    const [savingComment, setSavingComment] = useState(false);
    const [showSessionDialog, setShowSessionDialog] = useState(false);
    const fileRef = useRef(null);
    const editFileRef = useRef(null);
    const feedRef = useRef(null);
    const unreadDividerRef = useRef(null);
    const autoScrolledRef = useRef(false);
    const userMovedFeedRef = useRef(false);
    const categorySelectionTouchedRef = useRef(false);
    const submitLockRef = useRef(false);
    const pendingSessionActionRef = useRef(null);
    const { pickerRequest: commentPickerRequest, bindLongPress } = useCommentReactionLongPress();
    const missions = notice.challenge_missions || [];
    const isAdmin = isAdminOrStaff(user);
    const today = getKSTDateString(new Date());
    const isBeforeStart = Boolean(notice.program_start_date && today < notice.program_start_date);
    const isAfterEnd = Boolean(notice.program_end_date && today > notice.program_end_date);
    const canWrite = !isBeforeStart && !isAfterEnd;
    const periodMessage = isBeforeStart
        ? `${new Date(`${notice.program_start_date}T00:00:00+09:00`).toLocaleDateString('ko-KR')}부터 기록을 남길 수 있어요.`
        : '챌린지가 종료되어 새 기록을 남길 수 없어요.';

    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = previousOverflow; };
    }, []);

    useEffect(() => {
        const handleKeyDown = event => {
            if (event.key !== 'Escape' || showSessionDialog) return;
            event.preventDefault();
            onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, showSessionDialog]);

    const mySubmissions = useMemo(
        () => submissions.filter(item => item.participant_id === user.id && item.is_valid !== false),
        [submissions, user.id]
    );
    const eligibleMissions = useMemo(() => missions.filter(mission => {
        if (!canWrite || (isAdmin && !adminHasJoined)) return false;
        const mine = mySubmissions.filter(item => item.mission_id === mission.id);
        if (mission.schedule_type === 'DAILY') return !mine.some(item => item.completion_date === today);
        if (mission.schedule_type === 'FIXED_DATE') return mission.fixed_date === today && mine.length === 0;
        return mine.length < requiredCount(mission, notice);
    }), [adminHasJoined, canWrite, isAdmin, missions, mySubmissions, notice, today]);
    const visiblePosts = useMemo(() => {
        if (!activeFilter) return sortCommunityPosts(posts);
        return sortCommunityPosts(posts.filter(post => post.author_id === activeFilter.participantId
            && post.submission?.mission_id === activeFilter.missionId));
    }, [activeFilter, posts]);
    const lastReadAt = useCommunityUnread(channelId, user.id, posts, !loading);
    const unreadBoundary = useMemo(() => activeFilter ? null : getUnreadBoundary(visiblePosts, lastReadAt, user.id),
        [activeFilter, lastReadAt, user.id, visiblePosts]);

    useEffect(() => {
        autoScrolledRef.current = false;
        userMovedFeedRef.current = false;
    }, [notice.id]);

    useEffect(() => {
        if (loading || !channelId || !unreadBoundary || activeFilter
            || autoScrolledRef.current || userMovedFeedRef.current) return;
        const frame = window.requestAnimationFrame(() => {
            const feed = feedRef.current;
            const divider = unreadDividerRef.current;
            if (!feed || !divider || userMovedFeedRef.current) return;
            const position = divider.getBoundingClientRect().top - feed.getBoundingClientRect().top
                + feed.scrollTop - 12;
            feed.scrollTo({ top: Math.max(0, position), behavior: 'auto' });
            autoScrolledRef.current = true;
        });
        return () => window.cancelAnimationFrame(frame);
    }, [activeFilter, channelId, loading, unreadBoundary]);

    useEffect(() => {
        let active = true;
        setChannelId(null);
        communityFeedApi.fetchChallengeChannelId(notice.id)
            .then(id => { if (active) setChannelId(id); })
            .catch(error => console.error('Failed to locate challenge community:', error));
        return () => { active = false; };
    }, [notice.id]);

    useEffect(() => {
        setActiveFilter(initialFilter);
    }, [initialFilter]);

    useEffect(() => {
        setSelectedMissionId(current => {
            if (eligibleMissions.some(mission => mission.id === current)) return current;
            return categorySelectionTouchedRef.current ? '' : (eligibleMissions[0]?.id || '');
        });
    }, [eligibleMissions]);

    useEffect(() => {
        let active = true;
        setApplicantCount(null);
        supabase.from('notice_responses')
            .select('*', { count: 'exact', head: true })
            .eq('notice_id', notice.id)
            .eq('status', 'JOIN')
            .then(({ count, error }) => {
                if (error) {
                    console.error('Failed to fetch challenge applicant count:', error);
                    return;
                }
                if (active) setApplicantCount(count);
            });
        return () => { active = false; };
    }, [notice.id]);

    useEffect(() => {
        if (!isAdmin) return;
        let active = true;
        setAdminHasJoined(false);
        supabase.from('notice_responses')
            .select('user_id')
            .eq('notice_id', notice.id).eq('user_id', user.id).eq('status', 'JOIN')
            .maybeSingle()
            .then(({ data, error }) => {
                if (error) console.error('Failed to check admin challenge application:', error);
                if (active) setAdminHasJoined(Boolean(data) && !error);
            });
        return () => { active = false; };
    }, [isAdmin, notice.id, user.id]);

    const refresh = async () => {
        try {
            const [postRows, submissionRows] = await Promise.all([
                challengeCommunityApi.fetchPosts(notice.id),
                challengeMissionsApi.fetchSubmissions(notice.id, 'ONLINE'),
            ]);
            setPosts(postRows);
            setSubmissions(submissionRows);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { refresh(); }, [notice.id, user.id]);

    useEffect(() => {
        let active = true;
        supabase.auth.getSession().then(({ data }) => {
            if (active && !data?.session) setShowSessionDialog(true);
        });
        return () => { active = false; };
    }, []);

    const runWithSession = async action => {
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
            await action();
            return true;
        }
        pendingSessionActionRef.current = action;
        setShowSessionDialog(true);
        return false;
    };

    const resumePendingAction = () => {
        const action = pendingSessionActionRef.current;
        pendingSessionActionRef.current = null;
        setShowSessionDialog(false);
        if (action) {
            void action().catch(error => {
                console.error(error);
                alert(error.message || '요청을 처리하지 못했습니다.');
            });
        } else {
            setLoading(true);
            void refresh();
        }
    };

    const uploadImage = async file => {
        if (!file) return null;
        const compressed = await compressImage(file);
        if (isAccountAuthEnabled()) {
            const url = await uploadAccountImage({ profileId: user.id, kind: 'mission', file: compressed });
            return { path: communityImagePath(url, user.id, notice.id, supabaseUrl), url };
        }
        const extension = file.name.split('.').pop() || 'jpg';
        const path = `challenge-community/${notice.id}/${user.id}/${Date.now()}.${extension}`;
        const { error } = await supabase.storage.from('notice-images').upload(path, compressed);
        if (error) throw error;
        return { path, url: supabase.storage.from('notice-images').getPublicUrl(path).data.publicUrl };
    };

    const submitPost = async () => {
        if (!canWrite || !content.trim() || submitting || submitLockRef.current || (isAnnouncement && !isAdmin) || (selectedMissionId && !eligibleMissions.some(mission => mission.id === selectedMissionId))) return;
        submitLockRef.current = true;
        setSubmitting(true);
        let uploaded = null;
        const submittedContent = content.trim();
        const submittedMissionId = selectedMissionId || null;
        try {
            uploaded = await uploadImage(imageFile);
            const postId = await challengeCommunityApi.createPost({
                challengeId: notice.id,
                authorId: user.id,
                content: submittedContent,
                imageUrl: uploaded?.url || null,
                missionId: submittedMissionId,
                isAnnouncement,
            });
            const completedMission = missions.find(mission => mission.id === submittedMissionId) || null;
            const optimisticSubmission = completedMission ? {
                id: `local-${postId}`,
                challenge_id: notice.id,
                mission_id: completedMission.id,
                participant_id: user.id,
                post_id: postId,
                completion_date: today,
                is_valid: true,
            } : null;
            setPosts(current => [{
                id: postId,
                author_id: user.id,
                author: user,
                content: submittedContent,
                image_url: uploaded?.url || null,
                is_announcement: isAnnouncement,
                announced_at: isAnnouncement ? new Date().toISOString() : null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                media: uploaded?.url ? [{ id: `local-media-${postId}`, media_url: uploaded.url, media_type: 'IMAGE', sort_order: 0 }] : [],
                submission: completedMission ? {
                    ...optimisticSubmission,
                    online_challenge_missions: completedMission,
                } : null,
                community_channel_reactions: [],
                community_channel_comments: [],
            }, ...current.filter(post => post.id !== postId)]);
            if (optimisticSubmission) {
                setSubmissions(current => [...current.filter(item => item.post_id !== postId), optimisticSubmission]);
            }
            setContent('');
            setImageFile(null);
            setIsAnnouncement(false);
            setSelectedMissionId('');
            if (submittedMissionId) onMissionCompleted?.();
            void refresh();
        } catch (error) {
            console.error(error);
            if (uploaded?.path) await supabase.storage.from('notice-images').remove([uploaded.path]);
            alert(error.message || '챌린지 글을 등록하지 못했습니다. 잠시 후 다시 시도해주세요.');
        } finally {
            submitLockRef.current = false;
            setSubmitting(false);
        }
    };

    const toggleReaction = async (postId, emoji) => {
        try {
            await runWithSession(async () => {
                const isActive = await challengeCommunityApi.toggleReaction(postId, user.id, emoji);
                setPosts(current => current.map(post => {
                    if (post.id !== postId) return post;
                    const reactions = (post.community_channel_reactions || [])
                        .filter(reaction => !(reaction.user_id === user.id && reaction.emoji === emoji));
                    if (isActive) reactions.push({ user_id: user.id, emoji, users: user });
                    return { ...post, community_channel_reactions: reactions };
                }));
                void refresh();
            });
        }
        catch (error) { console.error(error); alert(error.message || '이모지 반응을 저장하지 못했습니다.'); }
    };

    const submitComment = async postId => {
        const value = (commentInputs[postId] || '').trim();
        if (!value) return;
        try {
            await runWithSession(async () => {
                const commentId = await challengeCommunityApi.createComment(postId, user.id, value);
                setPosts(current => current.map(post => post.id === postId ? {
                    ...post,
                    community_channel_comments: [...(post.community_channel_comments || []), {
                        id: commentId,
                        user_id: user.id,
                        author: user,
                        content: value,
                        created_at: new Date().toISOString(),
                    }],
                } : post));
                setCommentInputs(values => ({ ...values, [postId]: '' }));
                void refresh();
            });
        } catch (error) {
            console.error(error);
            alert(error.message || '댓글을 저장하지 못했습니다.');
        }
    };

    const saveCommentEdit = async (postId, commentId) => {
        const nextContent = editingCommentContent.trim();
        if (!nextContent || savingComment) return;
        setSavingComment(true);
        try {
            await runWithSession(async () => {
                const updated = await challengeCommunityApi.updateComment(commentId, nextContent);
                setPosts(current => current.map(post => post.id === postId ? {
                    ...post,
                    community_channel_comments: (post.community_channel_comments || []).map(comment => comment.id === commentId ? { ...comment, content: updated.content } : comment),
                } : post));
                setEditingCommentId(null);
                setEditingCommentContent('');
            });
        } catch (error) {
            console.error(error);
            alert(error.message || '댓글을 수정하지 못했습니다.');
        } finally {
            setSavingComment(false);
        }
    };

    const deleteComment = async (postId, commentId) => {
        if (!confirm('이 댓글을 삭제할까요?')) return;
        try {
            await runWithSession(async () => {
                await challengeCommunityApi.deleteComment(commentId);
                setPosts(current => current.map(post => post.id === postId ? {
                    ...post,
                    community_channel_comments: (post.community_channel_comments || []).filter(comment => comment.id !== commentId),
                } : post));
            });
        } catch (error) {
            console.error(error);
            alert(error.message || '댓글을 삭제하지 못했습니다.');
        }
    };

    const toggleCommentReaction = async (postId, commentId, emoji) => {
        try {
            await runWithSession(async () => {
                const active = await commentReactionsApi.toggleChannelComment(commentId, user.id, emoji);
                setPosts(current => current.map(post => {
                    if (post.id !== postId) return post;
                    return {
                        ...post,
                        community_channel_comments: (post.community_channel_comments || []).map(comment => {
                            if (comment.id !== commentId) return comment;
                            const reactions = (comment.community_channel_comment_reactions || []).filter(item => !(item.user_id === user.id && item.emoji === emoji));
                            if (active) reactions.push({ user_id: user.id, emoji, users: user });
                            return { ...comment, community_channel_comment_reactions: reactions };
                        }),
                    };
                }));
            });
        } catch (error) {
            console.error(error);
            alert(error.message || '댓글 반응을 저장하지 못했습니다.');
        }
    };

    const deletePost = async post => {
        if (!confirm('이 글을 삭제할까요?')) return;
        try {
            await runWithSession(async () => {
                await challengeCommunityApi.deletePost(post.id);
                setPosts(current => current.filter(item => item.id !== post.id));
                setSubmissions(current => current.filter(item => item.post_id !== post.id));
                onMissionCompleted?.();
                void refresh();
            });
        } catch (error) {
            console.error(error);
            alert(error.message || '글을 삭제하지 못했습니다.');
        }
    };

    const toggleAnnouncement = async post => {
        if (!isAdmin) return;
        try {
            await runWithSession(async () => {
                const updated = await communityFeedApi.setAnnouncement(post.id, !post.is_announcement);
                setPosts(current => sortCommunityPosts(current.map(item => item.id === post.id ? { ...item, ...updated } : item)));
            });
        } catch (error) {
            console.error(error);
            alert(error.message || '공지 상태를 변경하지 못했습니다.');
        }
    };

    const savePostEdit = async post => {
        const nextContent = editingContent.trim();
        if (!nextContent || savingEdit) return;
        const currentMissionId = post.submission?.mission_id || '';
        if (editingMissionId && editingMissionId !== currentMissionId && !eligibleMissions.some(mission => mission.id === editingMissionId)) {
            alert('지금 완료할 수 없는 미션입니다. 다른 미션이나 자유 글을 선택해 주세요.');
            return;
        }
        setSavingEdit(true);
        let uploaded = null;
        let contentSaved = false;
        try {
            await runWithSession(async () => {
                const imageChanged = Boolean(editingImageFile || editingRemoveImage);
                if (editingImageFile) uploaded = await uploadImage(editingImageFile);
                const updated = await challengeCommunityApi.updatePost(post, nextContent, editingMissionId || null, notice.id, user.id);
                contentSaved = true;
                const media = imageChanged
                    ? await challengeCommunityApi.replacePostImage(post, uploaded?.url || null, user.id, notice.id)
                    : post.media;
                setPosts(current => current.map(item => item.id === post.id ? { ...item, ...updated, media } : item));
                await refresh();
                setEditingPostId(null);
                setEditingContent('');
                setEditingMissionId('');
                setEditingImageFile(null);
                setEditingRemoveImage(false);
                if (editingMissionId !== currentMissionId) onMissionCompleted?.();
            });
        } catch (error) {
            console.error(error);
            if (uploaded?.path) await supabase.storage.from('notice-images').remove([uploaded.path]);
            if (contentSaved) await refresh();
            alert(contentSaved
                ? `글 내용은 저장되었지만 사진을 변경하지 못했습니다.\n${error.message}`
                : (error.message || '글을 수정하지 못했습니다.'));
        } finally {
            setSavingEdit(false);
        }
    };

    return createPortal(<>
        <button type="button" className="fixed inset-0 z-[259] cursor-default bg-black/50" aria-label="커뮤니티 닫기" onClick={onClose}/>
        <section className="fixed inset-0 z-[260] mx-auto flex flex-col overflow-hidden bg-white shadow-2xl sm:max-w-lg">
        <header className="shrink-0 border-b border-tossGrey100 bg-white/95 backdrop-blur">
            <div className="flex w-full items-center gap-3 px-4 py-3">
                <button onClick={onClose} className="rounded-full p-2 hover:bg-tossGrey100"><ArrowLeft size={21}/></button>
                <div className="min-w-0"><h2 className="truncate font-black text-tossGrey900">{notice.title}</h2><p className="text-[11px] font-bold text-tossGrey500">{applicantCount === null ? '챌린지 신청 인원을 불러오는 중이에요.' : `${applicantCount}명이 챌린지에 도전 중이에요!`}</p></div>
                <button onClick={onClose} className="ml-auto rounded-full p-2 hover:bg-tossGrey100"><X size={20}/></button>
            </div>
        </header>
        <main ref={feedRef} onWheel={() => { userMovedFeedRef.current = true; }} onTouchMove={() => { userMovedFeedRef.current = true; }} onPointerDown={() => { userMovedFeedRef.current = true; }} className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#F7EFE2]">
            <div className="space-y-4 p-4">
                {activeFilter && <section className="flex items-center gap-3 rounded-3xl border border-blue-100 bg-blue-50 px-4 py-3 shadow-sm">
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-tossGrey900">{activeFilter.participantName} · {activeFilter.missionTitle}</p>
                        <p className="mt-0.5 text-[11px] font-semibold text-tossGrey500">이 참여자가 해당 미션으로 작성한 기록만 보고 있어요.</p>
                    </div>
                    {!activeFilter.locked && <button type="button" onClick={() => setActiveFilter(null)} className="shrink-0 rounded-xl bg-white px-3 py-2 text-[11px] font-black text-tossBlue shadow-sm">전체 글 보기</button>}
                </section>}
                {!activeFilter && <section className="rounded-[28px] border border-tossGrey100 bg-white px-5 pb-4 pt-5 shadow-[0_6px_24px_rgba(0,0,0,0.035)]">
                    {!canWrite ? <div className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700">{periodMessage}</div> : <div className="mb-4">
                        <div className="scrollbar-hide flex gap-2 overflow-x-auto" role="group" aria-label="글 종류 선택">
                            {eligibleMissions.map(mission => <button key={mission.id} type="button" aria-pressed={selectedMissionId === mission.id} onClick={() => { categorySelectionTouchedRef.current = true; setSelectedMissionId(mission.id); }} className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-center text-xs font-extrabold leading-5 transition-colors ${selectedMissionId === mission.id ? 'border-[#CF3A27] bg-[#CF3A27] text-white' : 'border-[#E7D8C4] bg-[#FFFDF9] text-[#544B43] hover:border-[#CF3A27]'}`}>{mission.title}</button>)}
                            <button type="button" aria-pressed={!selectedMissionId} onClick={() => { categorySelectionTouchedRef.current = true; setSelectedMissionId(''); }} className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-center text-xs font-extrabold leading-5 transition-colors ${!selectedMissionId ? 'border-[#CF3A27] bg-[#CF3A27] text-white' : 'border-[#E7D8C4] bg-[#FFFDF9] text-[#544B43] hover:border-[#CF3A27]'}`}>자유 글</button>
                        </div>
                        {eligibleMissions.length === 0 && <p className="mt-2 text-xs font-semibold text-tossGrey500">{isAdmin && !adminHasJoined ? '관리자 글은 챌린지 미션 완료 현황에 포함되지 않아요.' : '오늘 완료할 수 있는 미션을 모두 마쳤어요. 자유롭게 이야기를 남겨주세요.'}</p>}
                    </div>}
                    <textarea value={content} onChange={event => setContent(event.target.value)} disabled={!canWrite} placeholder={canWrite ? selectedMissionId ? '오늘 미션은 어땠나요?' : '커뮤니티에 나누고 싶은 이야기를 자유롭게 남겨주세요!' : '챌린지 수행 기간에 작성할 수 있어요'} className="min-h-28 w-full resize-none bg-transparent text-sm leading-6 text-tossGrey900 outline-none placeholder:text-tossGrey400 disabled:text-tossGrey400" />
                    {isAdmin && <label className="mt-1 inline-flex cursor-pointer items-center gap-2 rounded-xl px-1 py-2 text-xs font-extrabold text-[#544B43]"><input type="checkbox" checked={isAnnouncement} onChange={event => setIsAnnouncement(event.target.checked)} disabled={!canWrite} className="h-4 w-4 accent-[#CF3A27]"/>공지로 보내기</label>}
                    {imageFile && <div className="mt-2 flex items-center justify-between rounded-2xl bg-tossGrey50 px-3 py-2.5 text-xs font-bold text-tossGrey700"><span className="truncate">{imageFile.name}</span><button type="button" onClick={() => setImageFile(null)} className="rounded-full p-1 text-tossGrey400 hover:bg-tossGrey100"><X size={15}/></button></div>}
                    <div className="mt-3 flex items-center gap-2 border-t border-tossGrey100 pt-3">
                        <input ref={fileRef} type="file" accept="image/*" hidden onChange={event => setImageFile(event.target.files?.[0] || null)}/>
                        <button type="button" onClick={() => fileRef.current?.click()} disabled={!canWrite} className="flex items-center gap-1.5 rounded-xl bg-tossGrey50 px-3 py-2.5 text-xs font-extrabold text-tossGrey600 hover:bg-tossGrey100 disabled:opacity-40" title="사진 첨부"><Camera size={18}/><span>사진</span></button>
                        <button onClick={submitPost} disabled={!canWrite || submitting || !content.trim()} className="ml-auto rounded-xl bg-[#CF3A27] px-5 py-2.5 text-xs font-black text-white shadow-sm transition-colors hover:bg-[#B93223] disabled:shadow-none disabled:opacity-40">{submitting ? '등록 중...' : '게시하기'}</button>
                    </div>
                </section>}
                {loading ? <p className="py-12 text-center text-sm text-tossGrey400">불러오는 중...</p> : visiblePosts.length === 0 ? <p className="py-12 text-center text-sm font-bold text-tossGrey400">{activeFilter ? '이 미션으로 작성한 기록이 아직 없어요.' : '첫 번째 기록을 남겨보세요.'}</p> : visiblePosts.map((post, index) => {
                    const imageUrl = post.media?.[0]?.media_url;
                    const mission = post.submission?.online_challenge_missions;
                    const missionIndex = Math.max(0, missions.findIndex(item => item.id === mission?.id));
                    const missionBadgeStyle = MISSION_BADGE_COLORS[missionIndex % MISSION_BADGE_COLORS.length];
                    const isEditing = editingPostId === post.id;
                    const editingMissionOptions = isEditing ? missions.filter(item => item.id === post.submission?.mission_id || eligibleMissions.some(eligible => eligible.id === item.id)) : [];
                    return <React.Fragment key={post.id}>
                        {unreadBoundary?.before === index && <UnreadDivider anchorRef={unreadDividerRef}/>}
                        <article className={`rounded-3xl border bg-white p-4 shadow-sm ${post.is_announcement ? 'border-[#E9B6A8]' : 'border-tossGrey200'}`}>
                        <div className="flex gap-3"><UserAvatar user={post.author} size="w-9 h-9"/><div><p className="text-sm font-black">{post.author?.name}</p><p className="text-[10px] text-tossGrey400">{new Date(post.created_at).toLocaleString('ko-KR')}{post.updated_at && post.updated_at !== post.created_at ? ' · 수정됨' : ''}</p></div>{(post.author_id === user.id || isAdminOrStaff(user)) && <div className="ml-auto flex items-center gap-1">{isAdmin && <button type="button" onClick={() => toggleAnnouncement(post)} aria-pressed={Boolean(post.is_announcement)} className={`rounded-full p-2 ${post.is_announcement ? 'text-[#CF3A27] hover:bg-[#FFF0E9]' : 'text-tossGrey400 hover:bg-tossGrey50 hover:text-[#CF3A27]'}`} aria-label={post.is_announcement ? '공지 해제' : '공지로 고정'}><Pin size={15}/></button>}{post.author_id === user.id && <button type="button" onClick={() => { setEditingPostId(post.id); setEditingContent(post.content); setEditingMissionId(post.submission?.mission_id || ''); setEditingImageFile(null); setEditingRemoveImage(false); }} className="rounded-full p-2 text-tossGrey400 hover:bg-tossGrey50 hover:text-[#CF3A27]" aria-label="글 수정"><Pencil size={15}/></button>}<button type="button" onClick={() => deletePost(post)} className="rounded-full p-2 text-tossGrey400 hover:bg-red-50 hover:text-red-500" aria-label="글 삭제"><Trash2 size={16}/></button></div>}</div>
                        {post.is_announcement && <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-[#FFF0E9] px-2.5 py-1 text-[10px] font-black text-[#B93223]"><Pin size={11}/>공지{lastReadAt && new Date(post.created_at).getTime() > new Date(lastReadAt).getTime() && post.author_id !== user.id ? ' · 새 글' : ''}</span>}
                        {mission && !isEditing && <span style={missionBadgeStyle} className="mt-3 inline-block rounded-full px-2.5 py-1 text-[10px] font-black">{mission.title}</span>}
                        {isEditing ? <div className="mt-3 rounded-2xl bg-tossGrey50 p-3 ring-1 ring-inset ring-tossGrey100 focus-within:ring-2 focus-within:ring-[#CF3A27]/25">
                            <div className="scrollbar-hide mb-3 flex gap-2 overflow-x-auto" role="group" aria-label="글 종류 수정">{editingMissionOptions.map(item => <button key={item.id} type="button" aria-pressed={editingMissionId === item.id} onClick={() => setEditingMissionId(item.id)} className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-extrabold leading-5 ${editingMissionId === item.id ? 'border-[#CF3A27] bg-[#CF3A27] text-white' : 'border-[#E7D8C4] bg-white text-[#544B43]'}`}>{item.title}</button>)}<button type="button" aria-pressed={!editingMissionId} onClick={() => setEditingMissionId('')} className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-extrabold leading-5 ${!editingMissionId ? 'border-[#CF3A27] bg-[#CF3A27] text-white' : 'border-[#E7D8C4] bg-white text-[#544B43]'}`}>자유 글</button></div>
                            <textarea value={editingContent} onChange={event => setEditingContent(event.target.value)} placeholder={editingMissionId ? '오늘 미션은 어땠나요?' : '커뮤니티에 나누고 싶은 이야기를 자유롭게 남겨주세요!'} className="min-h-24 w-full resize-none bg-transparent text-sm leading-6 text-tossGrey900 outline-none" autoFocus/>
                            {imageUrl && !editingImageFile && !editingRemoveImage && <div className="relative mt-3"><img src={imageUrl} alt="현재 첨부된 사진" className="max-h-[460px] w-full rounded-2xl object-cover"/><button type="button" onClick={() => setEditingRemoveImage(true)} disabled={savingEdit} className="absolute right-2 top-2 rounded-xl bg-white/95 px-3 py-2 text-xs font-black text-red-600 shadow-sm disabled:opacity-50" aria-label="기존 사진 삭제">사진 삭제</button></div>}
                            {editingImageFile && <div className="mt-3 flex items-center justify-between rounded-xl bg-white px-3 py-2 text-xs font-bold text-tossGrey700"><span className="truncate">새 사진: {editingImageFile.name}</span><button type="button" onClick={() => setEditingImageFile(null)} disabled={savingEdit} className="rounded-full p-1 text-tossGrey400" aria-label="선택한 사진 취소"><X size={15}/></button></div>}
                            {editingRemoveImage && !editingImageFile && <p className="mt-3 text-xs font-bold text-red-600">저장하면 기존 사진 파일이 삭제됩니다.</p>}
                            <div className="mt-3 flex items-center gap-2 border-t border-tossGrey200 pt-3"><input ref={editFileRef} type="file" accept="image/*" hidden onChange={event => { setEditingImageFile(event.target.files?.[0] || null); event.target.value = ''; }}/><button type="button" onClick={() => editFileRef.current?.click()} disabled={savingEdit} className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-extrabold text-tossGrey600 disabled:opacity-50"><Camera size={16}/>사진 {imageUrl ? '교체' : '추가'}</button><div className="ml-auto flex gap-2"><button type="button" onClick={() => { setEditingPostId(null); setEditingContent(''); setEditingMissionId(''); setEditingImageFile(null); setEditingRemoveImage(false); }} disabled={savingEdit} className="rounded-xl px-3 py-2 text-xs font-bold text-tossGrey500 hover:bg-white disabled:opacity-50">취소</button><button type="button" onClick={() => savePostEdit(post)} disabled={!editingContent.trim() || savingEdit} className="flex items-center gap-1 rounded-xl bg-[#CF3A27] px-3 py-2 text-xs font-black text-white disabled:opacity-40"><Check size={14}/>{savingEdit ? '저장 중...' : '저장'}</button></div></div>
                        </div> : <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-tossGrey850">{post.content}</p>}
                        {imageUrl && !isEditing && <img src={imageUrl} alt="챌린지 기록" className="mt-3 max-h-[460px] w-full rounded-2xl object-cover"/>}
                        <div className="mt-3"><NoticeReactions reactions={post.community_channel_reactions || []} currentUserId={user.id} onToggleReaction={emoji => toggleReaction(post.id, emoji)}/></div>
                        <div className="mt-3 space-y-3 border-t border-tossGrey100 pt-3">
                            {(post.community_channel_comments || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).map(comment => <div key={comment.id} {...bindLongPress(comment.id)} className="group/comment flex select-none gap-3 py-1"><UserAvatar user={comment.author} size="w-8 h-8"/><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="flex items-baseline gap-2"><p className="text-xs font-black text-tossGrey900">{comment.author?.name}</p><span className="text-[10px] text-tossGrey400">{new Date(comment.created_at).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })}</span></div>{comment.user_id === user.id && editingCommentId !== comment.id && <div className="flex shrink-0 opacity-100 md:opacity-0 md:group-hover/comment:opacity-100"><button type="button" onClick={() => { setEditingCommentId(comment.id); setEditingCommentContent(comment.content); }} className="rounded-lg p-1.5 text-tossGrey400 hover:bg-tossGrey50 hover:text-tossBlue" aria-label="댓글 수정"><Pencil size={13}/></button><button type="button" onClick={() => deleteComment(post.id, comment.id)} className="rounded-lg p-1.5 text-tossGrey400 hover:bg-red-50 hover:text-red-500" aria-label="댓글 삭제"><Trash2 size={13}/></button></div>}</div>{editingCommentId === comment.id ? <div className="mt-1"><input value={editingCommentContent} onChange={event => setEditingCommentContent(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') saveCommentEdit(post.id, comment.id); }} className="h-9 w-full rounded-xl border border-tossGrey200 bg-tossGrey50 px-3 text-sm outline-none focus:border-tossBlue" autoFocus/><div className="mt-1.5 flex justify-end gap-2"><button type="button" onClick={() => { setEditingCommentId(null); setEditingCommentContent(''); }} className="px-2 py-1 text-[11px] font-bold text-tossGrey500">취소</button><button type="button" onClick={() => saveCommentEdit(post.id, comment.id)} disabled={!editingCommentContent.trim() || savingComment} className="px-2 py-1 text-[11px] font-black text-tossBlue disabled:opacity-40">{savingComment ? '저장 중' : '저장'}</button></div></div> : <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-tossGrey700">{comment.content}</p>}<div className="mt-1 origin-left scale-90"><NoticeReactions reactions={comment.community_channel_comment_reactions || []} currentUserId={user.id} onToggleReaction={emoji => toggleCommentReaction(post.id, comment.id, emoji)} hideAddButtonOnMobile pickerOpenToken={commentPickerRequest.commentId === comment.id ? commentPickerRequest.token : 0}/></div></div></div>)}
                            <div className="flex items-center gap-2"><MessageCircle size={16} className="text-tossGrey400"/><input value={commentInputs[post.id] || ''} onChange={event => setCommentInputs(values => ({ ...values, [post.id]: event.target.value }))} onKeyDown={event => { if (event.key === 'Enter') submitComment(post.id); }} placeholder="댓글 남기기" className="flex-1 rounded-xl bg-tossGrey50 px-3 py-2 text-xs outline-none"/><button onClick={() => submitComment(post.id)} className="p-2 text-tossBlue"><Send size={16}/></button></div>
                        </div>
                        </article>
                        {unreadBoundary?.after === index && <UnreadDivider anchorRef={unreadDividerRef}/>}
                    </React.Fragment>;
                })}
            </div>
        </main>
        </section>
        {showSessionDialog && <InterestSessionDialog noticeId={null} api={challengeCommunityApi} onClose={() => { pendingSessionActionRef.current = null; setShowSessionDialog(false); }} onContinue={resumePendingAction}/>}
    </>, document.body);
}
