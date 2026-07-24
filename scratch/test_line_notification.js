import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testLine() {
    const { data: settings } = await supabase.from('global_settings').select('*');
    let lineToken = '';
    let lineGroupId = '';
    let gsWebhookUrl = '';

    settings.forEach(s => {
        if (s.key === 'line_channel_access_token') lineToken = s.value;
        if (s.key === 'line_group_id') lineGroupId = s.value;
        if (s.key === 'gs_webhook_url') gsWebhookUrl = s.value;
    });

    console.log("Token:", lineToken ? "EXISTS (" + lineToken.slice(0, 15) + "...)" : "MISSING");
    console.log("Group ID:", lineGroupId);
    console.log("GS Webhook URL:", gsWebhookUrl);

    const testPayload = {
        action: 'LINE_NOTIFY',
        token: lineToken,
        to: lineGroupId,
        message: '[TEST CHECK-IN]\n💌 테스트 체크인 알림입니다.'
    };

    console.log("Sending payload to Google Apps Script Webhook:", testPayload);

    try {
        const res = await fetch(gsWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testPayload)
        });
        const text = await res.text();
        console.log("GAS Response Status:", res.status);
        console.log("GAS Response Text:", text);
    } catch (err) {
        console.error("Fetch Error:", err);
    }
}

testLine();
