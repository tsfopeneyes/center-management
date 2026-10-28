import { writeFile, appendFile, unlink } from 'node:fs/promises';
import path from 'node:path';

if (process.env.GITHUB_ACTIONS !== 'true' || !process.env.RUNNER_TEMP) throw Error('GitHub runner context required');
const credentialPath = path.join(process.env.RUNNER_TEMP, 'sci-center-firebase-service-account.json');
if (/[\r\n]/.test(credentialPath)) throw Error('Invalid runner temporary path');
if (process.argv.includes('--cleanup')) {
    await unlink(credentialPath).catch(error => { if (error.code !== 'ENOENT') throw error; });
} else {
    let credential;
    try { credential = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || ''); }
    catch { throw Error('Firebase service account secret is missing or invalid'); }
    if (credential.type !== 'service_account' || credential.project_id !== 'sci-center-6f265'
        || typeof credential.private_key !== 'string' || !credential.private_key
        || typeof credential.client_email !== 'string' || !credential.client_email.endsWith('.gserviceaccount.com')
        || !process.env.GITHUB_ENV) throw Error('Firebase service account target or runner environment is invalid');
    await writeFile(credentialPath,JSON.stringify(credential),{mode:0o600});
    await appendFile(process.env.GITHUB_ENV,`GOOGLE_APPLICATION_CREDENTIALS=${credentialPath}\n`);
    console.log('Firebase credentials prepared for sci-center-6f265.');
}
