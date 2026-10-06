import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, Trash2, X, Save, School, KeyRound, MessageSquare, Star, ShieldMinus, UserRound, Activity, ShieldCheck } from 'lucide-react';
import { supabase } from '../../../../supabaseClient';
import { feedbackApi } from '../../../../api/feedbackApi';
import { extractProgramInfo } from '../../../../utils/textUtils';
import UserAvatar from '../../../common/UserAvatar';
import UserCategoryBadge from '../../../common/UserCategoryBadge';
import { aggregateVisitSessions } from '../../../../utils/visitUtils';
import { getAccountRole, isAdminOrStaff, isMasterStaff, normalizeSchoolName } from '../../../../utils/userUtils';
import useModalClose from '../../../../hooks/useModalClose';
import { getTermsConsentStatus } from '../../../../utils/termsConsent';

const isAdministrator = isAdminOrStaff;

const UserEditModal = ({
    editingUser, setEditingUser,
    handleDeleteUser, handleRemoveAdminRole, handleResetPassword, handleApproveUser,
    userStats, fetchData, setIsMergeModalOpen, setViewerImage, locations, adminUser
}) => {

    const [editFormData, setEditFormData] = useState({
        name: '', school: '', church: '', phone: '', user_group: '재학생', memo: '',
        status: 'approved', guardian_name: '', guardian_phone: '', guardian_relation: '',
        is_leader: false, is_school_church: false
    });

    const [activeTab, setActiveTab] = useState('INFO');

    const [participatedPrograms, setParticipatedPrograms] = useState([]);
    const [userFeedbacks, setUserFeedbacks] = useState([]);
    const [programTotalHours, setProgramTotalHours] = useState(0);
    const [isLoadingPrograms, setIsLoadingPrograms] = useState(false);

    const [schoolRegion, setSchoolRegion] = useState('미지정');
    const [visitHistory, setVisitHistory] = useState([]);
    const [stats, setStats] = useState({ monthCount: 0, yearCount: 0, dailyAvgMinutes: 0 });
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [historyFilter, setHistoryFilter] = useState('ALL'); // 'ALL' or 'MONTH'

    const formatDuration = (dur) => {
        if (!dur) return '';
        const cleaned = String(dur).trim();
        if (!isNaN(cleaned)) {
            return `${cleaned}시간`;
        }
        return cleaned;
    };

    useModalClose(!!editingUser, () => setEditingUser(null), { priority: 250 });
    useModalClose(isHistoryOpen, () => setIsHistoryOpen(false), { priority: 260 });

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            setEditingUser(null);
        }
    };

    const handleHistoryBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            setIsHistoryOpen(false);
        }
    };

    useEffect(() => {
        const fetchSchoolRegion = async () => {
            if (!editingUser || !editingUser.school) {
                setSchoolRegion('미지정');
                return;
            }
            try {
                const { data, error } = await supabase
                    .from('schools')
                    .select('region')
                    .eq('name', editingUser.school)
                    .maybeSingle();
                if (data && data.region) {
                    setSchoolRegion(data.region);
                } else {
                    setSchoolRegion('미지정');
                }
            } catch (err) {
                console.error(err);
                setSchoolRegion('미지정');
            }
        };
        fetchSchoolRegion();
    }, [editingUser]);

    useEffect(() => {
        const calculateStats = async () => {
            if (!editingUser) return;
            try {
                const { data: rawLogs } = await supabase
                    .from('logs')
                    .select('*')
                    .eq('user_id', editingUser.id);

                const sessions = aggregateVisitSessions(rawLogs || [], [editingUser], locations || []);

                const now = new Date();
                const currentYear = now.getFullYear();
                const currentMonth = now.getMonth();

                let monthCount = 0;
                let yearCount = 0;
                let totalDurationMin = 0;

                sessions.forEach(s => {
                    const [y, m, d] = s.date.split('-').map(Number);
                    if (y === currentYear) {
                        yearCount++;
                        if (m === currentMonth + 1) {
                            monthCount++;
                        }
                    }
                    const minVal = parseInt(s.durationMin) || 0;
                    totalDurationMin += minVal;
                });

                const dailyAvgMinutes = sessions.length > 0 ? Math.round(totalDurationMin / sessions.length) : 0;

                setVisitHistory(sessions);
                setStats({ monthCount, yearCount, dailyAvgMinutes });
            } catch (err) {
                console.error(err);
            }
        };
        calculateStats();
    }, [editingUser, locations]);

    useEffect(() => {
        const fetchPrograms = async () => {
            if (!editingUser) {
                setParticipatedPrograms([]);
                setProgramTotalHours(0);
                return;
            }
            setIsLoadingPrograms(true);
            try {
                const { data, error } = await supabase
                    .from('notice_responses')
                    .select(`
                        status,
                        is_attended,
                        notices (
                            id,
                            title,
                            category,
                            program_date,
                            content
                        )
                    `)
                    .eq('user_id', editingUser.id)
                    .eq('status', 'JOIN');

                if (error) throw error;

                let totalMins = 0;
                const progs = [];

                (data || []).forEach(r => {
                    const notice = r.notices;
                    if (!notice) return;

                    // Case-insensitive check for prior data
                    if (String(notice.category).toUpperCase() !== 'PROGRAM') return;

                    // Extract duration from content
                    const programInfo = extractProgramInfo(notice.content);
                    const extDuration = programInfo.duration;

                    let mins = 0;
                    if (extDuration) {
                        const durationStr = extDuration.replace(/\s+/g, '');
                        const hourMatch = durationStr.match(/(\d+(?:\.\d+)?)(?:시간|h|hr)/i);
                        const minMatch = durationStr.match(/(\d+(?:\.\d+)?)(?:분|m)/i);

                        if (hourMatch) mins += parseFloat(hourMatch[1]) * 60;
                        if (minMatch) mins += parseFloat(minMatch[1]);

                        if (!hourMatch && !minMatch) {
                            const num = parseFloat(durationStr);
                            if (!isNaN(num)) {
                                mins += (num <= 10 ? num * 60 : num); // Assume <= 10 is hours, else minutes
                            }
                        }
                    }

                    // Only count and show programs that they ACTUALLY attended,
                    // to match Student "나의 참여 내역" logic:
                    if (r.is_attended) {
                        totalMins += mins;
                        progs.push({
                            ...notice,
                            is_attended: r.is_attended,
                            mins
                        });
                    }
                });

                // Fetch Feedbacks for these notices
                const feedbacks = await feedbackApi.fetchUserFeedbacks(editingUser.id);
                setUserFeedbacks(feedbacks || []);

                // Sort by date descending
                progs.sort((a, b) => new Date(b.program_date || 0) - new Date(a.program_date || 0));

                setParticipatedPrograms(progs);
                setProgramTotalHours(totalMins / 60);
            } catch (err) {
                console.error('Failed to fetch user programs:', err);
            } finally {
                setIsLoadingPrograms(false);
            }
        };

        fetchPrograms();
    }, [editingUser]);


    useEffect(() => {
        if (editingUser) {
            setEditFormData({
                name: editingUser.name || '',
                school: editingUser.school || '',
                church: editingUser.church || '',
                phone: editingUser.phone || editingUser.phone_back4 || '',
                user_group: editingUser.user_group || '재학생',
                memo: editingUser.memo || '',
                status: editingUser.status || 'approved',
                guardian_name: editingUser.guardian_name || '',
                guardian_phone: editingUser.guardian_phone || '',
                guardian_relation: editingUser.guardian_relation || '',
                is_leader: editingUser.is_leader || false,
                is_school_church: editingUser.preferences?.is_school_church || false
            });
        }
    }, [editingUser]);

    const handleSaveUser = async () => {
        if (!editingUser) return;
        try {
            const { error } = await supabase.from('users').update({
                name: editFormData.name,
                school: normalizeSchoolName(editFormData.school),
                church: editFormData.church,
                phone: editFormData.phone,
                user_group: editFormData.user_group,
                memo: editFormData.memo,
                is_leader: editFormData.is_leader,
                preferences: { ...(editingUser.preferences || {}), is_school_church: editFormData.is_school_church }
            }).eq('id', editingUser.id);
            if (error) throw error;
            alert('회원 정보가 수정되었습니다.');
            setEditingUser(null);
            fetchData();
        } catch (err) { alert(`수정 실패: ${err?.message || '권한과 입력 내용을 확인해주세요.'}`); }
    };

    if (!editingUser) return null;
    const canResetPassword = isAdministrator(adminUser) && !isAdministrator(editingUser);
    const canRemoveAdminRole = isMasterStaff(adminUser)
        && adminUser.id !== editingUser.id
        && ['admin', 'master'].includes(getAccountRole(editingUser));

    return createPortal(
        <div data-testid="user-card-overlay" onClick={handleBackdropClick} className="fixed inset-0 z-[250] bg-black/50 flex items-center justify-center p-3 sm:p-5">
            <div role="dialog" aria-modal="true" aria-label="이용자 카드" className="bg-white w-full max-w-lg rounded-[28px] shadow-xl overflow-hidden flex flex-col max-h-[92dvh]">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
                    <h3 className="flex items-center gap-2 text-base font-bold text-gray-800"><UserRound size={19} className="text-[#CF3A27]" />이용자 카드</h3>
                    <div className="flex gap-2">
                        {canResetPassword && (
                            <button onClick={() => handleResetPassword(editingUser)} className="p-2 text-indigo-400 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition" title="비밀번호 초기화">
                                <KeyRound size={20} />
                            </button>
                        )}
                        {handleDeleteUser && <button aria-label="회원 삭제" onClick={() => handleDeleteUser(editingUser)} className="p-2 text-red-400 hover:bg-red-50 hover:text-red-500 rounded-lg transition"><Trash2 size={20} /></button>}
                        <button aria-label="회원 정보 닫기" className="p-2 rounded-lg hover:bg-gray-100" onClick={() => setEditingUser(null)}><X size={20} className="text-gray-400" /></button>
                    </div>
                </div>
                <div className="overflow-y-auto scrollbar-hide flex-1">
                    <div className="px-6 py-5 flex items-center gap-4 bg-[#F4DDD4]/50">
                        {editingUser.profile_image_url ? (
                            <button onClick={() => setViewerImage(editingUser.profile_image_url)} title="프로필 사진 크게 보기" className="active:scale-95 transition-transform focus:outline-none">
                                <UserAvatar user={editingUser} size="w-16 h-16" textSize="text-2xl" />
                            </button>
                        ) : (
                            <UserAvatar user={editingUser} size="w-16 h-16" textSize="text-2xl" />
                        )}
                        <div className="min-w-0 flex-1"><p className="text-2xl font-bold tracking-tight text-gray-900">{editingUser.name}</p><p className="mt-1 text-sm text-slate-600"><UserCategoryBadge user={editingUser} /> <span className="ml-2">{editingUser.school || '학교 미등록'}</span></p><div className="mt-2 text-xs text-gray-500 flex items-center gap-1.5">
                            <span>최근 웹 접속:</span>
                            <span className="text-[#CF3A27] font-extrabold">{editingUser.lastActiveFormatted || '기록 없음'}</span>
                        </div>
                        </div>
                    </div>
                    <div className="p-5 sm:p-6 space-y-5">
                        <h4 className="flex items-center gap-2 text-sm font-bold text-slate-800"><UserRound size={17} className="text-[#CF3A27]" />기본 정보</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-medium text-gray-600 block mb-1">이름</label>
                                <input type="text" value={editFormData.name} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-[#CF3A27] focus:ring-2 focus:ring-[#F4DDD4] font-semibold text-sm" />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-600 block mb-1">그룹</label>
                                <select value={editFormData.user_group} onChange={(e) => setEditFormData({ ...editFormData, user_group: e.target.value })} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-[#CF3A27] focus:ring-2 focus:ring-[#F4DDD4] bg-white font-semibold text-sm">
                                    <option value="청소년">청소년</option><option value="졸업생">졸업생</option><option value="STAFF">STAFF</option><option value="재학생">재학생(구)</option><option value="일반인">일반인(구)</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <div className="flex items-center gap-1.5 mb-1">
                                    <label className="text-xs font-medium text-gray-600">학교</label>
                                    {schoolRegion !== '미지정' && (
                                        <span className={`px-1.5 py-0.25 rounded text-xs font-black leading-none ${schoolRegion === '강동' ? 'bg-[#F4DDD4] text-[#CF3A27]' : 'bg-purple-100 text-purple-600'}`}>
                                            {schoolRegion}
                                        </span>
                                    )}
                                </div>
                                <input type="text" value={editFormData.school} onChange={(e) => setEditFormData({ ...editFormData, school: e.target.value })} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-[#CF3A27] focus:ring-2 focus:ring-[#F4DDD4] font-semibold text-sm" />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-600 block mb-1">출석교회</label>
                                <input type="text" value={editFormData.church} onChange={(e) => setEditFormData({ ...editFormData, church: e.target.value })} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-[#CF3A27] focus:ring-2 focus:ring-[#F4DDD4] font-semibold text-sm" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 divide-y divide-transparent">
                            <div>
                                <label className="text-xs font-medium text-gray-600 block mb-1">연락처</label>
                                <input type="text" value={editFormData.phone} onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-[#CF3A27] focus:ring-2 focus:ring-[#F4DDD4] font-semibold text-sm" />
                            </div>
                        </div>



                        <div className="grid grid-cols-2 gap-3">
                            {(() => {
                                const consentStatus = getTermsConsentStatus(editingUser);
                                const labels = {
                                    CURRENT: ['동의 완료', 'bg-emerald-50 text-emerald-800'],
                                    OUTDATED: ['재동의 필요 · 이전 약관', 'bg-amber-50 border-amber-100 text-amber-700'],
                                    REQUIRED: ['재동의 필요 · 기록 없음', 'bg-amber-50 border-amber-100 text-amber-700'],
                                    NOT_APPLICABLE: ['정식 가입 전', 'bg-gray-50 border-gray-200 text-gray-600'],
                                    UNAVAILABLE: ['확인 불가', 'bg-gray-50 border-gray-200 text-gray-600']
                                };
                                const [label, colors] = labels[consentStatus];
                                return <div className={`col-span-2 p-4 rounded-2xl ${colors}`}>
                                    <p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={17} />가입 약관 · {label}</p>
                                    {consentStatus === 'CURRENT' && <p className="mt-1 text-xs">{editingUser.preferences?.terms_agreed_at ? `동의 일시 · ${new Date(editingUser.preferences.terms_agreed_at).toLocaleString('ko-KR')}` : '동의 일시가 기록되지 않았습니다.'}</p>}
                                    {['REQUIRED', 'OUTDATED'].includes(consentStatus) && <p className="mt-1 text-xs">다음 로그인 또는 키오스크 이용 시 본인이 직접 동의합니다.</p>}
                                </div>;
                            })()}

                            <div className="flex items-center gap-2.5 p-3.5 bg-gray-50 rounded-2xl">
                                <input
                                    type="checkbox"
                                    id="is_school_church"
                                    checked={editFormData.is_school_church}
                                    onChange={(e) => setEditFormData({ ...editFormData, is_school_church: e.target.checked })}
                                    className="w-4 h-4 text-emerald-500 border-gray-300 rounded focus:ring-emerald-500 cursor-pointer"
                                />
                                <label htmlFor="is_school_church" className="text-xs font-bold text-gray-700 cursor-pointer flex items-center gap-1">
                                    <School size={14} className="text-emerald-500" />
                                    스쿨처치 참여
                                </label>
                            </div>

                            {(editFormData.user_group === '청소년' || editFormData.user_group === '졸업생' || editFormData.user_group === '재학생') && (
                                <div className="flex items-center gap-2.5 p-3.5 bg-gray-50 rounded-2xl">
                                    <input
                                        type="checkbox"
                                        id="is_leader"
                                        checked={editFormData.is_leader}
                                        onChange={(e) => setEditFormData({ ...editFormData, is_leader: e.target.checked })}
                                        className="w-4 h-4 text-yellow-500 border-gray-300 rounded focus:ring-yellow-500 cursor-pointer"
                                    />
                                    <label htmlFor="is_leader" className="text-xs font-bold text-gray-700 cursor-pointer flex items-center gap-1">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#FACC15" stroke="#FACC15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-star"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                                        리더 분배
                                    </label>
                                </div>
                            )}

                        </div>

                        {editFormData.guardian_name && (
                            <div className="p-4 bg-[#F4DDD4] rounded-xl border border-[#F4DDD4] space-y-2">
                                <p className="text-xs font-black text-[#CF3A27] uppercase tracking-widest mb-1">보호자 정보 (만 14세 미만)</p>
                                <div className="grid grid-cols-2 gap-4 text-xs font-bold">
                                    <div><span className="text-[#B93223] block text-xs">성함</span>{editFormData.guardian_name}</div>
                                    <div><span className="text-[#B93223] block text-xs">관계</span>{editFormData.guardian_relation}</div>
                                    <div className="col-span-2"><span className="text-[#B93223] block text-xs">연락처</span>{editFormData.guardian_phone}</div>
                                </div>
                            </div>
                        )}

                                                {stats && (
                            <div className="border-t border-gray-100 pt-5 mt-4">
                                <h4 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-3"><Activity size={17} className="text-[#CF3A27]" />활동 기록</h4>
                                <div className="grid grid-cols-3 gap-2 text-center mb-4">
                                    <button
                                        type="button"
                                        onClick={() => { setHistoryFilter('MONTH'); setIsHistoryOpen(true); }}
                                        className="bg-[#f9fafb] p-4 rounded-2xl hover:bg-[#F4DDD4]/40 transition-all cursor-pointer text-center focus:outline-none focus:ring-2 focus:ring-[#CF3A27]/20"
                                    >
                                        <span className="text-xs text-gray-500 block font-bold mb-0.5">이번 달 방문</span>
                                        <span className="font-bold text-[#CF3A27] text-xl whitespace-nowrap">{stats.monthCount}회</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setHistoryFilter('YEAR'); setIsHistoryOpen(true); }}
                                        className="bg-gray-50 p-3 rounded-xl hover:bg-[#F4DDD4]/40 transition-all cursor-pointer text-center focus:outline-none focus:ring-2 focus:ring-[#CF3A27]/20"
                                    >
                                        <span className="text-xs text-gray-500 block font-bold mb-0.5">올해 방문</span>
                                        <span className="font-bold text-[#CF3A27] text-xl whitespace-nowrap">{stats.yearCount}회</span>
                                    </button>
                                    <div className="bg-gray-50 p-3 rounded-xl flex flex-col justify-center items-center">
                                        <span className="text-xs text-gray-500 block font-bold mb-0.5">일 평균 시간</span>
                                        <span className="font-bold text-gray-800 text-base whitespace-nowrap">
                                            {stats.dailyAvgMinutes >= 60
                                                ? `${Math.floor(stats.dailyAvgMinutes / 60)}h ${stats.dailyAvgMinutes % 60}m`
                                                : `${stats.dailyAvgMinutes}m`
                                            }
                                        </span>
                                    </div>
                                </div>

                                <div className="border-t border-[#F4DDD4]/60 pt-4 mt-2">
                                    <div className="flex justify-between items-end mb-2">
                                        <h5 className="text-xs font-extrabold text-gray-600">참여 프로그램</h5>
                                        <span className="text-xs font-bold text-[#CF3A27] bg-[#F4DDD4]/60 px-2 py-0.5 rounded-full">
                                            총 {programTotalHours > 0 ? (Number.isInteger(programTotalHours) ? programTotalHours : programTotalHours.toFixed(1)) : 0}시간
                                        </span>
                                    </div>

                                    {isLoadingPrograms ? (
                                        <div className="text-center py-4 text-xs text-[#B93223] animate-pulse font-bold">명단 확인중...</div>
                                    ) : participatedPrograms.length > 0 ? (
                                        <div className="space-y-2">
                                            {participatedPrograms.map(p => {
                                                return (
                                                    <div key={p.id} className="bg-white p-2.5 rounded-lg border border-[#F4DDD4] flex flex-col gap-2">
                                                        <div className="flex justify-between items-start gap-2">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-xs font-bold text-gray-800 truncate" title={p.title}>{p.title}</div>
                                                                <div className="text-xs text-gray-500 mt-0.5">
                                                                    {p.program_date ? new Date(p.program_date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) : '일정미정'}
                                                                    {extractProgramInfo(p.content).duration ? ` • ${formatDuration(extractProgramInfo(p.content).duration)}` : ''}
                                                                </div>
                                                            </div>
                                                            <div className="text-xs font-bold px-2 py-1 rounded-md shrink-0 bg-emerald-50 text-emerald-600">
                                                                출석완료
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-center py-4 text-xs text-gray-400 bg-white/50 rounded-lg">
                                            참여한 프로그램이 없습니다.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* 메모(관리자용) - 최하단 이동 */}
                        <div className="mt-4">
                            <label className="text-xs font-semibold text-gray-600 block mb-1">메모 (관리자용)</label>
                            <textarea
                                value={editFormData.memo}
                                onChange={(e) => setEditFormData({ ...editFormData, memo: e.target.value })}
                                className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-[#CF3A27] focus:ring-2 focus:ring-[#F4DDD4] resize-none h-16 text-xs font-bold"
                                placeholder="특이사항 입력"
                            />
                        </div>
                    </div>
                </div>
                    <div className="p-5 shrink-0 border-t border-gray-100 bg-white space-y-2">
                        {canRemoveAdminRole && (
                            <button
                                type="button"
                                onClick={() => handleRemoveAdminRole(editingUser)}
                                className="w-full py-3 bg-violet-50 text-violet-700 border border-violet-200 rounded-xl font-bold hover:bg-violet-100 transition flex items-center justify-center gap-2"
                            >
                                <ShieldMinus size={18} /> 관리자 권한 해제
                            </button>
                        )}
                        {editingUser.status === 'pending' && (
                            <button
                                onClick={async () => {
                                    await handleApproveUser(editingUser);
                                    setEditingUser(null);
                                }}
                                className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition flex items-center justify-center gap-2 shadow-md mb-3"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                회원 승인 완료하기
                            </button>
                        )}
                        {(editingUser.user_group === '게스트' || editingUser.preferences?.is_temporary) && (
                            <button
                                onClick={() => setIsMergeModalOpen(true)}
                                className="w-full py-3 bg-amber-50 text-amber-600 border border-amber-200 rounded-xl font-bold hover:bg-amber-100 transition flex items-center justify-center gap-2 mb-3"
                            >
                                <RefreshCw size={18} /> 계정 연결 확인 안내
                            </button>
                        )}
                        <button onClick={handleSaveUser} className="w-full py-3.5 bg-[#CF3A27] text-white rounded-xl font-bold hover:bg-[#B93223] transition flex items-center justify-center gap-2 ">
                            <Save size={20} /> 수정사항 저장
                        </button>
                    </div>

                    {/* 방문 이력 상세 모달 overlay */}
                    {isHistoryOpen && (() => {
                        const filteredHistory = historyFilter === 'MONTH'
                            ? visitHistory.filter(s => {
                                const now = new Date();
                                const [y, m, d] = s.date.split('-').map(Number);
                                return y === now.getFullYear() && m === now.getMonth() + 1;
                              })
                            : visitHistory;

                        return (
                            <div onClick={handleHistoryBackdropClick} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                                <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl p-5 max-h-[75vh] flex flex-col">
                                    <div className="flex justify-between items-center pb-3 border-b border-gray-100 shrink-0">
                                        <h4 className="font-extrabold text-gray-800 text-sm">
                                            {editingUser.name}님의 {historyFilter === 'MONTH' ? '이번 달' : '올해'} 방문 기록
                                        </h4>
                                        <button onClick={() => setIsHistoryOpen(false)} className="text-gray-400 hover:text-gray-600 focus:outline-none p-1">
                                            <X size={18} />
                                        </button>
                                    </div>
                                    <div className="overflow-y-auto flex-1 mt-3 space-y-2 pr-1 scrollbar-hide">
                                        {filteredHistory.length === 0 ? (
                                            <div className="text-center text-gray-400 py-8 text-xs font-bold italic">
                                                {historyFilter === 'MONTH' ? '이번 달 ' : ''}방문 기록이 없습니다.
                                            </div>
                                        ) : (
                                            filteredHistory.map((s, idx) => (
                                                <div key={idx} className="p-3 bg-gray-50/50 border border-gray-100 rounded-xl space-y-1 text-xs">
                                                    <div className="flex justify-between font-bold">
                                                        <span className="text-gray-700">{s.date} ({s.dayOfWeek})</span>
                                                        <span className="text-[#CF3A27] font-mono">{s.startTime} ~ {s.endTime}</span>
                                                    </div>
                                                    <div className="text-xs text-gray-500 flex justify-between gap-2">
                                                        <span className="truncate">공간: <strong className="text-gray-700">{s.usedSpaces || '-'}</strong></span>
                                                        <span className="shrink-0">이용: <strong className="text-gray-700">{s.durationMin}</strong></span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
            </div>
        </div>, document.body
    );
};

export default UserEditModal;
