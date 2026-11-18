/**
 * @typedef {Object} AuditionControllerConfig
 * @property {AudioContext} context
 * @property {Worker} worker
 * @property {(bytes: Uint8Array) => Promise<AudioBuffer>} decode
 * @property {(state: AuditionState) => void} onState
 * @property {(error: Error) => void} onError
 * @property {() => number} [now]
 */

/**
 * @typedef {Object} AuditionState
 * @property {'stopped'|'pending'|'playing'} state
 * @property {number} revision
 * @property {number} [latencyMs]
 */

const CROSSFADE_MS = 40;

/**
 * Create an audition controller for looping spatial sketches.
 * @param {AuditionControllerConfig} config
 */
export function createAuditionController(config) {
  const { context, worker, decode, onState, onError, now = () => performance.now() } = config;

  let revision = 0;
  let currentEpoch = null; // { revision, kind, sampleRate, buffer, startTime, sourceNode, gainNode }
  let pendingRequest = null; // { revision, settings, startTime }
  let inflightRequest = null; // { revision, settings, startTime }
  let retiringNodes = []; // { sourceNode, gainNode, endTime }

  function emitState(state, latencyMs) {
    onState({
      state,
      revision,
      latencyMs: latencyMs !== undefined ? latencyMs : undefined
    });
  }

  function cleanup() {
    // Stop and disconnect all active and retiring nodes
    if (currentEpoch) {
      stopNode(currentEpoch.sourceNode, currentEpoch.gainNode);
      currentEpoch = null;
    }

    for (const retiring of retiringNodes) {
      stopNode(retiring.sourceNode, retiring.gainNode);
    }
    retiringNodes = [];

    pendingRequest = null;
    inflightRequest = null;
  }

  function stopNode(sourceNode, gainNode) {
    try {
      sourceNode.stop();
    } catch (e) {
      // Already stopped
    }
    try {
      sourceNode.disconnect();
    } catch (e) {
      // Already disconnected
    }
    try {
      gainNode.disconnect();
    } catch (e) {
      // Already disconnected
    }
  }

  function processQueue() {
    // If worker busy or nothing pending, return
    if (inflightRequest || !pendingRequest) {
      return;
    }

    // Move pending to inflight
    inflightRequest = pendingRequest;
    pendingRequest = null;

    const request = inflightRequest;

    worker.postMessage({
      id: request.revision,
      settings: request.settings
    });

    emitState('pending');
  }

  worker.onmessage = async function(event) {
    const { id, result, error } = event.data;

    // Check if stale
    if (id !== revision) {
      return; // Discard stale response
    }

    if (!inflightRequest || inflightRequest.revision !== id) {
      return; // Not our request
    }

    const request = inflightRequest;
    inflightRequest = null;

    if (error) {
      try {
        onError(new Error(`Worker error: ${error}`));
      } catch (e) {
        // Ignore onError exceptions
      }
      emitState('stopped');
      processQueue();
      return;
    }

    // Validate result
    if (!result || typeof result !== 'object') {
      try {
        onError(new Error('Invalid worker result'));
      } catch (e) {}
      emitState('stopped');
      processQueue();
      return;
    }

    const { wavBytes, sampleRate, frames, kind } = result;

    if (!(wavBytes instanceof Uint8Array)) {
      try {
        onError(new Error('wavBytes must be Uint8Array'));
      } catch (e) {}
      emitState('stopped');
      processQueue();
      return;
    }

    let buffer;
    try {
      buffer = await decode(wavBytes);
    } catch (decodeError) {
      // Check if stale after decode
      if (id !== revision) {
        processQueue();
        return;
      }

      try {
        onError(new Error(`Decode failed: ${decodeError.message}`));
      } catch (e) {}
      emitState('stopped');
      processQueue();
      return;
    }

    // Check if stale after async decode
    if (id !== revision) {
      processQueue();
      return;
    }

    // Validate decoded buffer
    if (buffer.numberOfChannels !== 2) {
      try {
        onError(new Error('Expected stereo buffer'));
      } catch (e) {}
      emitState('stopped');
      processQueue();
      return;
    }

    if (buffer.sampleRate !== sampleRate) {
      try {
        onError(new Error(`Sample rate mismatch: ${buffer.sampleRate} vs ${sampleRate}`));
      } catch (e) {}
      emitState('stopped');
      processQueue();
      return;
    }

    if (buffer.length !== frames) {
      try {
        onError(new Error(`Frame count mismatch: ${buffer.length} vs ${frames}`));
      } catch (e) {}
      emitState('stopped');
      processQueue();
      return;
    }

    // Validate finite peak
    for (let ch = 0; ch < 2; ch++) {
      const channelData = buffer.getChannelData(ch);
      for (let i = 0; i < channelData.length; i++) {
        if (!Number.isFinite(channelData[i])) {
          try {
            onError(new Error(`Non-finite sample in decoded buffer at channel ${ch}, frame ${i}`));
          } catch (e) {}
          emitState('stopped');
          processQueue();
          return;
        }
      }
    }

    const latencyMs = now() - request.startTime;

    // Create new epoch or update existing
    const contextTime = context.currentTime;
    const bufferDuration = buffer.duration;
    const crossfadeDuration = CROSSFADE_MS / 1000;

    if (!currentEpoch || currentEpoch.kind !== kind || currentEpoch.sampleRate !== sampleRate) {
      // Source change: start new epoch
      if (currentEpoch) {
        // Retire old epoch
        const oldSource = currentEpoch.sourceNode;
        const oldGain = currentEpoch.gainNode;

        // Fade out
        oldGain.gain.cancelScheduledValues(contextTime);
        oldGain.gain.setValueAtTime(oldGain.gain.value, contextTime);
        oldGain.gain.linearRampToValueAtTime(0, contextTime + crossfadeDuration);

        // Schedule stop and disconnect at audio-time end
        const endTime = contextTime + crossfadeDuration;
        retiringNodes.push({ sourceNode: oldSource, gainNode: oldGain, endTime });

        oldSource.onended = () => {
          stopNode(oldSource, oldGain);
          retiringNodes = retiringNodes.filter(n => n.sourceNode !== oldSource);
        };

        try {
          oldSource.stop(endTime);
        } catch (e) {
          stopNode(oldSource, oldGain);
          retiringNodes = retiringNodes.filter(n => n.sourceNode !== oldSource);
        }
      }

      // Create new epoch
      const sourceNode = context.createBufferSource();
      sourceNode.buffer = buffer;
      sourceNode.loop = true;

      const gainNode = context.createGain();
      gainNode.gain.setValueAtTime(0, contextTime);
      gainNode.gain.linearRampToValueAtTime(1, contextTime + crossfadeDuration);

      sourceNode.connect(gainNode);
      gainNode.connect(context.destination);

      try {
        sourceNode.start(contextTime);
      } catch (startError) {
        stopNode(sourceNode, gainNode);
        try {
          onError(new Error(`Failed to start source: ${startError.message}`));
        } catch (e) {}
        emitState('stopped');
        processQueue();
        return;
      }

      currentEpoch = {
        revision: id,
        kind,
        sampleRate,
        buffer,
        startTime: contextTime,
        sourceNode,
        gainNode
      };

      emitState('playing', latencyMs);
    } else {
      // Same source: crossfade to new buffer with phase alignment
      const oldSource = currentEpoch.sourceNode;
      const oldGain = currentEpoch.gainNode;
      const epochStartTime = currentEpoch.startTime;

      // Calculate phase-aligned start offset
      const elapsedSinceEpoch = contextTime - epochStartTime;
      const offset = elapsedSinceEpoch % bufferDuration;

      // Create new source at aligned offset
      const newSource = context.createBufferSource();
      newSource.buffer = buffer;
      newSource.loop = true;

      const newGain = context.createGain();
      newGain.gain.setValueAtTime(0, contextTime);
      newGain.gain.linearRampToValueAtTime(1, contextTime + crossfadeDuration);

      newSource.connect(newGain);
      newGain.connect(context.destination);

      // Complementary fade out on old
      oldGain.gain.cancelScheduledValues(contextTime);
      oldGain.gain.setValueAtTime(oldGain.gain.value, contextTime);
      oldGain.gain.linearRampToValueAtTime(0, contextTime + crossfadeDuration);

      try {
        newSource.start(contextTime, offset);
      } catch (startError) {
        stopNode(newSource, newGain);
        try {
          onError(new Error(`Failed to start source: ${startError.message}`));
        } catch (e) {}
        emitState('stopped');
        processQueue();
        return;
      }

      // Retire old source
      const endTime = contextTime + crossfadeDuration;
      retiringNodes.push({ sourceNode: oldSource, gainNode: oldGain, endTime });

      oldSource.onended = () => {
        stopNode(oldSource, oldGain);
        retiringNodes = retiringNodes.filter(n => n.sourceNode !== oldSource);
      };

      try {
        oldSource.stop(endTime);
      } catch (e) {
        stopNode(oldSource, oldGain);
        retiringNodes = retiringNodes.filter(n => n.sourceNode !== oldSource);
      }

      // Update epoch
      currentEpoch = {
        revision: id,
        kind,
        sampleRate,
        buffer,
        startTime: epochStartTime, // Preserve epoch start
        sourceNode: newSource,
        gainNode: newGain
      };

      emitState('playing', latencyMs);
    }

    // Process next pending
    processQueue();
  };

  worker.onerror = function(event) {
    try {
      onError(new Error(`Worker error: ${event.message}`));
    } catch (e) {}
    
    if (inflightRequest && inflightRequest.revision === revision) {
      inflightRequest = null;
      emitState('stopped');
      processQueue();
    }
  };

  return {
    start(settings) {
      revision++;
      cleanup();

      pendingRequest = {
        revision,
        settings,
        startTime: now()
      };

      processQueue();
    },

    update(settings) {
      if (!currentEpoch && !inflightRequest && !pendingRequest) {
        // No active state, treat as start
        this.start(settings);
        return;
      }

      // Check for source change
      if (currentEpoch && (settings.kind !== currentEpoch.kind || settings.sampleRate !== currentEpoch.sampleRate)) {
        // Treat as new start
        this.start(settings);
        return;
      }

      revision++;

      // Replace pending
      pendingRequest = {
        revision,
        settings,
        startTime: now()
      };

      processQueue();
    },

    stop() {
      revision++;
      cleanup();
      emitState('stopped');
    },

    dispose() {
      revision++;
      cleanup();
      worker.terminate();
    }
  };
}
