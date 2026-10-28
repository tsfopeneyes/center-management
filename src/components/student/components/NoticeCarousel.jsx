import React, { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import PinchZoomImage from '../../common/PinchZoomImage';

const NoticeCarousel = ({ allImages }) => {
    const bannerScrollRef = useRef(null);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isBannerDragging, setIsBannerDragging] = useState(false);
    const [bannerStartX, setBannerStartX] = useState(0);
    const [bannerScrollLeft, setBannerScrollLeft] = useState(0);

    if (!allImages || allImages.length === 0) return null;

    const handleBannerMouseDown = (e) => {
        setIsBannerDragging(true);
        setBannerStartX(e.pageX - bannerScrollRef.current.offsetLeft);
        setBannerScrollLeft(bannerScrollRef.current.scrollLeft);
    };

    const handleBannerMouseLeave = () => setIsBannerDragging(false);
    const handleBannerMouseUp = () => setIsBannerDragging(false);

    const handleBannerMouseMove = (e) => {
        if (!isBannerDragging) return;
        e.preventDefault();
        const x = e.pageX - bannerScrollRef.current.offsetLeft;
        const walk = (x - bannerStartX) * 2;
        bannerScrollRef.current.scrollLeft = bannerScrollLeft - walk;
    };

    const scrollPrev = () => {
        if (bannerScrollRef.current) {
            bannerScrollRef.current.scrollBy({ left: -bannerScrollRef.current.clientWidth, behavior: 'smooth' });
        }
    };

    const scrollNext = () => {
        if (bannerScrollRef.current) {
            bannerScrollRef.current.scrollBy({ left: bannerScrollRef.current.clientWidth, behavior: 'smooth' });
        }
    };

    return (
        <div className="mb-6 overflow-hidden bg-gray-50 relative group">
            <div
                ref={bannerScrollRef}
                className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide w-full cursor-grab active:cursor-grabbing select-none"
                onMouseDown={handleBannerMouseDown}
                onMouseLeave={handleBannerMouseLeave}
                onMouseUp={handleBannerMouseUp}
                onMouseMove={handleBannerMouseMove}
                onScroll={(e) => {
                    const index = Math.round(e.target.scrollLeft / e.target.clientWidth);
                    setCurrentImageIndex(index);
                }}
            >
                {allImages.map((img, idx) => (
                    <div key={idx} className="flex-shrink-0 w-full snap-center bg-gray-50 relative group/img">
                        <PinchZoomImage src={img} className="w-full" imageClassName="block w-full h-auto object-contain pointer-events-auto" alt={`Slide ${idx}`} />
                    </div>
                ))}
            </div>

            {/* Navigation Arrows */}
            {allImages.length > 1 && (
                <>
                    <button
                        type="button"
                        aria-label="이전 이미지"
                        onClick={(e) => { e.stopPropagation(); scrollPrev(); }}
                        className={`absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/70 hover:bg-white/90 text-gray-900 shadow-md flex items-center justify-center transition-colors z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 active:bg-white ${currentImageIndex === 0 ? 'invisible' : 'visible'}`}
                    >
                        <ChevronLeft size={24} aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        aria-label="다음 이미지"
                        onClick={(e) => { e.stopPropagation(); scrollNext(); }}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/70 hover:bg-white/90 text-gray-900 shadow-md flex items-center justify-center transition-colors z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 active:bg-white ${currentImageIndex === allImages.length - 1 ? 'invisible' : 'visible'}`}
                    >
                        <ChevronRight size={24} aria-hidden="true" />
                    </button>
                    <div className="absolute top-3 right-3 bg-black/60 text-white text-[10px] px-2 py-1 rounded-full font-bold backdrop-blur-md z-10">
                        {currentImageIndex + 1} / {allImages.length}
                    </div>
                </>
            )}
        </div>
    );
};

export default NoticeCarousel;
