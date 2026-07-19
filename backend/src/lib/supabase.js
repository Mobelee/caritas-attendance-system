import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

// Service-role key — server-side only, bypasses RLS. Never expose to the frontend.
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)
