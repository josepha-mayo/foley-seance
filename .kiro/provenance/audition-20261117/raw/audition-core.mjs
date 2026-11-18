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
const MASTER_GAIN = 0.35;
const MAX_NORMALIZE_THRESHOLD = 0.99; // Reject if renderer normalized beyond expected

/**
 * Build a looping audition with static placement.
 * @param {AuditionSettings} settings
 * @returns {AuditionResult}
 */
export function buildAudition(settings) {
  // Validate exact plain data
  if (!settings || typeof settings !== 'object') {
    throw new Error('Settings must be a plain object');
  }

  const { kind, sampleRate, x, y, doorClosed } = settings;

  if (kind !== 'creak' && kind !== 'breath') {
    throw new Error(`Invalid kind: ${kind}`);
  }

  if (sampleRate !== 24000 && sampleRate !== 48000) {
    throw new Error(`Invalid sampleRate: ${sampleRate}`);
  }

  if (typeof x !== 'number' || x < 0 || x > 1 || !Number.isFinite(x)) {
    throw new Error(`Invalid x: ${x}`);
  }

  if (typeof y !== 'number' || y < 0 || y > 1 || !Number.isFinite(y)) {
    throw new Error(`Invalid y: ${y}`);
  }

  if (typeof doorClosed !== 'boolean') {
    throw new Error(`Invalid doorClosed: ${doorClosed}`);
  }

  // Create source (<=8sec mono)
  const source = createDemoSource(sampleRate, kind);

  // Build static recipe
  const sourceDuration = source.length / sampleRate;
  const recipe = {
    version: 1,
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

  // Check normalization - reject unexpected gain reduction
  if (typeof normalizationGain === 'number' && normalizationGain < MAX_NORMALIZE_THRESHOLD) {
    throw new Error(`Unexpected normalization gain: ${normalizationGain}`);
  }

  // Apply master audition gain and loop boundary fade
  const fadeSamples = Math.floor((FADE_MS / 1000) * sampleRate);
  const fadedChannels = [
    new Float32Array(outputFrames),
    new Float32Array(outputFrames)
  ];

  for (let ch = 0; ch < 2; ch++) {
    const src = previewChannels[ch];
    const dst = fadedChannels[ch];

    for (let i = 0; i < outputFrames; i++) {
      let gain = MASTER_GAIN;

      // Fade in at start
      if (i < fadeSamples) {
        gain *= i / fadeSamples;
      }

      // Fade out at end
      if (i >= outputFrames - fadeSamples) {
        gain *= (outputFrames - i) / fadeSamples;
      }

      dst[i] = src[i] * gain;
    }
  }

  // Encode edited channels to exact WAV
  const finalWavBytes = encodeWav(fadedChannels, sampleRate);

  return {
    wavBytes: finalWavBytes,
    sampleRate,
    frames: outputFrames,
    kind
  };
}
