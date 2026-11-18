# Audition Module Contract

## Purpose
Minimal dependency-free ESM module for bounded static audition in Foley Seance browser-local sound room. Provides user-started looping spatial sketches with synthetic creak/breath sources, static placement (x, y), and door state toggle only.

## Scope and Boundaries

### In Scope
- User-initiated looping audition with explicit start
- Static spatial placement (x, y coordinates 0..1)
- Door state (open/closed) toggle
- Synthetic builtin sources: creak and breath (<=8sec mono)
- Fixed sample rates: 24000 or 48000 Hz
- Bounded loop duration (full source + fixed 1.5sec tail)
- Phase-aligned crossfade updates during playback
- Worker-based rendering with transferable buffers

### Out of Scope
- Authored movement/render/export (separate, untouched workflows)
- Recording performances or trajectory capture
- Autoplay, background audio, or automatic resume
- Microphone input or live audio processing
- User accounts, persistence, or cloud features
- Custom UI components (parent integrates)
- Real-time guarantees (best-effort latency reporting)
- Dynamic source upload or different sound graph
- Continuous room physics simulation claims

## Architecture

### Core (`audition-core.mjs`)
Pure function `buildAudition(settings)` that:
1. Validates exact plain data schema
2. Creates demo source via shared `createDemoSource(rate, kind)`
3. Builds static recipe with fixed x/y trajectory
4. Calls shared `renderRecipe(source, rate, recipe)` containing artistic room DSP
5. Applies fixed master gain (0.35) and 20ms loop boundary fades
6. Encodes edited PCM to WAV via shared `encodeWav(channels, rate)`
7. Returns `{wavBytes, sampleRate, frames, kind}`

**Normalization Convention**: Shared renderer applies down-only normalization per buffer. For these builtin sources, normalization should not trigger. Module rejects unexpected gain reduction (< 0.99) rather than accepting gain pumping. Fixed master gain 0.35 applied by controller, never automatic loudness compensation.

**Immutability**: Does not mutate shared engine output; creates new Float32Array for faded channels.

### Worker (`audition-worker.mjs`)
- Imports core
- Handles `{id, settings}` messages
- Returns `{id, result}` or `{id, error}`
- Transfers `wavBytes.buffer` for efficiency
- Guarded `self` check for safe node import

### Controller (`audition-controller.mjs`)
Factory `createAuditionController(config)` with:

**Config Requirements**:
- `context`: AudioContext (caller creates and resumes on explicit user gesture)
- `worker`: Web Worker instance
- `decode(bytes)`: Promise<AudioBuffer> injected for native decoding
- `onState(state)`: Receives `{state, revision, latencyMs?}`
- `onError(error)`: Error callback
- `now()`: Optional, defaults to `performance.now`

**API**:
- `start(settings)`: Begin audition from explicit caller interaction only
- `update(settings)`: Update parameters during playback
- `stop()`: Stop immediately, invalidate epoch
- `dispose()`: Cleanup and terminate worker

**State Management**:
- Single inflight worker request + newest pending (stale requests discarded)
- Stale revision checks after both worker response AND async decode
- Never starve latest while dragging; pending replaces previous pending
- Active kind/sampleRate change treated as stop + explicit new start

**Audio Graph**:
- AudioBufferSource (looping) → GainNode → destination
- Phase alignment: offset calculated from shared audio context start epoch
- Linear complementary 40ms crossfade ramps (not equal-power, signals correlated)
- Retiring nodes stopped/disconnected at audio-time end via `onended` callback
- No setTimeout for sound timing guarantees
- Bounded total gain: serialize transitions safely

**Safety**:
- Stop/dispose prevents stale decode results from restarting audio
- Handles worker errors, decode rejection, source start exception
- No unhandled promise rejections
- Validates decoded stereo/rate/framecount and finite peaks before playback

**Limitations**:
- Updates show pending state and measured latency only
- No real-time guarantees (best-effort async rendering)
- No browser reads or hidden global side effects at import time

## Ownership and Responsibilities

### Caller Responsibilities
- Create and own AudioContext lifecycle
- Call `context.resume()` on explicit user gesture (e.g., click handler)
- Provide Web Worker instance
- Provide native decode function (e.g., `context.decodeAudioData.bind(context)`)
- Handle state changes via `onState` callback
- Handle errors via `onError` callback
- Call `start()` only from explicit user interaction
- Integrate into UI (module provides no UI components)

### Module Responsibilities
- Validate input settings schema and reject malformed data
- Render audio via worker without blocking main thread
- Manage audio graph lifecycle (source, gain, crossfades)
- Prevent stale audio playback after stop/dispose
- Report state transitions and measured latency
- Clean up all resources on dispose

### Shared Engine Responsibilities
- Provide `createDemoSource(rate, kind)` for synthetic sources
- Provide `renderRecipe(source, rate, recipe)` with artistic room DSP
- Provide `encodeWav(channels, rate)` for WAV encoding
- Apply fixed 1.5sec tail processing
- Return normalized stereo preview channels and metadata

## Testing Requirements
Tests use `node:test` mocks, no external dependencies:
- Settings validation (exact schema enforcement)
- Stop during decode prevents playback
- Queue burst with single inflight limit
- Stale revision discard after new start
- Phase alignment verification (shared epoch preserved)
- Complementary ramps and bounded node count
- Error handling: worker error, decode rejection, malformed response
- Worker core settings validation

## Performance Characteristics
- Worker rendering: non-blocking main thread
- Transferable buffers: zero-copy worker → main
- Measured latency: worker + decode time reported
- Fixed loop duration: full source + 1.5sec tail
- Crossfade overhead: 40ms transition period
- Memory: bounded by single active buffer + short retiring queue

## Limitations and Non-Goals
- No autoplay or background audio (explicit user start required)
- No real-time hard guarantees (async rendering, best-effort latency)
- No trajectory recording or authored performance capture
- No dynamic source upload or arbitrary audio files
- No microphone input or live audio processing
- No persistence, accounts, or cloud synchronization
- No UI components (parent integration responsibility)
- No claims of continuous room physics simulation
- Builtin sources only (creak, breath) - no custom sound graph
