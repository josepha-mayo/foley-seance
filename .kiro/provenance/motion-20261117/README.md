# Genuine Kiro custom motion contribution

One successful Kiro CLI3.4.0 invocation using existing authenticated session, claude-sonnet-4.5, chat --no-interactive --trust-tools=. No trusted tools, credential reads, auth changes, UI interaction, user audio or private runtime data. Prompt supplied the precise existing renderer contract; no claim that Kiro inspected unseen files.

prompt.txt and stdout.txt preserve prompt and response text via command transport (terminal newline normalization may occur). Original Windows files remain preserved. stderr was empty and exit was0. generated-custom-motion.mjs is the unchanged extracted module before independent review.

Integrated engine/custom-motion.mjs retains generated normalization/retiming algorithms. Integrator-added assertDataShape rejects non-enumerable fields, noncanonical numeric array keys, undefined accessors and non-object points before property reads. These were gaps in the generated validation. No DSP changes.

Generated tests needed corrections: stricter guard error matches; 1e-16 does not cause precision collapse, so use Number.MIN_VALUE; duplicate-time fixture now has a valid final endpoint to isolate the monotonicity failure. Raw generated tests remain inside stdout. Independent tests cover exact reversal/dwell timing, renderer contract, ownership and malformed descriptor shapes.24 focused tests passed, with no native drawing or listening claim.

API: normalizeMotion(samples,duration=1), motionTrajectory(normalizedPoints,duration).2..128 points, no dropping/sorting/smoothing, exact endpoints, finite x/y0..1 and strictly increasing timestamps. Captured elapsed span must be>0 and<=8seconds; target duration>0 and<=8seconds. Repeated coordinates preserve dwell. Precision collapse rejects rather than inventing times. This represents bounded sampled motion, not all raw pointer events or audio recording.
