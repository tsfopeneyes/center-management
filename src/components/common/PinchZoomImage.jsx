import React, { useRef, useState, useEffect } from 'react';
import { useSpring, animated } from '@react-spring/web';
import { useGesture } from '@use-gesture/react';

const PinchZoomImage = ({ src, alt, className = '', style = {}, imageClassName = "w-full object-cover" }) => {
    const containerRef = useRef(null);
    const [isZooming, setIsZooming] = useState(false);

    useEffect(() => {
        const preventDefault = (e) => {
            if (isZooming) {
                e.preventDefault();
            }
        };
        // Disable body scroll when zooming
        document.addEventListener('touchmove', preventDefault, { passive: false });
        return () => {
            document.removeEventListener('touchmove', preventDefault);
        };
    }, [isZooming]);

    const [{ x, y, scale }, api] = useSpring(() => ({
        x: 0,
        y: 0,
        scale: 1,
        config: { mass: 1, tension: 400, friction: 30 }
    }));

    useGesture(
        {
            onPinch: ({ offset: [d], active }) => {
                if (active && d > 1) {
                    setIsZooming(true);
                    api.start({ scale: d, immediate: true });
                } else if (!active) {
                    setIsZooming(false);
                    api.start({ scale: 1, x: 0, y: 0 });
                }
            },
            onDrag: ({ offset: [dx, dy], active, movement: [mx, my] }) => {
                // Only allow panning if we are currently zoomed in
                if (isZooming) {
                    api.start({ x: dx, y: dy, immediate: true });
                }
            },
            onDragEnd: () => {
                // If not zooming anymore, reset position
                if (!isZooming) {
                    api.start({ x: 0, y: 0 });
                }
            }
        },
        {
            target: containerRef,
            drag: {
                from: () => [x.get(), y.get()],
                // Only trigger drag if we use 1 finger. Pinch uses 2.
                filterTaps: true,
                pointer: { touch: true }
            },
            pinch: {
                scaleBounds: { min: 1, max: 4 },
                rubberband: true
            }
        }
    );

    return (
        <div 
            ref={containerRef} 
            className={`relative ${className}`} 
            style={{ ...style, zIndex: isZooming ? 9999 : 'auto', touchAction: 'pan-x pan-y' }}
        >
            {/* Dark Backdrop Overlay that appears only when zoomed */}
            {isZooming && (
                <div 
                    className="fixed inset-0 bg-black/80 transition-opacity" 
                    style={{ zIndex: -1 }} 
                />
            )}
            <animated.img
                src={src}
                alt={alt}
                style={{
                    x, y, scale,
                    touchAction: isZooming ? 'none' : 'pan-x pan-y'
                }}
                className={`transform-gpu ${imageClassName}`}
            />
        </div>
    );
};

export default PinchZoomImage;
