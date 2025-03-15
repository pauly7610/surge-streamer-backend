import { createClient } from '@supabase/supabase-js';
import config from '../config';

// Initialize the Supabase client
export const supabase = createClient(
  config.supabase.url,
  config.supabase.key
);

// Service role client for admin operations
export const supabaseAdmin = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey
); 