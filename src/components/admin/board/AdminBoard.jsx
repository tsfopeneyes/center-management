import React, { useState, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { noticesApi } from '../../../api/noticesApi';
import { CATEGORIES, RESPONSE_STATUS } from '../../../constants/appConstants';
import { isWithinInterval, startOfDay, endOfDay, parseISO } from 'date-fns';
import { PlusCircle, FileText, Grid, UploadCloud, Trash2, Edit2, ImageIcon, Users, X, ZoomIn, RotateCw, Eye, ArrowLeft, Heart, MessageCircle, MoreHorizontal, CheckCircle2, XCircle, UserPlus, Search, RefreshCw, Calendar, MapPin, LayoutGrid, Columns, List, ClipboardList } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import Cropper from 'react-easy-crop';
import getCroppedImg, { compressImage } from '../../../utils/imageUtils';
import ModernEditor from '../../common/ModernEditor';
import Microlink from '@microlink/react';
import { formatToLocalISO } from '../../../utils/dateUtils';
import { stripHtml, extractUrls, extractProgramInfo } from '../../../utils/textUtils';
import IntuitiveTimePicker from '../../common/IntuitiveTimePicker';
import { exportParticipantsToExcel } from '../../../utils/exportUtils';
import TemplateManager from '../messages/TemplateManager';
import NoticeModal from '../../student/NoticeModal';
import { userApi } from '../../../api/userApi';

const NoticeGrid = ({ notices, viewMode, mode, noticeStats, setSelectedNotice, openParticipantModal, handleStatusChange, handleEditClick, handleDeleteNotice }) => {
    // Grid container styles
    let gridClass = "grid gap-4 md:gap-6 lg:gap-8 ";
    if (viewMode === 'large') gridClass += "grid-cols-1 md:grid-cols-2 xl:grid-cols-3";
    else if (viewMode === 'small') gridClass += "grid-cols-2 md:grid-cols-3 xl:grid-cols-4";
    else if (viewMode === 'smaller') gridClass += "grid-cols-3 md:grid-cols-4 xl:grid-cols-5";
    else gridClass = "flex flex-col gap-2"; // list

    // Card styles
    let cardClass = "bg-white border border-gray-100 transition-all duration-300 flex group shadow-sm hover:shadow-xl hover:shadow-blue-500/5 ";
    let contentClass = "flex ";
    let thumbClass = "bg-gray-50 overflow-hidden flex-shrink-0 cursor-pointer border border-gray-100 shadow-inner group-hover:border-blue-200 transition-colors ";
    let titleClass = "font-black cursor-pointer group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug tracking-tight ";

    if (viewMode === 'large') {
        cardClass += "p-5 md:p-6 lg:p-8 rounded-[1.5rem] md:rounded-[2rem] flex-col";
        contentClass += "gap-4 md:gap-6 mb-4 md:mb-6";
        thumbClass += "w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 rounded-2xl";
        titleClass += "text-base md:text-lg lg:text-xl mb-1";
    } else if (viewMode === 'small') {
        cardClass += "p-4 rounded-2xl flex-col";
        contentClass += "gap-3 mb-3";
        thumbClass += "w-12 h-12 md:w-16 md:h-16 rounded-xl";
        titleClass += "text-sm md:text-base mb-0.5";
    } else if (viewMode === 'smaller') {
        cardClass += "p-3 rounded-xl flex-col";
        contentClass += "gap-2 mb-2 flex-col"; // Stack image and text
        thumbClass += "w-full aspect-video rounded-lg";
        titleClass += "text-xs md:text-sm mb-0.5";
    } else if (viewMode === 'list') {
        cardClass += "p-3 rounded-xl flex-row items-center justify-between";
        contentClass += "gap-4 items-center flex-1 min-w-0";
        thumbClass += "w-10 h-10 rounded-lg";
        titleClass += "text-sm md:text-base mb-0.5 truncate";
    }

    return (
        <div className={gridClass}>
            {notices.map(notice => (
                <div key={notice.id} className={cardClass}>
                    <div className={contentClass}>
                        {/* Thumbnail */}
                        {viewMode !== 'list' && (notice.images?.length > 0 || notice.image_url) && (
                            <div onClick={() => setSelectedNotice(notice)} className={thumbClass}>
                                <img src={notice.images?.length > 0 ? notice.images[0] : notice.image_url} alt="thumb" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                            </div>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            {viewMode !== 'list' && (
                                <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                                    {notice.is_sticky && <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-lg text-[9px] font-black uppercase tracking-tight">📌 공지</span>}
                                    {notice.is_recruiting && notice.program_status === 'ACTIVE' && (
                                        <>
                                            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-lg text-[9px] font-black uppercase tracking-tight">Active</span>
                                            {(() => {
                                                if (!notice.recruitment_deadline) return null;
                                                const diff = parseISO(notice.recruitment_deadline) - new Date();
                                                return (diff > 0 && diff < 86400000) ? <span className="px-2 py-0.5 bg-red-500 text-white rounded-lg text-[9px] font-black animate-pulse">마감직전</span> : null;
                                            })()}
                                        </>
                                    )}
                                    {notice.program_status === 'COMPLETED' && <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-lg text-[9px] font-black uppercase tracking-tight">Completed</span>}
                                    {notice.program_status === 'CANCELLED' && <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-lg text-[9px] font-black uppercase tracking-tight">Cancelled</span>}
                                    {(notice.images?.length > 0 || notice.image_url) && (
                                        <div className="flex items-center gap-1 text-[9px] font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-lg border border-gray-100">
                                            <ImageIcon size={10} className="opacity-50" /> {notice.images?.length || 1}
                                        </div>
                                    )}
                                </div>
                            )}

                            <h3 onClick={() => setSelectedNotice(notice)} className={`${titleClass} ${notice.program_status !== 'ACTIVE' ? 'text-gray-400' : 'text-gray-800'}`}>
                                {viewMode === 'list' && notice.is_sticky && <span className="mr-2 text-orange-500 shrink-0">📌</span>}
                                {notice.title}
                            </h3>
                            <p className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">{new Date(notice.created_at).toLocaleDateString()}</p>
                        </div>
                    </div>

                    {/* Actions & Stats */}
                    <div className={viewMode === 'list' ? "flex items-center gap-4 shrink-0" : "mt-auto space-y-2 md:space-y-3"}>
                        {(notice.is_recruiting || notice.is_poll) && noticeStats[notice.id] && (
                            <div className={`p-2 lg:p-3 rounded-xl flex justify-between items-center transition-all shadow-sm ${notice.program_status === 'ACTIVE' || !notice.program_status ? 'bg-blue-50/50 group-hover:bg-blue-600 group-hover:text-white' : 'bg-gray-100/50 opacity-60'} ${viewMode === 'list' ? 'shrink-0 min-w-[130px] md:min-w-[150px]' : ''}`}>
                                <div className={`flex gap-3 font-black ${viewMode === 'smaller' ? 'text-[9px]' : 'text-[10px] md:text-[11px]'}`}>
                                    {notice.is_poll ? (
                                        <span className={notice.program_status === 'ACTIVE' || !notice.program_status ? "text-purple-600 group-hover:text-white" : ""}>
                                            투표 {noticeStats[notice.id].pollTotal || 0}
                                        </span>
                                    ) : (
                                        <>
                                            <span className={notice.program_status === 'ACTIVE' || !notice.program_status ? "text-blue-600 group-hover:text-white" : ""}>신청 {noticeStats[notice.id].JOIN || 0}</span>
                                            {viewMode !== 'smaller' && <span className={notice.program_status === 'ACTIVE' || !notice.program_status ? "text-orange-500 group-hover:text-orange-200" : ""}>대기 {noticeStats[notice.id].WAITLIST || 0}</span>}
                                        </>
                                    )}
                                </div>
                                <button onClick={() => openParticipantModal(notice)} className={`text-[9px] md:text-[10px] px-2 py-1 rounded-md font-black transition-all shadow-sm ${notice.program_status === 'ACTIVE' || !notice.program_status ? 'bg-white text-blue-600 hover:bg-blue-50' : 'bg-gray-200 text-gray-500'}`}>
                                    {notice.is_poll ? '결과' : '명단'}
                                </button>
                            </div>
                        )}

                        <div className={`flex items-center justify-between lg:gap-2 ${viewMode === 'list' ? 'gap-1' : 'pt-2 md:pt-3 border-t border-gray-50'}`}>
                            <div className="flex items-center gap-1 shrink-0">
                                {mode === CATEGORIES.PROGRAM && (
                                    <>
                                        {notice.program_status === 'ACTIVE' ? (
                                            <button onClick={() => handleStatusChange(notice.id, 'COMPLETED')} className="p-1.5 md:p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all" title="완료 처리">
                                                <CheckCircle2 size={viewMode === 'list' ? 18 : viewMode === 'smaller' ? 14 : 16} />
                                            </button>
                                        ) : (
                                            <button onClick={() => handleStatusChange(notice.id, 'ACTIVE')} className="p-1.5 md:p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-all" title="되돌리기">
                                                <RefreshCw size={viewMode === 'list' ? 18 : viewMode === 'smaller' ? 14 : 16} />
                                            </button>
                                        )}
                                    </>
                                )}
                                <button onClick={() => setSelectedNotice(notice)} className="p-1.5 md:p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="미리보기">
                                    <Eye size={viewMode === 'list' ? 18 : viewMode === 'smaller' ? 14 : 16} />
                                </button>
                                <button onClick={() => handleEditClick(notice)} className="p-1.5 md:p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="수정">
                                    <Edit2 size={viewMode === 'list' ? 18 : viewMode === 'smaller' ? 14 : 14} />
                                </button>
                                <button onClick={() => handleDeleteNotice(notice.id)} className="p-1.5 md:p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="삭제">
                                    <Trash2 size={viewMode === 'list' ? 18 : viewMode === 'smaller' ? 14 : 14} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

const AdminBoard = ({ mode = CATEGORIES.NOTICE, notices, fetchData, users, currentLocations }) => {
    // mode: 'NOTICE' | 'PROGRAM' | 'GALLERY'
    const targetCategory = mode;

    // Search & Filter State
    const [filterTitle, setFilterTitle] = useState('');
    const [filterLocation, setFilterLocation] = useState('');
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [filterProgramType, setFilterProgramType] = useState('ALL'); // ALL, CENTER, SCHOOL_CHURCH

    // View Mode State (Initialize empty, load from DB)
    const [viewMode, setViewMode] = useState('large');
    const [prefsLoading, setPrefsLoading] = useState(true);

    React.useEffect(() => {
        const loadPrefs = async () => {
            const adminUser = JSON.parse(localStorage.getItem('admin_user'));
            if (adminUser?.id) {
                try {
                    const prefs = await userApi.fetchUserPreferences(adminUser.id);
                    const localViewMode = localStorage.getItem('adminBoardViewMode') || 'large';

                    let mergedViewMode = prefs.adminBoardViewMode;

                    // Migrate from localStorage if DB is empty
                    if (!mergedViewMode && localViewMode) {
                        mergedViewMode = localViewMode;
                        await userApi.updateUserPreferences(adminUser.id, { adminBoardViewMode: mergedViewMode });
                    }

                    setViewMode(mergedViewMode || 'large');
                } catch (error) {
                    console.error('Failed to load board preferences', error);
                }
            }
            setPrefsLoading(false);
        };
        loadPrefs();
    }, []);

    const handleViewModeChange = async (mode) => {
        setViewMode(mode);
        const adminUser = JSON.parse(localStorage.getItem('admin_user'));
        if (adminUser?.id) {
            try {
                await userApi.updateUserPreferences(adminUser.id, { adminBoardViewMode: mode });
            } catch (err) {
                console.error("Failed to sync board view mode to DB", err);
            }
        }
    };

    // Filter Notices for this view
    const filteredNotices = notices.filter(n => {
        // 1. Basic Category Filter
        if (n.category !== mode) return false;

        // 2. Title Filter
        if (filterTitle && !n.title.toLowerCase().includes(filterTitle.toLowerCase())) return false;

        // 3. Location Filter (for Programs)
        if (mode === CATEGORIES.PROGRAM && filterLocation) {
            // Since location is in the HTML content, we check the content
            // We strip HTML tags from search if needed, but simple includes is usually enough
            if (!n.content.toLowerCase().includes(filterLocation.toLowerCase())) return false;
        }

        // 4. Date Range Filter
        if (filterStartDate || filterEndDate) {
            const targetDate = mode === CATEGORIES.PROGRAM && n.program_date
                ? parseISO(n.program_date)
                : parseISO(n.created_at);

            const start = filterStartDate ? startOfDay(parseISO(filterStartDate)) : new Date(0);
            const end = filterEndDate ? endOfDay(parseISO(filterEndDate)) : new Date(8640000000000000);

            if (!isWithinInterval(targetDate, { start, end })) return false;
        }

        // 5. Program Type Filter
        if (mode === CATEGORIES.PROGRAM && filterProgramType !== 'ALL') {
            const type = n.program_type || 'CENTER';
            if (type !== filterProgramType) return false;
        }

        return true;
    });

    // Split Programs by Status
    const activePrograms = mode === CATEGORIES.PROGRAM ? filteredNotices.filter(n => n.program_status === 'ACTIVE' || !n.program_status) : filteredNotices;
    const completedPrograms = mode === CATEGORIES.PROGRAM ? filteredNotices.filter(n => n.program_status === 'COMPLETED' || n.program_status === 'CANCELLED') : [];

    // State
    const [showWriteForm, setShowWriteForm] = useState(false);
    const [newNotice, setNewNotice] = useState({
        title: '',
        content: '',
        is_recruiting: mode === CATEGORIES.PROGRAM,
        is_sticky: false,
        send_push: false,
        category: targetCategory,
        recruitment_deadline: '',
        poll_deadline: '',
        max_capacity: mode === CATEGORIES.PROGRAM ? 0 : '',
        program_date: '',
        program_duration: '',
        program_location: '',
        program_type: 'CENTER',
        is_leader_only: false,
        target_regions: [],
        is_poll: false,
        allow_multiple_votes: false,
        poll_options: []
    }); // Default to target
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [uploading, setUploading] = useState(false);

    // Edit State
    const [editNoticeId, setEditNoticeId] = useState(null);
    const [existingImages, setExistingImages] = useState([]);

    // Image Editor State
    const [showEditor, setShowEditor] = useState(false);
    const [editingFileIndex, setEditingFileIndex] = useState(null);
    const [editorImageSrc, setEditorImageSrc] = useState(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

    // Participant Modal
    const [selectedNoticeForParticipants, setSelectedNoticeForParticipants] = useState(null);
    const [participantList, setParticipantList] = useState({ JOIN: [], DECLINE: [], UNDECIDED: [] });
    const [modalLoading, setModalLoading] = useState(false);
    const [showEntranceList, setShowEntranceList] = useState(false);
    const [lastAddedUser, setLastAddedUser] = useState(null);

    const [noticeStats, setNoticeStats] = useState({});

    // View Modal
    const [selectedNotice, setSelectedNotice] = useState(null);

    // Fetch stats for visible recruiting/poll notices
    React.useEffect(() => {
        const fetchStats = async () => {
            const recruitingIds = filteredNotices.filter(n => n.is_recruiting).map(n => n.id);
            const pollIds = filteredNotices.filter(n => n.is_poll).map(n => n.id);
            
            const nStats = {};
            
            // 1. Fetch Recruitment Stats
            if (recruitingIds.length > 0) {
                const { data: responses } = await supabase.from('notice_responses').select('*').in('notice_id', recruitingIds);
                recruitingIds.forEach(id => nStats[id] = {
                    [RESPONSE_STATUS.JOIN]: 0,
                    [RESPONSE_STATUS.DECLINE]: 0,
                    [RESPONSE_STATUS.UNDECIDED]: 0,
                    [RESPONSE_STATUS.WAITLIST]: 0,
                    attendedCount: 0,
                    is_recruiting: true
                });
                responses?.forEach(r => {
                    if (nStats[r.notice_id]) {
                        nStats[r.notice_id][r.status] = (nStats[r.notice_id][r.status] || 0) + 1;
                        if (r.is_attended) nStats[r.notice_id].attendedCount += 1;
                    }
                });
            }

            // 2. Fetch Poll Stats
            if (pollIds.length > 0) {
                const { data: pollResponses } = await supabase.from('notice_poll_responses').select('notice_id, user_id').in('notice_id', pollIds);
                pollIds.forEach(id => {
                    if (!nStats[id]) nStats[id] = { is_poll: true };
                    else nStats[id].is_poll = true;
                    nStats[id].voters = new Set();
                });
                pollResponses?.forEach(r => {
                    if (nStats[r.notice_id]) {
                        nStats[r.notice_id].voters.add(r.user_id);
                    }
                });
                // Convert Set size to count
                pollIds.forEach(id => {
                    nStats[id].pollTotal = nStats[id].voters?.size || 0;
                });
            }
            
            setNoticeStats(nStats);
        };
        fetchStats();
    }, [notices, mode]);


    // Handlers
    const handleEditClick = (notice) => {
        setShowWriteForm(true);
        setEditNoticeId(notice.id);

        const { date, duration, location, cleanContent } = extractProgramInfo(notice.content);

        const pDateFull = notice.program_date ? notice.program_date.split('T') : ['', '12:00'];
        const pDate = pDateFull[0];
        const pTime = pDateFull[1] ? pDateFull[1].substring(0, 5) : '12:00';

        setNewNotice({
            title: notice.title,
            content: cleanContent,
            is_recruiting: notice.is_recruiting,
            is_sticky: notice.is_sticky || false,
            send_push: false,
            category: notice.category,
            recruitment_deadline: notice.recruitment_deadline ? formatToLocalISO(notice.recruitment_deadline) : '',
            max_capacity: notice.max_capacity || '',
            program_date: pDate,
            program_time: pTime,
            program_duration: duration || notice.program_duration || '',
            program_location: location,
            program_type: notice.program_type || 'CENTER',
            is_leader_only: notice.is_leader_only || false,
            target_regions: notice.target_regions || [],
            is_poll: notice.is_poll || false,
            allow_multiple_votes: notice.allow_multiple_votes || false,
            poll_deadline: notice.poll_deadline ? formatToLocalISO(notice.poll_deadline) : '',
            poll_options: notice.poll_options || []
        });

        let currentImages = [];
        if (notice.images && Array.isArray(notice.images)) {
            currentImages = notice.images;
        } else if (notice.image_url) {
            currentImages = [notice.image_url];
        }
        setExistingImages(currentImages);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setEditNoticeId(null);
        setNewNotice({
            title: '',
            content: '',
            is_recruiting: mode === CATEGORIES.PROGRAM,
            is_sticky: false,
            send_push: false,
            category: targetCategory,
            recruitment_deadline: '',
            max_capacity: mode === CATEGORIES.PROGRAM ? 0 : '',
            program_date: '',
            program_duration: '',
            program_location: '',
            program_type: 'CENTER',
            is_leader_only: false,
            target_regions: [],
            is_poll: false,
            allow_multiple_votes: false,
            poll_deadline: '',
            poll_options: []
        });
        setSelectedFiles([]);
        setExistingImages([]);
        setShowWriteForm(false);
    };

    const handleDeleteNotice = async (id) => {
        if (!confirm('정말 삭제하시겠습니까?')) return;
        try {
            await noticesApi.delete(id);
            fetchData();
            if (selectedNotice?.id === id) setSelectedNotice(null);
        } catch (err) { console.error(err); }
    };

    const splitDateTime = (dateTimeStr) => {
        if (!dateTimeStr) return { date: '', time: '12:00' };
        if (dateTimeStr.includes('T')) {
            const [date, time] = dateTimeStr.split('T');
            return { date, time: time.substring(0, 5) };
        }
        return { date: dateTimeStr, time: '12:00' };
    };

    const joinDateTime = (date, time) => {
        if (!date) return '';
        return `${date}T${time}`;
    };


    const handleSaveNotice = async (e) => {
        e.preventDefault();
        if (!newNotice.title) return;
        setUploading(true);
        try {
            const newImageUrls = [];
            for (const item of selectedFiles) {
                // Apply automatic compression before upload
                const compressedFile = await compressImage(item.file);
                const fileExt = compressedFile.name.split('.').pop();
                const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
                const { error: uploadError } = await supabase.storage.from('notice-images').upload(fileName, compressedFile);
                if (uploadError) throw uploadError;
                const { data: { publicUrl } } = supabase.storage.from('notice-images').getPublicUrl(fileName);
                newImageUrls.push(publicUrl);
            }

            const finalImages = [...existingImages, ...newImageUrls];
            const legacyImageUrl = finalImages.length > 0 ? finalImages[0] : null;

            const sanitizedNotice = {
                ...newNotice,
                max_capacity: newNotice.max_capacity ? parseInt(newNotice.max_capacity) : null,
                recruitment_deadline: newNotice.recruitment_deadline ? new Date(newNotice.recruitment_deadline).toISOString() : null,
                poll_deadline: newNotice.poll_deadline ? new Date(newNotice.poll_deadline).toISOString() : null
            };

            // Process Poll Option Images
            let finalPollOptions = [];
            if (sanitizedNotice.is_poll && sanitizedNotice.poll_options) {
                for (let i = 0; i < sanitizedNotice.poll_options.length; i++) {
                    const opt = sanitizedNotice.poll_options[i];
                    let imgUrl = opt.image_url || '';
                    if (opt.imageFile) {
                        try {
                            const compressedPollImg = await compressImage(opt.imageFile);
                            const optExt = compressedPollImg.name.split('.').pop();
                            const optName = `poll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${optExt}`;
                            const { error: pErr } = await supabase.storage.from('notice-images').upload(optName, compressedPollImg);
                            if (pErr) throw pErr;
                            const { data: pData } = supabase.storage.from('notice-images').getPublicUrl(optName);
                            imgUrl = pData.publicUrl;
                        } catch (imgErr) {
                            console.error('Poll option image upload failed', imgErr);
                        }
                    }
                    finalPollOptions.push({
                        id: opt.id,
                        title: opt.title,
                        description: opt.description,
                        image_url: imgUrl
                    });
                }
            }
            sanitizedNotice.poll_options = finalPollOptions;

            // Remove UI-only fields that don't exist in the database
            const { send_push, program_date: rawProgramDate, program_time, program_duration, program_location, is_leader_only, ...dbData } = sanitizedNotice;

            const isProgram = sanitizedNotice.category === CATEGORIES.PROGRAM;
            const { date, duration, location, cleanContent } = extractProgramInfo(dbData.content);
            let finalContent = cleanContent;

            const combinedDate = rawProgramDate; // Already contains time from inputs

            if (isProgram) {
                const infoBlock = `
<div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
    <p style="margin: 0 0 8px 0;"><strong>📅 일정:</strong> ${combinedDate ? new Date(combinedDate).toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '미정'}</p>
    <p style="margin: 0 0 8px 0;"><strong>⏰ 소요시간:</strong> ${program_duration || '미정'}</p>
    <p style="margin: 0 0 8px 0;"><strong>📍 장소:</strong> ${program_location || '미정'}</p>
    <p style="margin: 0 0 8px 0;"><strong>👥 모집 정원:</strong> ${dbData.max_capacity ? dbData.max_capacity + '명' : '제한 없음'}</p>
    ${is_leader_only ? '<p style="margin: 0; color: #f59e0b;"><strong>⚠️ 대상:</strong> 학생 리더 전용 프로그램</p>' : ''}
</div>
`;
                finalContent = infoBlock + finalContent;
            }

            const payload = {
                ...dbData,
                content: finalContent,
                image_url: legacyImageUrl,
                images: finalImages,
                program_date: isProgram && combinedDate ? new Date(combinedDate).toISOString() : null,
                is_leader_only: is_leader_only,
                target_regions: sanitizedNotice.target_regions || []
            };

            if (editNoticeId) {
                await noticesApi.update(editNoticeId, payload);

                alert('수정되었습니다.');
            } else {
                const created = await noticesApi.create(payload);

                alert('등록되었습니다.');
            }
            handleCancelEdit();
            fetchData();
        } catch (err) { console.error(err); alert('저장 실패: ' + err.message); } finally { setUploading(false); }
    };

    // Image Logic
    const onDrop = useCallback(acceptedFiles => {
        if (selectedFiles.length + acceptedFiles.length > 30) {
            alert('최대 30장까지만 업로드 가능합니다.');
            return;
        }
        const newFiles = acceptedFiles.map(file => ({
            file,
            preview: URL.createObjectURL(file),
            id: Math.random().toString(36).substr(2, 9)
        }));
        setSelectedFiles(prev => [...prev, ...newFiles]);
    }, [selectedFiles]);

    const { getRootProps, getInputProps } = useDropzone({ onDrop, accept: { 'image/*': [] }, maxFiles: 30 });

    const openEditor = (index) => {
        setEditingFileIndex(index);
        setEditorImageSrc(selectedFiles[index].preview);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setRotation(0);
        setShowEditor(true);
    };

    const saveEditedImage = async () => {
        try {
            const croppedBlob = await getCroppedImg(editorImageSrc, croppedAreaPixels, rotation);
            const originalName = selectedFiles[editingFileIndex].file.name;
            const newFile = new File([croppedBlob], originalName, { type: 'image/jpeg' });
            const newPreview = URL.createObjectURL(newFile);

            const updated = [...selectedFiles];
            URL.revokeObjectURL(updated[editingFileIndex].preview);
            updated[editingFileIndex] = { ...updated[editingFileIndex], file: newFile, preview: newPreview };
            setSelectedFiles(updated);
            setShowEditor(false);
        } catch (e) { console.error(e); alert('이미지 저장 실패'); }
    };

    const removeFile = (index) => {
        URL.revokeObjectURL(selectedFiles[index].preview);
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleDeleteExistingImage = (index) => {
        setExistingImages(prev => prev.filter((_, i) => i !== index));
    };

    // Participant Modal Logic
    const openParticipantModal = async (notice) => {
        setSelectedNoticeForParticipants(notice);
        setModalLoading(true);
        setPollModalResults(null); 
        try {
            // Fetch normal RSVPs
            const { data, error } = await supabase
                .from('notice_responses')
                .select('status, is_attended, users(id, name, school, phone_back4)')
                .eq('notice_id', notice.id);
            if (error) throw error;
            const list = { JOIN: [], DECLINE: [], UNDECIDED: [], WAITLIST: [] };
            data?.forEach(r => {
                if (list[r.status]) {
                    list[r.status].push({ ...r.users, is_attended: r.is_attended });
                }
            });
            setParticipantList(list);

            // Fetch Poll Responses if applicable
            if (notice.is_poll) {
                const pollData = await noticesApi.fetchPollResponses(notice.id);
                // Group by option_id
                const grouped = {};
                pollData?.forEach(resp => {
                    const optId = resp.option_id;
                    if (!grouped[optId]) grouped[optId] = [];
                    if (resp.users) {
                        grouped[optId].push(resp.users);
                    }
                });
                setPollModalResults(grouped);
            }
        } catch (err) { alert('명단 불러오기 실패'); } finally { setModalLoading(false); }
    };

    const handleAttendanceToggle = async (userId, currentAttended) => {
        try {
            await noticesApi.updateAttendance(selectedNoticeForParticipants.id, userId, !currentAttended);
            setParticipantList(prev => {
                const next = { ...prev };
                next.JOIN = next.JOIN.map(u => u.id === userId ? { ...u, is_attended: !currentAttended } : u);
                return next;
            });
        } catch (err) { alert('출석 상태 변경 실패'); }
    };

    const handleDeleteParticipant = async (userId, userName) => {
        if (!window.confirm(`[${userName}] 학생의 신청 내역을 정말 삭제하시겠습니까?`)) return;
        try {
            await noticesApi.deleteResponse(selectedNoticeForParticipants.id, userId);
            setParticipantList(prev => {
                const next = { ...prev };
                next.JOIN = next.JOIN.filter(u => u.id !== userId);
                next.WAITLIST = next.WAITLIST.filter(u => u.id !== userId);
                return next;
            });
            // Update stats globally
            fetchData();
        } catch (err) {
            console.error('Failed to delete participant:', err);
            alert('삭제 실패: ' + err.message);
        }
    };

    const handleMarkAllAttended = async () => {
        if (!window.confirm('모든 신청 인원을 참석 처리하시겠습니까?')) return;
        try {
            await noticesApi.markAllAttended(selectedNoticeForParticipants.id);
            setParticipantList(prev => {
                const next = { ...prev };
                next.JOIN = next.JOIN.map(u => ({ ...u, is_attended: true }));
                return next;
            });
        } catch (err) { alert('전체 참석 처리 실패'); }
    };

    const handleStatusChange = async (noticeId, newStatus) => {
        const notice = notices.find(n => n.id === noticeId);
        if (!notice) return;

        const statusMap = { 'COMPLETED': '완료', 'CANCELLED': '취소', 'ACTIVE': '진행중(활성)' };
        if (!window.confirm(`프로그램 상태를 [${statusMap[newStatus]}] 상태로 변경하시겠습니까?`)) return;

        try {
            // Archiving Logic
            if (newStatus === 'COMPLETED' || newStatus === 'CANCELLED') {
                const { data: responses, error: resError } = await supabase
                    .from('notice_responses')
                    .select('user_id, status, is_attended')
                    .eq('notice_id', noticeId);

                if (resError) throw resError;

                let archiveLogs = [];
                // Store ID, Title, Date, Time, and Location for persistence
                const info = extractProgramInfo(notice.content);
                const archiveId = `${notice.id}|${notice.title}|${notice.program_date || ''}|${notice.program_time || ''}|${info.location || ''}`;

                if (newStatus === 'COMPLETED') {
                    // Archive ALL sign-ups with attend/absent distinction
                    archiveLogs = (responses || [])
                        .filter(r => r.status === 'JOIN')
                        .map(r => ({
                            user_id: r.user_id,
                            type: r.is_attended ? 'PRG_ATTENDED' : 'PRG_ABSENT',
                            location_id: archiveId
                        }));
                } else if (newStatus === 'CANCELLED') {
                    // Archive all sign-ups (Join or Waitlist) as Cancelled
                    archiveLogs = (responses || [])
                        .filter(r => r.status === 'JOIN' || r.status === 'WAITLIST')
                        .map(r => ({
                            user_id: r.user_id,
                            type: 'PRG_CANCELLED',
                            location_id: archiveId
                        }));
                }

                if (archiveLogs.length > 0) {
                    const { error: logError } = await supabase.from('logs').insert(archiveLogs);
                    if (logError) {
                        console.error('Archive logging failed:', logError);
                        alert(`데이터 아카이빙 실패: ${logError.message}`);
                    }
                } else {
                    // Fallback: If no participants, create a single "System" log entry to ensure persistence
                    const admin = JSON.parse(localStorage.getItem('admin_user'));
                    const systemLog = {
                        user_id: admin?.id || '00000000-0000-0000-0000-000000000000', // Admin or nil UUID
                        type: newStatus === 'COMPLETED' ? 'PRG_COMPLETED' : 'PRG_CANCELLED',
                        location_id: archiveId
                    };
                    const { error: logError } = await supabase.from('logs').insert([systemLog]);
                    if (logError) console.error('System archive logging failed:', logError);
                }
            }

            await noticesApi.updateProgramStatus(noticeId, newStatus);
            fetchData();
        } catch (err) {
            console.error('Status change error:', err);
            alert('상태 변경 및 데이터 아카이빙 실패: ' + err.message);
        }
    };

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [pollModalResults, setPollModalResults] = useState(null);

    const handleUserSearch = async (val) => {
        setSearchQuery(val);
        if (val.length < 2) { setSearchResults([]); return; }
        try {
            const users = await noticesApi.searchUsers(val);
            setSearchResults(users || []);
        } catch (err) { console.error(err); }
    };

    const addWalkIn = async (user) => {
        try {
            await noticesApi.upsertResponse(selectedNoticeForParticipants.id, user.id, 'JOIN');
            await noticesApi.updateAttendance(selectedNoticeForParticipants.id, user.id, true);

            // Optimistic Update & Immediate Feedback
            const newUser = { ...user, is_attended: true };
            if (!participantList.JOIN.some(u => u.id === user.id)) {
                setParticipantList(prev => ({ ...prev, JOIN: [newUser, ...prev.JOIN] }));
            }
            setSearchQuery('');
            setSearchResults([]);
            setLastAddedUser(user);
            setTimeout(() => setLastAddedUser(null), 3000);

            openParticipantModal(selectedNoticeForParticipants); // Refresh list
            setSearchQuery('');
            setSearchResults([]);
        } catch (err) { alert('추가 실패'); }
    };

    // Filter users currently in the center
    const entranceList = users?.filter(u => currentLocations?.[u.id]) || [];

    // Drag and Drop for Images
    const handleImageDragStart = (e, index, type) => {
        e.dataTransfer.setData('index', index);
        e.dataTransfer.setData('type', type);
    };

    const handleImageDrop = (e, dropIndex, dropType) => {
        e.preventDefault();
        const dragIndex = parseInt(e.dataTransfer.getData('index'));
        const dragType = e.dataTransfer.getData('type');
        
        if (dragType !== dropType || isNaN(dragIndex)) return;
        
        if (dragType === 'existing') {
            const newImages = [...existingImages];
            const [draggedItem] = newImages.splice(dragIndex, 1);
            newImages.splice(dropIndex, 0, draggedItem);
            setExistingImages(newImages);
        } else if (dragType === 'selected') {
            const newFiles = [...selectedFiles];
            const [draggedItem] = newFiles.splice(dragIndex, 1);
            newFiles.splice(dropIndex, 0, draggedItem);
            setSelectedFiles(newFiles);
        }
    };

    const handleImageDragOver = (e) => {
        e.preventDefault();
    };

    return (
        <div className="space-y-4 md:space-y-6 animate-fade-in-up">
            <div className="p-4 md:p-10 bg-white rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between bg-gradient-to-r from-white to-blue-50/20">
                <div className="flex items-center justify-between w-full lg:w-auto gap-4">
                    <div>
                        <h2 className="text-xl md:text-3xl font-black text-gray-800 tracking-tighter flex items-center gap-2 md:gap-3">
                            {mode === 'GALLERY' ? <ImageIcon className="text-blue-600" size={24} md:size={32} /> : mode === 'PROGRAM' ? <ClipboardList className="text-blue-600" size={24} md:size={32} /> : <FileText className="text-blue-600" size={24} md:size={32} />}
                            {mode === 'GALLERY' ? '사진첩 관리' : mode === 'PROGRAM' ? '프로그램 관리' : '공지사항 관리'}
                        </h2>
                        <p className="hidden lg:block text-gray-500 text-sm font-medium mt-1">
                            {mode === 'GALLERY' ? '스처 갤러리에 업로드된 사진 및 앨범을 관리합니다.' :
                                mode === 'PROGRAM' ? '프로그램 모집, 신청 현황 및 안내를 관리합니다.' :
                                    '전체 사용자 대상 공지사항을 작성하고 관리합니다.'}
                        </p>
                    </div>

                    <button
                        onClick={() => {
                            if (showWriteForm) handleCancelEdit(); else { setShowWriteForm(true); setNewNotice({ ...newNotice, category: targetCategory }); }
                        }}
                        className={`lg:hidden px-3 py-2 rounded-xl font-bold shadow-md transition flex items-center justify-center gap-1.5 text-xs ${showWriteForm ? 'bg-white text-gray-500 border border-gray-200' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                    >
                        {showWriteForm ? '취소' : <><PlusCircle size={16} /> 신규</>}
                    </button>
                </div>

                <button
                    onClick={() => {
                        if (showWriteForm) handleCancelEdit(); else { setShowWriteForm(true); setNewNotice({ ...newNotice, category: targetCategory }); }
                    }}
                    className={`hidden lg:flex px-5 py-2.5 rounded-xl font-bold shadow-md transition items-center justify-center gap-2 ${showWriteForm ? 'bg-white text-gray-500 border border-gray-200' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                >
                    {showWriteForm ? '작성 취소' : <><PlusCircle size={20} /> <span className="text-sm">새 글 쓰기</span></>}
                </button>
            </div>

            {/* Write Form */}
            {showWriteForm && (
                <div className="p-4 md:p-6 bg-white rounded-2xl border border-gray-100 shadow-sm animate-fade-in-down">
                    <h3 className="font-bold text-gray-800 mb-4 text-lg">{editNoticeId ? '글 수정' : '새 글 작성'}</h3>

                    <form onSubmit={handleSaveNotice} className="space-y-4">
                        <input type="text" placeholder="제목을 입력하세요" className="w-full p-3 md:p-4 border border-gray-100 bg-gray-50 rounded-xl outline-none focus:bg-white focus:border-blue-500 text-base md:text-lg font-bold transition" value={newNotice.title} onChange={e => setNewNotice(prev => ({ ...prev, title: e.target.value }))} required />

                        {mode === CATEGORIES.PROGRAM && (
                            <div className="flex gap-4 mb-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 items-center">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="program_type"
                                        checked={newNotice.program_type === 'CENTER' || !newNotice.program_type}
                                        onChange={() => setNewNotice(prev => ({ ...prev, program_type: 'CENTER' }))}
                                        className="w-4 h-4 text-blue-600"
                                    />
                                    <span className="text-sm font-bold text-gray-700">센터 프로그램</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="program_type"
                                        checked={newNotice.program_type === 'SCHOOL_CHURCH'}
                                        onChange={() => setNewNotice(prev => ({ ...prev, program_type: 'SCHOOL_CHURCH' }))}
                                        className="w-4 h-4 text-blue-600"
                                    />
                                    <span className="text-sm font-bold text-gray-700">스처 프로그램</span>
                                </label>
                                <div className="ml-auto flex flex-wrap items-center gap-3">
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 text-gray-700 rounded-xl border border-gray-200">
                                        {['강동', '강서'].map(region => (
                                            <label key={region} className="flex items-center gap-1.5 cursor-pointer text-sm font-bold">
                                                <input
                                                    type="checkbox"
                                                    checked={newNotice.target_regions?.includes(region)}
                                                    onChange={(e) => {
                                                        const isChecked = e.target.checked;
                                                        setNewNotice(prev => {
                                                            const current = prev.target_regions || [];
                                                            return {
                                                                ...prev,
                                                                target_regions: isChecked
                                                                    ? [...current, region]
                                                                    : current.filter(r => r !== region)
                                                            };
                                                        });
                                                    }}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                                                />
                                                {region}
                                            </label>
                                        ))}
                                    </div>

                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 text-yellow-700 rounded-xl border border-yellow-200">
                                        <input
                                            type="checkbox"
                                            id="is_leader_only"
                                            checked={newNotice.is_leader_only}
                                            onChange={(e) => setNewNotice(prev => ({ ...prev, is_leader_only: e.target.checked }))}
                                            className="w-4 h-4 text-yellow-600 rounded focus:ring-yellow-500 cursor-pointer"
                                        />
                                        <label htmlFor="is_leader_only" className="text-sm font-black cursor-pointer flex items-center gap-1">
                                            ⭐ 리더 전용
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}

                        {mode === CATEGORIES.PROGRAM && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-blue-50/30 p-4 rounded-2xl border border-blue-100/50">
                                <div>
                                    <label className="block text-xs font-bold text-blue-600 mb-1 ml-1">날짜 / 시간 *</label>
                                    <div className="flex flex-col gap-2">
                                        <input
                                            type="date"
                                            value={splitDateTime(newNotice.program_date).date}
                                            onChange={e => {
                                                const newDate = joinDateTime(e.target.value, splitDateTime(newNotice.program_date).time);
                                                setNewNotice(prev => ({
                                                    ...prev,
                                                    program_date: newDate,
                                                    // Sync deadline if it was empty or matches old program_date
                                                    recruitment_deadline: (!prev.recruitment_deadline || prev.recruitment_deadline === prev.program_date) ? newDate : prev.recruitment_deadline
                                                }));
                                            }}
                                            className="w-full p-3 bg-white border border-blue-100 rounded-xl outline-none focus:border-blue-500 transition text-sm"
                                            required
                                        />
                                        <IntuitiveTimePicker
                                            value={splitDateTime(newNotice.program_date).time}
                                            onChange={time => {
                                                const newDate = joinDateTime(splitDateTime(newNotice.program_date).date, time);
                                                setNewNotice(prev => ({
                                                    ...prev,
                                                    program_date: newDate,
                                                    // Sync deadline
                                                    recruitment_deadline: (!prev.recruitment_deadline || prev.recruitment_deadline === prev.program_date) ? newDate : prev.recruitment_deadline
                                                }));
                                            }}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-blue-600 mb-1 ml-1">소요시간 *</label>
                                    <input
                                        type="text"
                                        placeholder="예: 2시간"
                                        value={newNotice.program_duration}
                                        onChange={e => setNewNotice(prev => ({ ...prev, program_duration: e.target.value }))}
                                        className="w-full p-3 bg-white border border-blue-100 rounded-xl outline-none focus:border-blue-500 transition text-sm h-[46px]"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-blue-600 mb-1 ml-1">장소 *</label>
                                    <input
                                        type="text"
                                        placeholder="예: 센터 멀티룸"
                                        value={newNotice.program_location}
                                        onChange={e => setNewNotice(prev => ({ ...prev, program_location: e.target.value }))}
                                        className="w-full p-3 bg-white border border-blue-100 rounded-xl outline-none focus:border-blue-500 transition text-sm h-[46px]"
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        <TemplateManager
                            type={mode}
                            currentContent={newNotice.content}
                            onSelect={(content) => setNewNotice(prev => ({ ...prev, content }))}
                            currentAdmin={JSON.parse(localStorage.getItem('admin_user'))}
                        />

                        <div className="min-h-[300px]">
                            <ModernEditor
                                content={newNotice.content}
                                onChange={(content) => setNewNotice(prev => ({ ...prev, content }))}
                                placeholder="내용을 입력하세요..."
                            />
                        </div>
                        {/* Image Upload */}
                        <div className="border-2 border-dashed border-gray-100 rounded-xl p-6 md:p-8 bg-gray-50 flex flex-col items-center justify-center hover:bg-blue-50 hover:border-blue-200 transition cursor-pointer" {...getRootProps()}>
                            <input {...getInputProps()} />
                            <UploadCloud className="text-gray-300 mb-2" size={32} />
                            <p className="text-gray-500 text-xs md:text-sm font-bold text-center">사진을 드래그하거나 클릭하여 추가 (최대 30장)</p>
                        </div>

                        {/* Image List */}
                        {(existingImages.length > 0 || selectedFiles.length > 0) && (
                            <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
                                {existingImages.map((url, idx) => (
                                    <div 
                                        key={`exist-${idx}`} 
                                        draggable
                                        onDragStart={(e) => handleImageDragStart(e, idx, 'existing')}
                                        onDragOver={handleImageDragOver}
                                        onDrop={(e) => handleImageDrop(e, idx, 'existing')}
                                        className="relative flex-shrink-0 w-20 h-20 md:w-24 md:h-24 rounded-lg overflow-hidden group cursor-move"
                                    >
                                        <img src={url} className="w-full h-full object-cover pointer-events-none" />
                                        <button type="button" onClick={() => handleDeleteExistingImage(idx)} className="absolute inset-0 bg-black/50 flex items-center justify-center text-white md:opacity-0 md:group-hover:opacity-100"><Trash2 size={16} /></button>
                                    </div>
                                ))}
                                {selectedFiles.map((file, idx) => (
                                    <div 
                                        key={file.id} 
                                        draggable
                                        onDragStart={(e) => handleImageDragStart(e, idx, 'selected')}
                                        onDragOver={handleImageDragOver}
                                        onDrop={(e) => handleImageDrop(e, idx, 'selected')}
                                        className="relative flex-shrink-0 w-20 h-20 md:w-24 md:h-24 rounded-lg overflow-hidden group cursor-move"
                                    >
                                        <img src={file.preview} className="w-full h-full object-cover pointer-events-none" />
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center gap-2 md:opacity-0 md:group-hover:opacity-100">
                                            <button type="button" onClick={(e) => { e.stopPropagation(); openEditor(idx) }} className="text-white hover:text-blue-200"><Edit2 size={16} /></button>
                                            <button type="button" onClick={(e) => { e.stopPropagation(); removeFile(idx) }} className="text-white hover:text-red-200"><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Form Footer: Settings & Actions */}
                        <div className="pt-6 border-t border-gray-100 space-y-6">
                            {(mode === 'NOTICE' || mode === 'PROGRAM') && (
                                <div className="space-y-4">
                                    <p className="text-xs font-bold text-gray-400 ml-1">게시글 설정</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        <label className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition border border-gray-100">
                                            <input type="checkbox" checked={newNotice.is_sticky} onChange={e => setNewNotice(prev => ({ ...prev, is_sticky: e.target.checked }))} className="w-5 h-5 text-orange-600 rounded-lg" />
                                            <span className="text-sm font-bold text-gray-700">상단 고정 공지</span>
                                        </label>
                                        <label className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition border border-gray-100">
                                            <input type="checkbox" checked={newNotice.is_recruiting} onChange={e => setNewNotice(prev => ({ ...prev, is_recruiting: e.target.checked }))} className="w-5 h-5 text-blue-600 rounded-lg" />
                                            <span className="text-sm font-bold text-gray-700">학생들에게 참석여부 묻기</span>
                                        </label>
                                        <label className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition border border-gray-100">
                                            <input type="checkbox" checked={newNotice.send_push} onChange={e => setNewNotice(prev => ({ ...prev, send_push: e.target.checked }))} className="w-5 h-5 text-red-600 rounded-lg" />
                                            <span className="text-sm font-bold text-gray-700">🔔 푸시 알림 발송</span>
                                        </label>
                                        <label className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition border border-gray-100">
                                            <input type="checkbox" checked={newNotice.is_poll} onChange={e => setNewNotice(prev => ({ ...prev, is_poll: e.target.checked }))} className="w-5 h-5 text-purple-600 rounded-lg" />
                                            <span className="text-sm font-bold text-gray-700">📊 투표(설문) 열기</span>
                                        </label>
                                    </div>
                                    
                                    {/* Poll Deadline Settings (Visible if is_poll is checked) */}
                                    {newNotice.is_poll && (
                                        <div className="mt-4 p-4 bg-purple-50/50 rounded-xl border border-purple-100 flex flex-col gap-4 animate-fade-in">
                                            <div className="flex items-center gap-4">
                                                <label className="text-xs font-bold text-purple-600 shrink-0">투표 마감 일시 설정</label>
                                                <div className="flex bg-white border border-purple-200 rounded-lg overflow-hidden w-full max-w-sm">
                                                    <input
                                                        type="date"
                                                        value={splitDateTime(newNotice.poll_deadline).date}
                                                        onChange={e => setNewNotice(prev => ({ ...prev, poll_deadline: joinDateTime(e.target.value, splitDateTime(prev.poll_deadline).time) }))}
                                                        className="w-1/2 p-2 outline-none text-sm bg-transparent border-r border-gray-100"
                                                    />
                                                    <IntuitiveTimePicker
                                                        value={splitDateTime(newNotice.poll_deadline).time}
                                                        onChange={time => setNewNotice(prev => ({ ...prev, poll_deadline: joinDateTime(splitDateTime(prev.poll_deadline).date, time) }))}
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <label className="text-xs font-bold text-purple-600 shrink-0">선택 가능한 옵션 수</label>
                                                <div className="flex gap-4 items-center">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input 
                                                            type="radio" 
                                                            name="allow_multiple_votes" 
                                                            checked={!newNotice.allow_multiple_votes} 
                                                            onChange={() => setNewNotice(prev => ({...prev, allow_multiple_votes: false}))}
                                                            className="w-4 h-4 text-purple-600"
                                                        />
                                                        <span className="text-sm font-bold text-gray-700">단일투표 (1개만)</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input 
                                                            type="radio" 
                                                            name="allow_multiple_votes" 
                                                            checked={newNotice.allow_multiple_votes} 
                                                            onChange={() => setNewNotice(prev => ({...prev, allow_multiple_votes: true}))}
                                                            className="w-4 h-4 text-purple-600"
                                                        />
                                                        <span className="text-sm font-bold text-gray-700">중복투표 (여러 개 선택)</span>
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Recruitment Options (Visible if is_recruiting is checked) */}
                            {newNotice.is_recruiting && (
                                <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-4 animate-fade-in">
                                    <p className="text-xs font-bold text-blue-600 ml-1">신청 및 인원 설정</p>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-400 mb-1 ml-1 uppercase">신청 마감 일자</label>
                                            <input
                                                type="date"
                                                value={splitDateTime(newNotice.recruitment_deadline).date}
                                                onChange={e => setNewNotice(prev => ({ ...prev, recruitment_deadline: joinDateTime(e.target.value, splitDateTime(prev.recruitment_deadline).time) }))}
                                                className="w-full h-[46px] p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition text-sm shadow-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-400 mb-1 ml-1 uppercase">마감 시간</label>
                                            <IntuitiveTimePicker
                                                value={splitDateTime(newNotice.recruitment_deadline).time}
                                                onChange={time => setNewNotice(prev => ({ ...prev, recruitment_deadline: joinDateTime(splitDateTime(prev.recruitment_deadline).date, time) }))}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-400 mb-1 ml-1 uppercase">모집 인원 (0: 무제한) {mode === CATEGORIES.PROGRAM && '*'}</label>
                                            <input
                                                type="number"
                                                placeholder="예: 10"
                                                value={newNotice.max_capacity}
                                                onChange={e => setNewNotice(prev => ({ ...prev, max_capacity: e.target.value }))}
                                                className="w-full h-[46px] p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition text-sm shadow-sm"
                                                required={mode === CATEGORIES.PROGRAM}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Poll Options Builder (Visible if is_poll is checked) */}
                            {newNotice.is_poll && (
                                <div className="p-5 bg-purple-50/50 rounded-2xl border border-purple-100 space-y-4 animate-fade-in">
                                    <div className="flex justify-between items-center">
                                        <p className="text-xs font-bold text-purple-600 ml-1">투표 항목 설정</p>
                                        <button
                                            type="button"
                                            onClick={() => setNewNotice(prev => ({ ...prev, poll_options: [...(prev.poll_options || []), { id: Date.now().toString(), title: '', description: '', image_url: '' }] }))}
                                            className="px-3 py-1.5 bg-purple-100 text-purple-700 text-xs font-bold rounded-lg hover:bg-purple-200"
                                        >
                                            + 항목 추가
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        {(newNotice.poll_options || []).map((opt, idx) => (
                                            <div key={opt.id} className="flex gap-3 bg-white p-3 rounded-xl border border-purple-50 shadow-sm relative">
                                                <button type="button" onClick={() => setNewNotice(prev => ({ ...prev, poll_options: prev.poll_options.filter((_, i) => i !== idx) }))} className="absolute -top-2 -right-2 bg-red-100 text-red-500 rounded-full p-1 border border-white">
                                                    <X size={12} />
                                                </button>
                                                <div className="flex-1 space-y-2">
                                                    <input type="text" placeholder="항목 제목" value={opt.title} onChange={e => {
                                                        const newOpts = [...newNotice.poll_options];
                                                        newOpts[idx].title = e.target.value;
                                                        setNewNotice(prev => ({ ...prev, poll_options: newOpts }));
                                                    }} className="w-full p-2 bg-gray-50 border border-gray-100 rounded-lg outline-none focus:border-purple-500 text-sm font-bold" />
                                                    <input type="text" placeholder="항목 설명 (선택)" value={opt.description} onChange={e => {
                                                        const newOpts = [...newNotice.poll_options];
                                                        newOpts[idx].description = e.target.value;
                                                        setNewNotice(prev => ({ ...prev, poll_options: newOpts }));
                                                    }} className="w-full p-2 bg-gray-50 border border-gray-100 rounded-lg outline-none focus:border-purple-500 text-xs" />
                                                    
                                                    {/* File Upload for Option Image */}
                                                    <div className="flex items-center gap-2">
                                                        <label className="cursor-pointer bg-white border border-gray-200 hover:border-purple-400 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5">
                                                            <UploadCloud size={14} /> 이미지 첨부
                                                            <input 
                                                                type="file" 
                                                                accept="image/*" 
                                                                className="hidden" 
                                                                onChange={e => {
                                                                    const file = e.target.files[0];
                                                                    if (file) {
                                                                        const newOpts = [...newNotice.poll_options];
                                                                        newOpts[idx].imageFile = file;
                                                                        newOpts[idx].previewUrl = URL.createObjectURL(file);
                                                                        setNewNotice(prev => ({ ...prev, poll_options: newOpts }));
                                                                    }
                                                                }} 
                                                            />
                                                        </label>
                                                        {opt.image_url && !opt.imageFile && <span className="text-[10px] text-gray-400">기존 이미지가 있습니다</span>}
                                                    </div>
                                                </div>
                                                {(opt.previewUrl || opt.image_url) && (
                                                    <div className="w-20 h-20 rounded-lg bg-gray-100 shrink-0 overflow-hidden border border-gray-200 relative group">
                                                        <img src={opt.previewUrl || opt.image_url} alt="preview" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                                                        <button 
                                                            type="button" 
                                                            className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                                                            onClick={() => {
                                                                const newOpts = [...newNotice.poll_options];
                                                                if (newOpts[idx].previewUrl) URL.revokeObjectURL(newOpts[idx].previewUrl);
                                                                newOpts[idx].previewUrl = null;
                                                                newOpts[idx].imageFile = null;
                                                                newOpts[idx].image_url = '';
                                                                setNewNotice(prev => ({ ...prev, poll_options: newOpts }));
                                                            }}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        {(!newNotice.poll_options || newNotice.poll_options.length === 0) && (
                                            <div className="text-center py-6 text-xs text-gray-400 font-bold border-2 border-dashed border-purple-100 rounded-xl">
                                                우측 상단의 '+ 항목 추가' 버튼을 눌러보세요.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-col md:flex-row items-center justify-end gap-3 pt-4">
                                <button type="button" onClick={handleCancelEdit} className="w-full md:w-auto px-8 py-3.5 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition order-2 md:order-1">
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    disabled={uploading || (targetCategory === 'GALLERY' && selectedFiles.length === 0 && existingImages.length === 0)}
                                    className="w-full md:w-auto px-10 py-3.5 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:bg-gray-300 transition order-1 md:order-2"
                                >
                                    {uploading ? '업로드 중...' : (editNoticeId ? '수정 저장' : '등록하기')}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {/* Search & Filter Bar */}
            <div className="bg-white p-3 md:p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                {/* Row 0: Program Type Tabs (Only for PROGRAM mode) */}
                {mode === CATEGORIES.PROGRAM && (
                    <div className="flex bg-gray-50 p-1 rounded-xl w-fit border border-gray-100">
                        <button
                            onClick={() => setFilterProgramType('ALL')}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${filterProgramType === 'ALL' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            전체
                        </button>
                        <button
                            onClick={() => setFilterProgramType('CENTER')}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${filterProgramType === 'CENTER' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            센터 프로그램
                        </button>
                        <button
                            onClick={() => setFilterProgramType('SCHOOL_CHURCH')}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${filterProgramType === 'SCHOOL_CHURCH' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            스처 프로그램
                        </button>
                    </div>
                )}

                {/* Row 1: Search Inputs & View Toggle */}
                <div className="flex flex-col xl:flex-row gap-2 md:gap-4 justify-between items-center">
                    <div className="flex flex-col lg:flex-row gap-2 md:gap-4 flex-1 w-full">
                        <div className="flex items-center gap-2 w-full lg:w-auto flex-1">
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="제목 검색..."
                                    value={filterTitle}
                                    onChange={(e) => setFilterTitle(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2.5 md:py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition text-sm font-bold shadow-inner"
                                />
                            </div>
                            {mode === CATEGORIES.PROGRAM && (
                                <div className="flex-1 relative lg:hidden">
                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                    <input
                                        type="text"
                                        placeholder="장소..."
                                        value={filterLocation}
                                        onChange={(e) => setFilterLocation(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition text-sm font-bold shadow-inner"
                                    />
                                </div>
                            )}

                            {/* View Mode Toggle (Mobile) */}
                            <div className="flex xl:hidden bg-gray-100 p-1 rounded-xl shrink-0 border border-gray-100 shadow-inner">
                                {[
                                    { id: 'large', icon: LayoutGrid, label: '크게' },
                                    { id: 'list', icon: List, label: '목록' }
                                ].map(m => (
                                    <button
                                        key={m.id}
                                        onClick={() => handleViewModeChange(m.id)}
                                        className={`p-2 rounded-lg transition-all flex items-center justify-center ${viewMode === m.id ? 'bg-white text-blue-600 shadow-sm ring-1 ring-gray-100' : 'text-gray-400 hover:text-gray-600'}`}
                                        title={m.label}
                                    >
                                        <m.icon size={16} />
                                    </button>
                                ))}
                            </div>
                        </div>

                        {mode === CATEGORIES.PROGRAM && (
                            <div className="hidden lg:block flex-1 relative">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="장소 검색..."
                                    value={filterLocation}
                                    onChange={(e) => setFilterLocation(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition text-sm font-bold shadow-inner"
                                />
                            </div>
                        )}
                    </div>

                    {/* View Mode Toggle (Desktop) */}
                    <div className="hidden xl:flex bg-gray-100 p-1 rounded-xl shrink-0 border border-gray-100 shadow-inner">
                        {[
                            { id: 'large', icon: LayoutGrid, label: '크게 보기' },
                            { id: 'small', icon: Grid, label: '작게 보기' },
                            { id: 'smaller', icon: Columns, label: '더 작게 보기' },
                            { id: 'list', icon: List, label: '목록형' }
                        ].map(m => (
                            <button
                                key={m.id}
                                onClick={() => handleViewModeChange(m.id)}
                                className={`p-2 rounded-lg transition-all flex items-center justify-center ${viewMode === m.id ? 'bg-white text-blue-600 shadow-sm ring-1 ring-gray-100' : 'text-gray-400 hover:text-gray-600'}`}
                                title={m.label}
                            >
                                <m.icon size={18} />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Row 2: Date Filters & Results Summary */}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-gray-50">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Calendar className="text-gray-400 hidden sm:block" size={18} />
                            <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-100">
                                <input
                                    type="date"
                                    value={filterStartDate}
                                    onChange={(e) => setFilterStartDate(e.target.value)}
                                    className="p-2 bg-transparent outline-none text-[11px] font-bold w-[125px] sm:w-[135px]"
                                />
                                <span className="text-gray-300 text-xs">-</span>
                                <input
                                    type="date"
                                    value={filterEndDate}
                                    onChange={(e) => setFilterEndDate(e.target.value)}
                                    className="p-2 bg-transparent outline-none text-[11px] font-bold w-[125px] sm:w-[135px]"
                                />
                            </div>
                        </div>

                        {(filterTitle || filterLocation || filterStartDate || filterEndDate || filterProgramType !== 'ALL') && (
                            <button
                                onClick={() => {
                                    setFilterTitle('');
                                    setFilterLocation('');
                                    setFilterStartDate('');
                                    setFilterEndDate('');
                                    setFilterProgramType('ALL');
                                }}
                                className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition flex items-center gap-1.5"
                            >
                                <X size={14} /> 필터 초기화
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="py-2.5 px-4 bg-gray-50 text-gray-500 rounded-xl text-[11px] font-bold border border-gray-100">
                            검색 결과: <span className="text-blue-600">{filteredNotices.length}개</span>
                        </div>
                        {mode === CATEGORIES.PROGRAM && filteredNotices.length > 0 && (
                            <div className="py-2.5 px-4 bg-blue-600 text-white rounded-xl text-[11px] font-bold flex items-center gap-3 shadow-md shadow-blue-100">
                                <div className="flex items-center gap-1.5">
                                    <span className="opacity-70">총 신청:</span>
                                    <span className="text-white">{filteredNotices.reduce((acc, n) => acc + (noticeStats[n.id]?.JOIN || 0), 0)}명</span>
                                </div>
                                <span className="w-px h-3 bg-white/30" />
                                <div className="flex items-center gap-1.5">
                                    <span className="opacity-70">평균 출석:</span>
                                    <span className="text-white">
                                        {(() => {
                                            const programsWithStats = filteredNotices.filter(n => noticeStats[n.id]);
                                            if (programsWithStats.length === 0) return '0%';
                                            const totalJoin = programsWithStats.reduce((acc, n) => acc + (noticeStats[n.id]?.JOIN || 0), 0);
                                            const totalAttended = programsWithStats.reduce((acc, n) => acc + (noticeStats[n.id]?.attendedCount || 0), 0);
                                            return totalJoin > 0 ? Math.round((totalAttended / totalJoin) * 100) + '%' : '0%';
                                        })()}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* List */}
            {filteredNotices.length === 0 ? (
                <div className="py-24 text-center text-gray-400 bg-white rounded-3xl border border-dashed border-gray-200 text-sm font-medium">
                    등록된 게시글이 없습니다.
                </div>
            ) : (
                <div className="space-y-10">
                    <NoticeGrid notices={activePrograms} viewMode={viewMode} mode={mode} noticeStats={noticeStats} setSelectedNotice={setSelectedNotice} openParticipantModal={openParticipantModal} handleStatusChange={handleStatusChange} handleEditClick={handleEditClick} handleDeleteNotice={handleDeleteNotice} />

                    {completedPrograms.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="h-px flex-1 bg-gray-200"></div>
                                <span className="text-sm font-bold text-gray-400 tracking-wider">종료된 프로그램</span>
                                <div className="h-px flex-1 bg-gray-200"></div>
                            </div>
                            <NoticeGrid notices={completedPrograms} viewMode={viewMode} mode={mode} noticeStats={noticeStats} setSelectedNotice={setSelectedNotice} openParticipantModal={openParticipantModal} handleStatusChange={handleStatusChange} handleEditClick={handleEditClick} handleDeleteNotice={handleDeleteNotice} />
                        </div>
                    )}
                </div>
            )}

            {/* Modals */}
            {showEditor && (
                <div className="fixed inset-0 z-[60] bg-black flex flex-col animate-fade-in">
                    <div className="flex-1 relative bg-black">
                        <Cropper image={editorImageSrc} crop={crop} zoom={zoom} rotation={rotation} aspect={4 / 3} onCropChange={setCrop} onCropComplete={setCroppedAreaPixels} onZoomChange={setZoom} onRotationChange={setRotation} />
                    </div>
                    <div className="bg-gray-900 p-6 flex flex-col gap-4">
                        <div className="flex items-center gap-4"><span className="text-white text-xs w-10">Zoom</span><input type="range" value={zoom} min={1} max={3} step={0.1} onChange={(e) => setZoom(e.target.value)} className="flex-1" /></div>
                        <div className="flex items-center gap-4"><span className="text-white text-xs w-10">Rotate</span><input type="range" value={rotation} min={0} max={360} step={1} onChange={(e) => setRotation(e.target.value)} className="flex-1" /></div>
                        <div className="flex gap-3 justify-end mt-2"><button onClick={() => setShowEditor(false)} className="px-6 py-2 text-white bg-gray-700 rounded-lg hover:bg-gray-600">취소</button><button onClick={saveEditedImage} className="px-6 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-500 font-bold">편집 저장</button></div>
                    </div>
                </div>
            )}

            {selectedNoticeForParticipants && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white shrink-0">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">참여자 명단 및 출석체크</h3>
                                <p className="text-xs text-gray-400 mt-1">{selectedNoticeForParticipants.title}</p>
                            </div>
                            <button onClick={() => setSelectedNoticeForParticipants(null)} className="p-2 hover:bg-gray-100 rounded-full"><X size={24} className="text-gray-400" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50/50">
                            {modalLoading ? <div className="text-center py-10">로딩 중...</div> : (
                                <div className="space-y-6">
                                    {/* Normal Attendance Section */}
                                    {selectedNoticeForParticipants.is_recruiting && (
                                        <>
                                            <div className="bg-green-50 p-4 rounded-2xl border border-green-100/50">
                                                <h4 className="font-bold text-green-700 mb-3 flex flex-wrap justify-between items-center gap-2 text-sm">
                                                    <div className="flex items-center gap-2">
                                                        참여 인원 ({participantList.JOIN.length})
                                                        <button
                                                            onClick={handleMarkAllAttended}
                                                            className="ml-2 text-[10px] bg-green-50 text-green-600 border border-green-200 px-2 py-0.5 rounded-md hover:bg-green-100 transition font-bold"
                                                        >
                                                            전체 참석
                                                        </button>
                                                        <button
                                                            onClick={() => exportParticipantsToExcel(selectedNoticeForParticipants, participantList)}
                                                            className="ml-1 text-[10px] bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-md hover:bg-blue-100 transition font-bold flex items-center gap-1"
                                                        >
                                                            <UploadCloud size={10} /> 엑셀 다운로드
                                                        </button>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <span className="text-blue-600">참석: {participantList.JOIN.filter(u => u.is_attended).length}</span>
                                                        <span className="text-gray-400">미참석: {participantList.JOIN.filter(u => !u.is_attended).length}</span>
                                                    </div>
                                                </h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                    {participantList.JOIN.map((u, i) => (
                                                        <div key={i} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${u.is_attended ? 'bg-green-100 border-green-200' : 'bg-white border-white shadow-sm'}`}>
                                                            <div className="flex flex-col">
                                                                <span className={`font-bold text-sm ${u.is_attended ? 'text-green-700' : 'text-gray-800'}`}>{u.name}</span>
                                                                <span className="text-[10px] text-gray-500">{u.school} | {u.phone_back4}</span>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleDeleteParticipant(u.id, u.name); }}
                                                                    className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                                                                    title="신청 취소"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleAttendanceToggle(u.id, u.is_attended)}
                                                                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${u.is_attended ? 'bg-green-500 text-white shadow-md' : 'bg-gray-100 text-gray-300 hover:bg-gray-200'}`}
                                                                >
                                                                    <CheckCircle2 size={20} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                {participantList.JOIN.length === 0 && <p className="text-center py-6 text-xs text-gray-400 border border-dashed border-green-200 rounded-xl">참여 신청자가 없습니다.</p>}
                                            </div>

                                            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm relative">
                                                <div className="flex justify-between items-center mb-3">
                                                    <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                                                        <UserPlus size={16} className="text-blue-500" /> 현장 참석자 추가
                                                    </h4>
                                                    <button
                                                        onClick={() => setShowEntranceList(!showEntranceList)}
                                                        className={`text-[10px] px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1 border ${showEntranceList ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'}`}
                                                    >
                                                        <div className={`w-2 h-2 rounded-full ${showEntranceList ? 'bg-blue-500' : 'bg-gray-400'}`} />
                                                        입실 인원 ({entranceList.length})
                                                    </button>
                                                </div>

                                                {/* Success Message UI */}
                                                {lastAddedUser && (
                                                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg animate-fade-in-down z-20 flex items-center gap-2">
                                                        <CheckCircle2 size={14} />
                                                        {lastAddedUser.name} 학생 추가 완료!
                                                    </div>
                                                )}

                                                <div className="flex overflow-x-auto pb-4 gap-2 px-1 snap-x scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                                                    {showEntranceList ? (
                                                        entranceList.length > 0 ? (
                                                            entranceList.map(item => (
                                                                <div key={item.id} className="snap-start shrink-0 flex items-center gap-3 bg-white p-2.5 rounded-xl border shadow-sm w-[260px] animate-fade-in border-gray-200">
                                                                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold border-2 border-white shadow-sm shrink-0">
                                                                        {item.name?.charAt(0) || '?'}
                                                                    </div>
                                                                    <div className="flex flex-col flex-1 min-w-0">
                                                                        <span className="font-bold text-sm text-gray-800 truncate">{item.name}</span>
                                                                        <span className="text-[10px] text-gray-500 truncate">{item.school} | {item.phone_back4}</span>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => addWalkIn(item)}
                                                                        className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-50 hover:bg-green-500 hover:text-white hover:shadow-md text-gray-400 transition-all shrink-0"
                                                                        title="추가"
                                                                    >
                                                                        <PlusCircle size={20} />
                                                                    </button>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <p className="text-center w-full py-6 text-xs text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">입실한 학생이 없습니다.</p>
                                                        )
                                                    ) : (
                                                        searchResults.map(user => (
                                                            <div key={user.id} className="snap-start shrink-0 flex items-center gap-3 bg-white p-2.5 rounded-xl border shadow-sm w-[260px] border-gray-200">
                                                                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold border-2 border-white shadow-sm shrink-0 overflow-hidden">
                                                                    {user.profile_image_url ? (
                                                                        <img src={user.profile_image_url} alt="profile" className="w-full h-full object-cover" />
                                                            ) : (
                                                                user.name?.charAt(0) || '?'
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col flex-1 min-w-0">
                                                            <span className="font-bold text-sm text-gray-800 truncate">{user.name}</span>
                                                            <span className="text-[10px] text-gray-500 truncate">{user.school} | {user.phone_back4}</span>
                                                        </div>
                                                        <button
                                                            onClick={() => addWalkIn(user)}
                                                            className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-50 hover:bg-green-500 hover:text-white text-gray-400 transition-all shrink-0"
                                                        >
                                                            <PlusCircle size={20} />
                                                        </button>
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                                <Search size={16} />
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="학생 이름 또는 전화번호 뒷자리 검색..."
                                                value={searchQuery}
                                                onChange={(e) => handleUserSearch(e.target.value)}
                                                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition text-sm"
                                            />
                                            {searchResults.length > 0 && (
                                                <div className="absolute z-10 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                                    {searchResults.map(user => (
                                                        <button
                                                            key={user.id}
                                                            onClick={() => addWalkIn(user)}
                                                            className="w-full p-4 text-left hover:bg-blue-50 flex justify-between items-center transition border-b border-gray-50 last:border-0"
                                                        >
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-sm text-gray-800">{user.name}</span>
                                                                <span className="text-[10px] text-gray-500">{user.school} | {user.phone_back4}</span>
                                                            </div>
                                                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">+ 추가</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                        <div className="grid grid-cols-2 gap-3 md:gap-4">
                                            <div className="bg-orange-50 p-4 rounded-xl border border-orange-100/50">
                                                <h4 className="font-bold text-orange-700 mb-2 flex justify-between text-[10px] uppercase tracking-wider">대기 <span className="bg-white px-2 rounded-full">{participantList.WAITLIST?.length || 0}</span></h4>
                                                <div className="space-y-1">
                                                    {participantList.WAITLIST?.map((u, i) => (
                                                        <div key={i} className="flex items-center justify-between gap-2">
                                                            <span className="text-[10px] text-gray-600 font-bold truncate">{u.name}</span>
                                                            <button
                                                                onClick={() => handleDeleteParticipant(u.id, u.name)}
                                                                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    {(!participantList.WAITLIST || participantList.WAITLIST.length === 0) && <span className="text-[10px] text-gray-400">-</span>}
                                                </div>
                                            </div>
                                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                                <h4 className="font-bold text-gray-500 mb-2 flex justify-between text-[10px] uppercase tracking-wider">미참석 <span className="bg-white px-2 rounded-full">{participantList.JOIN.filter(u => !u.is_attended).length}</span></h4>
                                                <p className="text-[10px] text-gray-400 truncate">{participantList.JOIN.filter(u => !u.is_attended).map(u => u.name).join(', ') || '-'}</p>
                                            </div>
                                        </div>
                                        </>
                                    )}

                                    {/* Poll Results Section */}
                                    {selectedNoticeForParticipants.is_poll && pollModalResults && (
                                        <div className="bg-purple-50 p-6 rounded-2xl border border-purple-100/50 mt-6 shadow-sm">
                                            <div className="flex justify-between items-center mb-6">
                                                <h4 className="font-black text-purple-700 text-lg flex items-center gap-2">
                                                    <span className="w-1.5 h-6 bg-purple-500 rounded-full inline-block"></span>
                                                    투표(설문) 결과 명단
                                                </h4>
                                                <div className="bg-white px-3 py-1.5 rounded-full text-xs font-bold text-purple-600 shadow-sm border border-purple-100">
                                                    총 {(() => {
                                                        const uniqueUsers = new Set();
                                                        Object.values(pollModalResults).forEach(users => {
                                                            users.forEach(u => uniqueUsers.add(u.id));
                                                        });
                                                        return uniqueUsers.size;
                                                    })()}명 참여
                                                </div>
                                            </div>
                                            
                                            <div className="space-y-4">
                                                {(selectedNoticeForParticipants.poll_options || []).map((opt) => {
                                                    const respondents = pollModalResults[opt.id] || [];
                                                    return (
                                                        <div key={opt.id} className="bg-white rounded-xl border border-purple-100/50 overflow-hidden shadow-sm">
                                                            <div className="bg-purple-100/30 px-4 py-3 flex justify-between items-center border-b border-purple-50">
                                                                <div className="flex items-center gap-3">
                                                                    {opt.image_url && (
                                                                        <img src={opt.image_url} alt={opt.title} className="w-8 h-8 rounded-lg object-cover bg-gray-100" />
                                                                    )}
                                                                    <span className="font-bold text-purple-900">{opt.title}</span>
                                                                </div>
                                                                <span className="text-xs font-black text-purple-600 bg-purple-100 px-2.5 py-1 rounded-full">{respondents.length}명</span>
                                                            </div>
                                                            <div className="p-4">
                                                                {respondents.length > 0 ? (
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {respondents.map((user, idx) => (
                                                                            <span key={idx} className="inline-flex items-center gap-1 text-[11px] font-bold bg-gray-50 text-gray-700 px-2 py-1 rounded-md border border-gray-100">
                                                                                {user.name}
                                                                                <span className="text-[9px] text-gray-400 font-normal">{user.school}</span>
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-xs text-center text-gray-400 bg-gray-50 py-3 rounded-lg border border-dashed border-gray-200">선택한 인원이 없습니다</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* View Modal */}
            {selectedNotice && (
                <NoticeModal 
                    fromAdmin={true}
                    notice={selectedNotice} 
                    onClose={() => setSelectedNotice(null)}
                    user={JSON.parse(localStorage.getItem('admin_user'))}
                    responses={{}}
                    onResponse={() => {}}
                    onUpdate={async (updated) => {
                        try {
                            await noticesApi.update(updated.id, updated);
                            fetchData();
                        } catch (err) { alert('수정 실패'); }
                    }}
                    onDelete={handleDeleteNotice}
                    comments={[]}
                    newComment=""
                    setNewComment={() => {}}
                    onPostComment={() => {}}
                    onDeleteComment={() => {}}
                />
            )}
        </div>
    );
};
export default AdminBoard;
