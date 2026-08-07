type SoundType =
  | 'deal'
  | 'flip'
  | 'weapon'
  | 'monster'
  | 'potion'
  | 'damage'
  | 'run'
  | 'win'
  | 'lose';

class AudioManager {
  private ctx: AudioContext | null = null;
  private enabled = true;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  isEnabled() {
    return this.enabled;
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    gain = 0.15,
    delay = 0,
  ) {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);

    gainNode.gain.setValueAtTime(0, ctx.currentTime + delay);
    gainNode.gain.linearRampToValueAtTime(
      gain,
      ctx.currentTime + delay + 0.01,
    );
    gainNode.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + delay + duration,
    );

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration);
  }

  private playNoise(duration: number, gain = 0.1, delay = 0) {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(gain, ctx.currentTime + delay);
    gainNode.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + delay + duration,
    );

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, ctx.currentTime + delay);

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    noise.start(ctx.currentTime + delay);
    noise.stop(ctx.currentTime + delay + duration);
  }

  play(sound: SoundType) {
    switch (sound) {
      case 'deal':
        this.playNoise(0.05, 0.08);
        break;
      case 'flip':
        this.playTone(600, 0.06, 'square', 0.08);
        this.playTone(800, 0.04, 'square', 0.06, 0.03);
        break;
      case 'weapon':
        this.playTone(400, 0.1, 'sawtooth', 0.12);
        this.playTone(600, 0.08, 'sawtooth', 0.1, 0.05);
        this.playNoise(0.08, 0.06, 0.03);
        break;
      case 'monster':
        this.playTone(150, 0.15, 'sawtooth', 0.15);
        this.playNoise(0.1, 0.08, 0.05);
        break;
      case 'potion':
        this.playTone(500, 0.08, 'sine', 0.12);
        this.playTone(700, 0.08, 'sine', 0.1, 0.06);
        this.playTone(900, 0.1, 'sine', 0.08, 0.12);
        break;
      case 'damage':
        this.playTone(200, 0.12, 'sawtooth', 0.15);
        this.playNoise(0.1, 0.1);
        break;
      case 'run':
        this.playTone(300, 0.06, 'triangle', 0.1);
        this.playTone(200, 0.08, 'triangle', 0.1, 0.05);
        this.playTone(100, 0.1, 'triangle', 0.08, 0.1);
        break;
      case 'win':
        this.playTone(523, 0.15, 'sine', 0.15);
        this.playTone(659, 0.15, 'sine', 0.15, 0.15);
        this.playTone(784, 0.2, 'sine', 0.15, 0.3);
        this.playTone(1047, 0.4, 'sine', 0.12, 0.45);
        break;
      case 'lose':
        this.playTone(300, 0.2, 'sawtooth', 0.15);
        this.playTone(200, 0.25, 'sawtooth', 0.15, 0.2);
        this.playTone(100, 0.5, 'sawtooth', 0.12, 0.4);
        break;
    }
  }
}

export const audioManager = new AudioManager();
export type { SoundType };
