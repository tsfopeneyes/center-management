import { useEffect, useRef, useState } from 'react';

const isMobilePointer = () => window.matchMedia('(max-width: 767px), (pointer: coarse)').matches;

export default function useCommentReactionLongPress() {
    const timerRef = useRef(null);
    const [pickerRequest, setPickerRequest] = useState({ commentId: null, token: 0 });

    const cancel = () => {
        if (!timerRef.current) return;
        clearTimeout(timerRef.current);
        timerRef.current = null;
    };

    const bindLongPress = commentId => ({
        onTouchStart: () => {
            if (!isMobilePointer()) return;
            cancel();
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
            if (isMobilePointer()) event.preventDefault();
        },
    });

    useEffect(() => cancel, []);

    return { pickerRequest, bindLongPress };
}
