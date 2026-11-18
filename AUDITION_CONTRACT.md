# Audition integration contract

Exports createAuditionController({context,worker,decode,onState,onError,now}) from audition-controller.mjs. Module Worker entry audition-worker.mjs imports audition-core.mjs, which imports existing foley-engine.mjs unchanged.

Caller owns context creation/resume on explicit click. decode(Uint8Array) returns native AudioBuffer. start(settings), update(settings), stop(), dispose(). Settings are exact plain {kind:'creak'|'breath',sampleRate:24000|48000,x:0..1,y:0..1,doorClosed:boolean}. update while inactive returns false and never restarts; kind/rate change stops and throws, requiring explicit start. dispose terminates owned worker; controller owns that dedicated worker's handlers.

onState emits {state:'stopped'|'pending'|'playing',revision,latencyMs?}. Latency includes measured request/render/decode/deferred-transition delay plus audio start scheduling lead. It is not a realtime guarantee. Worker requests {id,settings}; responses {id,result:{wavBytes,sampleRate,frames,kind}} or {id,error}.

Static placement/door only. Synthetic source is repeated through the unchanged DSP for6seconds, then the last complete source cycle before the tail is extracted (creak1.2s/breath2s) with20ms end seam fades. Previous cycles contribute ambience: this is a recurring sketch, intentionally not the isolated exported cue. Export keeps its bounded1.5s tail. Export and authored trajectory remain separate. Master audition gain0.35 exactly once in controller. Gain ramps linear40ms, phase aligned to first audio-clock start. Maximum two connected voices; newer decoded result waits until prior retiring voice ends. Stop invalidates queued/decode work and disconnects all active/scheduled nodes. Source update must be explicitly stopped before replacement. No automatic gain compensation.

Qualification:10 independent essential mocked-controller/shared-engine tests pass on Node24.19.0 Windows. These are not browser/listening acceptance. Parent must verify real Worker/native decode/AudioContext interactions, source changes and stop behavior. Raw Kiro-generated tests are preserved as provenance, not represented as passing current integration tests.

## Imported-source integrator extension

Settings kind:'import' adds sourceId (nonempty string, max128characters) and source (owned finite mono Float32Array, nonempty and<=8seconds at the declared24/48kHz rate). Main UI now uses48kHz. Controller snapshots data and binds ID+bytes; changing source requires Stop/newStart, including sameID with changedbytes. Worker result carries sourceId and revision, validates whole-source+1.5second-tail frames, and permits only the same down-only normalization as export. No normalization-up or automatic trimming. Bounded copies are used initially; oneinflight+latestpending controls queue size. Imported audio uses wholeclip+tail mode regardless of duration; built-in warmedcycles remain their separately disclosed mode.

Current qualification:65tests pass and one real cloud Chrome48kHz stereo-WAV import/audition/export path succeeded, with independent downloaded-byte readback. Windows48kHz/imported audition and human listening remain unqualified.
