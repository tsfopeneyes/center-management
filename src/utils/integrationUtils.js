import { format } from 'date-fns';

/**
 * Backup logs to Google Sheets via Webhook
 * @param {string} webhookUrl - Google Apps Script Webhook URL
 * @param {Array} logs - Raw logs
 * @param {Array} users - User list for name mapping
 * @param {Array} locations - Location list for name mapping
 */
export const backupLogsToGoogleSheets = async (webhookUrl, logs, users, locations) => {
    if (!webhookUrl) throw new Error('Google Sheets Webhook URL이 설정되지 않았습니다.');

    const formattedData = logs.map(log => {
        const user = users.find(u => u.id === log.user_id);
        const location = locations.find(l => l.id === log.location_id);

        let typeLabel = '';
        switch (log.type) {
            case 'CHECKIN': typeLabel = '입실'; break;
            case 'CHECKOUT': typeLabel = '퇴실'; break;
            case 'MOVE': typeLabel = '이동'; break;
            default: typeLabel = log.type;
        }

        return {
            timestamp: format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
            userName: user ? user.name : '알 수 없음',
            userGroup: user ? user.user_group : '-',
            type: typeLabel,
            location: location ? location.name : '-'
        };
    });

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            mode: 'no-cors', // Apps Script often requires no-cors for simple webhooks
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ logs: formattedData })
        });
        return { success: true };
    } catch (error) {
        console.error('Google Sheets Backup Error:', error);
        throw error;
    }
};

/**
 * Upload daily summary to Notion
 * @param {string} apiKey - Notion API Key (Internal Integration Token)
 * @param {string} databaseId - Notion Database ID
 * @param {Object} summaryData - Processed summary data from analyticsUtils
 */
export const uploadSummaryToNotion = async (apiKey, databaseId, summaryData) => {
    if (!apiKey || !databaseId) throw new Error('Notion API 설정이 부족합니다.');

    // Note: This requires a proxy or a serverless function if calling directly from browser 
    // because Notion API doesn't support CORS from browsers.
    // For now, we will assume the user might use a simple relay or we provide the structure.
    // In a real Netlify/Vite environment, we'd use a Netlify Function.

    // We'll prepare the payload first.
    const today = format(new Date(), 'yyyy-MM-dd');
    const dayStats = summaryData.timeSeries.find(d => d.date === today) || {
        visitCount: 0,
        activeUsers: 0,
        totalDuration: 0
    };

    const payload = {
        parent: { database_id: databaseId },
        properties: {
            "날짜": {
                title: [{ text: { content: today } }]
            },
            "총 방문 횟수": {
                number: dayStats.visitCount || 0
            },
            "고유 방문자 수": {
                number: dayStats.activeUsers || 0
            },
            "총 이용 시간(분)": {
                number: Math.round(dayStats.totalDuration || 0)
            },
            "최고 인기 공간": {
                rich_text: [{ text: { content: summaryData.roomAnalysis[0]?.name || '-' } }]
            }
        }
    };

    try {
        // Direct call might fail due to CORS. 
        // Suggestion: Use a Netlify function if this is deployed on Netlify.
        const response = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Notion 업로드 실패');
        }

        return await response.json();
    } catch (error) {
        console.error('Notion Upload Error:', error);
        throw error;
    }
};
