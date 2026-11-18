import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { normalizeMotion, motionTrajectory } from './custom-motion.mjs';

test('normalizeMotion: basic nonuniform timing normalization', () => {
  const samples = [
    { x: 0.1, y: 0.2, t: 1.0 },
    { x: 0.3, y: 0.4, t: 2.5 },
    { x: 0.7, y: 0.8, t: 4.0 }
  ];
  const result = normalizeMotion(samples, 3);
  
  assert.equal(result.length, 3);
  assert.equal(result[0].t, 0);
  assert.equal(result[2].t, 3);
  assert.ok(result[1].t > 0 && result[1].t < 3);
  assert.ok(result[0].t < result[1].t && result[1].t < result[2].t);
  assert.equal(result[0].x, 0.1);
  assert.equal(result[1].y, 0.4);
});

test('normalizeMotion: exact endpoint preservation', () => {
  const samples = [
    { x: 0, y: 0, t: 5.5 },
    { x: 1, y: 1, t: 7.5 }
  ];
  const result = normalizeMotion(samples, 2);
  
  assert.equal(result[0].t, 0);
  assert.equal(result[1].t, 2);
  assert.equal(result[0].x, 0);
  assert.equal(result[1].y, 1);
});

test('normalizeMotion: stationary dwell with repeated coordinates', () => {
  const samples = [
    { x: 0.5, y: 0.5, t: 0 },
    { x: 0.5, y: 0.5, t: 2 },
    { x: 0.5, y: 0.5, t: 4 }
  ];
  const result = normalizeMotion(samples, 4);
  
  assert.equal(result.length, 3);
  assert.equal(result[0].x, 0.5);
  assert.equal(result[1].x, 0.5);
  assert.equal(result[2].x, 0.5);
  assert.ok(result[0].t < result[1].t && result[1].t < result[2].t);
});

test('normalizeMotion: owned copy not mutation', () => {
  const samples = [
    { x: 0.2, y: 0.3, t: 1 },
    { x: 0.8, y: 0.9, t: 3 }
  ];
  const result = normalizeMotion(samples, 2);
  
  assert.notStrictEqual(result, samples);
  assert.notStrictEqual(result[0], samples[0]);
  assert.equal(samples[0].t, 1); // Original unchanged
});

test('normalizeMotion: accepts exactly 128 points', () => {
  const samples = Array.from({ length: 128 }, (_, i) => ({
    x: 0.5, y: 0.5, t: i * 0.01
  }));
  const result = normalizeMotion(samples, 1);
  assert.equal(result.length, 128);
});

test('normalizeMotion: rejects 129 points', () => {
  const samples = Array.from({ length: 129 }, (_, i) => ({
    x: 0.5, y: 0.5, t: i * 0.01
  }));
  assert.throws(() => normalizeMotion(samples, 1), /2-128 points/);
});

test('normalizeMotion: rejects non-finite coordinates', () => {
  assert.throws(() => normalizeMotion([
    { x: NaN, y: 0.5, t: 0 },
    { x: 0.5, y: 0.5, t: 1 }
  ], 1), /finite/);
  
  assert.throws(() => normalizeMotion([
    { x: 0.5, y: Infinity, t: 0 },
    { x: 0.5, y: 0.5, t: 1 }
  ], 1), /finite/);
});

test('normalizeMotion: rejects invalid duration', () => {
  const samples = [{ x: 0, y: 0, t: 0 }, { x: 1, y: 1, t: 1 }];
  
  assert.throws(() => normalizeMotion(samples, 0), /Duration/);
  assert.throws(() => normalizeMotion(samples, -1), /Duration/);
  assert.throws(() => normalizeMotion(samples, 9), /Duration/);
  assert.throws(() => normalizeMotion(samples, NaN), /Duration/);
});

test('normalizeMotion: rejects non-strictly increasing time', () => {
  assert.throws(() => normalizeMotion([
    { x: 0, y: 0, t: 1 },
    { x: 1, y: 1, t: 1 }
  ], 1), /strictly increasing/);
  
  assert.throws(() => normalizeMotion([
    { x: 0, y: 0, t: 2 },
    { x: 1, y: 1, t: 1 }
  ], 1), /strictly increasing/);
});

test('normalizeMotion: rejects invalid time span', () => {
  assert.throws(() => normalizeMotion([
    { x: 0, y: 0, t: 0 },
    { x: 1, y: 1, t: 9 }
  ], 1), /span/);
});

test('normalizeMotion: accessor not invoked', () => {
  let accessed = false;
  const samples = [
    { x: 0, y: 0, get t() { accessed = true; return 0; } },
    { x: 1, y: 1, t: 1 }
  ];
  
  assert.throws(() => normalizeMotion(samples, 1), /accessor/);
  assert.equal(accessed, false);
});

test('normalizeMotion: rejects extra fields', () => {
  assert.throws(() => normalizeMotion([
    { x: 0, y: 0, t: 0, extra: 'field' },
    { x: 1, y: 1, t: 1 }
  ], 1), /exactly x, y, t/);
});

test('normalizeMotion: rejects symbol properties on point', () => {
  const sym = Symbol('test');
  const point = { x: 0, y: 0, t: 0 };
  point[sym] = 'value';
  
  assert.throws(() => normalizeMotion([point, { x: 1, y: 1, t: 1 }], 1), /symbol|exactly x, y, t|dense numeric/);
});

test('normalizeMotion: rejects array with holes', () => {
  const samples = [{ x: 0, y: 0, t: 0 }, { x: 1, y: 1, t: 1 }];
  samples.length = 3;
  
  assert.throws(() => normalizeMotion(samples, 1), /dense/);
});

test('normalizeMotion: rejects array with symbol properties', () => {
  const samples = [{ x: 0, y: 0, t: 0 }, { x: 1, y: 1, t: 1 }];
  samples[Symbol('test')] = 'value';
  
  assert.throws(() => normalizeMotion(samples, 1), /symbol|exactly x, y, t|dense numeric/);
});

test('normalizeMotion: precision collapse with very small duration', () => {
  const samples = [
    { x: 0, y: 0, t: 0 },
    { x: 0.5, y: 0.5, t: 1 },
    { x: 1, y: 1, t: 2 }
  ];
  
  assert.throws(() => normalizeMotion(samples, Number.MIN_VALUE), /Precision collapse/);
});

test('motionTrajectory: retimes normalized path', () => {
  const normalized = [
    { x: 0.1, y: 0.2, t: 0 },
    { x: 0.5, y: 0.5, t: 0.5 },
    { x: 0.9, y: 0.8, t: 1 }
  ];
  const result = motionTrajectory(normalized, 4);
  
  assert.equal(result[0].t, 0);
  assert.equal(result[1].t, 2);
  assert.equal(result[2].t, 4);
  assert.equal(result[0].x, 0.1);
});

test('motionTrajectory: rejects bad first endpoint', () => {
  const bad = [
    { x: 0, y: 0, t: 0.1 },
    { x: 1, y: 1, t: 1 }
  ];
  
  assert.throws(() => motionTrajectory(bad, 2), /First point.*exactly 0/);
});

test('motionTrajectory: rejects bad last endpoint', () => {
  const bad = [
    { x: 0, y: 0, t: 0 },
    { x: 1, y: 1, t: 0.9 }
  ];
  
  assert.throws(() => motionTrajectory(bad, 2), /Last point.*exactly 1/);
});

test('motionTrajectory: rejects non-strictly increasing', () => {
  const bad = [
    { x: 0, y: 0, t: 0 },
    { x: 0.5, y: 0.5, t: 0.3 },
    { x: 1, y: 1, t: 0.3 },
    { x: 1, y: 1, t: 1 }
  ];
  
  assert.throws(() => motionTrajectory(bad, 2), /strictly increasing/);
});

test('integration: normalize then retime preserves trajectory shape', () => {
  const samples = [
    { x: 0, y: 0, t: 2 },
    { x: 0.5, y: 1, t: 5 },
    { x: 1, y: 0, t: 6 }
  ];
  
  const normalized = normalizeMotion(samples, 1);
  const trajectory = motionTrajectory(normalized, 3);
  
  assert.equal(trajectory[0].x, 0);
  assert.equal(trajectory[1].x, 0.5);
  assert.equal(trajectory[2].x, 1);
  assert.equal(trajectory[0].t, 0);
  assert.equal(trajectory[2].t, 3);
});
