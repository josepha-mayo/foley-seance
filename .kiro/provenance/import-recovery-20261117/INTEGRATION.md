# Import recovery integration
Integrator-authored correction, not a new Kiro generation. Existing genuine Kiro provenance is unchanged.
The previous handler discarded the rendered WAV before validating a replacement import. It now stops listening, locks controls, validates/decodes, and lets installSource invalidate the cue only after validation. Failure retains the source/settings/cue. Latest-request identity protects asynchronous completion. The file chooser is reset for explicit same-file retry.
Nine tests run the actual import-handler source with modeled dependencies. All 170 source/model checks and three launcher checks pass. Native qualification of this delta remains pending due to localhost-preview connection failure. No waveform or external file is included.

Queued file-change events while rendering or drawing are ignored, with the file chooser reset and no playback or cue mutation. Two modeled actual-handler tests cover these guards.
