// foley-engine.test.mjs

import { test } from 'node:test';
import assert from 'node:assert';
import {
  validateRecipe,
  encodeWav,
  decodeWav,
  renderRecipe,
  createDemoSource
} from './foley-engine.mjs';

// ============================================================================
// VALIDATION TESTS
// ============================================================================

test('validateRecipe: valid minimal recipe', () => {
  const recipe = {
    version: 1,
    doorClosed: false,
    trajectory: [
      { t: 0, x: 0.5, y: 0.5 },
      { t: 2, x: 0.5, y: 0.5 }
    ]
  };
  const validated = validateRecipe(recipe, 2);
  assert.strictEqual(validated.version, 1);
  assert.strictEqual(validated.doorClosed, false);
  assert.strictEqual(validated.trajectory.length, 2);
});

test('validateRecipe: rejects unknown fields', () => {
  const recipe = {
    version: 1,
    doorClosed: true,
    trajectory: [{ t: 0, x: 0, y: 0 }, { t: 1, x: 1, y: 1 }],
    extraField: 'bad'
  };
  assert.throws(() => validateRecipe(recipe, 1), /Unknown recipe fields: extraField/);
});

test('validateRecipe: rejects missing fields', () => {
  const recipe = { version: 1, doorClosed: true };
  assert.throws(() => validateRecipe(recipe, 1), /Missing recipe fields: trajectory/);
});

test('validateRecipe: rejects wrong version', () => {
  const recipe = {
    version: 2,
    doorClosed: false,
    trajectory: [{ t: 0, x: 0, y: 0 }, { t: 1, x: 1, y: 1 }]
  };
  assert.throws(() => validateRecipe(recipe, 1), /recipe.version must be exactly 1/);
});

test('validateRecipe: rejects non-boolean doorClosed', () => {
  const recipe = {
    version: 1,
    doorClosed: 'yes',
    trajectory: [{ t: 0, x: 0, y: 0 }, { t: 1, x: 1, y: 1 }]
  };
  assert.throws(() => validateRecipe(recipe, 1), /doorClosed must be boolean/);
});

test('validateRecipe: rejects too few trajectory points', () => {
  const recipe = {
    version: 1,
    doorClosed: false,
    trajectory: [{ t: 0, x: 0, y: 0 }]
  };
  assert.throws(() => validateRecipe(recipe, 0), /trajectory must have 2..128 points/);
});

test('validateRecipe: rejects too many trajectory points', () => {
  const trajectory = Array.from({ length: 129 }, (_, i) => ({ t: i / 128, x: 0.5, y: 0.5 }));
  const recipe = { version: 1, doorClosed: false, trajectory };
  assert.throws(() => validateRecipe(recipe, 1), /trajectory must have 2..128 points/);
});

test('validateRecipe: rejects non-increasing time', () => {
  const recipe = {
    version: 1,
    doorClosed: false,
    trajectory: [
      { t: 0, x: 0, y: 0 },
      { t: 1, x: 0.5, y: 0.5 },
      { t: 0.5, x: 1, y: 1 }
    ]
  };
  assert.throws(() => validateRecipe(recipe, 1), /must be strictly increasing/);
});

test('validateRecipe: rejects first t != 0', () => {
  const recipe = {
    version: 1,
    doorClosed: false,
    trajectory: [{ t: 0.1, x: 0, y: 0 }, { t: 1, x: 1, y: 1 }]
  };
  assert.throws(() => validateRecipe(recipe, 1), /trajectory\[0\].t must be 0/);
});

test('validateRecipe: rejects last t != sourceDuration', () => {
  const recipe = {
    version: 1,
    doorClosed: false,
    trajectory: [{ t: 0, x: 0, y: 0 }, { t: 1.5, x: 1, y: 1 }]
  };
  assert.throws(() => validateRecipe(recipe, 2), /must equal sourceDuration/);
});

test('validateRecipe: rejects out of range x', () => {
  const recipe = {
    version: 1,
    doorClosed: false,
    trajectory: [{ t: 0, x: -0.1, y: 0 }, { t: 1, x: 1, y: 1 }]
  };
  assert.throws(() => validateRecipe(recipe, 1), /x must be in \[0,1\]/);
});

test('validateRecipe: rejects out of range y', () => {
  const recipe = {
    version: 1,
    doorClosed: false,
    trajectory: [{ t: 0, x: 0, y: 0 }, { t: 1, x: 1, y: 1.5 }]
  };
  assert.throws(() => validateRecipe(recipe, 1), /y must be in \[0,1\]/);
});

test('validateRecipe: rejects NaN coordinates', () => {
  const recipe = {
    version: 1,
    doorClosed: false,
    trajectory: [{ t: 0, x: NaN, y: 0 }, { t: 1, x: 1, y: 1 }]
  };
  assert.throws(() => validateRecipe(recipe, 1), /must be finite number/);
});

test('validateRecipe: rejects invalid sourceDuration', () => {
  const recipe = {
    version: 1,
    doorClosed: false,
    trajectory: [{ t: 0, x: 0, y: 0 }, { t: 1, x: 1, y: 1 }]
  };
  assert.throws(() => validateRecipe(recipe, 0), /sourceDuration must be finite number >0/);
  assert.throws(() => validateRecipe(recipe, 9), /sourceDuration must be finite number >0/);
});

test('validateRecipe: returns deep copy', () => {
  const recipe = {
    version: 1,
    doorClosed: true,
    trajectory: [{ t: 0, x: 0.2, y: 0.3 }, { t: 1.5, x: 0.8, y: 0.9 }]
  };
  const validated = validateRecipe(recipe, 1.5);
  
  // Mutate original
  recipe.doorClosed = false;
  recipe.trajectory[0].x = 0.999;

  // Validated should be unaffected
  assert.strictEqual(validated.doorClosed, true);
  assert.strictEqual(validated.trajectory[0].x, 0.2);
});

// ============================================================================
// WAV ENCODING/DECODING TESTS
// ============================================================================

test('encodeWav/decodeWav: round-trip stereo', () => {
  const sampleRate = 48000;
  const left = new Float32Array([0, 0.5, -0.5, 1, -1]);
  const right = new Float32Array([0.25, -0.25, 0.75, -0.75, 0]);

  const wav = encodeWav([left, right], sampleRate);
  assert.ok(wav instanceof Uint8Array);
  assert.strictEqual(wav.length, 44 + 5 * 4);

  const decoded = decodeWav(wav);
  assert.strictEqual(decoded.sampleRate, sampleRate);
  assert.strictEqual(decoded.channels.length, 2);
  assert.strictEqual(decoded.channels[0].length, 5);

  for (let i = 0; i < 5; i++) {
    assert.ok(Math.abs(decoded.channels[0][i] - left[i]) < 0.0001, `left[${i}] mismatch`);
    assert.ok(Math.abs(decoded.channels[1][i] - right[i]) < 0.0001, `right[${i}] mismatch`);
  }
});

test('encodeWav: deterministic output', () => {
  const left = new Float32Array([0.1, 0.2, 0.3]);
  const right = new Float32Array([0.4, 0.5, 0.6]);

  const wav1 = encodeWav([left, right], 24000);
  const wav2 = encodeWav([left, right], 24000);

  assert.strictEqual(wav1.length, wav2.length);
  for (let i = 0; i < wav1.length; i++) {
    assert.strictEqual(wav1[i], wav2[i], `Byte ${i} differs`);
  }
});

test('encodeWav: PCM16 quantization boundaries', () => {
  const left = new Float32Array([1, -1, 0]);
  const right = new Float32Array([0.5, -0.5, 0]);

  const wav = encodeWav([left, right], 24000);
  const view = new DataView(wav.buffer, wav.byteOffset + 44);

  assert.strictEqual(view.getInt16(0, true), 32767); // 1.0
  assert.strictEqual(view.getInt16(2, true), 16384); // 0.5
  assert.strictEqual(view.getInt16(4, true), -32768); // -1.0
  assert.strictEqual(view.getInt16(6, true), -16384); // -0.5
});

test('decodeWav: rejects corrupted header', () => {
  const left = new Float32Array([0, 0]);
  const right = new Float32Array([0, 0]);
  const wav = encodeWav([left, right], 24000);

  // Corrupt RIFF signature
  wav[0] = 0xFF;
  assert.throws(() => decodeWav(wav), /Invalid RIFF signature/);
});

test('decodeWav: rejects wrong channel count', () => {
  const left = new Float32Array([0, 0]);
  const right = new Float32Array([0, 0]);
  const wav = encodeWav([left, right], 24000);

  // Change channel count to 1
  const view = new DataView(wav.buffer, wav.byteOffset);
  view.setUint16(22, 1, true);

  assert.throws(() => decodeWav(wav), /Expected 2 channels/);
});

test('decodeWav: rejects truncated data', () => {
  const left = new Float32Array([0, 0, 0]);
  const right = new Float32Array([0, 0, 0]);
  const wav = encodeWav([left, right], 24000);

  const truncated = wav.slice(0, 50); // Cut off data
  assert.throws(() => decodeWav(truncated), /Data size mismatch/);
});

test('encodeWav: rejects mismatched channel lengths', () => {
  const left = new Float32Array([0, 0]);
  const right = new Float32Array([0]);
  assert.throws(() => encodeWav([left, right], 24000), /same length/);
});

test('encodeWav: rejects empty channels', () => {
  const left = new Float32Array(0);
  const right = new Float32Array(0);
  assert.throws(() => encodeWav([left, right], 24000), /nonempty/);
});

test('encodeWav: rejects out of range samples', () => {
  const left = new Float32Array([1.5]);
  const right = new Float32Array([0]);
  assert.throws(() => encodeWav([left, right], 24000), /out of range/);
});

test('encodeWav: rejects NaN samples', () => {
  const left = new Float32Array([NaN]);
  const right = new Float32Array([0]);
  assert.throws(() => encodeWav([left, right], 24000), /not finite/);
});

// ============================================================================
// RENDER TESTS
// ============================================================================

test('renderRecipe: basic render with tail', () => {
  const sampleRate = 24000;
  const source = new Float32Array(sampleRate * 0.5); // 0.5s
  for (let i = 0; i < source.length; i++) {
    source[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.3;
  }

  const recipe = {
    version: 1,
    doorClosed: false,
    trajectory: [
      { t: 0, x: 0.5, y: 0.5 },
      { t: 0.5, x: 0.5, y: 0.5 }
    ]
  };

  const result = renderRecipe(source, sampleRate, recipe);

  assert.strictEqual(result.sourceFrames, source.length);
  assert.strictEqual(result.tailFrames, Math.floor(sampleRate * 1.5));
  assert.strictEqual(result.outputFrames, result.sourceFrames + result.tailFrames);
  assert.strictEqual(result.sampleRate, sampleRate);
  assert.ok(result.wavBytes instanceof Uint8Array);
  assert.strictEqual(result.previewChannels.length, 2);
  assert.strictEqual(result.previewChannels[0].length, result.outputFrames);
});

test('renderRecipe: preview is exact decoded WAV', () => {
  const sampleRate = 24000;
  const source = createDemoSource(sampleRate, 'tap');
  const recipe = {
    version: 1,
    doorClosed: false,
    trajectory: [
      { t: 0, x: 0.3, y: 0.2 },
      { t: source.length / sampleRate, x: 0.7, y: 0.8 }
    ]
  };

  const result = renderRecipe(source, sampleRate, recipe);

  // Decode WAV independently
  const decoded = decodeWav(result.wavBytes);

  // Must be sample-for-sample identical
  assert.strictEqual(result.previewChannels[0].length, decoded.channels[0].length);
  for (let i = 0; i < result.previewChannels[0].length; i++) {
    assert.strictEqual(result.previewChannels[0][i], decoded.channels[0][i], `left[${i}]`);
    assert.strictEqual(result.previewChannels[1][i], decoded.channels[1][i], `right[${i}]`);
  }
});

test('renderRecipe: stereo panning audible', () => {
  const sampleRate = 24000;
  const source = new Float32Array(sampleRate * 0.1);
  source.fill(0.5);

  // Left side
  const recipeLeft = {
    version: 1,
    doorClosed: false,
    trajectory: [
      { t: 0, x: 0, y: 0.5 },
      { t: 0.1, x: 0, y: 0.5 }
    ]
  };
  const resultLeft = renderRecipe(source, sampleRate, recipeLeft);
  const leftEnergy = resultLeft.previewChannels[0].reduce((sum, v) => sum + v * v, 0);
  const rightEnergyLeft = resultLeft.previewChannels[1].reduce((sum, v) => sum + v * v, 0);

  // Right side
  const recipeRight = {
    version: 1,
    doorClosed: false,
    trajectory: [
      { t: 0, x: 1, y: 0.5 },
      { t: 0.1, x: 1, y: 0.5 }
    ]
  };
  const resultRight = renderRecipe(source, sampleRate, recipeRight);
  const leftEnergyRight = resultRight.previewChannels[0].reduce((sum, v) => sum + v * v, 0);
  const rightEnergy = resultRight.previewChannels[1].reduce((sum, v) => sum + v * v, 0);

  // Left recipe should have more energy in left channel
  assert.ok(leftEnergy > rightEnergyLeft * 2, 'Left pan should favor left channel');
  // Right recipe should have more energy in right channel
  assert.ok(rightEnergy > leftEnergyRight * 2, 'Right pan should favor right channel');
});

test('renderRecipe: distance attenuation', () => {
  const sampleRate = 24000;
  const source = new Float32Array(sampleRate * 0.1);
  source.fill(0.5);

  // Near
  const recipeNear = {
    version: 1,
    doorClosed: false,
    trajectory: [
      { t: 0, x: 0.5, y: 0 },
      { t: 0.1, x: 0.5, y: 0 }
    ]
  };
  const resultNear = renderRecipe(source, sampleRate, recipeNear);
  const nearEnergy = resultNear.previewChannels[0].reduce((sum, v) => sum + v * v, 0) +
                     resultNear.previewChannels[1].reduce((sum, v) => sum + v * v, 0);

  // Far
  const recipeFar = {
    version: 1,
    doorClosed: false,
    trajectory: [
      { t: 0, x: 0.5, y: 1 },
      { t: 0.1, x: 0.5, y: 1 }
    ]
  };
  const resultFar = renderRecipe(source, sampleRate, recipeFar);
  const farEnergy = resultFar.previewChannels[0].reduce((sum, v) => sum + v * v, 0) +
                    resultFar.previewChannels[1].reduce((sum, v) => sum + v * v, 0);

  assert.ok(nearEnergy > farEnergy * 2, 'Near should be louder than far');
});

test('renderRecipe: door closed muffles', () => {
  const sampleRate = 24000;
  const source = createDemoSource(sampleRate, 'tap');

  const recipeOpen = {
    version: 1,
    doorClosed: false,
    trajectory: [
      { t: 0, x: 0.5, y: 0.5 },
      { t: source.length / sampleRate, x: 0.5, y: 0.5 }
    ]
  };
  const resultOpen = renderRecipe(source, sampleRate, recipeOpen);

  const recipeClosed = {
    version: 1,
    doorClosed: true,
    trajectory: [
      { t: 0, x: 0.5, y: 0.5 },
      { t: source.length / sampleRate, x: 0.5, y: 0.5 }
    ]
  };
  const resultClosed = renderRecipe(source, sampleRate, recipeClosed);

  // Measure high-frequency content (simple difference proxy)
  function highFreqContent(channel) {
    let sum = 0;
    for (let i = 1; i < channel.length; i++) {
      sum += Math.abs(channel[i] - channel[i - 1]);
    }
    return sum;
  }

  const openHF = highFreqContent(resultOpen.previewChannels[0]);
  const closedHF = highFreqContent(resultClosed.previewChannels[0]);

  assert.ok(openHF > closedHF, 'Door open should have more high-frequency content');
});

test('renderRecipe: tail contains nonzero samples', () => {
  const sampleRate = 24000;
  const source = createDemoSource(sampleRate, 'tap');

  const recipe = {
    version: 1,
    doorClosed: false,
    trajectory: [
      { t: 0, x: 0.5, y: 0.5 },
      { t: source.length / sampleRate, x: 0.5, y: 0.5 }
    ]
  };

  const result = renderRecipe(source, sampleRate, recipe);

  // Check tail region (last 1.5s)
  const tailStart = result.sourceFrames;
  let tailEnergy = 0;
  for (let i = tailStart; i < result.outputFrames; i++) {
    tailEnergy += result.previewChannels[0][i] ** 2 + result.previewChannels[1][i] ** 2;
  }

  assert.ok(tailEnergy > 0, 'Tail should contain ambience');
});

test('renderRecipe: normalization only when peak > 0.95', () => {
  const sampleRate = 24000;

  // Quiet source (peak < 0.95)
  const sourceQuiet = new Float32Array(sampleRate * 0.1);
  sourceQuiet.fill(0.1);
  const recipeQuiet = {
    version: 1,
    doorClosed: false,
    trajectory: [
      { t: 0, x: 0.5, y: 0 },
      { t: 0.1, x: 0.5, y: 0 }
    ]
  };
  const resultQuiet = renderRecipe(sourceQuiet, sampleRate, recipeQuiet);
  assert.strictEqual(resultQuiet.normalizationGain, 1.0, 'Quiet source should not normalize');

  // Loud source (peak > 0.95)
  const sourceLoud = new Float32Array(sampleRate * 0.1);
  sourceLoud.fill(1.0);
  const recipeLoud = {
    version: 1,
    doorClosed: false,
    trajectory: [
      { t: 0, x: 0.5, y: 0 },
      { t: 0.1, x: 0.5, y: 0 }
    ]
  };
  const resultLoud = renderRecipe(sourceLoud, sampleRate, recipeLoud);
  assert.ok(resultLoud.normalizationGain < 1.0, 'Loud source should normalize');
  assert.ok(resultLoud.normalizationGain <= 1.0, 'Gain should never boost');
});

test('renderRecipe: source not mutated', () => {
  const sampleRate = 24000;
  const source = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]);
  const original = new Float32Array(source);

  const recipe = {
    version: 1,
    doorClosed: false,
    trajectory: [
      { t: 0, x: 0, y: 0 },
      { t: source.length / sampleRate, x: 1, y: 1 }
    ]
  };

  renderRecipe(source, sampleRate, recipe);

  for (let i = 0; i < source.length; i++) {
    assert.strictEqual(source[i], original[i], `source[${i}] was mutated`);
  }
});

test('renderRecipe: rejects invalid source', () => {
  const recipe = {
    version: 1,
    doorClosed: false,
    trajectory: [{ t: 0, x: 0, y: 0 }, { t: 0.1, x: 1, y: 1 }]
  };

  assert.throws(() => renderRecipe([], 24000, recipe), /must be Float32Array/);
  assert.throws(() => renderRecipe(new Float32Array(0), 24000, recipe), /nonempty/);
  assert.throws(() => renderRecipe(new Float32Array([NaN]), 24000, recipe), /not finite/);
  assert.throws(() => renderRecipe(new Float32Array([2]), 24000, recipe), /out of range/);
});

test('renderRecipe: rejects invalid sample rate', () => {
  const source = new Float32Array([0.5]);
  const recipe = {
    version: 1,
    doorClosed: false,
    trajectory: [{ t: 0, x: 0, y: 0 }, { t: 1 / 24000, x: 1, y: 1 }]
  };

  assert.throws(() => renderRecipe(source, 44100, recipe), /must be 24000 or 48000/);
});

test('renderRecipe: max 8 second source', () => {
  const sampleRate = 24000;
  const source = new Float32Array(sampleRate * 8 + 1);
  const recipe = {
    version: 1,
    doorClosed: false,
    trajectory: [
      { t: 0, x: 0.5, y: 0.5 },
      { t: (sampleRate * 8 + 1) / sampleRate, x: 0.5, y: 0.5 }
    ]
  };

  assert.throws(() => renderRecipe(source, sampleRate, recipe), /source too long/);
});

test('renderRecipe: output exactly sourceFrames + 1.5s tail', () => {
  const sampleRate = 48000;
  const source = createDemoSource(sampleRate, 'creak');
  const recipe = {
    version: 1,
    doorClosed: false,
    trajectory: [
      { t: 0, x: 0.5, y: 0.5 },
      { t: source.length / sampleRate, x: 0.5, y: 0.5 }
    ]
  };

  const result = renderRecipe(source, sampleRate, recipe);
  const expectedTail = Math.floor(sampleRate * 1.5);
  const expectedOutput = source.length + expectedTail;

  assert.strictEqual(result.outputFrames, expectedOutput);
  assert.strictEqual(result.tailFrames, expectedTail);
});

// ============================================================================
// DEMO SOURCE TESTS
// ============================================================================

test('createDemoSource: tap is deterministic', () => {
  const src1 = createDemoSource(24000, 'tap');
  const src2 = createDemoSource(24000, 'tap');

  assert.strictEqual(src1.length, src2.length);
  for (let i = 0; i < src1.length; i++) {
    assert.strictEqual(src1[i], src2[i]);
  }
});

test('createDemoSource: creak is deterministic and distinct', () => {
  const tap = createDemoSource(24000, 'tap');
  const creak = createDemoSource(24000, 'creak');

  assert.notStrictEqual(tap.length, creak.length);
  
  let differences = 0;
  const minLen = Math.min(tap.length, creak.length);
  for (let i = 0; i < minLen; i++) {
    if (tap[i] !== creak[i]) differences++;
  }
  assert.ok(differences > minLen * 0.9, 'Tap and creak should be mostly different');
});

test('createDemoSource: breath is deterministic and distinct', () => {
  const tap = createDemoSource(24000, 'tap');
  const breath = createDemoSource(24000, 'breath');

  assert.notStrictEqual(tap.length, breath.length);

  let differences = 0;
  const minLen = Math.min(tap.length, breath.length);
  for (let i = 0; i < minLen; i++) {
    if (tap[i] !== breath[i]) differences++;
  }
  assert.ok(differences > minLen * 0.9, 'Tap and breath should be mostly different');
});

test('createDemoSource: all sources in valid range', () => {
  const kinds = ['tap', 'creak', 'breath'];
  for (const kind of kinds) {
    const src = createDemoSource(48000, kind);
    assert.ok(src.length <= 48000 * 2, `${kind} should be <= 2s`);
    for (let i = 0; i < src.length; i++) {
      assert.ok(isFinite(src[i]), `${kind}[${i}] not finite`);
      assert.ok(src[i] >= -1 && src[i] <= 1, `${kind}[${i}] out of range`);
    }
  }
});

test('createDemoSource: rejects unknown kind', () => {
  assert.throws(() => createDemoSource(24000, 'unknown'), /Unknown demo kind/);
});

test('createDemoSource: rejects invalid sample rate', () => {
  assert.throws(() => createDemoSource(44100, 'tap'), /must be 24000 or 48000/);
});
