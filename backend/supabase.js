const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    console.error('   SUPABASE_URL:', supabaseUrl ? '✓ Set' : '✗ Missing');
    console.error('   SUPABASE_KEY:', supabaseKey ? '✓ Set' : '✗ Missing');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('✅ Supabase client initialized');
console.log('   Project: ' + supabaseUrl.replace('https://', '').split('.')[0]);

module.exports = { supabase };
