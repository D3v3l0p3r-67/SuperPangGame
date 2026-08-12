// Centralized audio system. Every sound the game can play is a named
// entry in AUDIO_CONFIG (mutated in place by ElementsScene from
// assets/audio/audio.json -- see assets.js's AUDIO_CONFIG_PATH), carrying
// its own file, category (music/sfx/ui), volume, playback mode
// (once/loop), whether it may overlap itself, and an optional max
// playback duration. Game code never touches a filename, a volume number,
// or a loop flag directly -- it only ever calls AudioManager.play(name)/
// playMusic(name) by the sound's config key, so swapping a sound is
// purely replacing the .ogg file (or editing audio.json), never a code
// change. Same mutable-registry pattern as elements.js's BALL_ELEMENTS/
// POWERUP_TYPES and LevelManager's LEVELS.
export const AUDIO_CONFIG = {}; // name -> {file, category, volume, mode, overlap, maxDurationMs?}

export class AudioManager {
  constructor(scene) {
    this.scene = scene;
    this.sound = scene.sound;
    this.musicVolume = 0.6;
    this.sfxVolume = 0.8;
    // Per-name Phaser Sound instance, kept around only for sounds that
    // can't overlap themselves (so a repeat trigger can stop the
    // previous instance first) -- overlap-allowed sfx are fire-and-forget
    // via this.sound.play() instead and need no bookkeeping here.
    this.activeInstances = new Map();
    this.music = null;
    this.musicName = null;
  }

  // Browsers refuse to start audio before a user gesture -- called from
  // the same click handlers that already used to call this pre-Phaser
  // Sound-Manager rewrite, so no call site needed to change.
  resumeContext() {
    const ctx = this.sound.context;
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  _categoryVolume(category) {
    return category === 'music' ? this.musicVolume : this.sfxVolume;
  }

  _effectiveVolume(cfg) {
    return cfg.volume * this._categoryVolume(cfg.category);
  }

  // One-shot (mode: 'once') sounds: sfx/ui, by config name. Safe to call
  // for any category -- 'loop' entries (music) are ignored here and must
  // go through playMusic() instead, since they need singleton/switch
  // handling this method doesn't do.
  //
  // Returns the Phaser Sound it started (or undefined if the name isn't a
  // one-shot), so a caller that needs to line something up with the sound
  // can read its `duration` -- see GameScene.beginRun holding the level
  // countdown until the run-start fanfare has finished.
  play(name) {
    const cfg = AUDIO_CONFIG[name];
    if (!cfg || cfg.mode === 'loop') return;

    const volume = this._effectiveVolume(cfg);

    if (!cfg.overlap) {
      const prev = this.activeInstances.get(name);
      if (prev) {
        prev.stop();
        prev.destroy();
        this.activeInstances.delete(name);
      }
      const snd = this.sound.add(name, { volume });
      snd.once('complete', () => {
        if (this.activeInstances.get(name) === snd) this.activeInstances.delete(name);
        snd.destroy();
      });
      this.activeInstances.set(name, snd);
      snd.play();
      if (cfg.maxDurationMs) {
        this.scene.time.delayedCall(cfg.maxDurationMs, () => { if (snd.isPlaying) snd.stop(); });
      }
      return snd;
    }

    // Overlap-allowed: the shorthand manager play() creates and cleans up
    // its own instance per call, so any number of triggers can sound at
    // once (e.g. several balls popping the same frame).
    const snd = this.sound.play(name, { volume });
    if (cfg.maxDurationMs && snd) {
      this.scene.time.delayedCall(cfg.maxDurationMs, () => { if (snd.isPlaying) snd.stop(); });
    }
    return snd;
  }

  // Music (mode: 'loop', category 'music'): only ever one track playing.
  // Re-requesting the track that's already playing (e.g. reloading the
  // same level on restart) is a no-op, so loops never duplicate.
  playMusic(name) {
    const cfg = AUDIO_CONFIG[name];
    if (!cfg || cfg.category !== 'music') return;
    if (this.musicName === name && this.music && this.music.isPlaying) return;

    this.stopMusic();
    const snd = this.sound.add(name, { loop: true, volume: this._effectiveVolume(cfg) });
    snd.play();
    this.music = snd;
    this.musicName = name;
  }

  stopMusic() {
    if (this.music) {
      this.music.stop();
      this.music.destroy();
      this.music = null;
      this.musicName = null;
    }
  }

  // Freezes the current track at its playback position (as opposed to
  // stopMusic(), which throws the instance away entirely) -- used for the
  // pause menu, so the music picks back up where it left off on resume
  // instead of restarting from the top. Safe to call with nothing playing.
  pauseMusic() {
    if (this.music && this.music.isPlaying) this.music.pause();
  }

  resumeMusic() {
    if (this.music && this.music.isPaused) this.music.resume();
  }

  setMuted(muted) {
    this.sound.mute = muted;
  }

  setSfxVolume(v) {
    this.sfxVolume = v;
  }

  setMusicVolume(v) {
    this.musicVolume = v;
    if (this.music && this.musicName) {
      this.music.setVolume(this._effectiveVolume(AUDIO_CONFIG[this.musicName]));
    }
  }

  applySettings(settings) {
    this.setMuted(settings.muted);
    this.setSfxVolume(settings.sfxVolume);
    this.setMusicVolume(settings.musicVolume);
  }
}
