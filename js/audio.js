// All sound is synthesized at runtime via the Web Audio API -- no external
// audio files, so there is nothing here that could be a copied asset.

const N = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25,
};

export const MUSIC_PATTERNS = [
  {
    tempo: 100,
    bass: [N.C3, 0, N.C3, 0, N.G3, 0, N.G3, 0, N.A3, 0, N.A3, 0, N.E3, 0, N.E3, 0],
    lead: [N.C4, N.E4, N.G4, N.E4, N.A4, N.G4, N.E4, N.C4, N.D4, N.F4, N.A4, N.F4, N.G4, N.E4, N.D4, 0],
  },
  {
    tempo: 124,
    bass: [N.D3, 0, N.D3, 0, N.A3, 0, N.A3, 0, N.B3, 0, N.B3, 0, N.F3, 0, N.F3, 0],
    lead: [N.D4, N.F4, N.A4, N.F4, N.B4, N.A4, N.F4, N.D4, N.E4, N.G4, N.B4, N.G4, N.A4, N.F4, N.E4, 0],
  },
  {
    tempo: 142,
    bass: [N.E3, 0, N.E3, N.E3, N.B3, 0, N.B3, N.B3, N.C4, 0, N.C4, N.C4, N.G3, 0, N.G3, N.G3],
    lead: [N.E4, N.G4, N.B4, N.G4, N.C5, N.B4, N.G4, N.E4, N.D5, N.C5, N.B4, N.G4, N.A4, N.G4, N.E4, 0],
  },
];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.muted = false;
    this.pendingSfxVolume = 0.8;
    this.pendingMusicVolume = 0.6;
    this.musicTimer = null;
    this.musicStep = 0;
    this.currentPattern = null;
  }

  ensureContext() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.masterGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.sfxGain.connect(this.masterGain);
    this.musicGain.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);
    this.sfxGain.gain.value = this.pendingSfxVolume;
    this.musicGain.gain.value = this.pendingMusicVolume;
    this.masterGain.gain.value = this.muted ? 0 : 1;
  }

  resumeContext() {
    this.ensureContext();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.masterGain) this.masterGain.gain.value = muted ? 0 : 1;
  }

  setSfxVolume(v) {
    this.pendingSfxVolume = v;
    if (this.sfxGain) this.sfxGain.gain.value = v;
  }

  setMusicVolume(v) {
    this.pendingMusicVolume = v;
    if (this.musicGain) this.musicGain.gain.value = v;
  }

  applySettings(settings) {
    this.setMuted(settings.muted);
    this.setSfxVolume(settings.sfxVolume);
    this.setMusicVolume(settings.musicVolume);
  }

  _tone(freqStart, freqEnd, duration, type = 'square', peak = 0.25, delay = 0) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(freqStart, 1), t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t0 + duration);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.015, duration * 0.3));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  _noiseBurst(duration, peak = 0.3, delay = 0) {
    if (!this.ctx) return;
    const bufferSize = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    const t0 = this.ctx.currentTime + delay;
    gain.gain.setValueAtTime(peak, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(gain).connect(this.sfxGain);
    src.start(t0);
  }

  shoot() {
    this.ensureContext();
    this._tone(820, 380, 0.09, 'square', 0.18);
  }

  pop(tier = 0) {
    this.ensureContext();
    const basePitch = 520 - tier * 90;
    this._tone(basePitch, basePitch * 0.4, 0.12, 'triangle', 0.3);
    this._noiseBurst(0.06, 0.15);
  }

  hit() {
    this.ensureContext();
    this._tone(300, 90, 0.32, 'sawtooth', 0.3);
  }

  powerup() {
    this.ensureContext();
    [660, 880, 1100, 1320].forEach((f, i) => this._tone(f, f, 0.09, 'square', 0.2, i * 0.07));
  }

  gameover() {
    this.ensureContext();
    [440, 370, 300, 220].forEach((f, i) => this._tone(f, f * 0.9, 0.22, 'square', 0.25, i * 0.18));
  }

  levelclear() {
    this.ensureContext();
    [520, 660, 780, 1040].forEach((f, i) => this._tone(f, f, 0.12, 'triangle', 0.25, i * 0.09));
  }

  playMusic(patternIndex) {
    this.ensureContext();
    if (!this.ctx) return;
    this.stopMusic();
    this.currentPattern = MUSIC_PATTERNS[Math.max(0, Math.min(MUSIC_PATTERNS.length - 1, patternIndex))];
    this.musicStep = 0;
    const stepDuration = 60 / this.currentPattern.tempo / 2;
    this.musicTimer = setInterval(() => this._playMusicStep(stepDuration), stepDuration * 1000);
  }

  _playMusicStep(stepDuration) {
    const pattern = this.currentPattern;
    if (!pattern || !this.ctx) return;
    const bassNote = pattern.bass[this.musicStep % pattern.bass.length];
    const leadNote = pattern.lead[this.musicStep % pattern.lead.length];
    const t0 = this.ctx.currentTime;
    if (bassNote) this._musicNote(bassNote, t0, stepDuration * 0.9, 'triangle', 0.12);
    if (leadNote) this._musicNote(leadNote, t0, stepDuration * 0.7, 'square', 0.07);
    this.musicStep++;
  }

  _musicNote(freq, t0, duration, type, peak) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(this.musicGain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.currentPattern = null;
  }
}
