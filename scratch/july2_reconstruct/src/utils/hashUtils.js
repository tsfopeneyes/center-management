import CryptoJS from 'crypto-js';

export const hashPassword = async (password) => {
    if (!password) return null;

    try {
        if (typeof crypto !== 'undefined' && crypto.subtle) {
            // Convert string to ArrayBuffer
            const encoder = new TextEncoder();
            const data = encoder.encode(password);

            // Hash the password using SHA-256
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);

            // Convert ArrayBuffer to Hex String
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            return hashHex;
        } else {
            // Fallback for non-secure contexts (HTTP over IP) where crypto.subtle is undefined
            return CryptoJS.SHA256(password).toString(CryptoJS.enc.Hex);
        }
    } catch (err) {
        console.warn("Crypto subtle failed, using fallback:", err);
        return CryptoJS.SHA256(password).toString(CryptoJS.enc.Hex);
    }
};
