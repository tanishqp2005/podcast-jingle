import { GoogleGenerativeAI } from '@google/generative-ai';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface JinglePayload {
    podcast_name: string;
    theme: string;
    tone: string;
    musical_prompt: string;
    voice_over_script: string;
    musical_style: string;
    bpm: number;
    instruments: string[];
    mood_tags: string[];
    safety_check: 'PASS' | 'FAIL';
    supabase_action: string;
    generation_reasoning: string;
}

export interface GenerateJingleInput {
    podcastName: string;
    theme: string;
    tone: string;
}

// ─── Safety filter wordlist ───────────────────────────────────────────────────

const BLOCKED_TERMS = [
    'hate', 'violence', 'racist', 'sexist', 'explicit', 'adult', 'nsfw',
    'gore', 'kill', 'murder', 'abuse', 'drug', 'terror', 'extremi',
];

function safetyCheck(input: string): boolean {
    const normalized = input.toLowerCase();
    return !BLOCKED_TERMS.some((term) => normalized.includes(term));
}

// ─── Input sanitizer ─────────────────────────────────────────────────────────

function sanitize(str: string): string {
    return str
        .replace(/[<>{}|\\^`[\]]/g, '')  // strip dangerous chars
        .trim()
        .slice(0, 200);
}

function truncateName(name: string, maxLen = 30): string {
    const clean = sanitize(name);
    return clean.length > maxLen ? clean.slice(0, maxLen).trimEnd() + '…' : clean;
}

// ─── Main generation function ─────────────────────────────────────────────────

export async function generateJingle(
    input: GenerateJingleInput
): Promise<JinglePayload> {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
        throw new Error('Gemini API key not configured. Set NEXT_PUBLIC_GEMINI_API_KEY in .env.local');
    }

    // ── Sanitize inputs
    const podcastName = sanitize(input.podcastName) || 'My Podcast';
    const theme = sanitize(input.theme) || 'Generic Professional';
    const tone = sanitize(input.tone) || 'Professional';
    const voiceName = truncateName(podcastName);

    // ── Safety check
    const combinedInput = `${podcastName} ${theme} ${tone}`;
    if (!safetyCheck(combinedInput)) {
        throw new Error(
            'SAFETY_VIOLATION: Your input contains content that cannot be processed. Please use appropriate podcast topics.'
        );
    }

    // ── Build Gemini prompt
    const systemPrompt = `You are a world-class audio creative director specializing in podcast jingles.
Your task: Given a podcast's name, theme, and tone, generate a precise musical prompt and voice-over script for a 10–15 second jingle.

Chain-of-thought reasoning rules:
1. First, reason WHY a specific BPM, bassline style, and instrument set fits the given tone + theme.
2. Then produce the final compact JSON.
3. Voice-over must naturally incorporate the podcast name (truncated to ≤30 chars) and fit in 3–8 spoken words.
4. Ensure the musical style is recognizable and professional (e.g., "Dark Techno 128 BPM" not just "techno").
5. BPM must be a number between 60 and 180.

Return ONLY valid compact JSON matching this exact structure (no markdown, no extra text):
{
  "reasoning": "<2-3 sentence chain-of-thought about why these choices fit the tone+theme>",
  "mp": "<full musical prompt: style, BPM, instruments, mood — 1 sentence>",
  "vo": "<voice-over script: 5-8 words max, includes podcast name>",
  "style": "<Musical Style Descriptor e.g. Dark Techno>",
  "bpm": <number>,
  "instruments": ["<inst1>", "<inst2>", "<inst3>"],
  "moods": ["<mood1>", "<mood2>", "<mood3>"]
}`;

    const userPrompt = `Podcast Name: "${voiceName}"
Theme: "${theme}"
Tone: "${tone}"`;

    // ── Call Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: {
            temperature: 0.85,
            topP: 0.95,
            maxOutputTokens: 600,
        },
    });

    const result = await model.generateContent([
        { text: systemPrompt },
        { text: userPrompt },
    ]);

    const rawText = result.response.text().trim();

    // ── Parse JSON (strip possible markdown fences)
    let cleaned = rawText;
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
    }

    let parsed: {
        reasoning: string;
        mp: string;
        vo: string;
        style: string;
        bpm: number;
        instruments: string[];
        moods: string[];
    };

    try {
        parsed = JSON.parse(cleaned);
    } catch {
        throw new Error(
            `Failed to parse Gemini response as JSON. Raw: ${rawText.slice(0, 200)}`
        );
    }

    // ── Validate & clamp BPM
    const bpm = Math.max(60, Math.min(180, Math.round(Number(parsed.bpm) || 120)));

    // ── Build SQL action string (for display / Supabase insert)
    const safeQuote = (s: string) => s.replace(/'/g, "''");
    const sqlAction = `INSERT INTO jingles (podcast_name, theme, tone, musical_style, voice_over_script, bpm) VALUES ('${safeQuote(voiceName)}', '${safeQuote(theme)}', '${safeQuote(tone)}', '${safeQuote(parsed.style || '')}', '${safeQuote(parsed.vo || '')}', ${bpm});`;

    return {
        podcast_name: voiceName,
        theme,
        tone,
        musical_prompt: parsed.mp || '',
        voice_over_script: parsed.vo || '',
        musical_style: parsed.style || '',
        bpm,
        instruments: Array.isArray(parsed.instruments) ? parsed.instruments.slice(0, 5) : [],
        mood_tags: Array.isArray(parsed.moods) ? parsed.moods.slice(0, 5) : [],
        safety_check: 'PASS',
        supabase_action: sqlAction,
        generation_reasoning: parsed.reasoning || '',
    };
}
