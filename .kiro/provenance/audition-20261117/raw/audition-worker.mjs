import { buildAudition } from './audition-core.mjs';

// Guard self for safe node import
if (typeof self !== 'undefined' && typeof self.postMessage === 'function') {
  self.onmessage = function(event) {
    const { id, settings } = event.data;

    try {
      const result = buildAudition(settings);
      
      // Transfer wavBytes buffer for efficiency
      self.postMessage(
        { id, result },
        [result.wavBytes.buffer]
      );
    } catch (error) {
      self.postMessage({
        id,
        error: error.message || String(error)
      });
    }
  };
}
