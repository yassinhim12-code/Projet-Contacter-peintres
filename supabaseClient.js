import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('تحذير: متغيرات Supabase غير مضبوطة (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});
