-- Run this in your Supabase SQL Editor to create the jingles table.
-- Go to: https://supabase.com/dashboard → Your Project → SQL Editor → New Query → Paste & Run

CREATE TABLE IF NOT EXISTS public.jingles (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  podcast_name     TEXT NOT NULL,
  theme            TEXT NOT NULL DEFAULT 'Generic Professional',
  tone             TEXT NOT NULL DEFAULT 'Professional',
  musical_prompt   TEXT,
  voice_over_script TEXT,
  musical_style    TEXT,
  bpm              INTEGER CHECK (bpm BETWEEN 60 AND 180),
  instruments      TEXT[] DEFAULT '{}',
  mood_tags        TEXT[] DEFAULT '{}',
  safety_check     TEXT DEFAULT 'PASS',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row-Level Security
ALTER TABLE public.jingles ENABLE ROW LEVEL SECURITY;

-- Allow all reads (public history)
CREATE POLICY "Allow public read"
  ON public.jingles FOR SELECT
  USING (true);

-- Allow all inserts (no auth required for demo)
CREATE POLICY "Allow public insert"
  ON public.jingles FOR INSERT
  WITH CHECK (true);

-- (Optional) Index for fast recent-first queries
CREATE INDEX IF NOT EXISTS jingles_created_at_idx
  ON public.jingles (created_at DESC);
