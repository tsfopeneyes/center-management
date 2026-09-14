/**
 * Smart Profanity Filter with Korean Jamo Decomposition and Obfuscation Normalization
 */

// Korean Jamo Initial Consonant Array
const CHOSUNG_LIST = [
    'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
];

/**
 * Extract initial consonants from a Hangul string (e.g. "시발" -> "ㅅㅂ")
 */
export const extractChosung = (text) => {
    let result = '';
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i) - 0xAC00;
        if (code >= 0 && code <= 11172) {
            const chosungIndex = Math.floor(code / 588);
            result += CHOSUNG_LIST[chosungIndex];
        } else {
            result += text[i];
        }
    }
    return result;
};

// Keep this deliberately small. A token must equal one of these values after
// punctuation/number normalization; merely containing one is not sufficient.
const BLOCKED_WORDS = new Set([
    '시발', '씨발', '병신', '개새끼', '지랄', '존나', '좆',
    '엠창', '느금마', '닥쳐', '미친놈', '미친년'
]);

const BLOCKED_CHOSUNG = new Set(['ㅅㅂ', 'ㅆㅂ', 'ㅂㅅ', 'ㄱㅅㄲ', 'ㅈㄹ', 'ㅈㄴ', 'ㄷㅊ']);

/**
 * Normalizes string by stripping special chars, symbols, and numbers used for obfuscation.
 * E.g. "시1발" -> "시발", "ㅅ~ㅂ" -> "ㅅㅂ", "씨...발" -> "씨발"
 */
export const normalizeText = (text) => {
    return text.replace(/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`\s]/g, '');
};

/**
 * Main profanity filter function
 * Returns { maskedText: string, hasProfanity: boolean }
 */
export const filterProfanity = (text) => {
    if (!text || typeof text !== 'string') {
        return { maskedText: '', hasProfanity: false };
    }

    let hasProfanity = false;
    const maskedText = text.split(/(\s+)/).map(token => {
        if (!token || /^\s+$/.test(token)) return token;

        const normalizedToken = normalizeText(token);
        const isBlockedWord = BLOCKED_WORDS.has(normalizedToken);
        const isBlockedChosung = /^[ㄱ-ㅎ]+$/.test(normalizedToken)
            && BLOCKED_CHOSUNG.has(normalizedToken);

        if (!isBlockedWord && !isBlockedChosung) return token;
        hasProfanity = true;
        return '***';
    }).join('');

    return { maskedText, hasProfanity };
};

export default filterProfanity;
