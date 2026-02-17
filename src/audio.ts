interface ToneOptions {
  type?: OscillatorType;
  startFreq?: number;
  endFreq?: number;
  duration?: number;
  gain?: number;
  noise?: boolean;
}

let audioCtx: AudioContext | null = null;
const music = new Audio("assets/music/doom1.mp3");
music.loop = true;
music.volume = 0.35;
let musicEnabled = true;

export function initAudio(): void {
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioCtx = new Ctx();
  }

  if (audioCtx.state === "suspended") {
    void audioCtx.resume();
  }

  if (musicEnabled) {
    void music.play().catch(() => {});
  }
}

export function toggleMusic(): void {
  musicEnabled = !musicEnabled;
  if (!musicEnabled) {
    music.pause();
    return;
  }
  void music.play().catch(() => {});
}

function playTone({
  type = "square",
  startFreq = 440,
  endFreq = 220,
  duration = 0.12,
  gain = 0.08,
  noise = false,
}: ToneOptions): void {
  if (!audioCtx) return;

  const now = audioCtx.currentTime;
  const attack = 0.005;
  const release = Math.max(0.03, duration - attack);
  const out = audioCtx.createGain();
  out.gain.setValueAtTime(0.0001, now);
  out.gain.exponentialRampToValueAtTime(gain, now + attack);
  out.gain.exponentialRampToValueAtTime(0.0001, now + attack + release);
  out.connect(audioCtx.destination);

  if (noise) {
    const size = Math.floor(audioCtx.sampleRate * duration);
    const buffer = audioCtx.createBuffer(1, size, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i += 1) data[i] = (Math.random() * 2 - 1) * 0.9;

    const src = audioCtx.createBufferSource();
    const filter = audioCtx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(Math.max(120, startFreq), now);
    filter.Q.value = 1.5;
    src.buffer = buffer;
    src.connect(filter);
    filter.connect(out);
    src.start(now);
    src.stop(now + duration);
    return;
  }

  const osc = audioCtx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(startFreq, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(50, endFreq), now + duration);
  osc.connect(out);
  osc.start(now);
  osc.stop(now + duration);
}

export function playGunSound(): void {
  playTone({ type: "square", startFreq: 170, endFreq: 70, duration: 0.08, gain: 0.09 });
  playTone({ startFreq: 1800, endFreq: 300, duration: 0.07, gain: 0.045, noise: true });
}

export function playCannonSound(): void {
  playTone({ type: "sawtooth", startFreq: 130, endFreq: 55, duration: 0.16, gain: 0.1 });
  playTone({ startFreq: 1400, endFreq: 190, duration: 0.12, gain: 0.06, noise: true });
}

export function playCatMeowSound(): void {
  playTone({ type: "triangle", startFreq: 620, endFreq: 420, duration: 0.09, gain: 0.06 });
  playTone({ type: "triangle", startFreq: 520, endFreq: 760, duration: 0.08, gain: 0.05 });
}

export function playEnemyDeathSound(): void {
  playTone({ type: "sawtooth", startFreq: 220, endFreq: 110, duration: 0.14, gain: 0.07 });
  playTone({ startFreq: 900, endFreq: 180, duration: 0.12, gain: 0.035, noise: true });
}

export function playPlayerDeathSound(): void {
  playTone({ type: "sawtooth", startFreq: 170, endFreq: 55, duration: 0.26, gain: 0.09 });
  playTone({ startFreq: 480, endFreq: 80, duration: 0.24, gain: 0.04, noise: true });
}

export function playPortalSound(): void {
  playTone({ type: "triangle", startFreq: 480, endFreq: 780, duration: 0.12, gain: 0.06 });
  playTone({ type: "triangle", startFreq: 620, endFreq: 980, duration: 0.14, gain: 0.05 });
}

export function playPickupSound(): void {
  playTone({ type: "triangle", startFreq: 760, endFreq: 980, duration: 0.08, gain: 0.05 });
  playTone({ type: "triangle", startFreq: 920, endFreq: 1220, duration: 0.08, gain: 0.04 });
}
