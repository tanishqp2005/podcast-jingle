# 🎙 JingleForge — AI Podcast Intro Jingle Maker

> **Generate a unique 10–15 second podcast jingle and voice-over script in seconds, powered by Gemini AI and stored in Supabase.**

---

## ✨ Features

| Feature | Details |
|---|---|
| 🎵 **AI Musical Prompt** | Gemini synthesizes a detailed genre/style/BPM prompt tailored to your show |
| 🎙 **Voice-Over Script** | 5–8 word script that naturally incorporates your podcast name |
| 🔊 **In-Browser Audio** | Fully procedural Web Audio API synthesizer — no external audio files needed |
| 📊 **Animated Waveform** | Real-time waveform visualization during playback |
| 📦 **JSON Payload** | Copy the complete Supabase-ready payload with one click |
| 🛡 **Safety Filter** | Blocks inappropriate content before it reaches Gemini |
| 🗄 **Supabase Persistence** | All jingles saved to the `jingles` table; history shown on page |
| 🧠 **Chain-of-Thought** | Gemini reasons WHY a specific BPM/bassline fits the tone before generating |

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd podcast-jingle
npm install
```

### 2. Set Up Credentials

Copy or edit `.env.local`:

```env
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

**Get your Gemini API key:** https://aistudio.google.com/app/apikey  
**Get your Supabase credentials:** https://supabase.com/dashboard → Project Settings → API

### 3. Set Up Supabase Table

In your Supabase dashboard → **SQL Editor** → paste and run the contents of `supabase_migration.sql`.

This creates:
- `jingles` table with all required columns
- Row-Level Security policies for public read/insert
- Performance index on `created_at`

### 4. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) 🎉

---

## 📐 Architecture

```
src/
├── app/
│   ├── page.tsx          # Main UI (form, result, audio player, history)
│   ├── layout.tsx        # SEO metadata + font preconnect
│   └── globals.css       # Full design system (glassmorphism dark theme)
└── lib/
    ├── gemini.ts         # Gemini API integration + safety filter + prompt engineering
    ├── supabase.ts       # Supabase client + DB helpers (insertJingle, fetchRecentJingles)
    └── audioSynth.ts     # Web Audio API procedural jingle synthesizer
```

### Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Vanilla CSS (glassmorphism) |
| AI Engine | Google Gemini 1.5 Flash |
| Backend | Supabase (Auth + Database) |
| Audio | Web Audio API (procedural synthesis) |
| Fonts | Inter + Space Grotesk (Google Fonts) |

---

## 🧠 How It Works

### Step 1 — Input Parsing
User provides:
- **Podcast Name** (sanitized, truncated to 30 chars for voice-over)
- **Theme** (dropdown + custom option)
- **Tone** (multi-select chips, up to 4)

### Step 2 — Safety Filter
All inputs pass through a blocklist check before reaching Gemini. Offensive content is rejected with a clear error message.

### Step 3 — Gemini Chain-of-Thought
Gemini 1.5 Flash is prompted to:
1. **Reason** why a specific BPM, bassline, and instrument set fits the tone + theme
2. **Output** compact JSON with musical prompt, voice-over, style, BPM, instruments, and mood tags

### Step 4 — Data Persistence
On success, the payload is `INSERT`-ed into the Supabase `jingles` table.

### Step 5 — Audio Synthesis
The Web Audio API synthesizer generates a ~12s jingle in real-time using:
- Procedural melody (scale chosen by style profile)
- Bassline (one octave down, root-third-root-fifth pattern)
- Chord pad (sine oscillators with slight detune)
- Drum kit (kick, snare, hi-hat synthesized with noise + oscillators)
- Convolver reverb bus

---

## 🎯 Test Example

**Input:**
- Podcast Name: `The Quantum Byte`
- Theme: `Cybersecurity`
- Tone: `Serious`, `Fast-paced`

**Expected Output:**
```json
{
  "podcast_name": "The Quantum Byte",
  "theme": "Cybersecurity",
  "tone": "Serious, Fast-paced",
  "musical_style": "Dark Industrial Techno",
  "bpm": 128,
  "musical_prompt": "Dark industrial techno at 128 BPM with heavy synth bass, glitchy percussion, and tense pad swells.",
  "voice_over_script": "Secure your data. This is The Quantum Byte.",
  "instruments": ["Synth Bass", "Industrial Drums", "Glitch FX", "Pad"],
  "mood_tags": ["Tense", "Futuristic", "Commanding"],
  "safety_check": "PASS",
  "supabase_action": "INSERT INTO jingles ..."
}
```

---

## ⚠ Edge Cases Handled

| Situation | Behavior |
|---|---|
| Empty podcast name | Form validation — error shown, no API call |
| No theme selected | Defaults to `"Generic Professional"` |
| No tone selected | Defaults to `"Professional"` |
| Name > 30 chars | Truncated with `…` for voice-over script |
| Offensive input | Safety filter blocks, returns user-friendly error |
| Gemini non-JSON output | Parser strips markdown fences; throws descriptive error |
| Missing API key | Clear error shown in UI, logged to console |
| Supabase not configured | App works fully; Supabase write silently skipped |
| BPM out of range | Clamped to [60, 180] |

---

## 🗄 Supabase Schema

```sql
CREATE TABLE public.jingles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  podcast_name     TEXT NOT NULL,
  theme            TEXT NOT NULL,
  tone             TEXT NOT NULL,
  musical_prompt   TEXT,
  voice_over_script TEXT,
  musical_style    TEXT,
  bpm              INTEGER,
  instruments      TEXT[],
  mood_tags        TEXT[],
  safety_check     TEXT DEFAULT 'PASS',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🌐 Deployment (Vercel)

1. Push to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables:
   - `NEXT_PUBLIC_GEMINI_API_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy → get your live demo link ✅

---

## 📄 License

MIT — built for the AntiGravity Hackathon.
