import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import useModalClose from '../../hooks/useModalClose';

export default function CommunityPhotoGallery({ media, alt = '커뮤니티 사진' }) {
    const [openIndex, setOpenIndex] = useState(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const [scale, setScale] = useState(1);
    const stripRef = useRef(null);
    const gestureRef = useRef(null);
    const pinchEndedAt = useRef(0);
    const photos = media.map(item => typeof item === 'string' ? item : item.media_url).filter(Boolean);

    const isViewerOpen = openIndex !== null;
    const closeViewer = () => setOpenIndex(null);
    useModalClose(isViewerOpen, closeViewer);

    useEffect(() => {
        if (!isViewerOpen) return undefined;
        const onKeyDown = event => {
            if (event.key === 'ArrowRight') setOpenIndex(index => Math.min(photos.length - 1, index + 1));
            if (event.key === 'ArrowLeft') setOpenIndex(index => Math.max(0, index - 1));
        };
        window.addEventListener('keydown', onKeyDown);
        return () => { window.removeEventListener('keydown', onKeyDown); };
    }, [isViewerOpen, photos.length]);

    useEffect(() => { setScale(1); }, [openIndex]);

    const onScroll = () => {
        const strip = stripRef.current;
        if (strip?.clientWidth) setActiveIndex(Math.round(strip.scrollLeft / strip.clientWidth));
    };
    const distance = touches => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    const startGesture = event => {
        if (event.touches.length === 2) {
            gestureRef.current = { type: 'pinch', distance: distance(event.touches), scale };
        } else if (event.touches.length === 1) {
            gestureRef.current = { type: 'swipe', x: event.touches[0].clientX, y: event.touches[0].clientY };
        }
    };
    const moveGesture = event => {
        const gesture = gestureRef.current;
        if (event.touches.length === 2) {
            if (gesture?.type !== 'pinch') gestureRef.current = { type: 'pinch', distance: distance(event.touches), scale };
            else setScale(Math.max(1, Math.min(5, gesture.scale * distance(event.touches) / gesture.distance)));
            event.preventDefault();
        }
    };
    const endGesture = event => {
        const gesture = gestureRef.current;
        if (!gesture) return;
        if (gesture.type === 'pinch') {
            pinchEndedAt.current = Date.now();
        } else if (event.touches.length === 0 && scale <= 1.05 && event.changedTouches.length) {
            const dx = event.changedTouches[0].clientX - gesture.x;
            const dy = event.changedTouches[0].clientY - gesture.y;
            if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.25) {
                setOpenIndex(index => Math.max(0, Math.min(photos.length - 1, index + (dx < 0 ? 1 : -1))));
                pinchEndedAt.current = Date.now();
            }
        }
        if (event.touches.length === 0) gestureRef.current = null;
    };

    return <>
        <div className="relative mt-3 overflow-hidden rounded-2xl bg-[#F7EFE2]">
            <div ref={stripRef} onScroll={onScroll} className="scrollbar-hide flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain">
                {photos.map((url, index) => <button key={`${url}-${index}`} type="button" onClick={() => setOpenIndex(index)} aria-label={`${alt} ${index + 1} 확대`} className="flex w-full shrink-0 snap-center items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#CF3A27]">
                    <img src={url} alt={`${alt} ${index + 1}`} className="max-h-[68vh] w-full object-contain" loading="lazy"/>
                </button>)}
            </div>
            {photos.length > 1 && <div className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/65 px-2.5 py-1 text-xs font-bold text-white">{activeIndex + 1} / {photos.length}</div>}
        </div>
        {openIndex !== null && createPortal(<div role="dialog" aria-modal="true" aria-label="사진 확대 보기" data-community-photo-viewer className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/95 text-white" style={{ touchAction: 'none' }} onTouchStart={startGesture} onTouchMove={moveGesture} onTouchEnd={endGesture} onClick={() => { if (Date.now() - pinchEndedAt.current > 350) closeViewer(); }}>
            <button type="button" onClick={event => { event.stopPropagation(); closeViewer(); }} aria-label="사진 닫기" className="absolute right-4 top-4 z-10 rounded-full bg-white/15 p-2"><X size={24}/></button>
            <img src={photos[openIndex]} alt={`${alt} ${openIndex + 1} 확대`} draggable="false" onClick={event => { event.stopPropagation(); if (Date.now() - pinchEndedAt.current > 350) closeViewer(); }} style={{ transform: `scale(${scale})`, touchAction: 'none' }} className="max-h-[90dvh] max-w-full select-none object-contain"/>
            <button type="button" aria-label="확대 사진 닫기" onClick={event => { event.stopPropagation(); if (Date.now() - pinchEndedAt.current > 350) closeViewer(); }} className="absolute inset-x-0 bottom-0 h-12 text-xs font-semibold text-white/70">좌우로 넘기기 · 두 손가락으로 확대 · 탭하여 닫기</button>
            {photos.length > 1 && <div className="absolute bottom-14 left-1/2 flex -translate-x-1/2 items-center gap-5 rounded-full bg-black/60 px-3 py-2 text-xs font-bold"><button type="button" onClick={event => { event.stopPropagation(); setOpenIndex(index => Math.max(0, index - 1)); }} disabled={openIndex === 0} aria-label="이전 사진" className="disabled:opacity-30"><ChevronLeft size={20}/></button>{openIndex + 1} / {photos.length}<button type="button" onClick={event => { event.stopPropagation(); setOpenIndex(index => Math.min(photos.length - 1, index + 1)); }} disabled={openIndex === photos.length - 1} aria-label="다음 사진" className="disabled:opacity-30"><ChevronRight size={20}/></button></div>}
        </div>, document.body)}
    </>;
}
