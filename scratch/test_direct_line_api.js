import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testDirectLineMessagingApi() {
    const { data: settings } = await supabase.from('global_settings').select('*');
    let lineToken = '';
    let lineGroupId = '';

    settings.forEach(s => {
        if (s.key === 'line_channel_access_token') lineToken = s.value;
        if (s.key === 'line_group_id') lineGroupId = s.value;
    });

    console.log("Token:", lineToken);
    console.log("Group ID:", lineGroupId);

    // Call LINE Messaging API push endpoint directly
    try {
        const res = await fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${lineToken}`
            },
            body: JSON.stringify({
                to: lineGroupId,
                messages: [
                    {
                        type: 'text',
                        text: '🔔 [DIAGNOSTIC TEST]\n라인 알림 직발송 테스트입니다.'
                    }
                ]
            })
        });

        console.log("LINE Messaging API Response Status:", res.status);
        const data = await res.json();
        console.log("LINE Messaging API Response Body:", data);
    } catch (err) {
        console.error("Direct LINE API Error:", err);
    }
}

testDirectLineMessagingApi();
