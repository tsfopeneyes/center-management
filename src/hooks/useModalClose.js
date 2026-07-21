import { useEffect, useRef } from 'react';

/**
 * Custom hook to close a modal when ESC key is pressed.
 * 
 * @param {boolean} isOpen - Whether the modal is currently open
 * @param {Function} onClose - Function to call to close the modal
 */
export const useModalClose = (isOpen = true, onClose) => {
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    useEffect(() => {
        if (!isOpen || typeof onCloseRef.current !== 'function') return;

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                if (onCloseRef.current) {
                    onCloseRef.current();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);
};

export default useModalClose;
