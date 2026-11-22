// A tiny WebAudio synth: every sound is an oscillator through a gain envelope, no
// assets. unlock() must run inside a user gesture before play() will make noise.
export function createAudio() {
  let ctx = null;

  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ctx = new AC();
  }

  function beep({ freq = 440, freqEnd = 0, dur = 0.15, type = 'sine', vol = 0.06, delay = 0 }) {
    if (!ctx || ctx.state !== 'running') return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function play(name) {
    switch (name) {
      case 'loot':
        beep({ freq: 988, dur: 0.09, type: 'triangle', vol: 0.05 });
        beep({ freq: 1319, dur: 0.14, type: 'triangle', vol: 0.05, delay: 0.08 });
        break;
      case 'gem':
        [523, 659, 784, 1047].forEach((f, i) => beep({ freq: f, dur: 0.16, type: 'triangle', vol: 0.055, delay: i * 0.09 }));
        break;
      case 'toss':
        beep({ freq: 1400, freqEnd: 900, dur: 0.05, type: 'triangle', vol: 0.035 });
        break;
      case 'emp':
        beep({ freq: 900, freqEnd: 90, dur: 0.3, type: 'sawtooth', vol: 0.05 });
        beep({ freq: 450, freqEnd: 60, dur: 0.3, type: 'square', vol: 0.025 });
        break;
      case 'spotted':
        beep({ freq: 740, dur: 0.1, type: 'square', vol: 0.045 });
        beep({ freq: 740, dur: 0.1, type: 'square', vol: 0.045, delay: 0.14 });
        break;
      case 'caught':
        beep({ freq: 160, freqEnd: 70, dur: 0.45, type: 'sawtooth', vol: 0.07 });
        beep({ freq: 110, dur: 0.45, type: 'square', vol: 0.04 });
        break;
      case 'escape':
        [523, 659, 784, 1047, 1319].forEach((f, i) => beep({ freq: f, dur: 0.18, type: 'triangle', vol: 0.055, delay: i * 0.1 }));
        break;
      default:
        break;
    }
  }

  return { unlock, play };
}
