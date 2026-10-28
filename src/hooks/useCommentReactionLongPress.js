import { useEffect, useRef, useState } from 'react';

const isMobilePointer = () => window.matchMedia('(max-width: 767px), (pointer: coarse)').matches;
const isInteractiveTarget = target => Boolean(target?.closest?.('a, button, input, textarea, select, iframe, [data-comment-interactive], [role="button"], [contenteditable="true"]'));

export default function useCommentReactionLongPress() {
    const timerRef = useRef(null);
    const [pickerRequest, setPickerRequest] = useState({ commentId: null, token: 0 });

    const cancel = () => {
        if (!timerRef.current) return;
        clearTimeout(timerRef.current);
        timerRef.current = null;
    };

    const bindLongPress = commentId => ({
        onTouchStart: event => {
            cancel();
            if (!isMobilePointer() || isInteractiveTarget(event.target) || event.touches.length !== 1) return;
            timerRef.current = setTimeout(() => {
                timerRef.current = null;
                navigator.vibrate?.(12);
                setPickerRequest({ commentId, token: Date.now() });
            }, 480);
        },
        onTouchEnd: cancel,
        onTouchMove: cancel,
        onTouchCancel: cancel,
        onContextMenu: event => {
            if (isMobilePointer() && !isInteractiveTarget(event.target)) event.preventDefault();
        },
    });

    useEffect(() => cancel, []);

    return { pickerRequest, bindLongPress };
}
