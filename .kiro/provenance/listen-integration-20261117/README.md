# Explicit Summon & listen integration

Integrator-authored app change, not a new Kiro generation. The existing genuine Kiro-derived DSP and validated WAV path are unchanged. The authenticated Kiro CLI was on an unavailable connected PC; no credentials were sought and no new generation is claimed.

A primary user click synchronously requests AudioContext resume before rendering yields. Resume rejection is handled immediately and never rejects the render. A three-second timeout bounds only waiting for audio resume, not DSP/decode/hash work. Once audio is ready, the explicit intent waits for validated cue publication. Start requires matching playback token, settings revision, current cue identity and a running context. Stop, settings/source changes, project-open attempts and pagehide cancel pending listening. Failed/expired playback retains the validated cue and download. An explicit Rendered cue click can retry.

The prepared monitor start uses the existing35% listening gain and fade helper. Export bytes are never attenuated by monitor gain. No source selection, preset, project reopen or initial page load requests playback.

Seven deterministic tests execute the actual helper source with modeled audio/DOM promises and a controlled timer: ready-before-render, Stop-before-resume, rejection, expiry/late-resume, settings cancellation, monitor failure and explicit replay cancellation. These are race/model tests, not native browser playback or listening-quality evidence. Native acceptance remains separate.

Independent review corrected the dry-source first-resume path to use the same captured playback token and prepared start directly, rather than a second resume/reset that could suppress current error messages. Native scope and limitations are recorded in the root README.
