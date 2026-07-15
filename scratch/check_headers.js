import fetch from 'node-fetch';

async function run() {
    const url = 'https://erecqalsxoxrufggvmcc.supabase.co/rest/v1/';
    console.log(`Fetching headers from ${url}...`);
    try {
        const resp = await fetch(url);
        console.log("Status:", resp.status);
        console.log("Headers:");
        for (const [key, val] of resp.headers.entries()) {
            console.log(`  ${key}: ${val}`);
        }
    } catch (e) {
        console.error("Fetch failed:", e);
    }
}
run();
