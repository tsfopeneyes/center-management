// Read-only verification of the standalone survey delivery schema.
import fs from 'node:fs/promises';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const local = dotenv.parse(await fs.readFile('.env.local', 'utf8'));
const legacy = dotenv.parse(await fs.readFile('.env', 'utf8'));
const supabase = createClient(
  local.VITE_SUPABASE_URL || legacy.VITE_SUPABASE_URL,
  local.VITE_SUPABASE_ANON_KEY || legacy.VITE_SUPABASE_ANON_KEY,
);

const { data, error } = await supabase
  .from('survey_links')
  .select('id,event,public_token,enabled,frequency')
  .eq('event', 'PUBLIC')
  .limit(10);
if (error) throw error;

const invalid = (data || []).filter(link => !link.public_token || link.frequency !== 'ONCE');
if (invalid.length) throw new Error('Invalid public survey link configuration found.');

console.log(JSON.stringify({
  readOnly: true,
  publicSurveySchemaReady: true,
  publicLinkCountSampled: data?.length || 0,
}, null, 2));
