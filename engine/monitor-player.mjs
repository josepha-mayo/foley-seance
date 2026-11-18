// Integrator-authored monitor only. Rendered/exported PCM is never modified.
export const MONITOR_GAIN = 0.35;
export const MONITOR_FADE_SECONDS = 0.015;

export function createMonitorPlayer(context, {onEnded = () => {}} = {}) {
  if (!context || typeof context.createBufferSource !== 'function' ||
      typeof context.createGain !== 'function' || typeof onEnded !== 'function')
    throw new TypeError('A Web Audio context and optional onEnded callback are required');
  let current = null, releasing = null;
  const now = () => {
    const value = context.currentTime;
    if (!Number.isFinite(value) || value < 0) throw new Error('Invalid audio clock');
    return value;
  };
  function dispose(voice) {
    if (!voice || voice.disposed) return;
    voice.disposed = true; voice.source.onended = null;
    try { voice.source.stop(); } catch {}
    try { voice.source.disconnect(); } catch {}
    try { voice.gain.disconnect(); } catch {}
  }
  function expire(t) {
    if (releasing && t >= releasing.releaseEnd) { dispose(releasing); releasing = null; }
  }
  function retire(t) {
    expire(t);
    const voice = current; current = null;
    if (!voice) return;
    // An inaudible scheduled replacement is cancelled, not allowed to restart.
    if (t <= voice.startedAt) { dispose(voice); return; }
    // Under monotonic Web Audio time, a prior release ends before this voice starts.
    if (releasing) { dispose(releasing); releasing = null; }
    const level = MONITOR_GAIN * Math.max(0, Math.min(1, (t - voice.startedAt) / voice.fade, (voice.naturalEnd - t) / voice.fade));
    voice.gain.gain.cancelScheduledValues(t);
    voice.gain.gain.setValueAtTime(level, t);
    voice.releaseEnd = Math.max(t, Math.min(voice.naturalEnd, t + MONITOR_FADE_SECONDS));
    voice.gain.gain.linearRampToValueAtTime(0, voice.releaseEnd);
    releasing = voice;
    voice.source.stop(voice.releaseEnd);
  }
  function failClosed() {
    dispose(current); dispose(releasing); current = releasing = null;
  }
  function stop() {
    try { retire(now()); } catch (error) { failClosed(); throw error; }
  }
  function play(buffer) {
    if (!buffer || !Number.isFinite(buffer.duration) || buffer.duration <= 0)
      throw new TypeError('A nonempty AudioBuffer is required');
    let voice;
    try {
      const t = now(); retire(t);
      const startedAt = releasing ? Math.max(t, releasing.releaseEnd) : t;
      voice = {source:context.createBufferSource(), gain:null, startedAt, disposed:false,
        naturalEnd:startedAt + buffer.duration, fade:Math.min(MONITOR_FADE_SECONDS, buffer.duration / 2)};
      voice.gain = context.createGain();
      voice.source.buffer = buffer;
      voice.gain.gain.setValueAtTime(0, t);
      voice.gain.gain.setValueAtTime(0, startedAt);
      voice.gain.gain.linearRampToValueAtTime(MONITOR_GAIN, startedAt + voice.fade);
      voice.gain.gain.setValueAtTime(MONITOR_GAIN, voice.naturalEnd - voice.fade);
      voice.gain.gain.linearRampToValueAtTime(0, voice.naturalEnd);
      voice.source.connect(voice.gain); voice.gain.connect(context.destination);
      voice.source.onended = () => {
        const naturalCurrent = current === voice;
        if (naturalCurrent) current = null;
        if (releasing === voice) releasing = null;
        dispose(voice);
        if (naturalCurrent) onEnded();
      };
      current = voice;
      voice.source.start(startedAt);
      return {startedAt};
    } catch (error) {
      if (voice) dispose(voice);
      failClosed(); throw error;
    }
  }
  return {play, stop, get active() {return current !== null;}};
}
