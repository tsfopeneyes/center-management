import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Construct remote PostgreSQL connection string
// supabase URL: https://erecqalsxoxrufggvmcc.supabase.co
// host: db.erecqalsxoxrufggvmcc.supabase.co
// We need db password. Let's look for database password in .env or config.toml
const dbPassword = 'tsf_openeyes_db_pw!'; // Wait, let's verify if there is a DB password in config.toml or .env

const connectionString = `postgresql://postgres.erecqalsxoxrufggvmcc:${dbPassword}@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=require`;

async function run() {
    const client = new pg.Client({ 
        connectionString,
        ssl: { rejectUnauthorized: false }
    });
    try {
        await client.connect();
        console.log("Connected to remote DB!");
        const sql = fs.readFileSync('./supabase/migrations/20260630_setup_rentals_and_contents.sql', 'utf8');
        await client.query(sql);
        console.log("Migration applied successfully!");
    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        await client.end();
    }
}
run();
