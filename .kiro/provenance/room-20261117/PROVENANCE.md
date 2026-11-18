# Foley Seance genuine Kiro provenance

Existing authenticated Kiro CLI 3.4.0, claude-sonnet-4.5, chat --no-interactive --trust-tools=.
Only synthetic project specifications were supplied. No tools trusted, no user recordings, no credentials.

Iteration 1: mono granular contract. Interrupted intentionally when owner narrowed direction to stereo haunted room. Partial stdout and original prompt preserved; never extracted/executed/integrated.
Iteration 2: revised stereo haunted-room contract, complete generation exit0. Exact prompt/stdout/stderr and extracted module/tests preserved under iteration2. Raw module SHA256 63de868887540eb24b1130d988270489d9c9848ad080ad57506ae971acc27fbb.

Independent review before execution: pure module and node tests inspected; no network/filesystem/process/device calls. Generated suite43 tests:39 passed,4 failed due generated fixture/error-order expectations. Raw output retained.

Integration adaptations in candidate (NOT claimed unchanged generated code):
- Added rate guards in standalone encoder/decoder and before renderer processing.
- Reject empty decoded WAV.
- Reject nonplain/non-data recipe and point fields, including accessors/symbols.
- Removed clipping BEFORE peak measurement; normalize entire unclipped stereo result once.
- Fade last50ms of fixed1.5s tail explicitly tozero.
- Corrected four generated test fixtures: valid duration when testing pointcount; interior decreasing time with valid endpoint; RIFF error precedes data error on truncation; hardpan loud fixture actually exceeds normalization threshold (center equalpower does not).
- Added4 independent tests for exact PCM/rates, unclipped normalization+tail, accessor rejection, maxduration+silence both rates.
Final47 tests passed Node24.19.0 on Windows. This is DSP/unit qualification, not listening, browser playback, external WAV-player parity, or usability acceptance.

DSP intentionally simple: equalpower pan, artistic distance gain/onepole lowpass, door attenuation/lowpass, four fixed feedback taps. No physically accurate acoustics, convolution, or AI synthesis claim. Input max8s and fixed1.5s tail; last50ms faded. Demo tap/creak/breath are synthetic authored fixtures. Floating math deterministic on tested runtime; cross-engine byteidentity not claimed. Returned preview channels are decoded from exact returned WAV bytes using module decoder; browser resampling/output hardware may differ.
