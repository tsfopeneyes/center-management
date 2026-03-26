import React, { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
        <div className="mb-6 rounded-2xl overflow-hidden shadow-sm bg-gray-50 border border-gray-100 relative group">
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
                    <div key={idx} className="flex-shrink-0 w-full snap-center flex items-center justify-center bg-gray-50 relative group/img">
                        <img src={img} className="w-full h-auto object-contain max-h-[70vh] pointer-events-none" alt={`Slide ${idx}`} />
                    </div>
                ))}
            </div>

            {/* Navigation Arrows */}
            {allImages.length > 1 && (
                <>
                    <button
                        onClick={(e) => { e.stopPropagation(); scrollPrev(); }}
                        className={`absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-gray-900 shadow-xl backdrop-blur-md flex items-center justify-center transition-all duration-300 z-10 opacity-0 group-hover:opacity-100 active:scale-90 ${currentImageIndex === 0 ? 'invisible' : 'visible'}`}
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); scrollNext(); }}
                        className={`absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-gray-900 shadow-xl backdrop-blur-md flex items-center justify-center transition-all duration-300 z-10 opacity-0 group-hover:opacity-100 active:scale-90 ${currentImageIndex === allImages.length - 1 ? 'invisible' : 'visible'}`}
                    >
                        <ChevronRight size={20} />
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
