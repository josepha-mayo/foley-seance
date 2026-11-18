/**
 * @typedef {Object} AuditionSettings
 * @property {'creak'|'breath'} kind
 * @property {24000|48000} sampleRate
 * @property {number} x - 0..1
 * @property {number} y - 0..1
 * @property {boolean} doorClosed
 */

/**
 * @typedef {Object} AuditionResult
 * @property {Uint8Array} wavBytes
 * @property {number} sampleRate
 * @property {number} frames
 * @property {'creak'|'breath'} kind
 */

import { createDemoSource, renderRecipe, encodeWav } from './foley-engine.mjs';

const FADE_MS = 20;
const MASTER_GAIN = 1; // Stable 0.35 master gain is applied once by controller.

// Exact, bounded, owned data snapshot. No getter invocation and no shared buffer.
export function copyAuditionSettings(settings) {
  if (!settings || Object.getPrototypeOf(settings) !== Object.prototype) throw new Error('Settings must be plain data');
  const descriptors = Object.getOwnPropertyDescriptors(settings);
  if (Reflect.ownKeys(descriptors).some(k=>typeof k!=='string'||!Object.hasOwn(descriptors[k],'value'))) throw new Error('Settings must be data fields');
  const kind = descriptors.kind?.value;
  const keys = ['kind','sampleRate','x','y','doorClosed',...(kind==='import'?['sourceId','source']:[]),...(Object.hasOwn(descriptors,'echoAmount')?['echoAmount']:[])];
  if (Reflect.ownKeys(settings).length !== keys.length || keys.some(k=>!Object.hasOwn(descriptors,k))) throw new Error('Unexpected settings fields');
  const {sampleRate,x,y,doorClosed} = settings;
  if (!['creak','breath','import'].includes(kind) || ![24000,48000].includes(sampleRate) || typeof doorClosed!=='boolean' || ![x,y].every(n=>Number.isFinite(n)&&n>=0&&n<=1)) throw new Error('Invalid audition settings');
  if (Object.hasOwn(descriptors,'echoAmount') && (!Number.isFinite(settings.echoAmount)||settings.echoAmount<0||settings.echoAmount>0.6)) throw new Error('Invalid audition echo amount');
  if (kind !== 'import') return {...settings};
  const {sourceId,source} = settings;
  if (typeof sourceId!=='string'||!sourceId.trim()||sourceId.length>128) throw new Error('Invalid imported source ID');
  if (!(source instanceof Float32Array) || !(source.buffer instanceof ArrayBuffer) || source.length===0 || source.length>8*sampleRate) throw new Error('Import must be nonempty mono Float32Array, at most 8 seconds');
  const owned = new Float32Array(source);
  for (const value of owned) if (!Number.isFinite(value)||value < -1 || value > 1) throw new Error('Invalid imported source sample');
  return {...settings,source:owned};
}

/**
 * Build a looping audition with static placement.
 * @param {AuditionSettings} settings
 * @returns {AuditionResult}
 */
export function buildAudition(settings) {
  // Imported-source support is an integrator adaptation of the Kiro-derived adapter.
  const validated = copyAuditionSettings(settings);
  const {kind, sampleRate, x, y, doorClosed} = validated;
  const imported = kind === 'import';
  let source, loopFrames;
  if (imported) {
    source = validated.source;
    loopFrames = source.length + Math.floor(sampleRate * 1.5);
  } else {
    // Retain the established warmed short cycles for built-in audition only.
    const cycle = createDemoSource(sampleRate, kind);
    const repeats = kind === 'creak' ? 5 : 3;
    source = new Float32Array(cycle.length * repeats);
    for (let i = 0; i < repeats; i++) source.set(cycle, i * cycle.length);
    loopFrames = cycle.length;
  }

  // Build static recipe
  const sourceDuration = source.length / sampleRate;
  const recipe = {
    version: Object.hasOwn(validated,'echoAmount') ? 2 : 1,
    ...(Object.hasOwn(validated,'echoAmount') ? {echoAmount:validated.echoAmount} : {}),
    doorClosed,
    trajectory: [
      { t: 0, x, y },
      { t: sourceDuration, x, y }
    ]
  };

  // Render using shared artistic room DSP
  const renderResult = renderRecipe(source, sampleRate, recipe);

  // Validate render result
  if (!renderResult || typeof renderResult !== 'object') {
    throw new Error('Invalid render result');
  }

  const { wavBytes, previewChannels, outputFrames, sourceFrames, tailFrames, normalizationGain } = renderResult;

  if (!Array.isArray(previewChannels) || previewChannels.length !== 2) {
    throw new Error('Expected stereo preview channels');
  }

  if (!(previewChannels[0] instanceof Float32Array) || !(previewChannels[1] instanceof Float32Array)) {
    throw new Error('Preview channels must be Float32Array');
  }

  if (previewChannels[0].length !== outputFrames || previewChannels[1].length !== outputFrames) {
    throw new Error('Channel length mismatch');
  }

  // Validate finite samples
  for (let ch = 0; ch < 2; ch++) {
    const channel = previewChannels[ch];
    for (let i = 0; i < channel.length; i++) {
      if (!Number.isFinite(channel[i])) {
        throw new Error(`Non-finite sample at channel ${ch}, frame ${i}`);
      }
    }
  }

  // Imports use the same down-only normalization as export, never gain-up.
  if (!Number.isFinite(normalizationGain) || normalizationGain <= 0 || normalizationGain > 1 || (!imported && normalizationGain !== 1)) {
    throw new Error(`Unexpected normalization gain: ${normalizationGain}`);
  }

  // Extract the last complete source cycle, not the exported tail.
  // Prior cycles warm the same DSP state; this sketch is intentionally not
  // the isolated one-shot export. Quantify convergence, without claiming
  // universally exact periodic steady state.
  let warmupMaxDifference = 0, warmupSquaredDifference = 0, seamJumpBeforeFade = 0;
  const loopStart = imported ? 0 : sourceFrames - loopFrames;
  const loopEnd = imported ? outputFrames : sourceFrames;
  if (imported && (sourceFrames !== source.length || outputFrames !== loopFrames || tailFrames !== Math.floor(sampleRate*1.5))) throw new Error('Imported render length mismatch');
  for (const channel of previewChannels) {
    if (imported) continue;
    seamJumpBeforeFade = Math.max(seamJumpBeforeFade, Math.abs(channel[sourceFrames-1]-channel[loopStart]));
    for (let i=0;i<loopFrames;i++) {
      const delta = channel[loopStart+i]-channel[loopStart-loopFrames+i];
      warmupMaxDifference = Math.max(warmupMaxDifference,Math.abs(delta));
      warmupSquaredDifference += delta*delta;
    }
  }
  // Stable gain and short loop-boundary fades; no automatic compensation.
  const fadeSamples = Math.floor((FADE_MS / 1000) * sampleRate);
  const fadedChannels = [
    new Float32Array(loopFrames),
    new Float32Array(loopFrames)
  ];

  for (let ch = 0; ch < 2; ch++) {
    const src = previewChannels[ch].subarray(loopStart, loopEnd);
    const dst = fadedChannels[ch];

    for (let i = 0; i < loopFrames; i++) {
      let gain = MASTER_GAIN;

      // Fade in at start
      if (i < fadeSamples) {
        gain *= i / (fadeSamples - 1);
      }

      // Fade out at end
      if (i >= loopFrames - fadeSamples) {
        gain *= (loopFrames - 1 - i) / (fadeSamples - 1);
      }

      dst[i] = src[i] * gain;
    }
  }

  // Encode edited channels to exact WAV
  const finalWavBytes = encodeWav(fadedChannels, sampleRate);

  return {
    wavBytes: finalWavBytes,
    sampleRate,
    frames: loopFrames,
    ...(imported ? {sourceId:validated.sourceId} : {}),
    normalizationGain,
    ...(!imported ? {warmupMaxDifference, warmupRmsDifference: Math.sqrt(warmupSquaredDifference/(2*loopFrames)), seamJumpBeforeFade} : {}),
    kind
  };
}
