import { strict as assert } from 'assert';
import { test } from 'node:test';
import {
  validateRecipe,
  renderRecipe,
  createDemoSource,
  encodeWav,
  decodeWav
} from './foley-engine.mjs';

test('v1 recipe rejects echoAmount', () => {
  assert.throws(
    () => validateRecipe({ version: 1, doorClosed: false, trajectory: [{ t: 0, x: 0.5, y: 0.5 }, { t: 1, x: 0.5, y: 0.5 }], echoAmount: 0.3 }, 1),
    /Unknown recipe fields: echoAmount/
  );
});

test('v2 recipe requires echoAmount', () => {
  assert.throws(
    () => validateRecipe({ version: 2, doorClosed: false, trajectory: [{ t: 0, x: 0.5, y: 0.5 }, { t: 1, x: 0.5, y: 0.5 }] }, 1),
    /Missing recipe fields: echoAmount/
  );
});

test('v2 echoAmount must be number', () => {
  assert.throws(
    () => validateRecipe({ version: 2, doorClosed: false, trajectory: [{ t: 0, x: 0.5, y: 0.5 }, { t: 1, x: 0.5, y: 0.5 }], echoAmount: '0.3' }, 1),
    /recipe.echoAmount must be finite number/
  );
});

test('v2 echoAmount rejects NaN', () => {
  assert.throws(
    () => validateRecipe({ version: 2, doorClosed: false, trajectory: [{ t: 0, x: 0.5, y: 0.5 }, { t: 1, x: 0.5, y: 0.5 }], echoAmount: NaN }, 1),
    /recipe.echoAmount must be finite number/
  );
});

test('v2 echoAmount rejects Infinity', () => {
  assert.throws(
    () => validateRecipe({ version: 2, doorClosed: false, trajectory: [{ t: 0, x: 0.5, y: 0.5 }, { t: 1, x: 0.5, y: 0.5 }], echoAmount: Infinity }, 1),
    /recipe.echoAmount must be finite number/
  );
});

test('v2 echoAmount rejects negative', () => {
  assert.throws(
    () => validateRecipe({ version: 2, doorClosed: false, trajectory: [{ t: 0, x: 0.5, y: 0.5 }, { t: 1, x: 0.5, y: 0.5 }], echoAmount: -0.1 }, 1),
    /recipe.echoAmount must be in \[0, 0\.6\]/
  );
});

test('v2 echoAmount rejects > 0.6', () => {
  assert.throws(
    () => validateRecipe({ version: 2, doorClosed: false, trajectory: [{ t: 0, x: 0.5, y: 0.5 }, { t: 1, x: 0.5, y: 0.5 }], echoAmount: 0.61 }, 1),
    /recipe.echoAmount must be in \[0, 0\.6\]/
  );
});

test('v2 echoAmount=0.3 produces byte-identical output to v1', () => {
  const source = createDemoSource(24000, 'tap');
  const recipe = { version: 1, doorClosed: false, trajectory: [{ t: 0, x: 0.5, y: 0.5 }, { t: source.length / 24000, x: 0.8, y: 0.2 }] };
  
  const v1Result = renderRecipe(source, 24000, recipe);
  const v2Result = renderRecipe(source, 24000, { ...recipe, version: 2, echoAmount: 0.3 });
  
  assert.equal(v1Result.wavBytes.length, v2Result.wavBytes.length);
  assert.deepEqual(v1Result.wavBytes, v2Result.wavBytes);
});

test('v1 and v2 default match for all demo kinds at 24kHz', () => {
  for (const kind of ['tap', 'creak', 'breath']) {
    const source = createDemoSource(24000, kind);
    const recipe = { version: 1, doorClosed: true, trajectory: [{ t: 0, x: 0.2, y: 0.8 }, { t: source.length / 24000, x: 0.7, y: 0.3 }] };
    
    const v1Result = renderRecipe(source, 24000, recipe);
    const v2Result = renderRecipe(source, 24000, { ...recipe, version: 2, echoAmount: 0.3 });
    
    assert.deepEqual(v1Result.wavBytes, v2Result.wavBytes, `${kind} mismatch at 24kHz`);
  }
});

test('v1 and v2 default match for all demo kinds at 48kHz', () => {
  for (const kind of ['tap', 'creak', 'breath']) {
    const source = createDemoSource(48000, kind);
    const recipe = { version: 1, doorClosed: false, trajectory: [{ t: 0, x: 0.1, y: 0.1 }, { t: source.length / 48000, x: 0.9, y: 0.9 }] };
    
    const v1Result = renderRecipe(source, 48000, recipe);
    const v2Result = renderRecipe(source, 48000, { ...recipe, version: 2, echoAmount: 0.3 });
    
    assert.deepEqual(v1Result.wavBytes, v2Result.wavBytes, `${kind} mismatch at 48kHz`);
  }
});

test('v2 echoAmount=0 produces distinct output', () => {
  const source = createDemoSource(24000, 'tap');
  const recipe = { version: 2, doorClosed: false, trajectory: [{ t: 0, x: 0.5, y: 0.5 }, { t: source.length / 24000, x: 0.5, y: 0.5 }], echoAmount: 0 };
  const recipeDefault = { ...recipe, echoAmount: 0.3 };
  
  const zeroResult = renderRecipe(source, 24000, recipe);
  const defaultResult = renderRecipe(source, 24000, recipeDefault);
  
  assert.equal(zeroResult.wavBytes.length, defaultResult.wavBytes.length);
  assert.notDeepEqual(zeroResult.wavBytes, defaultResult.wavBytes);
});

test('v2 echoAmount=0.6 produces distinct output', () => {
  const source = createDemoSource(24000, 'tap');
  const recipe = { version: 2, doorClosed: false, trajectory: [{ t: 0, x: 0.5, y: 0.5 }, { t: source.length / 24000, x: 0.5, y: 0.5 }], echoAmount: 0.6 };
  const recipeDefault = { ...recipe, echoAmount: 0.3 };
  
  const maxResult = renderRecipe(source, 24000, recipe);
  const defaultResult = renderRecipe(source, 24000, recipeDefault);
  
  assert.equal(maxResult.wavBytes.length, defaultResult.wavBytes.length);
  assert.notDeepEqual(maxResult.wavBytes, defaultResult.wavBytes);
});

test('v2 all echoAmount values produce same length output', () => {
  const source = createDemoSource(48000, 'creak');
  const baseRecipe = { version: 2, doorClosed: true, trajectory: [{ t: 0, x: 0.3, y: 0.7 }, { t: source.length / 48000, x: 0.6, y: 0.4 }] };
  
  const lengths = [0, 0.15, 0.3, 0.45, 0.6].map(echo => {
    const result = renderRecipe(source, 48000, { ...baseRecipe, echoAmount: echo });
    return result.wavBytes.length;
  });
  
  assert.ok(lengths.every(len => len === lengths[0]), 'All outputs should have identical length');
});

test('v2 output remains bounded for all echoAmount values', () => {
  const source = createDemoSource(24000, 'breath');
  const baseRecipe = { version: 2, doorClosed: false, trajectory: [{ t: 0, x: 0, y: 0 }, { t: source.length / 24000, x: 1, y: 1 }] };
  
  for (let echo = 0; echo <= 0.6; echo += 0.1) {
    const result = renderRecipe(source, 24000, { ...baseRecipe, echoAmount: echo });
    const decoded = decodeWav(result.wavBytes);
    
    for (const channel of decoded.channels) {
      for (let i = 0; i < channel.length; i++) {
        assert.ok(Math.abs(channel[i]) <= 1.0, `Sample out of bounds at echo=${echo}`);
        assert.ok(Number.isFinite(channel[i]), `Non-finite sample at echo=${echo}`);
      }
    }
  }
});
