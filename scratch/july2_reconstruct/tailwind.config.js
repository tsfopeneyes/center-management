import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Pretendard', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
            },
            colors: {
                tossBlue: '#3182f6',
                tossBlueHover: '#2272eb',
                tossBlueLight: '#e8f3ff',
                tossGrey50: '#f9fafb',
                tossGrey100: '#f2f4f6',
                tossGrey200: '#e5e8eb',
                tossGrey400: '#b0b8c1',
                tossGrey500: '#8b95a1',
                tossGrey600: '#6b7684',
                tossGrey700: '#4e5968',
                tossGrey800: '#333d4b',
                tossGrey900: '#191f28',
                tossBrandBlue: '#0064ff',
                tossError: '#f04452',
                tossSuccess: '#03b26c',
                tossWarning: '#fe9800',
                tossCaution: '#ffc342',
            },
            boxShadow: {
                'toss-subtle': '0px 1px 3px rgba(0,0,0,0.06)',
                'toss-standard': '0px 2px 8px rgba(0,0,0,0.08)',
                'toss-elevated': '0px 4px 12px rgba(0,0,0,0.12)',
                'toss-modal': '0px 8px 24px rgba(0,0,0,0.16)',
            },
            borderRadius: {
                'toss-sm': '4px',
                'toss-md': '8px',
                'toss-lg': '12px',
                'toss-xl': '16px',
            }
        },
    },
    plugins: [
        typography,
    ],
}
