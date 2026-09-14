export const confirmApp = (message, options = {}) => new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent('app-confirm', {
        detail: {
            message,
            title: options.title || '확인해 주세요',
            confirmText: options.confirmText || '확인',
            cancelText: options.cancelText || '취소',
            tone: options.tone || 'primary',
            resolve,
        },
    }));
});
