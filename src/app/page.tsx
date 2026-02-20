'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { generateJingle, JinglePayload } from '@/lib/gemini';
import { insertJingle, fetchRecentJingles, JingleRecord } from '@/lib/supabase';
import { playJingle, stopAudio, generateWaveformData } from '@/lib/audioSynth';

// ─── Constants ───────────────────────────────────────────────────────────────

const TONES = [
  'Energetic', 'Professional', 'Serious', 'Playful', 'Dark',
  'Inspirational', 'Mysterious', 'Comedic', 'Fast-paced', 'Calm',
];

const THEMES = [
  'Technology', 'True Crime', 'Cybersecurity', 'Business', 'Health & Wellness',
  'Comedy', 'Education', 'Sports', 'Finance', 'Science', 'Pop Culture',
  'Politics', 'History', 'Self-Help', 'Gaming',
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function WaveformBar({ height, active }: { height: number; active: boolean }) {
  return (
    <div
      className="wave-bar"
      style={{
        height: `${height * 38}px`,
        opacity: active ? 1 : 0.45,
        background: active
          ? 'linear-gradient(to top, #8b5cf6, #d946ef)'
          : 'linear-gradient(to top, #4c1d95, #7e22ce)',
        transition: 'height 0.15s ease, opacity 0.3s ease',
      }}
    />
  );
}

interface ToastItem { id: number; type: 'success' | 'error' | 'info'; msg: string }

function Toast({ items }: { items: ToastItem[] }) {
  const icons = { success: '✓', error: '✕', info: '◆' };
  return (
    <div className="toast-area">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span>{icons[t.type]}</span>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ─── JSON syntax highlighter ─────────────────────────────────────────────────

function highlightJSON(json: string): string {
  return json
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        if (/^"/.test(match)) {
          if (/:$/.test(match)) return `<span class="json-key">${match}</span>`;
          return `<span class="json-str">${match}</span>`;
        }
        if (/true|false/.test(match)) return `<span class="json-bool">${match}</span>`;
        if (/null/.test(match)) return `<span class="json-bool">${match}</span>`;
        return `<span class="json-num">${match}</span>`;
      });
}

// ─── History card ─────────────────────────────────────────────────────────────

function HistoryCard({ item }: { item: JingleRecord }) {
  const timeAgo = (dateStr?: string) => {
    if (!dateStr) return 'just now';
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <div className="history-card">
      <div className="history-name">{item.podcast_name}</div>
      <div className="history-script">"{item.voice_over_script}"</div>
      <div className="history-footer">
        <span className="history-style-badge">{item.musical_style} · {item.bpm} BPM</span>
        <span className="history-time">{timeAgo(item.created_at)}</span>
      </div>
    </div>
  );
}

// ─── Main page component ─────────────────────────────────────────────────────

export default function PodcastJinglePage() {
  // Form state
  const [podcastName, setPodcastName] = useState('');
  const [theme, setTheme] = useState('');
  const [customTheme, setCustomTheme] = useState('');
  const [tones, setTones] = useState<string[]>([]);

  // App state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<JinglePayload | null>(null);
  const [error, setError] = useState('');
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastIdRef = useRef(0);

  // Audio state
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0); // 0–1
  const [waveData, setWaveData] = useState<number[]>([]);

  // History
  const [history, setHistory] = useState<JingleRecord[]>([]);
  const [copiedJSON, setCopiedJSON] = useState(false);

  // Step tracking
  const step = result ? 3 : loading ? 2 : 1;

  // ── Toast helper ────────────────────────────────────────────────────────────
  const showToast = useCallback((type: ToastItem['type'], msg: string) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, type, msg }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  // ── Load history on mount ────────────────────────────────────────────────────
  useEffect(() => {
    fetchRecentJingles(8).then(setHistory);
  }, []);

  // ── Toggle tone ─────────────────────────────────────────────────────────────
  const toggleTone = (tone: string) => {
    setTones((prev) =>
      prev.includes(tone) ? prev.filter((t) => t !== tone) : [...prev, tone].slice(0, 4)
    );
  };

  // ── Effective theme ─────────────────────────────────────────────────────────
  const effectiveTheme = theme === '__custom__' ? customTheme : theme;
  const effectiveTone = tones.length > 0 ? tones.join(', ') : 'Professional';

  // ── Generate ────────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!podcastName.trim()) {
      showToast('error', 'Please enter a podcast name.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);
    stopAudio();
    setIsPlaying(false);
    setAudioProgress(0);

    try {
      // 1. Call Gemini
      const payload = await generateJingle({
        podcastName: podcastName.trim(),
        theme: effectiveTheme || 'Generic Professional',
        tone: effectiveTone,
      });

      setResult(payload);
      setWaveData(generateWaveformData(payload.bpm, 48));
      showToast('success', 'Jingle generated! ✨');

      // 2. Persist to Supabase
      const { error: dbError } = await insertJingle({
        podcast_name: payload.podcast_name,
        theme: payload.theme,
        tone: payload.tone,
        musical_prompt: payload.musical_prompt,
        voice_over_script: payload.voice_over_script,
        musical_style: payload.musical_style,
        bpm: payload.bpm,
        instruments: payload.instruments,
        mood_tags: payload.mood_tags,
        safety_check: payload.safety_check,
      });

      if (dbError && dbError.message !== 'Supabase not configured') {
        showToast('info', `Supabase: ${dbError.message}`);
      } else if (!dbError) {
        showToast('success', 'Saved to Supabase ✓');
        // Refresh history
        fetchRecentJingles(8).then(setHistory);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error occurred';
      if (msg.startsWith('SAFETY_VIOLATION')) {
        setError('⚠ Safety filter triggered: ' + msg.replace('SAFETY_VIOLATION: ', ''));
        showToast('error', 'Content blocked by safety filter.');
      } else if (msg.includes('API key')) {
        setError('🔑 ' + msg);
        showToast('error', 'API key error — check .env.local');
      } else {
        setError(msg);
        showToast('error', 'Generation failed. Check console.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Play / Stop ─────────────────────────────────────────────────────────────
  const handlePlayStop = async () => {
    if (!result) return;

    if (isPlaying) {
      stopAudio();
      setIsPlaying(false);
      setAudioProgress(0);
      return;
    }

    setIsPlaying(true);
    setAudioProgress(0);

    try {
      await playJingle({
        bpm: result.bpm,
        musicalStyle: result.musical_style,
        tone: result.tone,
        durationSeconds: 12,
        onTimeUpdate: (elapsed, total) => {
          setAudioProgress(elapsed / total);
          // Animate waveform based on progress
          setWaveData(generateWaveformData(result.bpm + Math.sin(elapsed) * 2, 48));
        },
      });
    } finally {
      setIsPlaying(false);
      setAudioProgress(0);
    }
  };

  // ── Copy JSON ───────────────────────────────────────────────────────────────
  const handleCopyJSON = () => {
    if (!result) return;
    const jsonStr = JSON.stringify(result, null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
      setCopiedJSON(true);
      setTimeout(() => setCopiedJSON(false), 2000);
      showToast('success', 'JSON copied to clipboard!');
    });
  };

  // ── Char counter color ───────────────────────────────────────────────────────
  const nameLen = podcastName.length;
  const nameCounterClass = nameLen > 40 ? 'over' : nameLen > 28 ? 'warn' : '';

  // ── Build pretty JSON for display ───────────────────────────────────────────
  const displayJSON = result
    ? JSON.stringify(
      {
        podcast_name: result.podcast_name,
        theme: result.theme,
        tone: result.tone,
        musical_style: result.musical_style,
        bpm: result.bpm,
        musical_prompt: result.musical_prompt,
        voice_over_script: result.voice_over_script,
        instruments: result.instruments,
        mood_tags: result.mood_tags,
        safety_check: result.safety_check,
        supabase_action: result.supabase_action,
      },
      null,
      2
    )
    : '';

  // ── Waveform active threshold ────────────────────────────────────────────────
  const activeIdx = Math.floor(audioProgress * waveData.length);

  return (
    <div className="app-container">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="header">
        <div className="header-inner">
          <a href="#" className="logo">
            <div className="logo-icon">🎙</div>
            <span className="logo-text">JingleForge</span>
          </a>
          <span className="header-badge">Powered by Gemini</span>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="hero">
        <div className="hero-tag">
          <span className="hero-tag-dot" />
          AI-Powered Podcast Jingle Maker
        </div>
        <h1 className="hero-title">
          Your Podcast Deserves a<br />
          <span className="gradient-text">Signature Sound</span>
        </h1>
        <p className="hero-subtitle">
          Transform your podcast name, theme, and tone into a unique 10–15 second jingle
          and voice-over script — powered by Gemini AI and stored in Supabase.
        </p>
      </section>

      {/* ── Step Indicator ─────────────────────────────────────── */}
      <div style={{ padding: '0 2rem 1rem' }}>
        <div className="steps-row">
          {[
            { n: 1, label: 'Input' },
            { n: 2, label: 'Generate' },
            { n: 3, label: 'Preview' },
          ].map(({ n, label }, i, arr) => (
            <div key={n} className="step-item" style={{ flex: i < arr.length - 1 ? undefined : '0 0 auto' }}>
              <div className={`step-dot ${step > n ? 'done' : step === n ? 'active' : ''}`}>
                {step > n ? '✓' : n}
              </div>
              <span className={`step-label ${step > n ? 'done' : step === n ? 'active' : ''}`}>
                {label}
              </span>
              {i < arr.length - 1 && (
                <div className={`step-line ${step > n ? 'done' : ''}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Main Content ───────────────────────────────────────── */}
      <main className="main-section">
        <div className="two-col">
          {/* ── Left: Input Form ─────────────────────────── */}
          <div className="glass-card">
            <div className="card-header">
              <div className="card-icon">🎤</div>
              <div>
                <div className="card-title">Podcast Details</div>
                <div className="card-desc">Tell us about your show</div>
              </div>
            </div>

            {/* Podcast Name */}
            <div className="form-group">
              <label className="form-label" htmlFor="podcast-name">Podcast Name *</label>
              <input
                id="podcast-name"
                type="text"
                className="form-input"
                placeholder="e.g. The Quantum Byte"
                value={podcastName}
                onChange={(e) => setPodcastName(e.target.value)}
                maxLength={60}
                disabled={loading}
              />
              <div className={`char-counter ${nameCounterClass}`}>
                {nameLen}/30 chars {nameLen > 30 && '· Name will be truncated to 30 chars for voice-over'}
              </div>
            </div>

            {/* Theme */}
            <div className="form-group">
              <label className="form-label" htmlFor="podcast-theme">Theme / Genre</label>
              <select
                id="podcast-theme"
                className="form-select"
                value={theme}
                onChange={(e) => { setTheme(e.target.value); if (e.target.value !== '__custom__') setCustomTheme(''); }}
                disabled={loading}
              >
                <option value="">Select a theme…</option>
                {THEMES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
                <option value="__custom__">✏ Custom…</option>
              </select>
            </div>

            {/* Custom theme */}
            {theme === '__custom__' && (
              <div className="form-group">
                <label className="form-label" htmlFor="custom-theme">Custom Theme</label>
                <input
                  id="custom-theme"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Paranormal Investigations"
                  value={customTheme}
                  onChange={(e) => setCustomTheme(e.target.value)}
                  maxLength={80}
                  disabled={loading}
                />
              </div>
            )}

            {/* Tone chips */}
            <div className="form-group">
              <label className="form-label">Tone (pick up to 4)</label>
              <div className="tone-chips">
                {TONES.map((t) => (
                  <button
                    key={t}
                    id={`tone-${t.toLowerCase()}`}
                    className={`tone-chip ${tones.includes(t) ? 'active' : ''}`}
                    onClick={() => toggleTone(t)}
                    disabled={loading}
                    type="button"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate button */}
            <button
              id="generate-jingle-btn"
              className={`generate-btn ${loading ? 'loading' : ''}`}
              onClick={handleGenerate}
              disabled={loading}
              type="button"
            >
              {loading ? (
                <>
                  <div className="spinner" />
                  Composing with Gemini…
                </>
              ) : (
                <>
                  ✨ Generate My Jingle
                </>
              )}
            </button>

            {/* Error */}
            {error && (
              <div className="error-box" id="error-message">
                <span>⚠</span>
                <span>{error}</span>
              </div>
            )}

            {/* Safety / feature hints */}
            <div className="safety-row">
              <span className="safety-item">🛡 Safety filtered</span>
              <span className="safety-item">⚡ Gemini 1.5 Flash</span>
              <span className="safety-item">📦 Supabase backed</span>
            </div>
          </div>

          {/* ── Right: Result Panel ──────────────────────── */}
          <div>
            {!result && !loading && (
              <div className="glass-card">
                <div className="empty-state">
                  <div className="empty-state-icon">🎵</div>
                  <div className="empty-state-text">
                    Fill in your podcast details on the left and hit<br />
                    <strong style={{ color: '#a78bfa' }}>Generate My Jingle</strong> to create a<br />
                    unique musical prompt and voice-over script.
                  </div>
                </div>
              </div>
            )}

            {loading && (
              <div className="glass-card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '1rem', animation: 'pulse-dot 1s ease-in-out infinite' }}>🎵</div>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '1rem', marginBottom: '0.5rem', color: '#a78bfa' }}>
                  Crafting your signature sound…
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Gemini is reasoning about BPM, bassline, and style
                </div>
                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                  <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
                </div>
              </div>
            )}

            {result && (
              <div className="result-section">
                {/* Header */}
                <div className="glass-card" style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <div className="result-tag">
                      <span>✓</span> Generated
                    </div>
                    <span className="bpm-badge">♩ {result.bpm} BPM</span>
                  </div>

                  {/* Metadata grid */}
                  <div className="meta-grid">
                    <div className="meta-item">
                      <div className="meta-label">Podcast</div>
                      <div className="meta-value">{result.podcast_name}</div>
                    </div>
                    <div className="meta-item">
                      <div className="meta-label">Style</div>
                      <div className="meta-value accent">{result.musical_style}</div>
                    </div>
                    <div className="meta-item">
                      <div className="meta-label">Tone</div>
                      <div className="meta-value">{result.tone}</div>
                    </div>
                    <div className="meta-item">
                      <div className="meta-label">Safety</div>
                      <div className="meta-value" style={{ color: '#6ee7b7' }}>✓ {result.safety_check}</div>
                    </div>
                  </div>

                  {/* Instruments & moods */}
                  {result.instruments.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                      {result.instruments.map((inst) => (
                        <span key={inst} style={{
                          fontSize: '0.72rem', padding: '3px 8px', borderRadius: 12,
                          background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)',
                          color: '#67e8f9', fontWeight: 600,
                        }}>{inst}</span>
                      ))}
                      {result.mood_tags.map((m) => (
                        <span key={m} style={{
                          fontSize: '0.72rem', padding: '3px 8px', borderRadius: 12,
                          background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)',
                          color: '#fcd34d', fontWeight: 600,
                        }}>{m}</span>
                      ))}
                    </div>
                  )}

                  {/* Musical Prompt */}
                  <div className="prompt-box">
                    <div className="prompt-label">🎼 Musical Prompt</div>
                    <div className="prompt-text">{result.musical_prompt}</div>
                  </div>

                  {/* Voice-over */}
                  <div className="voiceover-box">
                    <div className="voiceover-label">🎙 Voice-Over Script</div>
                    <div className="voiceover-text">"{result.voice_over_script}"</div>
                  </div>

                  {/* Reasoning (collapsible) */}
                  {result.generation_reasoning && (
                    <details style={{ marginTop: '0.75rem' }}>
                      <summary style={{ fontSize: '0.78rem', color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}>
                        🧠 Gemini Reasoning
                      </summary>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.5rem', lineHeight: 1.6, fontStyle: 'italic' }}>
                        {result.generation_reasoning}
                      </p>
                    </details>
                  )}
                </div>

                {/* Audio Player */}
                <div className="glass-card" style={{ marginBottom: '1rem' }}>
                  <div className="card-header">
                    <div className="card-icon">🔊</div>
                    <div>
                      <div className="card-title">Jingle Preview</div>
                      <div className="card-desc">Synthesized via Web Audio API · ~12s</div>
                    </div>
                  </div>
                  <div className="audio-player">
                    <div className="audio-controls">
                      <button
                        id="play-jingle-btn"
                        className="play-btn"
                        onClick={handlePlayStop}
                        type="button"
                        title={isPlaying ? 'Stop' : 'Play'}
                      >
                        {isPlaying ? '⏹' : '▶'}
                      </button>
                      <div className="audio-waveform">
                        {waveData.map((h, i) => (
                          <WaveformBar
                            key={i}
                            height={h}
                            active={isPlaying && i <= activeIdx}
                          />
                        ))}
                      </div>
                    </div>
                    {isPlaying && (
                      <div style={{ marginTop: '10px', height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          background: 'linear-gradient(90deg, #8b5cf6, #d946ef)',
                          width: `${audioProgress * 100}%`,
                          transition: 'width 0.1s linear',
                          borderRadius: '2px',
                        }} />
                      </div>
                    )}
                  </div>
                </div>

                {/* JSON Payload */}
                <div className="glass-card">
                  <div className="card-header" style={{ justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="card-icon">📦</div>
                      <div>
                        <div className="card-title">JSON Payload</div>
                        <div className="card-desc">Supabase-ready output</div>
                      </div>
                    </div>
                    <button id="copy-json-btn" className="copy-btn" onClick={handleCopyJSON} type="button">
                      {copiedJSON ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                  <div
                    className="json-block"
                    dangerouslySetInnerHTML={{ __html: highlightJSON(displayJSON) }}
                  />

                  {/* SQL action */}
                  <div style={{ marginTop: '1rem' }}>
                    <div className="prompt-label" style={{ color: '#6ee7b7', marginBottom: 6, fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      🗄 Supabase Action
                    </div>
                    <code style={{
                      display: 'block', background: '#080816', border: '1px solid var(--border)',
                      borderRadius: 8, padding: '10px 12px', fontSize: '0.72rem', color: '#6ee7b7',
                      lineHeight: 1.6, wordBreak: 'break-all', fontFamily: 'Courier New, monospace',
                    }}>
                      {result.supabase_action}
                    </code>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── History Section ─────────────────────────────────────── */}
      <section className="history-section">
        <div className="divider" />
        <div className="section-header">
          <h2 className="section-title">
            📚 Recent Jingles
          </h2>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {history.length > 0 ? `${history.length} saved` : 'from Supabase'}
          </span>
        </div>

        {history.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-text">
              No jingle history yet.<br />
              {!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL === 'your_supabase_project_url_here'
                ? 'Configure Supabase credentials in .env.local to enable history.'
                : 'Generate your first jingle to see it here!'}
            </div>
          </div>
        ) : (
          <div className="history-grid">
            {history.map((item, i) => (
              <HistoryCard key={item.id ?? i} item={item} />
            ))}
          </div>
        )}
      </section>

      {/* ── Toasts ─────────────────────────────────────────────── */}
      <Toast items={toasts} />
    </div>
  );
}
