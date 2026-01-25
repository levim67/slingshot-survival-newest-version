
// Audio Context Singleton
let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let globalFilter: BiquadFilterNode | null = null;
let bgmSource: AudioBufferSourceNode | null = null;
let bgmBuffer: AudioBuffer | null = null;

const IS_MUTED = false;

export const initAudio = async () => {
    if (ctx) return;

    // Create Context
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    // Master Chain
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.5; // Slightly louder master

    // Global Filter (for slow-mo underwater effect)
    globalFilter = ctx.createBiquadFilter();
    globalFilter.type = 'lowpass';
    globalFilter.frequency.value = 22000;
    globalFilter.Q.value = 1.0;

    masterGain.connect(globalFilter);
    globalFilter.connect(ctx.destination);

    // Busses
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.6;
    musicGain.connect(masterGain);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.8;
    sfxGain.connect(masterGain);

    // Load Custom Music
    try {
        const response = await fetch('https://raw.githubusercontent.com/levim67/slingshot-survival-assets/main/Quantum_Leap_2026-01-25T225144.mp3');
        const arrayBuffer = await response.arrayBuffer();
        bgmBuffer = await ctx.decodeAudioData(arrayBuffer);
        startMusic();
    } catch (e) {
        console.warn('Failed to load music:', e);
    }
};

const startMusic = () => {
    if (!ctx || !bgmBuffer || !musicGain) return;
    // Stop old if exists
    if (bgmSource) {
        try { bgmSource.stop(); } catch (e) { }
    }
    bgmSource = ctx.createBufferSource();
    bgmSource.buffer = bgmBuffer;
    bgmSource.loop = true;
    bgmSource.connect(musicGain);
    bgmSource.start(0);
};

export const updateAudioState = (timeScale: number, isHighEnergy: boolean) => {
    if (!ctx || !bgmSource || !globalFilter) return;

    const now = ctx.currentTime;

    let targetRate = timeScale;
    let targetFreq = 22000;

    if (isHighEnergy) {
        // High Energy: Faster, Higher Pitch, Open Filter
        targetRate = 1.15;
        targetFreq = 24000;
    } else {
        // Normal / Slow Mo Logic
        // Clamp to minimum 0.1 to prevent stopping completely
        targetRate = Math.max(0.1, timeScale);
        // Filter cutoff: 20k at full speed, 400Hz at slow speed (underwater feel)
        targetFreq = 400 + (20000 * Math.pow(timeScale, 3));
    }

    // Ramp playback rate
    bgmSource.playbackRate.setTargetAtTime(targetRate, now, 0.1);

    // Filter cutoff
    globalFilter.frequency.setTargetAtTime(targetFreq, now, 0.1);
};

export const updateGlobalTimeScale = (timeScale: number) => {
    updateAudioState(timeScale, false);
};

// --- PROCEDURAL MUSIC GENERATION (IMPROVED) ---
const generateSynthwaveLoop = async (actx: AudioContext): Promise<AudioBuffer> => {
    const duration = 6.4; // Slightly longer for 4 bars at 150BPM approx
    const sampleRate = actx.sampleRate;
    const offline = new OfflineAudioContext(2, sampleRate * duration, sampleRate);

    const tempo = 150;
    const secondsPerBeat = 60 / tempo;
    const sixteenth = secondsPerBeat / 4;
    const totalSixteenths = Math.floor(duration / sixteenth);

    // --- 1. KICK DRUM (Punchier) ---
    for (let i = 0; i < totalSixteenths; i += 4) { // Every beat
        const t = i * sixteenth;
        const osc = offline.createOscillator();
        const g = offline.createGain();

        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(50, t + 0.1);

        g.gain.setValueAtTime(1.0, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

        osc.connect(g).connect(offline.destination);
        osc.start(t);
        osc.stop(t + 0.2);
    }

    // --- 2. SNARE (Crisp Noise + Tone) ---
    for (let i = 4; i < totalSixteenths; i += 8) { // Beats 2 and 4
        const t = i * sixteenth;

        // Noise
        const noiseBuffer = offline.createBuffer(1, sampleRate * 0.2, sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let j = 0; j < noiseBuffer.length; j++) output[j] = Math.random() * 2 - 1;
        const noise = offline.createBufferSource();
        noise.buffer = noiseBuffer;

        const noiseFilter = offline.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = 1000;

        const noiseGain = offline.createGain();
        noiseGain.gain.setValueAtTime(0.6, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

        noise.connect(noiseFilter).connect(noiseGain).connect(offline.destination);
        noise.start(t);

        // Body Tone
        const osc = offline.createOscillator();
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.linearRampToValueAtTime(100, t + 0.1);
        const oscGain = offline.createGain();
        oscGain.gain.setValueAtTime(0.3, t);
        oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.connect(oscGain).connect(offline.destination);
        osc.start(t);
        osc.stop(t + 0.1);
    }

    // --- 3. BASSLINE (Driving Sawtooth) ---
    const bassOsc = offline.createOscillator();
    bassOsc.type = 'sawtooth';
    const bassFilter = offline.createBiquadFilter();
    bassFilter.type = 'lowpass';
    bassFilter.frequency.value = 400;
    bassFilter.Q.value = 2;
    const bassGain = offline.createGain();
    bassGain.gain.value = 0.3;

    bassOsc.connect(bassFilter).connect(bassGain).connect(offline.destination);
    bassOsc.start(0);
    bassOsc.stop(duration);

    // Sequence: E1 E1 E1 E1 G1 G1 A1 A1 (Root notes)
    // Rolling 16ths
    for (let i = 0; i < totalSixteenths; i++) {
        const t = i * sixteenth;

        // Note Selection
        let freq = 41.20; // E1
        if (i >= 32 && i < 48) freq = 49.00; // G1
        if (i >= 48) freq = 55.00; // A1

        bassOsc.frequency.setValueAtTime(freq, t);

        // Filter Envelope (Pluck)
        bassFilter.frequency.setValueAtTime(800, t);
        bassFilter.frequency.exponentialRampToValueAtTime(100, t + sixteenth * 0.9);

        // Sidechain ducking on kick
        if (i % 4 === 0) {
            bassGain.gain.cancelScheduledValues(t);
            bassGain.gain.setValueAtTime(0.05, t);
            bassGain.gain.linearRampToValueAtTime(0.3, t + sixteenth);
        }
    }

    // --- 4. ARPEGGIO (Square Wave) ---
    const arpOsc = offline.createOscillator();
    arpOsc.type = 'square';
    const arpGain = offline.createGain();
    arpGain.gain.value = 0.08;
    const arpFilter = offline.createBiquadFilter();
    arpFilter.type = 'bandpass';
    arpFilter.Q.value = 1;

    arpOsc.connect(arpFilter).connect(arpGain).connect(offline.destination);
    arpOsc.start(0);
    arpOsc.stop(duration);

    const notes = [164.81, 196.00, 246.94, 329.63]; // E minor arpeggio

    for (let i = 0; i < totalSixteenths; i++) {
        const t = i * sixteenth;
        const note = notes[i % 4] * (i > 32 ? 1.5 : 1); // Slight variation halfway

        arpOsc.frequency.setValueAtTime(note * 2, t); // Octave up

        arpFilter.frequency.setValueAtTime(note * 4, t);
        arpFilter.frequency.exponentialRampToValueAtTime(note * 2, t + sixteenth);

        arpGain.gain.setValueAtTime(0.08, t);
        arpGain.gain.exponentialRampToValueAtTime(0.01, t + sixteenth * 0.8);
    }

    return await offline.startRendering();
};

// --- SFX (IMPROVED) ---

export const playSFX = (type: 'launch' | 'impact' | 'collect' | 'kill' | 'ui' | 'charge' | 'break' | 'lightning' | 'boss_roar' | 'missile' | 'fireball' | 'fire_death' | 'electric_charge' | 'electric_zap' | 'electric_death' | 'bomb_throw' | 'bomb_explode' | 'super_launch' | 'super_impact' | 'mini_launch', intensity: number = 1.0) => {
    if (!ctx || !sfxGain || IS_MUTED) return;
    const t = ctx.currentTime;

    if (type === 'super_launch') {
        // Charging pulse + release
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, t);
        osc.frequency.linearRampToValueAtTime(800, t + 0.5); // Fast zip up

        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(500, t);
        f.frequency.linearRampToValueAtTime(5000, t + 0.5); // Filter open

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.5, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.6);

        osc.connect(f).connect(g).connect(sfxGain);
        osc.start(t);
        osc.stop(t + 0.6);
    }
    else if (type === 'super_impact') {
        // Heavy Neon Slam
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.4);

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.8, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.4);

        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(8000, t);
        f.frequency.exponentialRampToValueAtTime(100, t + 0.3);

        osc.connect(f).connect(g).connect(sfxGain);
        osc.start(t);
        osc.stop(t + 0.4);
    }
    else if (type === 'mini_launch') {
        // Tiny zips
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.linearRampToValueAtTime(1200, t + 0.1);

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.2, t);
        g.gain.linearRampToValueAtTime(0, t + 0.1);

        osc.connect(g).connect(sfxGain);
        osc.start(t);
        osc.stop(t + 0.1);
    }
    else if (type === 'fireball') {
        const noise = ctx.createBufferSource();
        const bufferSize = ctx.sampleRate * 0.3;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        noise.buffer = buffer;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(800, t);
        f.frequency.linearRampToValueAtTime(200, t + 0.3);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.3 * intensity, t);
        g.gain.linearRampToValueAtTime(0, t + 0.3);
        noise.connect(f).connect(g).connect(sfxGain);
        noise.start(t);
    }
    else if (type === 'fire_death') {
        const noise = ctx.createBufferSource();
        const bufferSize = ctx.sampleRate * 0.6;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        noise.buffer = buffer;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(400, t);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.8 * intensity, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.6);
        noise.connect(f).connect(g).connect(sfxGain);
        noise.start(t);
    }
    else if (type === 'electric_charge') {
        // FIXED: Much quieter, smoother sine wave, less aggressive ramp
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, t);
        // Slight pitch up, but low frequency
        osc.frequency.linearRampToValueAtTime(220, t + 1.2);

        const g = ctx.createGain();
        // Very low gain start
        g.gain.setValueAtTime(0.02, t);
        // Max gain is still quiet
        g.gain.linearRampToValueAtTime(0.08, t + 1.0);
        g.gain.linearRampToValueAtTime(0, t + 1.2);

        osc.connect(g).connect(sfxGain);
        osc.start(t);
        osc.stop(t + 1.2);
    }
    else if (type === 'electric_zap') {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.2);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.2 * intensity, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        osc.connect(g).connect(sfxGain);
        osc.start(t);
        osc.stop(t + 0.2);
    }
    else if (type === 'electric_death') {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, t);
        osc.frequency.linearRampToValueAtTime(20, t + 0.4);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.3, t); // Slightly lower
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
        osc.connect(g).connect(sfxGain);
        osc.start(t);
        osc.stop(t + 0.4);
    }
    else if (type === 'bomb_throw') {
        // Fuse hiss + throw swoosh
        const noise = ctx.createBufferSource();
        const bufferSize = ctx.sampleRate * 0.5;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        noise.buffer = buffer;

        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.setValueAtTime(2000, t);
        f.Q.value = 1;

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.2, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.5);

        noise.connect(f).connect(g).connect(sfxGain);
        noise.start(t);
    }
    else if (type === 'bomb_explode') {
        // Deep BOOM
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(100, t);
        osc.frequency.exponentialRampToValueAtTime(10, t + 0.5);

        const g = ctx.createGain();
        g.gain.setValueAtTime(1.0, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.5);

        // Lowpass filter for muffled explosion
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(300, t);
        f.frequency.linearRampToValueAtTime(50, t + 0.5);

        osc.connect(f).connect(g).connect(sfxGain);
        osc.start(t);
        osc.stop(t + 0.5);

        // Noise layer
        const noise = ctx.createBufferSource();
        const bufferSize = ctx.sampleRate * 0.6;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        noise.buffer = buffer;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.5, t);
        ng.gain.exponentialRampToValueAtTime(0.01, t + 0.6);
        noise.connect(ng).connect(sfxGain);
        noise.start(t);
    }
    else if (type === 'lightning') {
        const osc = ctx.createOscillator();
        const noise = ctx.createBufferSource();
        const bufferSize = ctx.sampleRate * 0.5;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        noise.buffer = buffer;

        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = 500;

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.2 * intensity, t); // Reduced
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

        noise.connect(noiseFilter).connect(noiseGain).connect(sfxGain);
        noise.start(t);

        osc.type = 'triangle'; // Changed from sawtooth
        osc.frequency.setValueAtTime(50, t);
        osc.frequency.linearRampToValueAtTime(20, t + 0.3);
        const oscGain = ctx.createGain();
        oscGain.gain.setValueAtTime(0.3 * intensity, t); // Reduced
        oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
        osc.connect(oscGain).connect(sfxGain);
        osc.start(t);
        osc.stop(t + 0.3);
    }
    else if (type === 'boss_roar') {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(80, t);
        osc.frequency.linearRampToValueAtTime(30, t + 1.0);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.8, t);
        gain.gain.linearRampToValueAtTime(0, t + 1.0);

        // Distortion
        const shaper = ctx.createWaveShaper();
        shaper.curve = new Float32Array([-1, 1]); // Simple clip

        osc.connect(shaper).connect(gain).connect(sfxGain);
        osc.start(t);
        osc.stop(t + 1.0);
    }
    else if (type === 'missile') {
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.3);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

        osc.connect(gain).connect(sfxGain);
        osc.start(t);
        osc.stop(t + 0.3);
    }
    else if (type === 'launch') {
        // High-tech Railgun Swoosh
        const dur = 0.4;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        const f = ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.exponentialRampToValueAtTime(1200, t + dur); // Pitch up

        f.type = 'bandpass';
        f.Q.value = 1;
        f.frequency.setValueAtTime(400, t);
        f.frequency.linearRampToValueAtTime(4000, t + dur);

        g.gain.setValueAtTime(0.4, t);
        g.gain.linearRampToValueAtTime(0, t + dur);

        // Add Noise layer
        const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.2, t);
        ng.gain.exponentialRampToValueAtTime(0.001, t + dur);
        noise.connect(ng).connect(sfxGain);
        noise.start(t);

        osc.connect(f).connect(g).connect(sfxGain);
        osc.start(t);
        osc.stop(t + dur);
    }
    else if (type === 'impact') {
        // Heavy Thud
        const osc = ctx.createOscillator();
        const g = ctx.createGain();

        osc.frequency.setValueAtTime(100 * intensity, t);
        osc.frequency.exponentialRampToValueAtTime(20, t + 0.15);

        g.gain.setValueAtTime(0.8 * intensity, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

        osc.connect(g).connect(sfxGain);
        osc.start(t);
        osc.stop(t + 0.15);
    }
    else if (type === 'collect') {
        // Coin Ding
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, t);
        osc.frequency.linearRampToValueAtTime(1800, t + 0.05); // Chirp

        g.gain.setValueAtTime(0.3, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

        osc.connect(g).connect(sfxGain);
        osc.start(t);
        osc.stop(t + 0.3);
    }
    else if (type === 'break') {
        // CRUNCHY BREAK (Rock/Debris)
        const dur = 0.25;

        // 1. LOW THUD (Kick)
        const kickOsc = ctx.createOscillator();
        kickOsc.frequency.setValueAtTime(120, t);
        kickOsc.frequency.exponentialRampToValueAtTime(40, t + 0.1);
        const kickGain = ctx.createGain();
        kickGain.gain.setValueAtTime(0.8 * intensity, t);
        kickGain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
        kickOsc.connect(kickGain).connect(sfxGain);
        kickOsc.start(t);
        kickOsc.stop(t + 0.2);

        // 2. CRACK (Filtered Noise - Lower frequency focus for "crunch")
        const bufferSize = ctx.sampleRate * dur;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        // Bandpass sweeping down simulates a crunch/crumble
        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(3000, t);
        noiseFilter.frequency.exponentialRampToValueAtTime(500, t + 0.15);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.6 * intensity, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + dur);

        noise.connect(noiseFilter).connect(noiseGain).connect(sfxGain);
        noise.start(t);
    }
    else if (type === 'charge') {
        // Power up
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, t);
        osc.frequency.linearRampToValueAtTime(1760, t + 0.4);

        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.4, t + 0.1);
        g.gain.linearRampToValueAtTime(0, t + 0.4);

        osc.connect(g).connect(sfxGain);
        osc.start(t);
        osc.stop(t + 0.4);
    }
    else if (type === 'ui') {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, t);
        g.gain.setValueAtTime(0.1, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
        osc.connect(g).connect(sfxGain);
        osc.start(t);
        osc.stop(t + 0.05);
    }
};
