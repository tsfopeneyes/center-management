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
import { confirmApp } from '../../../utils/appDialog';
import CommunityPhotoGallery from '../../common/CommunityPhotoGallery';
import useModalClose from '../../../hooks/useModalClose';
import { communityChannelsApi } from '../../../api/communityChannelsApi';
import { canWriteMissionPost, getChallengeProgress } from '../../../utils/challengeProgress';
import ChallengeProgressSummary from '../../common/ChallengeProgressSummary';
import ChallengeSuccessDialog from '../../common/ChallengeSuccessDialog';
import useChallengeSuccessMessage from '../../../hooks/useChallengeSuccessMessage';
import { CommunityMentionInput, CommunityMentionText } from '../../common/CommunityMention';

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

export default function CommunityModal({ notice: sourceNotice = null, channel: initialChannel = null, user, initialFilter = null, initialPostId = null, onClose, onMissionCompleted, manageHistory = true }) {
    const channelsApi = communityChannelsApi;
    const socialApi = challengeCommunityApi;
    const missionApi = challengeMissionsApi;
    const commentsApi = commentReactionsApi;
    const feedApi = communityFeedApi;
    const notice = sourceNotice || {};
    const isOnlineChallenge = notice.is_challenge === true && notice.challenge_format === 'ONLINE';
    const [channel, setChannel] = useState(initialChannel);
    const [loadError, setLoadError] = useState('');
    const [posts, setPosts] = useState([]);
    const [currentTime, setCurrentTime] = useState(() => new Date());
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [content, setContent] = useState('');
    const [imageFiles, setImageFiles] = useState([]);
    const [selectedMissionId, setSelectedMissionId] = useState('');
    const [isAnnouncement, setIsAnnouncement] = useState(false);
    const [channelId, setChannelId] = useState(null);
    const [applicantCount, setApplicantCount] = useState(null);
    const [adminHasJoined, setAdminHasJoined] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [commentInputs, setCommentInputs] = useState({});
    const [commentMentions, setCommentMentions] = useState({});
    const [mentionCandidates, setMentionCandidates] = useState([]);
    const [activeFilter, setActiveFilter] = useState(initialFilter);
    const [editingPostId, setEditingPostId] = useState(null);
    const [editingContent, setEditingContent] = useState('');
    const [editingMissionId, setEditingMissionId] = useState('');
    const [editingImageFiles, setEditingImageFiles] = useState([]);
    const [editingRemovedUrls, setEditingRemovedUrls] = useState([]);
    const [savingEdit, setSavingEdit] = useState(false);
    const [editingCommentId, setEditingCommentId] = useState(null);
    const [editingCommentContent, setEditingCommentContent] = useState('');
    const [savingComment, setSavingComment] = useState(false);
    const [canCorrectMissions, setCanCorrectMissions] = useState(false);
    const [correctingPostId, setCorrectingPostId] = useState(null);
    const [correctedMissionId, setCorrectedMissionId] = useState('');
    const [savingMission, setSavingMission] = useState(false);
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
    const missions = isOnlineChallenge ? (notice.challenge_missions || []) : [];
    const ownSubmissions = submissions.filter(item => item.participant_id === user.id);
    const ownProgress = getChallengeProgress(notice, ownSubmissions);
    const isAdmin = isAdminOrStaff(user);
    const today = getKSTDateString(currentTime);
    const isBeforeStart = Boolean(isOnlineChallenge && notice.program_start_date && today < notice.program_start_date);
    const isAfterEnd = Boolean(isOnlineChallenge && notice.program_end_date && today > notice.program_end_date);
    const canWrite = channel?.status === 'ACTIVE' && (!notice.is_challenge || isAdmin || adminHasJoined);
    const canSubmitMission = isOnlineChallenge && canWrite && !isBeforeStart && !isAfterEnd;
    const { open: showSuccessMessage, show: openSuccessMessage, close: closeSuccessMessage } = useChallengeSuccessMessage({
        challengeId: notice.id, userId: user.id,
        ready: isOnlineChallenge && !loading && !loadError,
        eligible: adminHasJoined || ownSubmissions.length > 0,
        autoEnabled: !onMissionCompleted,
        isSuccess: ownProgress.isSuccess,
    });
    useModalClose(manageHistory, onClose, { priority: 260 });
    const periodMessage = isBeforeStart
        ? `${new Date(`${notice.program_start_date}T00:00:00+09:00`).toLocaleDateString('ko-KR')}부터 기록을 남길 수 있어요.`
        : '챌린지는 종료되었지만 자유 글과 댓글은 계속 남길 수 있어요.';

    useEffect(() => {
        let active = true;
        setCanCorrectMissions(false);
        if (!isOnlineChallenge) return () => { active = false; };
        socialApi.isChallengeHost(notice.id, user)
            .then(isHost => { if (active) setCanCorrectMissions(isHost); })
            .catch(error => console.error('Failed to check challenge host:', error));
        return () => { active = false; };
    }, [notice.id, user.id, isOnlineChallenge]);


    useEffect(() => {
        const timer = window.setInterval(() => setCurrentTime(new Date()), 60_000);
        return () => window.clearInterval(timer);
    }, []);


    useEffect(() => {
        const handleKeyDown = event => {
            if (event.key !== 'Escape' || showSessionDialog || manageHistory) return;
            if (document.querySelector('[data-community-photo-viewer]')) return;
            event.preventDefault();
            onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, showSessionDialog, manageHistory]);

    const eligibleMissions = useMemo(() => missions.filter(mission => canWriteMissionPost(mission,
        { canSubmitMission, hasJoined: adminHasJoined, today })), [adminHasJoined, canSubmitMission, missions, today]);
    const visiblePosts = useMemo(() => {
        if (!activeFilter) return sortCommunityPosts(posts);
        return sortCommunityPosts(posts.filter(post => post.author_id === activeFilter.participantId
            && post.submission?.mission_id === activeFilter.missionId));
    }, [activeFilter, posts]);
    const lastReadAt = useCommunityUnread(channelId, user.id, posts, !loading, feedApi);
    const unreadBoundary = useMemo(() => activeFilter ? null : getUnreadBoundary(visiblePosts, lastReadAt, user.id),
        [activeFilter, lastReadAt, user.id, visiblePosts]);

    useEffect(() => {
        autoScrolledRef.current = false;
        userMovedFeedRef.current = false;
    }, [notice.id]);

    useEffect(() => {
        if (initialPostId || loading || !channelId || !unreadBoundary || activeFilter
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
    }, [activeFilter, channelId, initialPostId, loading, unreadBoundary]);

    useEffect(() => {
        if (!initialPostId || loading) return;
        const frame = window.requestAnimationFrame(() => {
            const feed = feedRef.current;
            const target = [...(feed?.querySelectorAll('[data-community-post-id]') || [])]
                .find(element => element.dataset.communityPostId === initialPostId);
            if (!feed || !target) return;
            feed.scrollTo({ top: Math.max(0, target.getBoundingClientRect().top
                - feed.getBoundingClientRect().top + feed.scrollTop - 12), behavior: 'auto' });
            autoScrolledRef.current = true;
        });
        return () => window.cancelAnimationFrame(frame);
    }, [initialPostId, loading]);

    useEffect(() => { setActiveFilter(initialFilter); }, [initialFilter]);
    useEffect(() => {
        setSelectedMissionId(current => eligibleMissions.some(mission => mission.id === current)
            ? current : categorySelectionTouchedRef.current ? '' : (eligibleMissions[0]?.id || ''));
    }, [eligibleMissions]);
    useEffect(() => {
        let active = true;
        setAdminHasJoined(false);
        if (notice.is_challenge) channelsApi.fetchChallengeAccess(notice.id, user.id)
            .then(allowed => { if (active) setAdminHasJoined(allowed); }).catch(console.error);
        return () => { active = false; };
    }, [notice.is_challenge, notice.id, user.id]);
    const refresh = async () => {
        try {
            const resolved = initialChannel?.id
                ? await channelsApi.fetchChannel(initialChannel.id)
                : await channelsApi.fetchProgramChannel(notice.id);
            if (!resolved) throw new Error('커뮤니티가 아직 열리지 않았거나 참여 권한이 없어요. 모집 상태와 프로그램 참여 내역을 확인해주세요.');
            const [postRows, submissionRows, candidates] = await Promise.all([
                channelsApi.fetchPosts(resolved.id),
                isOnlineChallenge ? missionApi.fetchSubmissions(notice.id, 'ONLINE') : [],
                channelsApi.fetchMentionCandidates(resolved),
            ]);
            setChannel(resolved);
            setChannelId(resolved.id);
            setApplicantCount(resolved.participant_count);
            setPosts(postRows);
            setSubmissions(submissionRows);
            setMentionCandidates(candidates);
            setLoadError('');
        } catch (error) {
            setLoadError(error.code === 'PGRST116' || error.code === '42501'
                ? '커뮤니티가 종료되었거나 참여 권한이 변경되었어요. 운영 상태와 프로그램 참여 내역을 확인해주세요.'
                : error.message || '커뮤니티를 불러오지 못했어요. 다시 시도해주세요.');
            setChannel(null); setPosts([]); setSubmissions([]); setMentionCandidates([]);
        } finally { setLoading(false); }
    };
    useEffect(() => { setLoading(true); void refresh(); }, [notice.id, initialChannel?.id, user.id]);
    useEffect(() => {
        const timer = window.setInterval(async () => {
            try {
                const resolved = initialChannel?.id ? await channelsApi.fetchChannel(initialChannel.id)
                    : await channelsApi.fetchProgramChannel(notice.id);
                if (!resolved) throw new Error('커뮤니티 접근 권한이 변경되었어요.');
                setChannel(resolved); setApplicantCount(resolved.participant_count);
            } catch (error) { setLoadError(error.message); setChannel(null); setPosts([]); }
        }, 60_000);
        return () => window.clearInterval(timer);
    }, [notice.id, initialChannel?.id, user.id]);

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
            return { path: communityImagePath(url, user.id, notice.id || channelId, supabaseUrl), url };
        }
        const extension = file.name.split('.').pop() || 'jpg';
        const path = `challenge-community/${notice.id || channelId}/${user.id}/${crypto.randomUUID()}.${extension}`;
        const { error } = await supabase.storage.from('notice-images').upload(path, compressed);
        if (error) throw error;
        return { path, url: supabase.storage.from('notice-images').getPublicUrl(path).data.publicUrl };
    };
    const removeImages = async paths => {
        if (!paths.length) return;
        const {error}=await supabase.storage.from('notice-images').remove(paths);
        if(error)throw error;
    };

    const submitPost = async () => {
        if (!canWrite || !content.trim() || submitting || submitLockRef.current || (isAnnouncement && !isAdmin) || (selectedMissionId && !eligibleMissions.some(mission => mission.id === selectedMissionId))) return;
        submitLockRef.current = true;
        setSubmitting(true);
        const uploaded = [];
        const submittedContent = content.trim();
        const submittedMissionId = selectedMissionId || null;
        try {
            if (notice.is_challenge && (!isAdmin || submittedMissionId) && !await channelsApi.fetchChallengeAccess(notice.id, user.id)) {
                setAdminHasJoined(false);
                throw new Error('챌린지 신청 확정자만 미션과 자유글을 작성할 수 있어요.');
            }
            for (const file of imageFiles) uploaded.push(await uploadImage(file));
            const postId = await channelsApi.createPost({
                channelId,
                authorId: user.id,
                content: submittedContent,
                imageUrls: uploaded.map(item => item.url),
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
                image_url: uploaded[0]?.url || null,
                is_announcement: isAnnouncement,
                announced_at: isAnnouncement ? new Date().toISOString() : null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                media: uploaded.map((item, sort_order) => ({ id: `local-media-${postId}-${sort_order}`, media_url: item.url, media_type: 'IMAGE', sort_order })),
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
            setImageFiles([]);
            setIsAnnouncement(false);
            setSelectedMissionId('');
            if (submittedMissionId) onMissionCompleted?.();
            void refresh();
        } catch (error) {
            console.error(error);
            if (uploaded.length) await removeImages(uploaded.map(item => item.path).filter(Boolean)).catch(console.error);
            alert(error.message || '글을 등록하지 못했습니다. 잠시 후 다시 시도해주세요.');
        } finally {
            submitLockRef.current = false;
            setSubmitting(false);
        }
    };

    const toggleReaction = async (postId, emoji) => {
        try {
            await runWithSession(async () => {
                const isActive = await socialApi.toggleReaction(postId, user.id, emoji);
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
                const commentId = await socialApi.createComment(postId, user.id, value, commentMentions[postId] || []);
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
                setCommentMentions(values => ({ ...values, [postId]: [] }));
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
                const updated = await socialApi.updateComment(commentId, nextContent);
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
        if (!await confirmApp('이 댓글을 삭제할까요?', { title: '댓글 삭제', confirmText: '삭제', tone: 'danger' })) return;
        try {
            await runWithSession(async () => {
                await socialApi.deleteComment(commentId);
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
                const active = await commentsApi.toggleChannelComment(commentId, user.id, emoji);
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
        if (!await confirmApp('이 글을 삭제할까요?\n삭제하면 모두에게 보이지 않습니다.', { title: '글 삭제', confirmText: '삭제', tone: 'danger' })) return;
        try {
            await runWithSession(async () => {
                await socialApi.deletePost(post.id);
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

    const saveHostMission = async post => {
        if (!canCorrectMissions || savingMission) return;
        setSavingMission(true);
        try {
            await runWithSession(async () => {
                await socialApi.setPostMissionAsAdmin(post, correctedMissionId || null);
                await refresh();
                setCorrectingPostId(null);
                onMissionCompleted?.();
            });
        } catch (error) {
            console.error(error);
            alert(error.message || '게시글의 미션을 수정하지 못했습니다.');
        } finally {
            setSavingMission(false);
        }
    };

    const toggleAnnouncement = async post => {
        if (!isAdmin) return;
        try {
            await runWithSession(async () => {
                const updated = await feedApi.setAnnouncement(post.id, !post.is_announcement);
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
        if (isOnlineChallenge && editingMissionId && editingMissionId !== currentMissionId && !eligibleMissions.some(mission => mission.id === editingMissionId)) {
            alert('지금 완료할 수 없는 미션입니다. 다른 미션이나 자유 글을 선택해 주세요.');
            return;
        }
        setSavingEdit(true);
        const uploaded = [];
        let contentSaved = false;
        try {
            await runWithSession(async () => {
                const imageChanged = Boolean(editingImageFiles.length || editingRemovedUrls.length);
                for (const file of editingImageFiles) uploaded.push(await uploadImage(file));
                const nextUrls = imageChanged ? [
                    ...(post.media || []).filter(item => !editingRemovedUrls.includes(item.media_url)).map(item => item.media_url),
                    ...uploaded.map(item => item.url),
                ] : null;
                const updated = await channelsApi.editPost(post, user.id, nextContent,
                    isOnlineChallenge ? (editingMissionId || null) : (post.submission?.mission_id || null), nextUrls);
                contentSaved = true;
                const removedPaths = (post.media || []).filter(item => nextUrls && !nextUrls.includes(item.media_url))
                    .map(item => communityImagePath(item.media_url, user.id, notice.id || channelId, supabaseUrl)).filter(Boolean);
                if (removedPaths.length) {
                    await removeImages(removedPaths).catch(error => console.error('Failed to remove replaced community photos:',error));
                }
                const media = nextUrls === null ? post.media : nextUrls.map((media_url, sort_order) => ({ media_url, sort_order }));
                setPosts(current => current.map(item => item.id === post.id ? { ...item, ...updated, media } : item));
                await refresh();
                setEditingPostId(null);
                setEditingContent('');
                setEditingMissionId('');
                setEditingImageFiles([]);
                setEditingRemovedUrls([]);
                if (editingMissionId !== currentMissionId) onMissionCompleted?.();
            });
        } catch (error) {
            console.error(error);
            if (!error.postId && uploaded.length) await removeImages(uploaded.map(item => item.path).filter(Boolean)).catch(console.error);
            if (contentSaved) await refresh();
            alert(error.message || '글을 수정하지 못했습니다. 다시 시도해주세요.');
        } finally {
            setSavingEdit(false);
        }
    };

    return createPortal(<>
        <button type="button" className="fixed inset-0 z-[259] cursor-default bg-black/50" aria-hidden="true" tabIndex={-1} onClick={onClose}/>
        <section role="dialog" aria-modal="true" aria-label={channel?.name || notice.title || '커뮤니티'} className="fixed inset-0 z-[260] mx-auto flex flex-col overflow-hidden bg-white shadow-2xl sm:max-w-lg">
        <header className="shrink-0 border-b border-tossGrey100 bg-white/95 backdrop-blur">
            <div className="flex w-full items-center gap-3 px-4 py-3">
                <button onClick={onClose} aria-label="뒤로 가기" className="rounded-full p-2 hover:bg-tossGrey100"><ArrowLeft size={21}/></button>
                <div className="min-w-0"><h2 className="truncate font-black text-tossGrey900">{channel?.name || notice.title || '커뮤니티'}</h2><p className="text-[11px] font-bold text-tossGrey500">{loadError ? '프로그램 참여 내역을 확인해주세요.' : channel?.is_open_program ? '로그인하면 누구나 글을 남길 수 있어요.' : applicantCount === null ? '참여 인원을 불러오는 중이에요.' : `${applicantCount}명 참여 중`}</p></div>
                <button onClick={onClose} aria-label="닫기" className="ml-auto rounded-full p-2 hover:bg-tossGrey100"><X size={20}/></button>
            </div>
        </header>
        <main ref={feedRef} onWheel={() => { userMovedFeedRef.current = true; }} onTouchMove={() => { userMovedFeedRef.current = true; }} onPointerDown={() => { userMovedFeedRef.current = true; }} className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#F7EFE2]">
            <div className="space-y-4 p-4">
                {isOnlineChallenge && !loading && !loadError && (adminHasJoined || ownSubmissions.length > 0) && <>
                    <ChallengeProgressSummary notice={notice} submissions={ownSubmissions} onViewMessage={openSuccessMessage}/>
                </>}
                {activeFilter && <section className="flex items-center gap-3 rounded-3xl border border-blue-100 bg-blue-50 px-4 py-3 shadow-sm">
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-tossGrey900">{activeFilter.participantName} · {activeFilter.missionTitle}</p>
                        <p className="mt-0.5 text-[11px] font-semibold text-tossGrey500">이 참여자가 해당 미션으로 작성한 기록만 보고 있어요.</p>
                    </div>
                    {!activeFilter.locked && <button type="button" onClick={() => setActiveFilter(null)} className="shrink-0 rounded-xl bg-white px-3 py-2 text-[11px] font-black text-tossBlue shadow-sm">전체 글 보기</button>}
                </section>}
                {!activeFilter && <section className="rounded-[28px] border border-tossGrey100 bg-white px-5 pb-4 pt-5 shadow-[0_6px_24px_rgba(0,0,0,0.035)]">
                    {!canWrite ? <div className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700">{loadError ? '현재 이 커뮤니티에 접근할 수 없어요.' : channel?.status === 'SCHEDULED' ? '프로그램 모집이 시작되면 커뮤니티가 열려요.' : channel?.status === 'CLOSED' ? '종료된 커뮤니티입니다.' : isOnlineChallenge && !adminHasJoined ? '챌린지 신청 확정자만 미션과 자유글을 작성할 수 있어요.' : '참여 권한을 확인하고 있어요.'}</div> : <div className="mb-4">
                        {isAfterEnd && <div className="mb-3 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700">{periodMessage}</div>}
                        {isOnlineChallenge && <div className="scrollbar-hide flex gap-2 overflow-x-auto" role="group" aria-label="글 종류 선택">
                            {eligibleMissions.map(mission => <button key={mission.id} type="button" aria-pressed={selectedMissionId === mission.id} onClick={() => { categorySelectionTouchedRef.current = true; setSelectedMissionId(mission.id); }} className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-center text-xs font-extrabold leading-5 transition-colors ${selectedMissionId === mission.id ? 'border-[#CF3A27] bg-[#CF3A27] text-white' : 'border-[#E7D8C4] bg-[#FFFDF9] text-[#544B43] hover:border-[#CF3A27]'}`}>{mission.title}</button>)}
                            <button type="button" aria-pressed={!selectedMissionId} onClick={() => { categorySelectionTouchedRef.current = true; setSelectedMissionId(''); }} className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-center text-xs font-extrabold leading-5 transition-colors ${!selectedMissionId ? 'border-[#CF3A27] bg-[#CF3A27] text-white' : 'border-[#E7D8C4] bg-[#FFFDF9] text-[#544B43] hover:border-[#CF3A27]'}`}>자유 글</button>
                        </div>}
                        {isOnlineChallenge && eligibleMissions.length === 0 && <p className="mt-2 text-xs font-semibold text-tossGrey500">{!adminHasJoined ? '관리자는 자유글과 공지를 작성할 수 있어요. 미션 참여는 프로그램 신청 후 가능해요.' : isBeforeStart ? '미션 인증은 챌린지 시작일부터 가능해요. 자유 글은 지금 남길 수 있어요.' : '지금 인증할 수 있는 미션이 없어요. 자유롭게 이야기를 남겨주세요.'}</p>}
                    </div>}
                    <textarea value={content} onChange={event => setContent(event.target.value)} disabled={!canWrite} placeholder={canWrite ? selectedMissionId ? '오늘 미션은 어땠나요?' : '커뮤니티에 나누고 싶은 이야기를 자유롭게 남겨주세요!' : loadError ? '참여 권한을 확인해주세요' : '운영 중인 커뮤니티에서 작성할 수 있어요'} className="min-h-28 w-full resize-none bg-transparent text-sm leading-6 text-tossGrey900 outline-none placeholder:text-tossGrey400 disabled:text-tossGrey400" />
                    {isAdmin && <label className="mt-1 inline-flex cursor-pointer items-center gap-2 rounded-xl px-1 py-2 text-xs font-extrabold text-[#544B43]"><input type="checkbox" checked={isAnnouncement} onChange={event => setIsAnnouncement(event.target.checked)} disabled={!canWrite} className="h-4 w-4 accent-[#CF3A27]"/>공지로 보내기</label>}
                    {imageFiles.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{imageFiles.map((file, index) => <div key={`${file.name}-${index}`} className="flex max-w-full items-center gap-1 rounded-xl bg-tossGrey50 px-2 py-1.5 text-xs font-bold text-tossGrey700"><span className="max-w-40 truncate">{file.name}</span><button type="button" onClick={() => setImageFiles(files => files.filter((_, itemIndex) => itemIndex !== index))} aria-label={`${file.name} 제거`}><X size={14}/></button></div>)}</div>}
                    <div className="mt-3 flex items-center gap-2 border-t border-tossGrey100 pt-3">
                        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={event => { const files = Array.from(event.target.files || []); setImageFiles(current => { if (current.length + files.length > 10) { alert('사진은 최대 10장까지 첨부할 수 있습니다.'); return current; } return [...current, ...files]; }); event.target.value = ''; }}/>
                        <button type="button" onClick={() => fileRef.current?.click()} disabled={!canWrite} className="flex items-center gap-1.5 rounded-xl bg-tossGrey50 px-3 py-2.5 text-xs font-extrabold text-tossGrey600 hover:bg-tossGrey100 disabled:opacity-40" title="사진 첨부"><Camera size={18}/><span>사진</span></button>
                        <button onClick={submitPost} disabled={!canWrite || submitting || !content.trim()} className="ml-auto rounded-xl bg-[#CF3A27] px-5 py-2.5 text-xs font-black text-white shadow-sm transition-colors hover:bg-[#B93223] disabled:shadow-none disabled:opacity-40">{submitting ? '등록 중...' : '게시하기'}</button>
                    </div>
                </section>}
                {loadError && <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{loadError}<button type="button" onClick={() => { setLoading(true); void refresh(); }} className="ml-3 underline">다시 시도</button></div>}
                {loading ? <p className="py-12 text-center text-sm text-tossGrey400">불러오는 중...</p> : visiblePosts.length === 0 ? (!loadError && <p className="py-12 text-center text-sm font-bold text-tossGrey400">{activeFilter ? '이 미션으로 작성한 기록이 아직 없어요.' : '첫 번째 기록을 남겨보세요.'}</p>) : visiblePosts.map((post, index) => {
                    const media = post.media || [];
                    const mission = post.submission?.online_challenge_missions;
                    const missionIndex = Math.max(0, missions.findIndex(item => item.id === mission?.id));
                    const missionBadgeStyle = MISSION_BADGE_COLORS[missionIndex % MISSION_BADGE_COLORS.length];
                    const isEditing = editingPostId === post.id;
                    const editingMissionOptions = isEditing ? missions.filter(item => item.id === post.submission?.mission_id || eligibleMissions.some(eligible => eligible.id === item.id)) : [];
                    return <React.Fragment key={post.id}>
                        {unreadBoundary?.before === index && <UnreadDivider anchorRef={unreadDividerRef}/>}
                        <article data-community-post-id={post.id} className={`rounded-3xl border bg-white p-4 shadow-sm ${post.is_announcement ? 'border-[#E9B6A8]' : 'border-tossGrey200'}`}>
                        <div className="flex gap-3"><UserAvatar user={post.author} size="w-9 h-9"/><div><p className="text-sm font-black">{post.author?.name}</p><p className="text-[10px] text-tossGrey400">{new Date(post.created_at).toLocaleString('ko-KR')}{post.updated_at && post.updated_at !== post.created_at ? ' · 수정됨' : ''}</p></div>{(post.author_id === user.id || isAdminOrStaff(user)) && <div className="ml-auto flex items-center gap-1">{isAdmin && <button type="button" onClick={() => toggleAnnouncement(post)} aria-pressed={Boolean(post.is_announcement)} className={`rounded-full p-2 ${post.is_announcement ? 'text-[#CF3A27] hover:bg-[#FFF0E9]' : 'text-tossGrey400 hover:bg-tossGrey50 hover:text-[#CF3A27]'}`} aria-label={post.is_announcement ? '공지 해제' : '공지로 고정'}><Pin size={15}/></button>}{post.author_id === user.id && <button type="button" onClick={() => { setEditingPostId(post.id); setEditingContent(post.content); setEditingMissionId(post.submission?.mission_id || ''); setEditingImageFiles([]); setEditingRemovedUrls([]); }} className="rounded-full p-2 text-tossGrey400 hover:bg-tossGrey50 hover:text-[#CF3A27]" aria-label="글 수정"><Pencil size={15}/></button>}<button type="button" onClick={() => deletePost(post)} className="rounded-full p-2 text-tossGrey400 hover:bg-red-50 hover:text-red-500" aria-label="글 삭제"><Trash2 size={16}/></button></div>}</div>
                        {post.is_announcement && <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-[#FFF0E9] px-2.5 py-1 text-[10px] font-black text-[#B93223]"><Pin size={11}/>공지{lastReadAt && new Date(post.created_at).getTime() > new Date(lastReadAt).getTime() && post.author_id !== user.id ? ' · 새 글' : ''}</span>}
                        {mission && !isEditing && <span style={missionBadgeStyle} className="mt-3 inline-block rounded-full px-2.5 py-1 text-[10px] font-black">{mission.title}</span>}
                        {canCorrectMissions && !isEditing && (correctingPostId === post.id
                            ? <div className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 p-3"><label className="block text-xs font-bold text-blue-800">이 글의 미션 변경<select value={correctedMissionId} onChange={event => setCorrectedMissionId(event.target.value)} className="mt-2 w-full rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-sm font-bold text-tossGrey800"><option value="">미션 없음</option>{missions.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => setCorrectingPostId(null)} disabled={savingMission} className="rounded-xl px-3 py-2 text-xs font-bold text-tossGrey600">취소</button><button type="button" onClick={() => saveHostMission(post)} disabled={savingMission || correctedMissionId === (post.submission?.mission_id || '')} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white disabled:opacity-40">{savingMission ? '저장 중...' : '미션 저장'}</button></div></div>
                            : <button type="button" onClick={() => { setCorrectingPostId(post.id); setCorrectedMissionId(post.submission?.mission_id || ''); }} className="ml-2 mt-3 inline-flex items-center gap-1 rounded-full border border-[#DDD2C6] bg-white px-2 py-1 text-[10px] font-bold text-[#786F66] hover:border-[#B7A89A] hover:text-[#544B43] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#CF3A27]" aria-label="이 글의 미션 수정"><Pencil size={11}/>미션 수정</button>)}
                        {isEditing ? <div className="mt-3 rounded-2xl bg-tossGrey50 p-3 ring-1 ring-inset ring-tossGrey100 focus-within:ring-2 focus-within:ring-[#CF3A27]/25">
                            {isOnlineChallenge && <div className="scrollbar-hide mb-3 flex gap-2 overflow-x-auto" role="group" aria-label="글 종류 수정">{editingMissionOptions.map(item => <button key={item.id} type="button" aria-pressed={editingMissionId === item.id} onClick={() => setEditingMissionId(item.id)} className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-extrabold leading-5 ${editingMissionId === item.id ? 'border-[#CF3A27] bg-[#CF3A27] text-white' : 'border-[#E7D8C4] bg-white text-[#544B43]'}`}>{item.title}</button>)}<button type="button" aria-pressed={!editingMissionId} onClick={() => setEditingMissionId('')} className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-extrabold leading-5 ${!editingMissionId ? 'border-[#CF3A27] bg-[#CF3A27] text-white' : 'border-[#E7D8C4] bg-white text-[#544B43]'}`}>자유 글</button></div>}
                            <textarea value={editingContent} onChange={event => setEditingContent(event.target.value)} placeholder={editingMissionId ? '오늘 미션은 어땠나요?' : '커뮤니티에 나누고 싶은 이야기를 자유롭게 남겨주세요!'} className="min-h-24 w-full resize-none bg-transparent text-sm leading-6 text-tossGrey900 outline-none" autoFocus/>
                            {media.some(item => !editingRemovedUrls.includes(item.media_url)) && <div className="mt-3 grid grid-cols-2 gap-2">{media.filter(item => !editingRemovedUrls.includes(item.media_url)).map((item, mediaIndex) => <div key={item.id} className="relative"><img src={item.media_url} alt={`현재 첨부된 사진 ${mediaIndex + 1}`} className="aspect-square w-full rounded-xl object-cover"/><button type="button" onClick={() => setEditingRemovedUrls(urls => [...urls, item.media_url])} disabled={savingEdit} className="absolute right-1 top-1 rounded-lg bg-white/95 p-1.5 text-red-600 shadow-sm" aria-label="사진 삭제"><X size={14}/></button></div>)}</div>}
                            {editingImageFiles.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{editingImageFiles.map((file, index) => <div key={`${file.name}-${index}`} className="flex items-center gap-1 rounded-xl bg-white px-2 py-1.5 text-xs font-bold"><span className="max-w-36 truncate">{file.name}</span><button type="button" onClick={() => setEditingImageFiles(files => files.filter((_, itemIndex) => itemIndex !== index))} disabled={savingEdit} aria-label="선택한 사진 취소"><X size={14}/></button></div>)}</div>}
                            {editingRemovedUrls.length > 0 && <p className="mt-3 text-xs font-bold text-red-600">제외한 사진은 저장 후 글에서 사라집니다.</p>}
                            <div className="mt-3 flex items-center gap-2 border-t border-tossGrey200 pt-3"><input ref={editFileRef} type="file" accept="image/*" multiple hidden onChange={event => { const files = Array.from(event.target.files || []); setEditingImageFiles(current => { if (media.length - editingRemovedUrls.length + current.length + files.length > 10) { alert('사진은 최대 10장까지 첨부할 수 있습니다.'); return current; } return [...current, ...files]; }); event.target.value = ''; }}/><button type="button" onClick={() => editFileRef.current?.click()} disabled={savingEdit} className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-extrabold text-tossGrey600 disabled:opacity-50"><Camera size={16}/>사진 추가</button><div className="ml-auto flex gap-2"><button type="button" onClick={() => { setEditingPostId(null); setEditingContent(''); setEditingMissionId(''); setEditingImageFiles([]); setEditingRemovedUrls([]); }} disabled={savingEdit} className="rounded-xl px-3 py-2 text-xs font-bold text-tossGrey500 hover:bg-white disabled:opacity-50">취소</button><button type="button" onClick={() => savePostEdit(post)} disabled={!editingContent.trim() || savingEdit} className="flex items-center gap-1 rounded-xl bg-[#CF3A27] px-3 py-2 text-xs font-black text-white disabled:opacity-40"><Check size={14}/>{savingEdit ? '저장 중...' : '저장'}</button></div></div>
                        </div> : <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-tossGrey850">{post.content}</p>}
                        {!isEditing && media.length > 0 && <CommunityPhotoGallery media={media} alt="커뮤니티 첨부 사진"/>}
                        <div className="mt-3"><NoticeReactions reactions={post.community_channel_reactions || []} currentUserId={user.id} onToggleReaction={emoji => toggleReaction(post.id, emoji)}/></div>
                        <div className="mt-3 space-y-3 border-t border-tossGrey100 pt-3">
                            {(post.community_channel_comments || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).map(comment => <div key={comment.id} {...bindLongPress(comment.id)} className="group/comment flex select-none gap-3 py-1"><UserAvatar user={comment.author} size="w-8 h-8"/><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="flex items-baseline gap-2"><p className="text-xs font-black text-tossGrey900">{comment.author?.name}</p><span className="text-[10px] text-tossGrey400">{new Date(comment.created_at).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })}</span></div>{comment.user_id === user.id && editingCommentId !== comment.id && <div className="flex shrink-0 opacity-100 md:opacity-0 md:group-hover/comment:opacity-100"><button type="button" onClick={() => { setEditingCommentId(comment.id); setEditingCommentContent(comment.content); }} className="rounded-lg p-1.5 text-tossGrey400 hover:bg-tossGrey50 hover:text-tossBlue" aria-label="댓글 수정"><Pencil size={13}/></button><button type="button" onClick={() => deleteComment(post.id, comment.id)} className="rounded-lg p-1.5 text-tossGrey400 hover:bg-red-50 hover:text-red-500" aria-label="댓글 삭제"><Trash2 size={13}/></button></div>}</div>{editingCommentId === comment.id ? <div className="mt-1"><CommunityMentionInput value={editingCommentContent} onChange={setEditingCommentContent} candidates={mentionCandidates} onSubmit={() => saveCommentEdit(post.id, comment.id)} className="h-9 w-full rounded-xl border border-tossGrey200 bg-tossGrey50 px-3 text-sm outline-none focus:border-tossBlue"/><div className="mt-1.5 flex justify-end gap-2"><button type="button" onClick={() => { setEditingCommentId(null); setEditingCommentContent(''); }} className="px-2 py-1 text-[11px] font-bold text-tossGrey500">취소</button><button type="button" onClick={() => saveCommentEdit(post.id, comment.id)} disabled={!editingCommentContent.trim() || savingComment} className="px-2 py-1 text-[11px] font-black text-tossBlue disabled:opacity-40">{savingComment ? '저장 중' : '저장'}</button></div></div> : <CommunityMentionText candidates={mentionCandidates} className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-tossGrey700">{comment.content}</CommunityMentionText>}<div className="mt-1 origin-left scale-90"><NoticeReactions reactions={comment.community_channel_comment_reactions || []} currentUserId={user.id} onToggleReaction={emoji => toggleCommentReaction(post.id, comment.id, emoji)} hideAddButtonOnMobile pickerOpenToken={commentPickerRequest.commentId === comment.id ? commentPickerRequest.token : 0}/></div></div></div>)}
                            <div className="flex items-center gap-2"><MessageCircle size={16} className="text-tossGrey400"/><CommunityMentionInput onMentionSelect={candidate => setCommentMentions(values => ({ ...values, [post.id]: [...new Set([...(values[post.id] || []), candidate.id])] }))} value={commentInputs[post.id] || ''} onChange={value => setCommentInputs(values => ({ ...values, [post.id]: value }))} candidates={mentionCandidates} onSubmit={() => submitComment(post.id)} className="w-full rounded-xl bg-tossGrey50 px-3 py-2 text-xs outline-none"/><button aria-label="댓글 게시" onClick={() => submitComment(post.id)} className="p-2 text-tossBlue"><Send size={16}/></button></div>
                        </div>
                        </article>
                        {unreadBoundary?.after === index && <UnreadDivider anchorRef={unreadDividerRef}/>}
                    </React.Fragment>;
                })}
            </div>
        </main>
        </section>
        <ChallengeSuccessDialog open={showSuccessMessage} onClose={closeSuccessMessage} notice={notice} user={user}/>
        {showSessionDialog && <InterestSessionDialog noticeId={null} api={challengeCommunityApi} onClose={() => { pendingSessionActionRef.current = null; setShowSessionDialog(false); }} onContinue={resumePendingAction}/>}
    </>, document.body);
}
