import React, { useState, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { noticesApi } from '../../api/noticesApi';
import { CATEGORIES, RESPONSE_STATUS } from '../../constants/appConstants';
import { PlusCircle, FileText, Grid, UploadCloud, Trash2, Edit2, ImageIcon, Users, X, ZoomIn, RotateCw, Eye, ArrowLeft, Heart, MessageCircle, MoreHorizontal, CheckCircle2, XCircle, UserPlus, Search, RefreshCw } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../../utils/imageUtils';
import SunEditor from 'suneditor-react';
import 'suneditor/dist/css/suneditor.min.css';
import {
    align, font, fontSize, formatBlock, hiliteColor, horizontalRule, lineHeight, list, paragraphStyle, table, template, textStyle, image, link, video
} from 'suneditor/src/plugins';
import Microlink from '@microlink/react';
import { formatToLocalISO } from '../../utils/dateUtils';
import { extractUrls } from '../../utils/textUtils';
import IntuitiveTimePicker from '../common/IntuitiveTimePicker';

const AdminBoard = ({ mode = CATEGORIES.NOTICE, notices, fetchData }) => {
    // mode: 'NOTICE' | 'PROGRAM' | 'GALLERY'
    const targetCategory = mode;

    // Filter Notices for this view
    const filteredNotices = notices.filter(n => n.category === mode);

    // State
    const [showWriteForm, setShowWriteForm] = useState(false);
    const [newNotice, setNewNotice] = useState({
        title: '',
        content: '',
        is_recruiting: false,
        is_sticky: false,
        send_push: false,
        category: targetCategory,
        recruitment_deadline: '',
        max_capacity: '',
        program_date: '',
        program_duration: '',
        program_location: ''
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

    const [noticeStats, setNoticeStats] = useState({});

    // View Modal
    const [selectedNotice, setSelectedNotice] = useState(null);

    // Fetch stats for visible recruiting notices
    React.useEffect(() => {
        const fetchStats = async () => {
            const recruitingIds = filteredNotices.filter(n => n.is_recruiting).map(n => n.id);
            if (recruitingIds.length > 0) {
                // We'll keep this direct for now as it's a batch select for stats
                const { data: responses } = await supabase.from('notice_responses').select('*').in('notice_id', recruitingIds);
                const nStats = {};
                recruitingIds.forEach(id => nStats[id] = { [RESPONSE_STATUS.JOIN]: 0, [RESPONSE_STATUS.DECLINE]: 0, [RESPONSE_STATUS.UNDECIDED]: 0 });
                responses?.forEach(r => {
                    if (nStats[r.notice_id]) nStats[r.notice_id][r.status] = (nStats[r.notice_id][r.status] || 0) + 1;
                });
                setNoticeStats(nStats);
            }
        };
        fetchStats();
    }, [notices, mode]);


    // Handlers
    const handleEditClick = (notice) => {
        setShowWriteForm(true);
        setEditNoticeId(notice.id);

        const { date, duration, location, cleanContent } = extractProgramInfo(notice.content);

        setNewNotice({
            title: notice.title,
            content: cleanContent,
            is_recruiting: notice.is_recruiting,
            is_sticky: notice.is_sticky || false,
            send_push: false,
            category: notice.category,
            recruitment_deadline: notice.recruitment_deadline ? formatToLocalISO(notice.recruitment_deadline) : '',
            max_capacity: notice.max_capacity || '',
            program_date: notice.program_date ? formatToLocalISO(notice.program_date) : date,
            program_duration: duration,
            program_location: location
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
            is_recruiting: false,
            is_sticky: false,
            send_push: false,
            category: targetCategory,
            recruitment_deadline: '',
            max_capacity: '',
            program_date: '',
            program_duration: '',
            program_location: ''
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

    const extractProgramInfo = (content) => {
        const info = { date: '', duration: '', location: '', cleanContent: content };
        if (!content) return info;

        // Matches the info block div and its contents
        const infoBlockRegex = /<div style="background-color: #f8fafc;[\s\S]*?<\/div>/;
        const match = content.match(infoBlockRegex);

        if (match) {
            const block = match[0];
            info.cleanContent = content.replace(infoBlockRegex, '').trim();

            // Extract Date (tries to parse the locale string back to ISO-ish)
            const dateMatch = block.match(/📅 일정:<\/strong>\s*([^<]+)/);
            if (dateMatch) {
                const dateStr = dateMatch[1].trim();
                if (dateStr !== '미정') {
                    // Try to parse: "2026년 1월 31일 오후 12:00"
                    // This is a simplified parser for our specific format
                    const parts = dateStr.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(오전|오후)\s*(\d{1,2}):(\d{2})/);
                    if (parts) {
                        let [_, year, month, day, ampm, hour, minute] = parts;
                        hour = parseInt(hour);
                        if (ampm === '오후' && hour < 12) hour += 12;
                        if (ampm === '오전' && hour === 12) hour = 0;
                        const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                        const isoTime = `${hour.toString().padStart(2, '0')}:${minute}`;
                        info.date = `${isoDate}T${isoTime}`;
                    }
                }
            }

            // Extract Duration
            const durationMatch = block.match(/⏰ 소요시간:<\/strong>\s*([^<]+)/);
            if (durationMatch) info.duration = durationMatch[1].trim() === '미정' ? '' : durationMatch[1].trim();

            // Extract Location
            const locationMatch = block.match(/📍 장소:<\/strong>\s*([^<]+)/);
            if (locationMatch) info.location = locationMatch[1].trim() === '미정' ? '' : locationMatch[1].trim();
        }

        return info;
    };

    const handleSaveNotice = async (e) => {
        e.preventDefault();
        if (!newNotice.title) return;
        setUploading(true);
        try {
            const newImageUrls = [];
            for (const item of selectedFiles) {
                const fileExt = item.file.name.split('.').pop();
                const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
                const { error: uploadError } = await supabase.storage.from('notice-images').upload(fileName, item.file);
                if (uploadError) throw uploadError;
                const { data: { publicUrl } } = supabase.storage.from('notice-images').getPublicUrl(fileName);
                newImageUrls.push(publicUrl);
            }

            const finalImages = [...existingImages, ...newImageUrls];
            const legacyImageUrl = finalImages.length > 0 ? finalImages[0] : null;

            const sanitizedNotice = {
                ...newNotice,
                max_capacity: newNotice.max_capacity ? parseInt(newNotice.max_capacity) : null,
                recruitment_deadline: newNotice.recruitment_deadline ? new Date(newNotice.recruitment_deadline).toISOString() : null
            };

            // Remove UI-only fields that don't exist in the database
            const { send_push, program_date, program_duration, program_location, ...dbData } = sanitizedNotice;

            const isProgram = sanitizedNotice.category === CATEGORIES.PROGRAM;
            const { date, duration, location, cleanContent } = extractProgramInfo(dbData.content);
            let finalContent = cleanContent;

            if (isProgram) {
                const infoBlock = `
<div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
    <p style="margin: 0 0 8px 0;"><strong>📅 일정:</strong> ${program_date ? new Date(program_date).toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '미정'}</p>
    <p style="margin: 0 0 8px 0;"><strong>⏰ 소요시간:</strong> ${program_duration || '미정'}</p>
    <p style="margin: 0 0 8px 0;"><strong>📍 장소:</strong> ${program_location || '미정'}</p>
    <p style="margin: 0;"><strong>👥 모집 정원:</strong> ${dbData.max_capacity ? dbData.max_capacity + '명' : '제한 없음'}</p>
</div>
`;
                finalContent = infoBlock + finalContent;
            }

            const payload = {
                ...dbData,
                content: finalContent,
                image_url: legacyImageUrl,
                images: finalImages,
                program_date: isProgram && program_date ? new Date(program_date).toISOString() : null
            };

            if (editNoticeId) {
                await noticesApi.update(editNoticeId, payload);

                // Logging
                if (isProgram) {
                    const admin = JSON.parse(localStorage.getItem('admin_user'));
                    await supabase.from('logs').insert([{
                        user_id: admin?.id,
                        type: 'PROGRAM_UPDATE',
                        location_id: null
                    }]);
                }

                alert('수정되었습니다.');
            } else {
                const created = await noticesApi.create(payload);

                // Logging
                if (isProgram) {
                    const admin = JSON.parse(localStorage.getItem('admin_user'));
                    await supabase.from('logs').insert([{
                        user_id: admin?.id,
                        type: 'PROGRAM_CREATE',
                        location_id: null
                    }]);
                }

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
        try {
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

    const handleStatusChange = async (noticeId, newStatus) => {
        const statusMap = { 'COMPLETED': '완료', 'CANCELLED': '취소', 'ACTIVE': '진행중(활성)' };
        if (!window.confirm(`프로그램 상태를 [${statusMap[newStatus]}] 상태로 변경하시겠습니까?`)) return;
        try {
            await noticesApi.updateProgramStatus(noticeId, newStatus);
            fetchData();
        } catch (err) { alert('상태 변경 실패'); }
    };

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);

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
            alert(`${user.name} 학생이 명단에 추가되고 출석 처리되었습니다.`);
            openParticipantModal(selectedNoticeForParticipants); // Refresh
            setSearchQuery('');
            setSearchResults([]);
        } catch (err) { alert('추가 실패'); }
    };


    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-50/50 p-4 rounded-2xl gap-4">
                <div>
                    <h2 className="text-xl md:text-2xl font-bold text-gray-800">
                        {mode === 'GALLERY' ? '사진첩 관리' : mode === 'PROGRAM' ? '센터 프로그램 관리' : '공지사항 관리'}
                    </h2>
                    <p className="text-gray-500 text-xs md:text-sm">
                        {mode === 'GALLERY' ? '스처 갤러리에 업로드된 사진을 관리합니다.' :
                            mode === 'PROGRAM' ? '프로그램 모집 및 안내 글을 관리합니다.' :
                                '일반 공지사항을 작성하고 관리합니다.'}
                    </p>
                </div>
                <button
                    onClick={() => {
                        if (showWriteForm) handleCancelEdit(); else { setShowWriteForm(true); setNewNotice({ ...newNotice, category: targetCategory }); }
                    }}
                    className={`w-full md:w-auto px-5 py-2.5 rounded-xl font-bold shadow-md transition flex items-center justify-center gap-2 ${showWriteForm ? 'bg-white text-gray-500 border border-gray-200' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
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
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-blue-50/30 p-4 rounded-2xl border border-blue-100/50">
                                <div>
                                    <label className="block text-xs font-bold text-blue-600 mb-1 ml-1">날짜 / 시간 *</label>
                                    <div className="flex flex-col gap-2">
                                        <input
                                            type="date"
                                            value={splitDateTime(newNotice.program_date).date}
                                            onChange={e => setNewNotice(prev => ({ ...prev, program_date: joinDateTime(e.target.value, splitDateTime(prev.program_date).time) }))}
                                            className="w-full p-3 bg-white border border-blue-100 rounded-xl outline-none focus:border-blue-500 transition text-sm"
                                            required
                                        />
                                        <IntuitiveTimePicker
                                            value={splitDateTime(newNotice.program_date).time}
                                            onChange={time => setNewNotice(prev => ({ ...prev, program_date: joinDateTime(splitDateTime(prev.program_date).date, time) }))}
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

                        <div className="rounded-xl overflow-hidden border border-gray-100 min-h-[300px]">
                            <SunEditor
                                setOptions={{
                                    height: 'auto', minHeight: '300px',
                                    plugins: [align, font, fontSize, formatBlock, hiliteColor, horizontalRule, lineHeight, list, paragraphStyle, table, template, textStyle, image, link, video],
                                    buttonList: [
                                        ['undo', 'redo'],
                                        ['fontSize', 'formatBlock'],
                                        ['bold', 'underline', 'italic'],
                                        ['align', 'list'],
                                        ['table', 'link', 'image'],
                                        ['fullScreen']
                                    ]
                                }}
                                setContents={newNotice.content}
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
                                    <div key={`exist-${idx}`} className="relative flex-shrink-0 w-20 h-20 md:w-24 md:h-24 rounded-lg overflow-hidden group">
                                        <img src={url} className="w-full h-full object-cover" />
                                        <button type="button" onClick={() => handleDeleteExistingImage(idx)} className="absolute inset-0 bg-black/50 flex items-center justify-center text-white md:opacity-0 md:group-hover:opacity-100"><Trash2 size={16} /></button>
                                    </div>
                                ))}
                                {selectedFiles.map((file, idx) => (
                                    <div key={file.id} className="relative flex-shrink-0 w-20 h-20 md:w-24 md:h-24 rounded-lg overflow-hidden group">
                                        <img src={file.preview} className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center gap-2 md:opacity-0 md:group-hover:opacity-100">
                                            <button type="button" onClick={(e) => { e.stopPropagation(); openEditor(idx) }} className="text-white hover:text-blue-200"><Edit2 size={16} /></button>
                                            <button type="button" onClick={(e) => { e.stopPropagation(); removeFile(idx) }} className="text-white hover:text-red-200"><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 pt-4">
                            {(mode === 'NOTICE' || mode === 'PROGRAM') && (
                                <div className="flex flex-wrap gap-4">
                                    <label className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition border border-gray-100">
                                        <input type="checkbox" checked={newNotice.is_sticky} onChange={e => setNewNotice(prev => ({ ...prev, is_sticky: e.target.checked }))} className="w-4 h-4 text-orange-600 rounded" />
                                        <span className="text-sm font-bold text-gray-600">상단 고정 공지</span>
                                    </label>
                                    <label className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition border border-gray-100">
                                        <input type="checkbox" checked={newNotice.is_recruiting} onChange={e => setNewNotice(prev => ({ ...prev, is_recruiting: e.target.checked }))} className="w-4 h-4 text-blue-600 rounded" />
                                        <span className="text-sm font-bold text-gray-600">학생들에게 참석여부 묻기</span>
                                    </label>
                                    <label className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition border border-gray-100">
                                        <input type="checkbox" checked={newNotice.send_push} onChange={e => setNewNotice(prev => ({ ...prev, send_push: e.target.checked }))} className="w-4 h-4 text-red-600 rounded" />
                                        <span className="text-sm font-bold text-gray-600">🔔 푸시 알림 발송</span>
                                    </label>
                                </div>
                            )}

                            {/* Recruitment Options (Visible if is_recruiting is checked) */}
                            {newNotice.is_recruiting && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                    <div className="flex-1">
                                        <label className="block text-xs font-bold text-gray-400 mb-1 ml-1">신청 마감 일자</label>
                                        <input
                                            type="date"
                                            value={splitDateTime(newNotice.recruitment_deadline).date}
                                            onChange={e => setNewNotice(prev => ({ ...prev, recruitment_deadline: joinDateTime(e.target.value, splitDateTime(prev.recruitment_deadline).time) }))}
                                            className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition text-sm"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs font-bold text-gray-400 mb-1 ml-1">마감 시간</label>
                                        <IntuitiveTimePicker
                                            value={splitDateTime(newNotice.recruitment_deadline).time}
                                            onChange={time => setNewNotice(prev => ({ ...prev, recruitment_deadline: joinDateTime(splitDateTime(prev.recruitment_deadline).date, time) }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 mb-1 ml-1">모집 인원 제한 (0: 무제한) {mode === CATEGORIES.PROGRAM && '*'}</label>
                                        <input
                                            type="number"
                                            placeholder="예: 10"
                                            value={newNotice.max_capacity}
                                            onChange={e => setNewNotice(prev => ({ ...prev, max_capacity: e.target.value }))}
                                            className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition text-sm"
                                            required={mode === CATEGORIES.PROGRAM}
                                        />
                                    </div>
                                </div>
                            )}
                            <div className="flex gap-2">
                                <button type="button" onClick={handleCancelEdit} className="flex-1 md:flex-none px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition">취소</button>
                                <button type="submit" disabled={uploading || (targetCategory === 'GALLERY' && selectedFiles.length === 0 && existingImages.length === 0)} className="flex-1 md:flex-none px-8 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 disabled:bg-gray-300 transition">
                                    {uploading ? '업로드 중...' : (editNoticeId ? '수정 저장' : '등록하기')}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {/* List */}
            <div className="space-y-4">
                {filteredNotices.length === 0 ? (
                    <div className="py-20 text-center text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-sm">등록된 게시글이 없습니다.</div>
                ) : (
                    filteredNotices.map(notice => (
                        <div key={notice.id} className="bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition">
                            <div className="flex justify-between items-start gap-3">
                                <div className="flex gap-3 md:gap-4 flex-1 min-w-0">
                                    {/* Thumbnail for Gallery/Notice */}
                                    {(notice.images?.length > 0 || notice.image_url) && (
                                        <div
                                            onClick={() => setSelectedNotice(notice)}
                                            className="w-16 h-16 md:w-20 md:h-20 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0 cursor-pointer border border-gray-100"
                                        >
                                            <img
                                                src={notice.images?.length > 0 ? notice.images[0] : notice.image_url}
                                                alt="thumb"
                                                className="w-full h-full object-cover transition hover:scale-110"
                                            />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            {notice.is_sticky && <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-[9px] font-bold">📌 공지</span>}
                                            {notice.is_recruiting && notice.program_status === 'ACTIVE' && <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-[9px] font-bold">모집중</span>}
                                            {notice.program_status === 'COMPLETED' && <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-[9px] font-bold">진행완료</span>}
                                            {notice.program_status === 'CANCELLED' && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[9px] font-bold">취소됨</span>}
                                            {(notice.images?.length > 0 || notice.image_url) && (
                                                <div className="flex items-center gap-1 text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full">
                                                    <ImageIcon size={10} /> {notice.images?.length || 1}
                                                </div>
                                            )}
                                        </div>
                                        <h3
                                            onClick={() => setSelectedNotice(notice)}
                                            className={`font-bold text-base md:text-lg mb-0.5 cursor-pointer hover:text-blue-600 transition truncate ${notice.program_status !== 'ACTIVE' ? 'text-gray-400 line-through' : 'text-gray-800'}`}
                                        >
                                            {notice.title}
                                        </h3>
                                        <p className="text-[10px] md:text-xs text-gray-400">{new Date(notice.created_at).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <div className="flex gap-0.5 md:gap-1 flex-shrink-0">
                                    {mode === CATEGORIES.PROGRAM && (
                                        <>
                                            {notice.program_status === 'ACTIVE' ? (
                                                <>
                                                    <button onClick={() => handleStatusChange(notice.id, 'COMPLETED')} className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition" title="완료 처리">
                                                        <CheckCircle2 size={18} />
                                                    </button>
                                                    <button onClick={() => handleStatusChange(notice.id, 'CANCELLED')} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="취소 처리">
                                                        <XCircle size={18} />
                                                    </button>
                                                </>
                                            ) : (
                                                <button onClick={() => handleStatusChange(notice.id, 'ACTIVE')} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition" title="진행중으로 되돌리기">
                                                    <RefreshCw size={18} />
                                                </button>
                                            )}
                                        </>
                                    )}
                                    <button onClick={() => setSelectedNotice(notice)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="미리보기">
                                        <Eye size={18} />
                                    </button>
                                    <button onClick={() => handleEditClick(notice)} className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition" title="수정">
                                        <Edit2 size={18} />
                                    </button>
                                    <button onClick={() => handleDeleteNotice(notice.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="삭제">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Recruiting Stats */}
                            {notice.is_recruiting && noticeStats[notice.id] && (
                                <div className={`mt-4 p-2 md:p-3 rounded-xl flex justify-between items-center ${notice.program_status === 'ACTIVE' ? 'bg-gray-50' : 'bg-gray-100/50 opacity-60'}`}>
                                    <div className="flex gap-3 md:gap-4 text-[10px] md:text-xs font-bold">
                                        <span className="text-green-600">참여 {noticeStats[notice.id].JOIN}</span>
                                        <span className="text-orange-500">대기 {noticeStats[notice.id].WAITLIST || 0}</span>
                                        <span className="text-gray-400">불참 {noticeStats[notice.id].DECLINE}</span>
                                    </div>
                                    <button onClick={() => openParticipantModal(notice)} className="text-[10px] md:text-xs bg-white border border-gray-200 text-gray-600 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 font-bold shadow-sm flex items-center gap-1">
                                        <Users size={12} /> 명단 및 출석체크
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

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
                                    {/* Attendance Check Section */}
                                    <div className="bg-green-50 p-4 rounded-2xl border border-green-100/50">
                                        <h4 className="font-bold text-green-700 mb-3 flex justify-between items-center text-sm">
                                            참여 인원 ({participantList.JOIN.length})
                                            <span className="text-[10px] font-medium text-green-600">이름 옆 체크박스로 출석을 표시하세요</span>
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            {participantList.JOIN.map((u, i) => (
                                                <div key={i} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${u.is_attended ? 'bg-green-100 border-green-200' : 'bg-white border-white shadow-sm'}`}>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-sm text-gray-800">{u.name}</span>
                                                        <span className="text-[10px] text-gray-500">{u.school} | {u.phone_back4}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleAttendanceToggle(u.id, u.is_attended)}
                                                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${u.is_attended ? 'bg-green-500 text-white shadow-md' : 'bg-gray-100 text-gray-300 hover:bg-gray-200'}`}
                                                    >
                                                        <CheckCircle2 size={20} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        {participantList.JOIN.length === 0 && <p className="text-center py-6 text-xs text-gray-400 border border-dashed border-green-200 rounded-xl">참여 신청자가 없습니다.</p>}
                                    </div>

                                    {/* Walk-in Addition Section */}
                                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                                        <h4 className="font-bold text-gray-800 mb-3 text-sm flex items-center gap-2">
                                            <UserPlus size={16} className="text-blue-500" /> 현장 참석자 추가
                                        </h4>
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

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="bg-orange-50 p-4 rounded-xl border border-orange-100/50">
                                            <h4 className="font-bold text-orange-700 mb-3 flex justify-between text-xs uppercase tracking-wider">대기 <span className="bg-white px-2 rounded-full text-[10px]">{participantList.WAITLIST?.length || 0}</span></h4>
                                            <ul className="space-y-1.5">{participantList.WAITLIST?.map((u, i) => <li key={i} className="bg-white/80 p-2 rounded-lg text-[10px] shadow-sm"><span className="font-bold text-gray-700">{u.name}</span> <span className="text-gray-400">({u.school})</span></li>)}</ul>
                                        </div>
                                        <div className="bg-gray-100/50 p-4 rounded-xl border border-gray-200/50">
                                            <h4 className="font-bold text-gray-600 mb-3 flex justify-between text-xs uppercase tracking-wider">미정 <span className="bg-white px-2 rounded-full text-[10px]">{participantList.UNDECIDED.length}</span></h4>
                                            <ul className="space-y-1.5">{participantList.UNDECIDED.map((u, i) => <li key={i} className="bg-white/80 p-2 rounded-lg text-[10px] shadow-sm"><span className="font-bold text-gray-600">{u.name}</span> <span className="text-gray-400">({u.school})</span></li>)}</ul>
                                        </div>
                                        <div className="bg-red-50 p-4 rounded-xl border border-red-100/50 opacity-60">
                                            <h4 className="font-bold text-red-700 mb-3 flex justify-between text-xs uppercase tracking-wider">불참 <span className="bg-white px-2 rounded-full text-[10px]">{participantList.DECLINE.length}</span></h4>
                                            <ul className="space-y-1.5">{participantList.DECLINE.map((u, i) => <li key={i} className="bg-white/40 p-2 rounded-lg text-[10px]"><span className="text-gray-400 font-medium">{u.name}</span></li>)}</ul>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* View Modal */}
            {selectedNotice && (
                <AdminNoticeDetailModal notice={selectedNotice} onClose={() => setSelectedNotice(null)} />
            )}
        </div>
    );
};

// Internal Modal Component
const AdminNoticeDetailModal = ({ notice, onClose }) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [likeCount, setLikeCount] = useState(0);
    const [liked, setLiked] = useState(false);

    let allImages = [];
    if (notice.images && Array.isArray(notice.images)) {
        allImages = [...notice.images];
    }
    if (allImages.length === 0 && notice.image_url) {
        allImages.push(notice.image_url);
    }

    React.useEffect(() => {
        const fetchLikes = async () => {
            const { count } = await supabase.from('notice_likes').select('*', { count: 'exact', head: true }).eq('notice_id', notice.id);
            if (count !== null) setLikeCount(count);

            const storedAdmin = localStorage.getItem('admin_user');
            if (storedAdmin) {
                const admin = JSON.parse(storedAdmin);
                const { data } = await supabase.from('notice_likes').select('id').eq('notice_id', notice.id).eq('user_id', admin.id);
                setLiked(data?.length > 0);
            }
        };
        fetchLikes();
    }, [notice.id]);

    const toggleLike = async () => {
        const storedAdmin = localStorage.getItem('admin_user');
        if (!storedAdmin) return;
        const admin = JSON.parse(storedAdmin);

        try {
            if (liked) {
                await supabase.from('notice_likes').delete().eq('notice_id', notice.id).eq('user_id', admin.id);
                setLiked(false);
                setLikeCount(prev => Math.max(0, prev - 1));
            } else {
                await supabase.from('notice_likes').insert([{ notice_id: notice.id, user_id: admin.id }]);
                setLiked(true);
                setLikeCount(prev => prev + 1);
            }
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white w-full max-w-sm md:max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="h-14 px-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
                    <div className="flex items-center gap-2">
                        <button onClick={onClose} className="-ml-2 p-2 hover:bg-gray-50 rounded-full transition">
                            <ArrowLeft size={24} className="text-gray-900" />
                        </button>
                        <span className="font-bold text-gray-900">미리보기</span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-hide">
                    {/* User Info Header */}
                    <div className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 to-pink-600 p-[2px]">
                                <div className="w-full h-full rounded-full bg-white p-[1px] overflow-hidden">
                                    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                                        {notice.category === 'GALLERY' ? <ImageIcon size={14} className="text-gray-400" /> : <span className="text-xs">📢</span>}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-900 leading-none">{notice.category === 'GALLERY' ? '갤러리' : '공지사항'}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{notice.title}</p>
                            </div>
                        </div>
                    </div>

                    {/* Image Carousel - Only show if images exist */}
                    {allImages.length > 0 && (
                        <div className="bg-gray-100 relative w-full aspect-square overflow-hidden group">
                            <div
                                className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide h-full w-full"
                                onScroll={(e) => {
                                    const index = Math.round(e.target.scrollLeft / e.target.clientWidth);
                                    setCurrentImageIndex(index);
                                }}
                            >
                                {allImages.map((img, idx) => (
                                    <div key={idx} className="flex-shrink-0 w-full h-full snap-center flex items-center justify-center bg-gray-100 relative">
                                        <img src={img} className="w-full h-full object-cover" />
                                    </div>
                                ))}
                            </div>
                            {/* Counter */}
                            {allImages.length > 1 && (
                                <div className="absolute top-3 right-3 bg-black/60 text-white text-[10px] px-2 py-1 rounded-full font-bold backdrop-blur-md">
                                    {currentImageIndex + 1} / {allImages.length}
                                </div>
                            )}
                            {/* Dots */}
                            {allImages.length > 1 && (
                                <div className="absolute -bottom-6 left-0 right-0 flex justify-center gap-1 py-4 pointer-events-none">
                                    {allImages.map((_, idx) => (
                                        <div key={idx} className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${idx === currentImageIndex ? 'bg-blue-500' : 'bg-gray-300'}`} />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Content */}
                    <div className="p-4">
                        <div className="flex gap-4 mb-3">
                            <button onClick={toggleLike} className="hover:opacity-60 transition active:scale-90">
                                <Heart
                                    size={28}
                                    strokeWidth={liked ? 0 : 1.5}
                                    className={liked ? "fill-red-500 text-red-500" : "text-gray-900"}
                                />
                            </button>
                        </div>
                        <div className="text-sm font-bold text-gray-900 mb-2">좋아요 {likeCount}개</div>

                        <div className="text-sm text-gray-900">
                            <span dangerouslySetInnerHTML={{ __html: notice.content }} />
                        </div>
                        <div className="text-[10px] text-gray-400 uppercase tracking-wide mt-3 mb-4">
                            {new Date(notice.created_at).toLocaleDateString()}
                        </div>

                        {/* Recruiting RSVP (Visual Only for Admin) */}
                        {notice.is_recruiting && (
                            <div className="bg-blue-50 p-4 rounded-xl mb-4">
                                <p className="text-xs font-bold text-blue-600 mb-2 block">참여 여부 선택 (미리보기)</p>
                                <div className="flex gap-2">
                                    {['JOIN:참여', 'DECLINE:불참', 'UNDECIDED:미정'].map(opt => {
                                        const [val, label] = opt.split(':');
                                        let colorClass = 'bg-white text-gray-600 border-gray-200';
                                        if (val === 'JOIN') colorClass = 'text-green-600 border-green-200'; // Just styling for preview
                                        return (
                                            <button
                                                key={val}
                                                disabled
                                                className={`flex-1 py-2 rounded-lg text-xs font-bold border ${colorClass} opacity-70`}
                                            >
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>


        </div>
    );
};

export default AdminBoard;
