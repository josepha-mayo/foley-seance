# Integration scope

Integrator-authored UI capture uses a 67 ms timer, not pointermove-only sampling, so stationary holds have repeated sampled positions. Motion events update only the owning pointer position. Successful normalization is the commit boundary; cancellation keeps the previous path/cue. A source review caught and corrected missing hold samples, missing pointer ownership and route-label refresh. The closed-door authoring overlay is intentionally an editing view, not a change to sound or door state.

The imported Kiro helper preserves all accepted points, checks exact endpoints and rejects numerical collapse instead of sorting/dropping/smoothing. The original generated file and prompt/output remain preserved. The app's sampling is an explicit approximation, about 15 Hz; no raw-gesture exactness or live recording is claimed.

Independent app-handler tests run actual source in a modeled DOM/audio/timer environment. CUA was unavailable, so no native interaction or listening pass is claimed for this feature. The existing original DSP/export is unchanged.
