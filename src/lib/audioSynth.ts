/**
 * Web Audio API synthesizer for podcast jingle playback.
 * Generates a 10–15s procedural jingle based on BPM and mood tags.
 * No external audio files required — entirely in-browser.
 */

type WaveType = OscillatorType;

interface NoteEvent {
    time: number;
    freq: number;
    duration: number;
    wave: WaveType;
    gain: number;
    detune?: number;
}

// ─── Frequency helpers ────────────────────────────────────────────────────────

const NOTE_FREQS: Record<string, number> = {
    C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.0,
};

// ─── Style → scale + character mapping ───────────────────────────────────────

function getStyleProfile(style: string, tone: string): {
    scale: number[];
    wave: WaveType;
    bassWave: WaveType;
    reverbAmount: number;
} {
    const combined = (style + ' ' + tone).toLowerCase();

    if (combined.includes('dark') || combined.includes('crime') || combined.includes('serious')) {
        return {
            scale: [NOTE_FREQS.C4, NOTE_FREQS.D4, NOTE_FREQS.F4, NOTE_FREQS.G4, NOTE_FREQS.A4],
            wave: 'sawtooth',
            bassWave: 'square',
            reverbAmount: 0.6,
        };
    }
    if (combined.includes('jazz') || combined.includes('lo-fi') || combined.includes('chill')) {
        return {
            scale: [NOTE_FREQS.C4, NOTE_FREQS.E4, NOTE_FREQS.G4, NOTE_FREQS.A4, NOTE_FREQS.B4],
            wave: 'sine',
            bassWave: 'sine',
            reverbAmount: 0.7,
        };
    }
    if (combined.includes('energetic') || combined.includes('upbeat') || combined.includes('pop')) {
        return {
            scale: [NOTE_FREQS.C4, NOTE_FREQS.D4, NOTE_FREQS.E4, NOTE_FREQS.G4, NOTE_FREQS.A4, NOTE_FREQS.C5],
            wave: 'square',
            bassWave: 'sawtooth',
            reverbAmount: 0.3,
        };
    }
    if (combined.includes('techno') || combined.includes('electronic') || combined.includes('cyber')) {
        return {
            scale: [NOTE_FREQS.C4, NOTE_FREQS.D4, NOTE_FREQS.F4, NOTE_FREQS.G4, NOTE_FREQS.A4],
            wave: 'sawtooth',
            bassWave: 'sawtooth',
            reverbAmount: 0.4,
        };
    }
    // Default: professional/neutral
    return {
        scale: [NOTE_FREQS.C4, NOTE_FREQS.E4, NOTE_FREQS.G4, NOTE_FREQS.A4, NOTE_FREQS.C5],
        wave: 'sine',
        bassWave: 'triangle',
        reverbAmount: 0.45,
    };
}

// ─── Reverb impulse ───────────────────────────────────────────────────────────

function createReverb(ctx: AudioContext, duration: number, decay: number): ConvolverNode {
    const convolver = ctx.createConvolver();
    const length = ctx.sampleRate * duration;
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
        const data = impulse.getChannelData(ch);
        for (let i = 0; i < length; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
        }
    }
    convolver.buffer = impulse;
    return convolver;
}

// ─── Note scheduler ───────────────────────────────────────────────────────────

function scheduleNote(
    ctx: AudioContext,
    destination: AudioNode,
    event: NoteEvent
) {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = event.wave;
    osc.frequency.setValueAtTime(event.freq, ctx.currentTime + event.time);
    if (event.detune) osc.detune.setValueAtTime(event.detune, ctx.currentTime + event.time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3000, ctx.currentTime + event.time);
    filter.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + event.time + event.duration);

    gainNode.gain.setValueAtTime(0, ctx.currentTime + event.time);
    gainNode.gain.linearRampToValueAtTime(event.gain, ctx.currentTime + event.time + 0.02);
    gainNode.gain.setValueAtTime(event.gain, ctx.currentTime + event.time + event.duration - 0.05);
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + event.time + event.duration);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(destination);

    osc.start(ctx.currentTime + event.time);
    osc.stop(ctx.currentTime + event.time + event.duration);
}

// ─── Kick drum synthesizer ────────────────────────────────────────────────────

function scheduleKick(ctx: AudioContext, destination: AudioNode, time: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(150, ctx.currentTime + time);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + time + 0.15);
    gain.gain.setValueAtTime(0.9, ctx.currentTime + time);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + time + 0.3);
    osc.connect(gain);
    gain.connect(destination);
    osc.start(ctx.currentTime + time);
    osc.stop(ctx.currentTime + time + 0.35);
}

// ─── Snare synthesizer ───────────────────────────────────────────────────────

function scheduleSnare(ctx: AudioContext, destination: AudioNode, time: number) {
    const bufLen = ctx.sampleRate * 0.12;
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1);

    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3000;
    filter.Q.value = 0.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, ctx.currentTime + time);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + time + 0.12);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    noise.start(ctx.currentTime + time);
    noise.stop(ctx.currentTime + time + 0.15);
}

// ─── Hi-hat synthesizer ──────────────────────────────────────────────────────

function scheduleHihat(ctx: AudioContext, destination: AudioNode, time: number, open = false) {
    const bufLen = ctx.sampleRate * (open ? 0.3 : 0.05);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1);

    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, ctx.currentTime + time);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + time + bufLen / ctx.sampleRate);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    noise.start(ctx.currentTime + time);
    noise.stop(ctx.currentTime + time + bufLen / ctx.sampleRate + 0.01);
}

// ─── Public API ───────────────────────────────────────────────────────────────

let activeCtx: AudioContext | null = null;

export function stopAudio() {
    if (activeCtx) {
        activeCtx.close();
        activeCtx = null;
    }
}

export async function playJingle(params: {
    bpm: number;
    musicalStyle: string;
    tone: string;
    durationSeconds?: number;
    onTimeUpdate?: (elapsed: number, total: number) => void;
}): Promise<void> {
    stopAudio();

    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    activeCtx = ctx;

    const { bpm, musicalStyle, tone, durationSeconds = 12 } = params;
    const beatDuration = 60 / bpm;
    const profile = getStyleProfile(musicalStyle, tone);

    // ── Routing ──────────────────────────────────────────────────
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.75;

    const reverb = createReverb(ctx, 2.5, 3.5);
    const dryGain = ctx.createGain();
    const wetGain = ctx.createGain();
    dryGain.gain.value = 1 - profile.reverbAmount;
    wetGain.gain.value = profile.reverbAmount;

    masterGain.connect(dryGain);
    masterGain.connect(reverb);
    reverb.connect(wetGain);
    dryGain.connect(ctx.destination);
    wetGain.connect(ctx.destination);

    // Drum bus (no reverb)
    const drumBus = ctx.createGain();
    drumBus.gain.value = 0.8;
    drumBus.connect(ctx.destination);

    // ── Generate melody ───────────────────────────────────────────
    const scale = profile.scale;
    const bars = Math.floor(durationSeconds / (beatDuration * 4));

    // Melody line
    for (let bar = 0; bar < bars; bar++) {
        const barStart = bar * beatDuration * 4;
        for (let beat = 0; beat < 4; beat++) {
            if (Math.random() < 0.7) {
                const noteIdx = Math.floor(Math.random() * scale.length);
                const step = barStart + beat * beatDuration;
                scheduleNote(ctx, masterGain, {
                    time: step,
                    freq: scale[noteIdx],
                    duration: beatDuration * (Math.random() < 0.3 ? 2 : 1) * 0.9,
                    wave: profile.wave,
                    gain: 0.18 + Math.random() * 0.06,
                });
            }
        }
    }

    // ── Bass line ─────────────────────────────────────────────────
    const bassScale = scale.map((f) => f / 2); // one octave down
    for (let bar = 0; bar < bars; bar++) {
        const barStart = bar * beatDuration * 4;
        const pattern = [0, 2, 0, 3]; // root-third-root-fifth pattern
        for (let beat = 0; beat < 4; beat++) {
            const step = barStart + beat * beatDuration;
            scheduleNote(ctx, masterGain, {
                time: step,
                freq: bassScale[pattern[beat] % bassScale.length],
                duration: beatDuration * 0.85,
                wave: profile.bassWave,
                gain: 0.22,
            });
        }
    }

    // ── Chord pad ─────────────────────────────────────────────────
    const chordRoot = scale[0];
    for (let bar = 0; bar < bars; bar++) {
        const chordTime = bar * beatDuration * 4;
        [chordRoot, chordRoot * 1.25, chordRoot * 1.5].forEach((freq) => {
            scheduleNote(ctx, masterGain, {
                time: chordTime,
                freq,
                duration: beatDuration * 3.8,
                wave: 'sine',
                gain: 0.06,
                detune: Math.random() * 6 - 3,
            });
        });
    }

    // ── Drums ─────────────────────────────────────────────────────
    for (let bar = 0; bar < bars; bar++) {
        const barStart = bar * beatDuration * 4;
        // Kick: beats 1 & 3
        [0, 2].forEach((b) => scheduleKick(ctx, drumBus, barStart + b * beatDuration));
        // Snare: beats 2 & 4
        [1, 3].forEach((b) => scheduleSnare(ctx, drumBus, barStart + b * beatDuration));
        // Hi-hats: every 8th note
        for (let i = 0; i < 8; i++) {
            scheduleHihat(ctx, drumBus, barStart + i * beatDuration * 0.5, i === 7);
        }
    }

    // ── Fade out ──────────────────────────────────────────────────
    masterGain.gain.setValueAtTime(0.75, ctx.currentTime + durationSeconds - 1.5);
    masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + durationSeconds);
    drumBus.gain.setValueAtTime(0.8, ctx.currentTime + durationSeconds - 1.5);
    drumBus.gain.linearRampToValueAtTime(0, ctx.currentTime + durationSeconds);

    // ── Progress callback ─────────────────────────────────────────
    if (params.onTimeUpdate) {
        const interval = setInterval(() => {
            if (!activeCtx || activeCtx.state === 'closed') {
                clearInterval(interval);
                return;
            }
            const elapsed = ctx.currentTime;
            params.onTimeUpdate!(Math.min(elapsed, durationSeconds), durationSeconds);
            if (elapsed >= durationSeconds) clearInterval(interval);
        }, 100);
    }

    // ── Resolve when done ─────────────────────────────────────────
    return new Promise((resolve) => {
        setTimeout(() => {
            if (activeCtx === ctx) {
                ctx.close();
                activeCtx = null;
            }
            resolve();
        }, durationSeconds * 1000 + 200);
    });
}

// ─── Waveform data for visualization ─────────────────────────────────────────

export function generateWaveformData(bpm: number, bars = 32): number[] {
    const data: number[] = [];
    for (let i = 0; i < bars; i++) {
        const beatPhase = (i / bars) * Math.PI * 2 * (bpm / 60);
        const val = Math.abs(
            Math.sin(beatPhase * 0.7) * 0.5 +
            Math.sin(beatPhase * 1.3) * 0.3 +
            Math.random() * 0.2
        );
        data.push(Math.min(1, Math.max(0.08, val)));
    }
    return data;
}
