import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
transformSync(readFileSync('supabase/functions/send-recruitment-alerts/index.ts','utf8'),{loader:'ts'});
console.log('PASS notification worker syntax');
