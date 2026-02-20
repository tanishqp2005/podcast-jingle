import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Gracefully handle missing credentials — the app still works;
// Supabase features are disabled with a clear console warning.
let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey &&
    supabaseUrl !== 'your_supabase_project_url_here' &&
    supabaseAnonKey !== 'your_supabase_anon_key_here') {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  console.warn('[Podcast Jingle] Supabase credentials not configured. ' +
    'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
}

export { supabase };

// ─── Types ──────────────────────────────────────────────────────────────────

export interface JingleRecord {
  id?: string;
  podcast_name: string;
  theme: string;
  tone: string;
  musical_prompt: string;
  voice_over_script: string;
  musical_style: string;
  bpm: number;
  instruments: string[];
  mood_tags: string[];
  safety_check: string;
  created_at?: string;
}

// ─── Jingles Table Helpers ───────────────────────────────────────────────────

/**
 * Insert a jingle record into Supabase.
 * Returns { data, error } — gracefully handles the no-supabase scenario.
 */
export async function insertJingle(record: JingleRecord) {
  if (!supabase) {
    console.warn('[Podcast Jingle] Supabase not configured — skipping persist.');
    return { data: null, error: { message: 'Supabase not configured' } };
  }

  const { data, error } = await supabase
    .from('jingles')
    .insert([record])
    .select()
    .single();

  return { data, error };
}

/**
 * Fetch the most recent N jingles (newest first).
 */
export async function fetchRecentJingles(limit = 10): Promise<JingleRecord[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('jingles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Podcast Jingle] fetchRecentJingles error:', error.message);
    return [];
  }

  return (data as JingleRecord[]) ?? [];
}
