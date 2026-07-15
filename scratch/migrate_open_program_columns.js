import pg from 'pg';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const dbPassword = 'tsf_openeyes_db_pw!';
const tenant = 'erecqalsxoxrufggvmcc';
const connectionString = `postgresql://postgres:${dbPassword}@db.${tenant}.supabase.co:5432/postgres`;

async function run() {
    console.log(`Connecting directly to db.${tenant}.supabase.co:5432...`);
    const client = new pg.Client({ 
        connectionString,
        connectionTimeoutMillis: 10000,
        ssl: { rejectUnauthorized: false }
    });
    
    try {
        await client.connect();
        console.log(`🎉 SUCCESS! Connected directly to Supabase DB!`);
        
        await client.query(`
            ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS host_ids UUID[] DEFAULT '{}';
            UPDATE public.notices SET host_ids = ARRAY[host_id] WHERE host_id IS NOT NULL AND (host_ids IS NULL OR host_ids = '{}');
            NOTIFY pgrst, 'reload schema';
        `);
        console.log("Migration query for host_ids executed successfully!");
        await client.end();
        console.log("Migration completed successfully!");
        process.exit(0);
    } catch (e) {
        console.error(`Direct connection failed:`, e);
        try { await client.end(); } catch(err) {}
        process.exit(1);
    }
}

run();
