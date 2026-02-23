const fs = require('fs');
const path = require('path');

// Load .env file only if it exists (for local development)
// Railway and other platforms will provide environment variables directly
try {
    const envPath = path.resolve(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
        require('dotenv').config({ path: envPath });
    }
} catch (err) {
    // Silent fail - environment variables may be set by platform
}

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    console.error('   SUPABASE_URL:', supabaseUrl ? '✓ Set' : '✗ Missing');
    console.error('   SUPABASE_KEY:', supabaseKey ? '✓ Set' : '✗ Missing');
    console.error('\n   For Railway deployment:');
    console.error('   1. Go to your Railway project dashboard');
    console.error('   2. Add SUPABASE_URL and SUPABASE_KEY environment variables');
    console.error('   3. Restart the deployment');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('✅ Supabase client initialized');
console.log('   Project: ' + supabaseUrl.replace('https://', '').split('.')[0]);

module.exports = { supabase };
