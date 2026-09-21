import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL || 'https://qpsquwvnxwkutirwyavk.supabase.co';
const publishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_jnMuLAnebPOnRuELNd4TFw_LjrzeOeT';

export const supabase = createClient(url, publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
