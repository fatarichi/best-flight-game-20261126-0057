// Coral Coast Run — procedural sound, no audio files: an engine hum
// that follows the throttle, wind that rises with speed, a chime for
// each ring, and a thud for the touchdown. All WebAudio, all optional.

export function createAudio() {
  const audio = {
    ctx: null,
    enabled: true,
    engine: null,
    engineGain: null,
    wind: null,
    windGain: null,
    windFilter: null,
  };

  // Browsers only let sound start after a user gesture.
  audio.unlock = function unlockAudio() {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext ?? window.webkitAudioContext;
      if (!Ctx) return;
      audio.ctx = new Ctx();
      // Engine: two detuned saws through a low-pass filter.
      audio.engineGain = audio.ctx.createGain();
      audio.engineGain.gain.value = 0;
      audio.windFilter = audio.ctx.createBiquadFilter();
      audio.windFilter.type = 'lowpass';
      audio.windFilter.frequency.value = 500;
      audio.engine = audio.ctx.createOscillator();
      audio.engine.type = 'sawtooth';
      audio.engine.frequency.value = 55;
      const engine2 = audio.ctx.createOscillator();
      engine2.type = 'sawtooth';
      engine2.frequency.value = 55 * 1.5;
      const engine2Gain = audio.ctx.createGain();
      engine2Gain.gain.value = 0.4;
      audio.engine.connect(audio.windFilter);
      engine2.connect(engine2Gain);
      engine2Gain.connect(audio.windFilter);
      audio.windFilter.connect(audio.engineGain);
      audio.engineGain.connect(audio.ctx.destination);
      audio.engine.start();
      engine2.start();
      audio.engine2 = engine2;
      // Wind: looped noise through a band-pass.
      const len = audio.ctx.sampleRate * 2;
      const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const noise = audio.ctx.createBufferSource();
      noise.buffer = buf;
      noise.loop = true;
      const bp = audio.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 900;
      bp.Q.value = 0.6;
      audio.windGain = audio.ctx.createGain();
      audio.windGain.gain.value = 0;
      noise.connect(bp);
      bp.connect(audio.windGain);
      audio.windGain.connect(audio.ctx.destination);
      noise.start();
      audio.wind = noise;
    } catch {
      audio.ctx = null;
    }
  };

  // Call every frame: the hum follows throttle, the wind follows speed.
  audio.update = function updateAudio(plane, flying) {
    if (!audio.ctx || !audio.enabled) return;
    const t = audio.ctx.currentTime;
    const target = flying ? 0.05 + plane.throttle * 0.075 : 0;
    audio.engineGain.gain.setTargetAtTime(target, t, 0.1);
    const freq = 46 + plane.throttle * 52 + plane.speed * 0.35;
    audio.engine.frequency.setTargetAtTime(freq, t, 0.08);
    audio.engine2.frequency.setTargetAtTime(freq * 1.5, t, 0.08);
    audio.windGain.gain.setTargetAtTime(flying ? Math.min(0.14, plane.speed * 0.0016) : 0, t, 0.15);
    audio.windFilter.frequency.setTargetAtTime(320 + plane.speed * 9, t, 0.1);
  };

  audio.chime = function ringChime() {
    if (!audio.ctx || !audio.enabled) return;
    const t = audio.ctx.currentTime;
    [880, 1318.5].forEach((f, i) => {
      const o = audio.ctx.createOscillator();
      const g = audio.ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.22, t + i * 0.07);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.5);
      o.connect(g);
      g.connect(audio.ctx.destination);
      o.start(t + i * 0.07);
      o.stop(t + i * 0.07 + 0.55);
    });
  };

  audio.thud = function touchdownThud() {
    if (!audio.ctx || !audio.enabled) return;
    const t = audio.ctx.currentTime;
    const o = audio.ctx.createOscillator();
    const g = audio.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.22);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g);
    g.connect(audio.ctx.destination);
    o.start(t);
    o.stop(t + 0.32);
  };

  audio.toggle = function toggleSound() {
    audio.enabled = !audio.enabled;
    if (audio.ctx && audio.engineGain) {
      audio.engineGain.gain.setTargetAtTime(audio.enabled ? 0.06 : 0, audio.ctx.currentTime, 0.05);
      audio.windGain.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.05);
    }
    return audio.enabled;
  };

  return audio;
}
