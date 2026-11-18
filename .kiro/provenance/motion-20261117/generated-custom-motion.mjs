/**
 * custom-motion.mjs
 * Pure browser JavaScript ES module for Foley Seance motion trajectory normalization.
 * No imports, DOM, IO, network, audio APIs, or global mutations.
 */

/**
 * Validates and normalizes motion samples to a specified duration.
 * @param {Array} samples - Array of 2-128 motion points with {x, y, t} properties
 * @param {number} duration - Target duration in seconds (>0, <=8)
 * @returns {Array} Normalized array with t mapped to [0, duration]
 */
export function normalizeMotion(samples, duration = 1) {
  // Validate duration
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0 || duration > 8) {
    throw new Error('Duration must be a finite number >0 and <=8');
  }

  // Validate array shape
  if (!Array.isArray(samples) || Object.getPrototypeOf(samples) !== Array.prototype) {
    throw new Error('Samples must be a plain Array');
  }
  if (samples.length < 2 || samples.length > 128) {
    throw new Error('Samples must contain 2-128 points');
  }

  // Check for dense array (no holes, no extra properties)
  const desc = Object.getOwnPropertyDescriptors(samples);
  for (let i = 0; i < samples.length; i++) {
    if (!(i in desc) || desc[i].get || desc[i].set) {
      throw new Error('Array must be dense with no accessor properties');
    }
  }
  for (const key of Object.keys(samples)) {
    if (key !== 'length' && (Number(key) < 0 || Number(key) >= samples.length || !Number.isInteger(Number(key)))) {
      throw new Error('Array must have only numeric indices and length');
    }
  }
  if (Object.getOwnPropertySymbols(samples).length > 0) {
    throw new Error('Array must not have symbol properties');
  }

  const result = [];
  let firstT = null;
  let lastT = null;

  // First pass: validate all points and find time bounds
  for (let i = 0; i < samples.length; i++) {
    const point = samples[i];
    
    // Validate point is plain object
    const proto = Object.getPrototypeOf(point);
    if (proto !== Object.prototype && proto !== null) {
      throw new Error('Points must be plain objects');
    }

    // Get descriptors to validate exact shape
    const pointDesc = Object.getOwnPropertyDescriptors(point);
    const keys = Object.keys(pointDesc);
    
    if (keys.length !== 3 || !keys.includes('x') || !keys.includes('y') || !keys.includes('t')) {
      throw new Error('Points must have exactly x, y, t properties');
    }
    if (pointDesc.x.get || pointDesc.x.set || pointDesc.y.get || pointDesc.y.set || pointDesc.t.get || pointDesc.t.set) {
      throw new Error('Points must not have accessor properties');
    }
    if (Object.getOwnPropertySymbols(point).length > 0) {
      throw new Error('Points must not have symbol properties');
    }

    // Read values
    const { x, y, t } = point;

    // Validate types and finite
    if (typeof x !== 'number' || !Number.isFinite(x)) {
      throw new Error('x must be a finite number');
    }
    if (typeof y !== 'number' || !Number.isFinite(y)) {
      throw new Error('y must be a finite number');
    }
    if (typeof t !== 'number' || !Number.isFinite(t) || t < 0) {
      throw new Error('t must be a finite non-negative number');
    }

    // Validate coordinate bounds
    if (x < 0 || x > 1) {
      throw new Error('x must be within [0, 1]');
    }
    if (y < 0 || y > 1) {
      throw new Error('y must be within [0, 1]');
    }

    // Validate strictly increasing time
    if (i > 0 && t <= lastT) {
      throw new Error('t values must be strictly increasing');
    }

    if (firstT === null) {
      firstT = t;
    }
    lastT = t;
  }

  // Validate time span
  const span = lastT - firstT;
  if (span <= 0 || span > 8) {
    throw new Error('Time span (last - first) must be >0 and <=8 seconds');
  }

  // Second pass: normalize and copy
  for (let i = 0; i < samples.length; i++) {
    const { x, y, t } = samples[i];
    
    let normalizedT;
    if (i === 0) {
      normalizedT = 0;
    } else if (i === samples.length - 1) {
      normalizedT = duration;
    } else {
      normalizedT = ((t - firstT) / span) * duration;
    }

    result.push({ x, y, t: normalizedT });
  }

  // Verify strictly increasing after normalization
  for (let i = 1; i < result.length; i++) {
    if (result[i].t <= result[i - 1].t) {
      throw new Error('Precision collapse: normalized times not strictly increasing');
    }
  }

  return result;
}

/**
 * Converts normalized motion points (t in [0,1]) to trajectory with specified duration.
 * @param {Array} normalizedPoints - Array of 2-128 points with t in [0, 1]
 * @param {number} duration - Target duration in seconds (>0, <=8)
 * @returns {Array} Trajectory with t scaled to [0, duration]
 */
export function motionTrajectory(normalizedPoints, duration) {
  // Validate duration
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0 || duration > 8) {
    throw new Error('Duration must be a finite number >0 and <=8');
  }

  // Validate array shape
  if (!Array.isArray(normalizedPoints) || Object.getPrototypeOf(normalizedPoints) !== Array.prototype) {
    throw new Error('Points must be a plain Array');
  }
  if (normalizedPoints.length < 2 || normalizedPoints.length > 128) {
    throw new Error('Points must contain 2-128 points');
  }

  // Check for dense array
  const desc = Object.getOwnPropertyDescriptors(normalizedPoints);
  for (let i = 0; i < normalizedPoints.length; i++) {
    if (!(i in desc) || desc[i].get || desc[i].set) {
      throw new Error('Array must be dense with no accessor properties');
    }
  }
  for (const key of Object.keys(normalizedPoints)) {
    if (key !== 'length' && (Number(key) < 0 || Number(key) >= normalizedPoints.length || !Number.isInteger(Number(key)))) {
      throw new Error('Array must have only numeric indices and length');
    }
  }
  if (Object.getOwnPropertySymbols(normalizedPoints).length > 0) {
    throw new Error('Array must not have symbol properties');
  }

  const result = [];

  // Validate and transform
  for (let i = 0; i < normalizedPoints.length; i++) {
    const point = normalizedPoints[i];
    
    // Validate point is plain object
    const proto = Object.getPrototypeOf(point);
    if (proto !== Object.prototype && proto !== null) {
      throw new Error('Points must be plain objects');
    }

    // Get descriptors
    const pointDesc = Object.getOwnPropertyDescriptors(point);
    const keys = Object.keys(pointDesc);
    
    if (keys.length !== 3 || !keys.includes('x') || !keys.includes('y') || !keys.includes('t')) {
      throw new Error('Points must have exactly x, y, t properties');
    }
    if (pointDesc.x.get || pointDesc.x.set || pointDesc.y.get || pointDesc.y.set || pointDesc.t.get || pointDesc.t.set) {
      throw new Error('Points must not have accessor properties');
    }
    if (Object.getOwnPropertySymbols(point).length > 0) {
      throw new Error('Points must not have symbol properties');
    }

    // Read values
    const { x, y, t } = point;

    // Validate types and finite
    if (typeof x !== 'number' || !Number.isFinite(x)) {
      throw new Error('x must be a finite number');
    }
    if (typeof y !== 'number' || !Number.isFinite(y)) {
      throw new Error('y must be a finite number');
    }
    if (typeof t !== 'number' || !Number.isFinite(t)) {
      throw new Error('t must be a finite number');
    }

    // Validate coordinate bounds
    if (x < 0 || x > 1) {
      throw new Error('x must be within [0, 1]');
    }
    if (y < 0 || y > 1) {
      throw new Error('y must be within [0, 1]');
    }

    // Validate exact endpoints and strictly increasing
    if (i === 0) {
      if (t !== 0) {
        throw new Error('First point t must be exactly 0');
      }
    } else if (i === normalizedPoints.length - 1) {
      if (t !== 1) {
        throw new Error('Last point t must be exactly 1');
      }
      if (t <= normalizedPoints[i - 1].t) {
        throw new Error('t values must be strictly increasing');
      }
    } else {
      if (t <= normalizedPoints[i - 1].t) {
        throw new Error('t values must be strictly increasing');
      }
    }

    // Scale time
    const scaledT = i === normalizedPoints.length - 1 ? duration : t * duration;
    
    result.push({ x, y, t: scaledT });
  }

  // Verify strictly increasing after scaling
  for (let i = 1; i < result.length; i++) {
    if (result[i].t <= result[i - 1].t) {
      throw new Error('Precision collapse: scaled times not strictly increasing');
    }
  }

  return result;
}
