import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testSurveyLine() {
    const { data: settings } = await supabase.from('global_settings').select('*');
    let lineToken = '';
    let lineGroupId = '';
    let gsWebhookUrl = '';

    settings.forEach(s => {
        if (s.key === 'line_channel_access_token') lineToken = s.value;
        if (s.key === 'line_group_id') lineGroupId = s.value;
        if (s.key === 'gs_webhook_url') gsWebhookUrl = s.value;
    });

    const timeStr = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
    const surveyText = '\n▪ 스터디, 카페 이용';
    const message = `[CHECK-IN]\n💌 홍길동님이 하이픈에 방문했어요 (${timeStr})${surveyText}`;

    const testPayload = {
        action: 'LINE_NOTIFY',
        token: lineToken,
        to: lineGroupId,
        message: message
    };

    console.log("Sending survey LINE payload:", testPayload);

    try {
        const res = await fetch(gsWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(testPayload)
        });
        const text = await res.text();
        console.log("GAS Response Text:", text);
    } catch (err) {
        console.error("Fetch Error:", err);
    }
}

testSurveyLine();
