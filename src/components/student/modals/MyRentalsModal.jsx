import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { X, Calendar, MapPin, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MyRentalsModal = ({ user, onClose }) => {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);

    // Edit states
    const [editingId, setEditingId] = useState(null);
    const [editDate, setEditDate] = useState('');
    const [editStart, setEditStart] = useState('');
    const [editEnd, setEditEnd] = useState('');
    const [editPurpose, setEditPurpose] = useState('');
    const [editHeadcount, setEditHeadcount] = useState('');
    const [editMeeting, setEditMeeting] = useState('');
    const [editNotes, setEditNotes] = useState('');
    const [submittingEdit, setSubmittingEdit] = useState(false);

    useEffect(() => {
        fetchMyBookings();
    }, [user.id]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const fetchMyBookings = async () => {
        try {
            const { data, error } = await supabase
                .from('rental_bookings')
                .select('*, rentals(name, school_id, schools(region))')
                .eq('user_id', user.id)
                .order('booking_date', { ascending: false });
            
            if (error) throw error;
            setBookings(data || []);
        } catch (error) {
            console.error('Error fetching my bookings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (bookingId) => {
        if (!confirm('정말 이 공간 대여 신청을 취소하시겠습니까?')) return;
        
        try {
            const { error } = await supabase
                .from('rental_bookings')
                .delete()
                .eq('id', bookingId);
            
            if (error) throw error;
            fetchMyBookings();
            alert('신청이 취소되었습니다.');
        } catch (error) {
            console.error('Error deleting booking:', error);
            alert('신청 취소 중 오류가 발생했습니다.');
        }
    };

    const startEdit = (b) => {
        const parts = b.end_time.split('|');
        setEditingId(b.id);
        setEditDate(b.booking_date);
        setEditStart(b.start_time);
        setEditEnd(parts[0] || '12:00');
        setEditPurpose(parts[1] || '');
        setEditHeadcount(parts[2] || '');
        setEditMeeting(parts[3] || '');
        setEditNotes(parts[4] || '');
    };

    const handleResubmit = async (bookingId, prevRejectionReason = '') => {
        if (!editMeeting.trim() || !editPurpose.trim() || !editHeadcount.trim()) {
            alert('필수 입력 항목을 채워주세요.');
            return;
        }

        setSubmittingEdit(true);
        try {
            const finalEndTime = `${editEnd}|${editPurpose}|${editHeadcount}|${editMeeting}|${editNotes}|${prevRejectionReason}`;
            const { error } = await supabase
                .from('rental_bookings')
                .update({
                    booking_date: editDate,
                    start_time: editStart,
                    end_time: finalEndTime,
                    status: 'PENDING' // Reset to pending
                })
                .eq('id', bookingId);
            
            if (error) throw error;
            alert('수정 제출 완료되었습니다. 승인 대기 상태로 변경됩니다.');
            setEditingId(null);
            fetchMyBookings();
        } catch (error) {
            console.error('Error resubmitting:', error);
            alert('재제출 중 오류가 발생했습니다.');
        } finally {
            setSubmittingEdit(false);
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[300] flex items-end md:items-center justify-center p-0 md:p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="fixed inset-0 bg-black/50 backdrop-blur-[2px]"
                />

                <motion.div
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                    className="w-full md:max-w-md bg-white rounded-t-toss-2xl md:rounded-toss-2xl shadow-toss-elevated z-10 flex flex-col max-h-[85vh] md:max-h-[85vh] overflow-hidden"
                >
                    <div className="p-5 border-b border-tossGrey100 flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-tossBlue font-black uppercase tracking-wider">내 공간 대여 현황</span>
                            <h3 className="font-extrabold text-tossGrey900 text-base flex items-center gap-1.5 mt-0.5">
                                공간 대여 신청 내역
                            </h3>
                        </div>
                        <button onClick={onClose} className="p-1.5 text-tossGrey500 hover:text-tossGrey800 hover:bg-tossGrey100 rounded-lg transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 p-5 overflow-y-auto space-y-4 custom-scrollbar">
                        {loading ? (
                            <div className="text-center py-10 font-bold text-tossGrey400 text-sm animate-pulse">불러오는 중...</div>
                        ) : bookings.length === 0 ? (
                            <div className="text-center py-10 text-tossGrey400 text-sm font-bold">신청 내역이 없습니다.</div>
                        ) : (
                            bookings.map(booking => {
                                let displayName = booking.rentals?.name || '공간';
                                try {
                                    if (displayName.startsWith('{')) {
                                        displayName = JSON.parse(displayName).name;
                                    }
                                } catch(e) {}
                                
                                const region = booking.rentals?.schools?.region;
                                const regionName = region === '강동' ? '하이픈' : region === '강서' ? '이높플레이스' : '';
                                
                                const endParts = booking.end_time.split('|');
                                const actualEndTime = endParts[0];
                                const purpose = endParts.length > 1 ? endParts[1] : '';
                                const headcount = endParts.length > 2 ? endParts[2] : '';
                                const meetingName = endParts.length > 3 ? endParts[3] : '';
                                const customNotes = endParts.length > 4 ? endParts[4] : '';
                                const rejectionReason = endParts.length > 5 ? endParts[5] : '';

                                const isEditing = editingId === booking.id;

                                return (
                                    <div key={booking.id} className="border border-tossGrey100 rounded-2xl p-4 space-y-3 bg-white">
                                        {isEditing ? (
                                            /* Inline Resubmission Form */
                                            <div className="space-y-3 text-xs">
                                                <div className="font-extrabold text-tossBlue text-[11px] mb-1">📝 신청 정보 수정</div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-tossGrey500 block">이용 날짜</label>
                                                    <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="w-full p-2 border border-tossGrey200 rounded-lg" />
                                                </div>
                                                <div className="flex gap-2">
                                                    <div className="flex-1 space-y-1">
                                                        <label className="text-[10px] font-bold text-tossGrey500 block">시작 시간</label>
                                                        <input type="time" value={editStart} onChange={e => setEditStart(e.target.value)} className="w-full p-2 border border-tossGrey200 rounded-lg" />
                                                    </div>
                                                    <div className="flex-1 space-y-1">
                                                        <label className="text-[10px] font-bold text-tossGrey500 block">종료 시간</label>
                                                        <input type="time" value={editEnd} onChange={e => setEditEnd(e.target.value)} className="w-full p-2 border border-tossGrey200 rounded-lg" />
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-tossGrey500 block">모임 이름</label>
                                                    <input type="text" value={editMeeting} onChange={e => setEditMeeting(e.target.value)} className="w-full p-2 border border-tossGrey200 rounded-lg" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-tossGrey500 block">이용 목적</label>
                                                    <input type="text" value={editPurpose} onChange={e => setEditPurpose(e.target.value)} className="w-full p-2 border border-tossGrey200 rounded-lg" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-tossGrey500 block">이용 인원</label>
                                                    <input type="number" value={editHeadcount} onChange={e => setEditHeadcount(e.target.value)} className="w-full p-2 border border-tossGrey200 rounded-lg" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-tossGrey500 block">기타 요청 사항</label>
                                                    <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows="2" className="w-full p-2 border border-tossGrey200 rounded-lg resize-none" />
                                                </div>
                                                <div className="flex gap-2 pt-1">
                                                    <button onClick={() => setEditingId(null)} className="flex-1 py-2 bg-tossGrey100 text-tossGrey700 font-bold rounded-lg text-[11px]">취소</button>
                                                    <button onClick={() => handleResubmit(booking.id, rejectionReason)} disabled={submittingEdit} className="flex-1 py-2 bg-tossBlue text-white font-bold rounded-lg text-[11px]">
                                                        {submittingEdit ? '제출 중...' : '수정 제출'}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            /* Regular Card Display */
                                            <>
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-start gap-2">
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                {regionName && (
                                                                    <span className="px-1.5 py-0.5 bg-tossBlueLight text-tossBlue border border-tossBlue/10 text-[9px] font-black rounded shrink-0">
                                                                        {regionName}
                                                                    </span>
                                                                )}
                                                                <h4 className="font-extrabold text-tossGrey900 text-sm tracking-tight">{displayName}</h4>
                                                            </div>
                                                        </div>
                                                        <span className={`px-2 py-0.5 border text-[9px] font-black rounded shrink-0 uppercase tracking-wider ${
                                                            booking.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                            booking.status === 'REJECTED' ? 'bg-red-50 text-red-600 border-red-100' :
                                                            'bg-amber-50 text-amber-600 border-amber-100'
                                                        }`}>
                                                            {booking.status === 'APPROVED' ? '승인 완료' :
                                                             booking.status === 'REJECTED' ? '반려됨' : '대기중'}
                                                        </span>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] font-bold text-tossGrey550 bg-tossGrey50 border border-tossGrey100 rounded-lg px-2.5 py-1.5">
                                                        <span className="flex items-center gap-1">
                                                            <Calendar size={11} className="text-tossGrey400 shrink-0" />
                                                            {booking.booking_date}
                                                        </span>
                                                        <span className="text-tossGrey200 font-normal">|</span>
                                                        <span className="flex items-center gap-1">
                                                            <Clock size={11} className="text-tossGrey400 shrink-0" />
                                                            {booking.start_time} - {actualEndTime}
                                                        </span>
                                                    </div>

                                                    {(meetingName || purpose || headcount || customNotes) && (
                                                        <div className="bg-tossGrey50/50 rounded-xl border border-tossGrey100/80 p-3 text-xs">
                                                            <div className="grid grid-cols-[64px_1fr] gap-y-2 text-[11px] leading-normal font-semibold">
                                                                {meetingName && (
                                                                    <>
                                                                        <span className="text-tossGrey400">모임 이름</span>
                                                                        <span className="text-tossGrey800 font-bold">{meetingName}</span>
                                                                    </>
                                                                )}
                                                                {headcount && (
                                                                    <>
                                                                        <span className="text-tossGrey400">이용 인원</span>
                                                                        <span className="text-tossGrey800 font-bold">{headcount}명</span>
                                                                    </>
                                                                )}
                                                                {purpose && (
                                                                    <>
                                                                        <span className="text-tossGrey400">이용 목적</span>
                                                                        <span className="text-tossGrey800 font-bold">{purpose}</span>
                                                                    </>
                                                                )}
                                                                {customNotes && (
                                                                    <>
                                                                        <span className="text-tossGrey400">요청 사항</span>
                                                                        <span className="text-tossGrey600 font-medium whitespace-pre-wrap">{customNotes}</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {booking.status === 'REJECTED' && rejectionReason && (
                                                    <div className="p-3 bg-red-50/70 border border-red-100/70 rounded-xl text-[11px] text-red-700 font-bold mt-2">
                                                        <p className="font-extrabold text-red-800">반려 사유:</p>
                                                        <p className="mt-0.5 text-red-600 font-medium">{rejectionReason}</p>
                                                    </div>
                                                )}
                                                
                                                <div className="flex justify-end gap-2 pt-2.5 border-t border-tossGrey100 text-xs font-bold mt-2">
                                                    {booking.status === 'REJECTED' && (
                                                        <button 
                                                            onClick={() => startEdit(booking)}
                                                            className="px-3 py-1.5 bg-tossBlueLight text-tossBlue hover:bg-tossBlue/20 border border-tossBlue/10 rounded-lg text-[11px] font-black transition-all flex items-center gap-1"
                                                        >
                                                            수정 후 재제출
                                                        </button>
                                                    )}
                                                    {(booking.status === 'PENDING' || booking.status === 'REJECTED') && (
                                                        <button 
                                                            onClick={() => handleDelete(booking.id)}
                                                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 rounded-lg text-[11px] font-black transition-colors"
                                                        >
                                                            신청 취소
                                                        </button>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default MyRentalsModal;
