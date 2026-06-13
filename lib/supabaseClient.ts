import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const isValidUrl = (url: string) => {
  return url.startsWith('http://') || url.startsWith('https://');
};

const finalUrl = isValidUrl(supabaseUrl) ? supabaseUrl : 'https://placeholder.supabase.co';
const finalKey = supabaseAnonKey && supabaseAnonKey !== 'your_supabase_anon_key' ? supabaseAnonKey : 'placeholder-key';

if (!isValidUrl(supabaseUrl) || !supabaseAnonKey || supabaseAnonKey === 'your_supabase_anon_key') {
  console.warn(
    'Supabase environment variables are missing or set to placeholders. Using placeholder configuration for static compilation.'
  );
}

export const supabase = createClient(finalUrl, finalKey);
