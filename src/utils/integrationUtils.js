import { format } from 'date-fns';

/**
 * Generic Sync to Google Sheets
 * @param {string} webhookUrl 
 * @param {string} tabName - The name of the tab in Google Sheets
 * @param {Array} rows - Array of objects (data)
 * @param {Array} headers - Optional headers for first-time creation
 */
export const syncToGoogleSheets = async (webhookUrl, tabName, rows, headers = []) => {
    return await bulkSyncToGoogleSheets(webhookUrl, [{ tabName, rows, headers }]);
};

/**
 * Bulk Sync to Google Sheets (Multiple tabs in one request)
 * @param {string} webhookUrl 
 * @param {Array} payloads - Array of { tabName, rows, headers }
 */
export const bulkSyncToGoogleSheets = async (webhookUrl, payloads) => {
    if (!webhookUrl) throw new Error('Google Sheets Webhook URL이 설정되지 않았습니다.');

    try {
        await fetch(webhookUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ isBulk: true, payloads })
        });
        return { success: true };
    } catch (error) {
        console.error('Google Sheets Bulk Sync Error:', error);
        throw error;
    }
};

/**
 * Legacy wrapper for backward compatibility or convenience
 */
export const backupLogsToGoogleSheets = async (webhookUrl, logs, users, locations, notices) => {
    const formatted = logs.map(log => {
        const user = users.find(u => u.id === log.user_id);
        const location = locations.find(l => l.id === log.location_id);

        let targetName = location ? location.name : '-';
        if (log.type?.startsWith('PRG_')) {
            const notice = notices?.find(n => n.id === log.location_id);
            targetName = notice ? `[프로그램] ${notice.title}` : '삭제된 프로그램';
        }

        return {
            '일시': format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
            '이름': user ? user.name : '알 수 없음',
            '학교': user ? user.school : '-',
            '구분': log.type,
            '장소/프로그램': targetName
        };
    });

    return await syncToGoogleSheets(webhookUrl, '공간로그', formatted, ['일시', '이름', '학교', '구분', '장소/프로그램']);
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
