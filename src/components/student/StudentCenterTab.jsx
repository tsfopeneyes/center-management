import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import StudentProgramsTab from './StudentProgramsTab';
import { Store, Calendar, MapPin, Check, Plus, Coffee, Gamepad2, Landmark, CheckCircle, Sparkles, BookOpen, Wrench, ChevronRight } from 'lucide-react';
import RentalBookingModal from './modals/RentalBookingModal';
import MyRentalsModal from './modals/MyRentalsModal';
import ContentPostModal from './modals/ContentPostModal';
import { parseContentPost, sortContentPosts } from '../../utils/contentPosts';
import { isAdminOrStaff } from '../../utils/userUtils';
import ContentImage from '../common/ContentImage';

const StudentCenterTab = ({
    user,
    filteredPrograms,
    allPrograms,
    responses,
    responseDetails,
    openNoticeDetail,
    refreshTrigger,
    setRefreshTrigger,
    selectedRegion,
    studentRegion,
    tutorialMode = false,
    tutorialStep = '',
    tutorialResponses = {},
    onTutorialProgramOpen,
    onTutorialClose
}) => {
    const [contents, setContents] = useState([]);
    const [rentals, setRentals] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [loadingContents, setLoadingContents] = useState(false);
    const [loadingRentals, setLoadingRentals] = useState(false);
    
    // Booking modal states
    const [selectedRental, setSelectedRental] = useState(null);
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [showMyBookings, setShowMyBookings] = useState(false);
    const [selectedContent, setSelectedContent] = useState(null);

    // Get mapped center name based on student school/region
    // 강동 -> 하이픈, 강서 -> 이높플레이스
    const studentSchool = user?.school || '';
    const centerName = studentRegion === '강서' ? '이높플레이스' : '하이픈';

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
            } else if (!isAdminOrStaff(user)) {
                // Query by region instead of individual school name to show all items in the region
                const region = studentRegion || (studentSchool.includes('강서') ? '강서' : '강동');
                const { data: schs } = await supabase.from('schools').select('id').eq('region', region);
                query = query.in('school_id', schs?.map(s => s.id) || []);
            }

            const { data, error } = await query;
            if (error) throw error;
            setContents(sortContentPosts((data || []).map(parseContentPost).filter(Boolean)));
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
            } else if (!isAdminOrStaff(user)) {
                // Query by region instead of individual school name to show all spaces in the region
                const region = studentRegion || (studentSchool.includes('강서') ? '강서' : '강동');
                const { data: schs } = await supabase.from('schools').select('id').eq('region', region);
                query = query.in('school_id', schs?.map(s => s.id) || []);
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
        if (tutorialMode) {
            window.dispatchEvent(new CustomEvent('student-onboarding:rental-opened', { detail: { rental } }));
        }
    };

    return (
        <div className="w-full min-h-screen bg-[#F7EFE2] pb-24 relative">
            {/* Header Title */}
            <div className="relative overflow-hidden rounded-b-[30px] bg-[#CF3A27] px-5 pb-7 pt-6 text-white shadow-[0_8px_24px_rgba(207,58,39,0.18)] mb-5">
                <div aria-hidden="true" className="absolute -right-7 -top-8 h-24 w-24 rounded-full bg-[#F8DF53]" />
                <div aria-hidden="true" className="absolute -bottom-8 right-16 h-20 w-28 rounded-t-full bg-[#E88AAC]/85" />
                <div className="relative z-10 flex flex-col gap-1">
                    <h2 className="text-[24px] font-black tracking-[-0.04em] flex items-center gap-1.5">
                        센터 이용
                    </h2>
                    <p className="text-white/80 text-xs font-semibold">센터에서 새로운 기독 청소년 라이프스타일을 누려보세요!</p>
                </div>
            </div>

            <div className="px-4 space-y-5">

            {/* 1. Programs Section */}
            <section data-tour={tutorialMode ? 'tutorial-program-section' : undefined} className="rounded-[24px] border border-[#E7D8C4] bg-white p-5 shadow-[0_5px_16px_rgba(82,55,33,0.07)]">
                <div className="flex justify-between items-start mb-4 rounded-xl">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#F4DDD4] text-[#CF3A27] flex items-center justify-center shrink-0">
                            <BookOpen size={18} />
                        </div>
                        <div>
                            <h3 className="font-bold text-tossGrey900 text-[15px] tracking-tight leading-tight">프로그램</h3>
                            <p className="text-[11px] text-tossGrey500 font-semibold mt-0.5">우리가 연결되는 시간, 하나되는 공간</p>
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
                        tutorialMode={tutorialMode}
                        tutorialStep={tutorialStep}
                        tutorialResponses={tutorialResponses}
                        onTutorialProgramOpen={onTutorialProgramOpen}
                    />
                </div>
            </section>

            {/* 2. Contents Section */}
            <section data-tour={tutorialMode ? 'tutorial-content-section' : undefined} className="rounded-[24px] border border-[#E7D8C4] bg-[#FFFDF9] p-5 shadow-[0_5px_16px_rgba(82,55,33,0.07)]">
                <div className="flex justify-between items-start mb-4 rounded-xl">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#F8E9B0] text-[#8A6510] flex items-center justify-center shrink-0">
                            <Store size={18} />
                        </div>
                        <div>
                                <h3 className="font-bold text-tossGrey900 text-[15px] tracking-tight leading-tight">콘텐츠</h3>
                                <p className="text-[11px] text-tossGrey500 font-semibold mt-0.5">센터에서 자유롭게 누릴 수 있는 다채로운 경험!</p>
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
                            const isEnoughPlace = selectedRegion === 'GANGSEO' || (selectedRegion !== 'GANGDONG' && centerName === '이높플레이스');

                            const renderList = (items, categoryLabel, CategoryIcon, locationLabel, tutorialIndex) => {
                                if (items.length === 0) return null;
                                return (
                                    <div
                                        data-tour={tutorialMode ? `tutorial-content-card-${tutorialIndex}` : undefined}
                                        data-tour-label={categoryLabel}
                                        className="rounded-xl"
                                    >
                                        <div className="grid grid-cols-2 gap-3 mb-4 last:mb-0">
                                            {items.map((item, itemIndex) => {
                                                let d = '';
                                                try {
                                                    if (item.description && item.description.startsWith('{')) {
                                                        const parsed = JSON.parse(item.description);
                                                        d = parsed.desc || '';
                                                    } else {
                                                        d = item.description || '';
                                                    }
                                                } catch (e) {
                                                    d = item.description || '';
                                                }

                                                return (
                                                    <article key={item.id} onClick={()=>setSelectedContent(item)} className={`group cursor-pointer overflow-hidden rounded-[20px] border border-[#E7D8C4] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-toss-elevated active:scale-[0.98] ${itemIndex === 0 ? 'col-span-2' : ''}`}>
                                                        {item.image_url?<ContentImage src={item.image_url} alt={item.name} fit="cover" className={`${itemIndex === 0 ? 'aspect-[2/1]' : 'aspect-square'} w-full`} imageClassName="h-full"/>:<div className={`flex ${itemIndex === 0 ? 'aspect-[2/1]' : 'aspect-square'} items-center justify-center bg-[#F4DDD4] text-[#CF3A27]`}><Store size={28}/></div>}
                                                        <div className="p-3.5"><h4 className="line-clamp-1 font-extrabold text-tossGrey900 transition group-hover:text-[#CF3A27]">{item.name}</h4>
                                                        {item.short_description && <p className="mt-1 line-clamp-2 min-h-8 text-[11px] font-medium leading-relaxed text-tossGrey500">{item.short_description}</p>}<div className="mt-3 flex items-center gap-1.5 border-t border-tossGrey100 pt-2.5 text-[10px] font-bold text-tossGrey600"><MapPin size={12}/>{item.location}</div></div>
                                                    </article>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            };

                            const contentGroups = [
                                { items: contents, label: '콘텐츠', icon: Store, location: '' }
                            ];

                            return (
                                <div className="space-y-4">
                                    {contentGroups.map((group, index) => (
                                        <React.Fragment key={group.label}>
                                            {renderList(group.items, group.label, group.icon, group.location, index)}
                                        </React.Fragment>
                                    ))}
                                </div>
                            );
                        })()
                    )}
                </div>
            </section>

            {/* 3. Rentals Section */}
            <section data-tour={tutorialMode ? 'tutorial-rental-section' : undefined} className="rounded-[24px] border border-[#E7D8C4] bg-white p-5 shadow-[0_5px_16px_rgba(82,55,33,0.07)]">
                <div className="flex justify-between items-start mb-4 rounded-xl">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#E7EFEA] text-[#3C7560] flex items-center justify-center shrink-0">
                            <Landmark size={18} />
                        </div>
                        <div>
                            <h3 className="font-bold text-tossGrey900 text-[15px] tracking-tight leading-tight">공간 대여</h3>
                            <p className="text-[11px] text-tossGrey500 font-semibold mt-0.5">우리만의 스쿨처치 모임을 위해 공간을 이용해보세요</p>
                        </div>
                    </div>
                    {/* My Bookings History Button */}
                    <button
                        onClick={() => setShowMyBookings(true)}
                        className="flex shrink-0 items-center gap-0.5 py-1 text-[11px] font-extrabold text-[#CF3A27] transition-colors hover:text-[#B92F20]"
                    >
                        내 신청 내역
                        <ChevronRight size={14} strokeWidth={2.5} />
                    </button>
                </div>
                {tutorialMode && tutorialStep === 'rentalSelect' && (
                    <div className="mb-4 rounded-2xl border border-tossBlue/15 bg-tossBlueLight px-4 py-3 text-xs font-bold leading-5 text-tossGrey700">
                        원하는 공간의 <span className="text-tossBlue">예약 신청</span>을 눌러 실제 예약 화면을 살펴보세요. 체험 신청은 서버에 저장되지 않아요.
                    </div>
                )}
                <div className="pt-2 space-y-2">
                    {loadingRentals ? (
                        <div className="text-center py-6 font-bold text-tossGrey400 animate-pulse">불러오는 중...</div>
                    ) : rentals.length === 0 ? (
                        <div className="text-center py-6 text-tossGrey400 text-xs font-bold">등록된 공간이 없습니다.</div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {rentals.map((rental, rentalIndex) => {
                                let displayName = rental.name;
                                let capacityText = '';
                                let featuresText = '';
                                let imageUrl = '';
                                try {
                                    const trimmed = rental.name ? rental.name.trim() : '';
                                    if (trimmed.startsWith('{')) {
                                        const parsed = JSON.parse(trimmed);
                                        displayName = parsed.name || '';
                                        capacityText = parsed.capacity || '';
                                        featuresText = parsed.features || '';
                                        imageUrl = parsed.image_url || '';
                                    }
                                } catch (e) {
                                    displayName = rental.name;
                                    capacityText = '';
                                    featuresText = '';
                                }

                                return (
                                    <div
                                        key={rental.id}
                                        data-tour={tutorialMode ? `tutorial-rental-card-${rentalIndex}` : undefined}
                                        data-tour-label={displayName}
                                        className="flex min-h-[116px] overflow-hidden rounded-[18px] border border-[#E7D8C4] bg-white shadow-[0_3px_10px_rgba(82,55,33,0.05)] transition-shadow hover:shadow-[0_6px_16px_rgba(82,55,33,0.09)]"
                                    >
                                        <div className="flex w-[30%] min-w-[92px] shrink-0 items-center justify-center overflow-hidden border-r border-[#E7D8C4] bg-[#FBF3E7] text-[#CF3A27]">
                                            {imageUrl ? (
                                                <ContentImage src={imageUrl} alt={displayName} fit="cover" className="h-full w-full" imageClassName="h-full" />
                                            ) : (
                                                <Landmark size={26} strokeWidth={1.8} />
                                            )}
                                        </div>
                                        <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-3.5">
                                            <div className="flex items-start justify-between gap-2">
                                                <h4 className="min-w-0 font-extrabold text-tossGrey900 text-[14px] tracking-tight leading-tight">{displayName}</h4>
                                                {capacityText && (
                                                    <span className="shrink-0 rounded-md bg-[#F4DDD4] px-2 py-0.5 text-[9px] font-extrabold text-[#CF3A27]">
                                                        최대 {capacityText}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex min-w-0 items-start gap-1.5 text-[10.5px] font-medium leading-relaxed text-tossGrey500">
                                                <Wrench size={13} className="mt-0.5 shrink-0 text-tossGrey400" />
                                                <span className="line-clamp-2">{featuresText || rental.description || '이용 가능한 시설 정보를 확인해보세요'}</span>
                                            </div>
                                            <button
                                                onClick={() => handleOpenBooking(rental)}
                                                className="mt-auto flex w-full items-center justify-center rounded-lg bg-[#CF3A27] py-2 text-[11px] font-bold text-white shadow-sm transition-colors hover:bg-[#B83222]"
                                            >
                                                예약 신청
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>

            </div>

            {/* Rental Booking Dialog/Modal */}
            {showBookingModal && selectedRental && (
                <RentalBookingModal
                    user={user}
                    rental={selectedRental}
                    bookings={bookings}
                    onClose={() => {
                        setShowBookingModal(false);
                        setSelectedRental(null);
                        if (tutorialMode) window.dispatchEvent(new Event('student-onboarding:rental-cancelled'));
                    }}
                    onSuccess={() => {
                        setShowBookingModal(false);
                        setSelectedRental(null);
                        if (tutorialMode) {
                            window.dispatchEvent(new Event('student-onboarding:rental-completed'));
                        } else {
                            fetchBookings();
                            if (setRefreshTrigger) setRefreshTrigger(prev => prev + 1);
                        }
                    }}
                    tutorialMode={tutorialMode}
                />
            )}

            {/* My Rentals History Modal */}
            {showMyBookings && (
                <MyRentalsModal
                    user={user}
                    onClose={() => setShowMyBookings(false)}
                />
            )}
            {selectedContent && <ContentPostModal post={selectedContent} onClose={()=>setSelectedContent(null)}/>}
        </div>
    );
};

export default StudentCenterTab;
