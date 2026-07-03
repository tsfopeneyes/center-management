import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import StudentProgramsTab from './StudentProgramsTab';
import { Store, Calendar, MapPin, Check, Plus, Coffee, Gamepad2, Landmark, CheckCircle, Sparkles, BookOpen } from 'lucide-react';
import RentalBookingModal from './modals/RentalBookingModal';

const StudentCenterTab = ({
    user,
    filteredPrograms,
    allPrograms,
    responses,
    responseDetails,
    openNoticeDetail,
    refreshTrigger,
    setRefreshTrigger,
    selectedRegion
}) => {
    const [contents, setContents] = useState([]);
    const [rentals, setRentals] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [loadingContents, setLoadingContents] = useState(false);
    const [loadingRentals, setLoadingRentals] = useState(false);
    
    // Booking modal states
    const [selectedRental, setSelectedRental] = useState(null);
    const [showBookingModal, setShowBookingModal] = useState(false);

    // Get mapped center name based on student school
    // 강동 -> 하이픈, 강서 -> 이높플레이스
    const studentSchool = user?.school || '';
    const centerName = studentSchool.includes('강서') ? '이높플레이스' : '하이픈';

    // Region switcher states are now passed as props from parent (Student Dashboard / Home Tab)
    useEffect(() => {
        fetchContents();
        fetchRentals();
        fetchBookings();
    }, [studentSchool, selectedRegion, refreshTrigger]);

    const fetchContents = async () => {
        setLoadingContents(true);
        try {
            let query = supabase.from('contents').select('*, schools(region)');
            
            // Region selection filter (matching simplified 'ALL', 'GANGDONG', 'GANGSEO' regional scope)
            if (selectedRegion === 'GANGDONG') {
                const { data: schs } = await supabase.from('schools').select('id').eq('region', '강동');
                query = query.in('school_id', schs?.map(s => s.id) || []);
            } else if (selectedRegion === 'GANGSEO') {
                const { data: schs } = await supabase.from('schools').select('id').eq('region', '강서');
                query = query.in('school_id', schs?.map(s => s.id) || []);
            } else if (user?.role !== 'admin') {
                // Regular student query - exact school name matching
                const { data: schoolData } = await supabase
                    .from('schools')
                    .select('id')
                    .eq('name', studentSchool)
                    .maybeSingle();
                
                if (schoolData) {
                    query = query.eq('school_id', schoolData.id);
                } else {
                    const schoolRegion = studentSchool.includes('강서') ? '강서' : '강동';
                    const { data: schs } = await supabase.from('schools').select('id').eq('region', schoolRegion);
                    query = query.in('school_id', schs?.map(s => s.id) || []);
                }
            }

            const { data, error } = await query;
            if (error) throw error;
            setContents(data || []);
        } catch (error) {
            console.error('Error fetching contents:', error);
        } finally {
            setLoadingContents(false);
        }
    };

    const fetchRentals = async () => {
        setLoadingRentals(true);
        try {
            let query = supabase.from('rentals').select('*, schools(region)');
            
            if (selectedRegion === 'GANGDONG') {
                const { data: schs } = await supabase.from('schools').select('id').eq('region', '강동');
                query = query.in('school_id', schs?.map(s => s.id) || []);
            } else if (selectedRegion === 'GANGSEO') {
                const { data: schs } = await supabase.from('schools').select('id').eq('region', '강서');
                query = query.in('school_id', schs?.map(s => s.id) || []);
            } else if (user?.role !== 'admin') {
                // Regular student query - exact school name matching
                const { data: schoolData } = await supabase
                    .from('schools')
                    .select('id')
                    .eq('name', studentSchool)
                    .maybeSingle();
                
                if (schoolData) {
                    query = query.eq('school_id', schoolData.id);
                } else {
                    const schoolRegion = studentSchool.includes('강서') ? '강서' : '강동';
                    const { data: schs } = await supabase.from('schools').select('id').eq('region', schoolRegion);
                    query = query.in('school_id', schs?.map(s => s.id) || []);
                }
            }

            const { data, error } = await query;
            if (error) throw error;
            
            const sorted = (data || []).sort((a, b) => {
                let orderA = 9999;
                let orderB = 9999;
                try {
                    if (a.name && a.name.trim().startsWith('{')) {
                        orderA = JSON.parse(a.name.trim()).sort_order ?? 9999;
                    }
                } catch (e) {}
                try {
                    if (b.name && b.name.trim().startsWith('{')) {
                        orderB = JSON.parse(b.name.trim()).sort_order ?? 9999;
                    }
                } catch (e) {}
                
                if (orderA !== orderB) {
                    return orderA - orderB;
                }
                
                let nameA = a.name || '';
                let nameB = b.name || '';
                try {
                    if (a.name && a.name.trim().startsWith('{')) nameA = JSON.parse(a.name.trim()).name || '';
                    if (b.name && b.name.trim().startsWith('{')) nameB = JSON.parse(b.name.trim()).name || '';
                } catch (e) {}
                return nameA.localeCompare(nameB);
            });
            
            setRentals(sorted);
        } catch (error) {
            console.error('Error fetching rentals:', error);
        } finally {
            setLoadingRentals(false);
        }
    };

    const fetchBookings = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const { data, error } = await supabase
                .from('rental_bookings')
                .select('*')
                .eq('booking_date', today);
            if (error) throw error;
            setBookings(data || []);
        } catch (error) {
            console.error('Error fetching bookings:', error);
        }
    };

    const handleOpenBooking = (rental) => {
        setSelectedRental(rental);
        setShowBookingModal(true);
    };

    return (
        <div className="w-full min-h-screen bg-tossGrey50 pb-28 relative">
            {/* Header Title */}
            <div className="px-5 pt-5 pb-4 sticky top-0 bg-tossGrey50/95 backdrop-blur-xl z-20 border-b border-tossGrey200/50 mb-6">
                <div className="flex flex-col gap-1">
                    <h2 className="text-2xl font-bold text-tossGrey900 tracking-tight flex items-center gap-1.5">
                        센터 이용
                    </h2>
                    <p className="text-tossGrey500 text-xs font-medium">센터에서 새로운 기독 청소년 라이프스타일을 누려보세요</p>
                </div>
            </div>

            <div className="px-5 space-y-6">

            {/* 1. Programs Section */}
            <div className="bg-white p-5 rounded-toss-xl shadow-toss-standard">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-tossBlueLight text-tossBlue flex items-center justify-center shrink-0">
                            <BookOpen size={18} />
                        </div>
                        <div>
                            <h3 className="font-bold text-tossGrey900 text-[15px] tracking-tight leading-tight">프로그램</h3>
                            <p className="text-[11px] text-tossGrey500 font-semibold mt-0.5">진행 중인 다양한 프로그램에 참여해 보세요.</p>
                        </div>
                    </div>
                </div>
                <div className="pt-2">
                    <StudentProgramsTab
                        filteredPrograms={filteredPrograms}
                        allPrograms={allPrograms}
                        responses={responses}
                        responseDetails={responseDetails}
                        openNoticeDetail={openNoticeDetail}
                    />
                </div>
            </div>

            {/* 2. Contents Section */}
            <div className="bg-white p-5 rounded-toss-xl shadow-toss-standard">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-tossWarning/10 text-tossWarning flex items-center justify-center shrink-0">
                            <Store size={18} />
                        </div>
                        <div>
                            <h3 className="font-bold text-tossGrey900 text-[15px] tracking-tight leading-tight">콘텐츠</h3>
                            <p className="text-[11px] text-tossGrey500 font-semibold mt-0.5">간식 및 보드게임 등 무료로 이용 가능한 혜택입니다.</p>
                        </div>
                    </div>
                </div>
                <div className="pt-2 space-y-5">
                    {loadingContents ? (
                        <div className="text-center py-6 font-bold text-tossGrey400 animate-pulse">불러오는 중...</div>
                    ) : contents.length === 0 ? (
                        <div className="text-center py-6 text-tossGrey400 text-xs font-bold">등록된 콘텐츠가 없습니다.</div>
                    ) : (
                        (() => {
                            const snacks = contents.filter(c => c.category === '간식');
                            const boardGames = contents.filter(c => c.category === '보드게임');

                            const renderList = (items, categoryLabel) => {
                                if (items.length === 0) return null;
                                return (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-1.5 border-b border-tossGrey100 pb-1 mb-2">
                                            <span className="text-[12px] font-black text-tossGrey850">{categoryLabel}</span>
                                            <span className="text-[10px] font-bold text-tossGrey400 bg-tossGrey100 px-1.5 py-0.5 rounded-full">{items.length}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {items.map(item => {
                                                let loc = '';
                                                let d = '';
                                                try {
                                                    if (item.description && item.description.startsWith('{')) {
                                                        const parsed = JSON.parse(item.description);
                                                        loc = parsed.location || '';
                                                        d = parsed.desc || '';
                                                    } else {
                                                        d = item.description || '';
                                                    }
                                                } catch (e) {
                                                    d = item.description || '';
                                                }

                                                return (
                                                    <div key={item.id} className="bg-tossGrey50 rounded-xl border border-tossGrey100 p-3 hover:bg-tossGrey100/50 transition-colors flex flex-col justify-center">
                                                        <div className="flex items-center justify-between gap-1.5 min-w-0">
                                                            <h4 className="font-extrabold text-tossGrey900 text-[13px] tracking-tight truncate flex-1">{item.name}</h4>
                                                            {loc ? (
                                                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded shrink-0 ${
                                                                    loc === '2F SQUARE' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                                                                    loc === '3F ROUND' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                                                    loc === '6F LOUNGE' ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                                                                    'bg-pink-50 text-pink-700 border border-pink-100'
                                                                }`}>
                                                                    {loc}
                                                                </span>
                                                            ) : (
                                                                <span className="text-[9px] font-bold text-tossGrey400 bg-tossGrey200/50 px-1.5 py-0.5 rounded shrink-0">
                                                                    위치 미정
                                                                </span>
                                                            )}
                                                        </div>
                                                        {d && <p className="text-[10px] text-tossGrey400 mt-1 truncate font-normal">{d}</p>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            };

                            return (
                                <div className="space-y-4">
                                    {renderList(snacks, '🍪 간식')}
                                    {renderList(boardGames, '🎲 보드게임')}
                                </div>
                            );
                        })()
                    )}
                </div>
            </div>

            {/* 3. Rentals Section */}
            <div className="bg-white p-5 rounded-toss-xl shadow-toss-standard">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                            <Landmark size={18} />
                        </div>
                        <div>
                            <h3 className="font-bold text-tossGrey900 text-[15px] tracking-tight leading-tight">대관 신청</h3>
                            <p className="text-[11px] text-tossGrey500 font-semibold mt-0.5">센터 대관 현황을 조회하고 예약 신청을 진행하세요.</p>
                        </div>
                    </div>
                </div>
                <div className="pt-2 space-y-2">
                    {loadingRentals ? (
                        <div className="text-center py-6 font-bold text-tossGrey400 animate-pulse">불러오는 중...</div>
                    ) : rentals.length === 0 ? (
                        <div className="text-center py-6 text-tossGrey400 text-xs font-bold">등록된 공간이 없습니다.</div>
                    ) : (
                        <div className="grid grid-cols-1 divide-y divide-tossGrey100 bg-tossGrey50 border border-tossGrey100 rounded-xl overflow-hidden">
                            {rentals.map(rental => {
                                let displayName = rental.name;
                                let capacityText = '';
                                let featuresText = '';
                                try {
                                    const trimmed = rental.name ? rental.name.trim() : '';
                                    if (trimmed.startsWith('{')) {
                                        const parsed = JSON.parse(trimmed);
                                        displayName = parsed.name || '';
                                        capacityText = parsed.capacity || '';
                                        featuresText = parsed.features || '';
                                    }
                                } catch (e) {
                                    displayName = rental.name;
                                    capacityText = '';
                                    featuresText = '';
                                }

                                return (
                                    <div key={rental.id} className="flex justify-between items-center px-4 py-3.5 hover:bg-tossGrey100/50 transition-colors">
                                        <div className="min-w-0 pr-3">
                                            <h4 className="font-extrabold text-tossGrey900 text-[13px] tracking-tight leading-none">{displayName}</h4>
                                            {(capacityText || featuresText) ? (
                                                <div className="flex flex-col gap-1 mt-1.5 font-normal text-[10px] text-tossGrey400">
                                                    {capacityText && <span>👥 최대 이용 인원: <span className="font-black text-tossGrey600">{capacityText}</span></span>}
                                                    {featuresText && <span className="truncate max-w-[220px]">🛠️ 구비 설비: {featuresText}</span>}
                                                </div>
                                            ) : (
                                                <p className="text-[10px] text-tossGrey400 mt-1.5 truncate max-w-[240px] font-normal">
                                                    {rental.description || '대관 가능한 공간입니다.'}
                                                </p>
                                            )}
                                        </div>
                                    <button
                                        onClick={() => handleOpenBooking(rental)}
                                        className="shrink-0 px-3.5 py-1.5 bg-tossBlue text-white rounded-lg font-black text-[11px] hover:bg-tossBlueDark transition-colors shadow-sm"
                                    >
                                        예약 신청
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            </div>

            {/* Rental Booking Dialog/Modal */}
            {selectedRental && (
                <RentalBookingModal 
                    user={user}
                    rental={selectedRental}
                    onClose={handleCloseBooking}
                    onSuccess={handleCloseBooking}
                />
            )}

            {/* My Rentals Modal */}
            {showMyRentalsModal && (
                <MyRentalsModal 
                    user={user}
                    onClose={() => setShowMyRentalsModal(false)}
                />
            )}
            {showBookingModal && selectedRental && (
                <RentalBookingModal
                    user={user}
                    rental={selectedRental}
                    bookings={bookings}
                    onClose={() => {
                        setShowBookingModal(false);
                        setSelectedRental(null);
                    }}
                    onSuccess={() => {
                        setShowBookingModal(false);
                        setSelectedRental(null);
                        fetchBookings();
                        if (setRefreshTrigger) setRefreshTrigger(prev => prev + 1);
                    }}
                />
            )}
        </div>
    );
};

export default StudentCenterTab;
