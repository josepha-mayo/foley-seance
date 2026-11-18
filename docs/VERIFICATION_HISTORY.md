# Foley Séance

Custom motion drawing has a bounded native cloud Chrome qualification: simple pointer capture, render/play invocation, download, cancellation and project save/reopen with byte-identical export. Complex hold gestures, touch, Windows drawing and artistic listening remain unqualified. See the native follow-up below.

A browser-local sound-design sketch for the Kiroween Costume Contest category. A haunted room controls stereo position, distance, artistic door muffling and chamber ambience. No physical-acoustics, professional-DSP or novelty claim.

## Bring a sound, shape it, take a cue

- Choose an explicitly synthetic tap, creak or breath, or import local audio up to 8 seconds / 12 MB.
- Imports are downmixed to mono at 48 kHz. Stereo channels are averaged; opposing channels can cancel. Nothing is uploaded. Overlong sources are rejected, not silently trimmed.
- Position the spirit with a pointer or keyboard sliders; click the pictured door or activate it with Space/Enter. Door actions do not move the source. The spirit scales/dims with distance as an artistic visual cue, not physical geometry.
- Explicitly start audition for creak, breath or your imported clip. Static position, door and echo changes update the sketch. Tap uses Summon only.
- Built-in creak/breath audition uses warmed repeated-source cycles with short seam fades. Imported audition repeats the WHOLE clip plus its bounded 1.5-second tail, without automatic trimming; quiet intervals remain. Both use fixed 0.35 monitor gain. These are spatial sketches, not recordings or the isolated exported cue.
- Summon & listen explicitly renders and plays still, approach, retreat or cross-to-other-side authored movement from the selected position. It stops audition and creates stereo PCM16 WAV at 48 kHz, including the full bounded 1.5-second tail faded over its final50ms.
- Preview plays the browser-decoded export bytes. Download contains those same bytes. Changing a setting invalidates the previous export.

Latest-only worker processing, source identity/byte binding, stale-decode cancellation and phase-aligned complementary 40 ms crossfades keep audition updates bounded. Source changes require explicit restart. The 20 ms audition boundary fade can soften attacks or very short clips; it does not alter exported waveforms. Every update copies/scans the bounded source, which may affect responsiveness for long clips. Audition hard Stop/source-change disconnection may still click; perceptual seamlessness is not qualified. Normal dry/rendered playback uses bounded monitor fades as described below. Displayed update time measures request-to-scheduled transition start, NOT acoustic latency or fade completion. Source envelopes and imported tails can include quiet periods.

This does not record a live performance. Source and controls live in tab memory unless explicitly saved as a local project file. Project files include the mono source samples and room settings; there is no automatic persistence or cloud storage. Playback-device resampling and speaker coloration are outside the PCM equality claim.

## Audio import limits and resource risk

The file-size check runs before reading audio and allows at most 12 × 1024 × 1024 bytes (12 MiB, labeled “12 MB” in the UI). Accepted imports are downmixed to mono at 48 kHz and limited to 384,000 samples (8 seconds). Overlong audio is rejected, not silently truncated. Sample-value and filename checks also apply. Failed imports preserve the previous source, room settings and rendered cue.

A narrow early check now rejects overlong WAV files only when their complete layout is recognized as canonical RIFF with a 16-byte format chunk followed immediately by one data chunk, with consistent PCM/float frame sizes. It does not rewrite audio. Other WAV variants, compressed formats and unrecognized layouts continue through the existing browser-native decoder. An unknown preflight result is not a safety validation.

**The encoded-size and accepted-duration limits are not a hard memory or CPU bound.** For compressed and unrecognized formats, the browser may allocate and decode the full audio before the app can check its duration. A small encoded file can expand into much longer audio; the current importer has no streaming decode or native-decode cancellation/resource budget. Stale-result guards prevent an outdated result from replacing the current source but do not stop the underlying decode. The canonical WAV check reduces unnecessary decoding for that subset only; it does not resolve the remaining resource risk. Use short, trusted source clips rather than treating this preview as a hardened arbitrary-file decoder.

The WAV safeguard passed independent review, 225 source/model tests and four launcher checks. Native cloud Chrome imported a safe 1-second canonical WAV, rendered a cue, then rejected a safe 9-second canonical WAV while retaining the previous source and cue. The no-native-decode-call assertion for early rejection is covered by the actual-handler model test, not inferred from the visible UI. This does not qualify arbitrary formats, Windows compatibility, hostile-file resistance or artistic listening quality. No streaming-decoder dependency has been added.

## Local development

No dependency installation. Requires modern JavaScript, Worker, Web Audio, Web Crypto, local file input and downloads.

```
node --test engine/*.test.mjs
node build.mjs
```

Serve dist/ using an authorized local static preview. In the managed development environment use sites-preview. No external assets, accounts, inference service, upload endpoint or microphone access. Do not publish this private candidate without authorization.

## Verified scope and remaining gates

67 source tests pass. Actual cloud Chrome imported an original 1-second stereo 48 kHz PCM WAV through the file chooser, started whole-clip audition, changed position/door, stopped/restarted, and invoked Summon. The downloaded export was independently parsed as stereo PCM16 / 48 kHz / 120,000 frames (2.5 seconds including tail). Its hash matched both the UI receipt and independently predicted stereo-downmix/render output. 240,000 native-decoded samples matched the renderer preview exactly. Switching source stopped audition and invalidated export. Built-in creak audition also ran at 48 kHz.

Earlier 24 kHz proof separately verified all three synthetic sources, one cloud local-file import and Windows Chrome built-in tap render/download. Windows import was blocked by extension file-access permission and was not bypassed; playback was not initiated on the active user PC. Current 48 kHz Windows audition/import, arbitrary input formats, mobile geometry and human artistic listening remain unqualified. An attempted audio-review tool explicitly reported that this thread does not support audio input. Numerical tests and playback invocation are not listening approval.

The exact custom-float comparison currently follows the native Chrome PCM convention observed in these tests. Other browsers can differ and currently fail closed; broad cross-browser compatibility is not claimed.

## Kiro and attribution

The central DSP/PCM engine and initial audition design/core/worker/controller were generated through genuine Kiro CLI 3.4.0 (Claude Sonnet 4.5), then independently reviewed and adapted. Source-safe original prompts/output, raw generated modules and correction notes are under .kiro/provenance/. Controller race/cleanup corrections, recurring-cycle adaptation, imported-source support and UI integration are explicitly integrator changes, not falsely attributed to raw Kiro generation. The original main DSP was extended by the separately documented genuine Kiro echo contribution patch; version-1 and default version-2 output compatibility are verified below.

All previous FieldFold, Fault Theater and other project artifacts remain separate and unchanged. No public deployment or release.

## Room interaction qualification

Actual cloud Chrome click and Space activation toggled the in-scene door while source coordinates remained unchanged. Narrow desktop-window/150%zoom inspection at379CSSpixels verified a visible matching action label/focus ring and no horizontal overflow. Observed source/door and focus/listener overlaps were corrected with proportional spirit geometry and consistent forward/inverse placement coordinates. Normal zoom and window view were restored. This is narrow desktop/zoom qualification, not a real-phone test. Device-emulation DevTools were blocked and not bypassed. DSP and export behavior are unchanged.

## Waveform and exported variants

The output overview now summarizes actual decoded-export peak amplitudes in64time bins for both stereo channels. A shared display scale preserves relative channel peaks; heights are explicitly scaled for visibility, not loudness. The divider marks source duration versus the included tail, not a guaranteed silence boundary. The overview is not a literal signed-sample trace or quality assessment. Accessible SVG title/description and a text timing caption accompany it; stale renders clear the display.

Downloads are configured with source/route/door/rate names, such as foley-creak-cross-open-48k.wav. Names are descriptive, not unique recipe identifiers; different positions may share a name. Native Chrome showed the waveform and accessible description, cleared it after a door edit, then rendered again. The actual downloaded open-cross cue was byte-identical to the prior browser export, so visualization/filename changes did not alter audio.67tests pass.

## Private runnable kit / local launcher

For a source-only checkout, first run node build.mjs (Node.js required), then python run-local.py (Python3.9+). The packaged private ZIP includes ready-built assets; extract it and use start-windows.cmd or python3 run-local.py. No installation is attempted. The launcher binds only127.0.0.1 on a free port and serves an exact packaged-asset allowlist, without audio-upload API or directory listing. Keep its console open; Ctrl+C stops it. --no-browser prints the URL without opening a browser, and --check verifies assets without a listener. Packaged hashes detect inconsistent files, not signed authenticity.

Three independent launcher tests and packaged --check pass. Actual Windows current-kit qualification is in progress; earlier Windows app proof is separately scoped above. If the Windows py launcher exists but lacks a usable Python3, it does not automatically fall back; run python run-local.py manually with an existing supported Python installation.

## Local project save/reopen

Open “Keep this séance” to save a `.foley.json` containing the exact 48 kHz mono source and room settings. Keep it private if the source is private. Opening validates the complete bounded file (3,000,000 bytes maximum) before a replacement dialog; Cancel or Escape preserves the current project. Replacing clears the previous rendered cue, restores the source/settings, and never starts audio. Summon recreates the WAV. Drawn-path projects use version 3; other new projects use version 2 for echo. Version-1 files remain readable at the legacy 0.30 echo default, and version-2 files remain compatible. This format is not an archival compatibility promise; demo identities are checked against current built-ins. Source SHA-256 detects corruption, not authenticity or trust. No external dependencies or uploads.

Qualification: 75 engine tests pass. Actual cloud Chrome saved a synthetic creak/cross/closed-door project, changed source to tap, cancelled replacement (tap retained), then reopened and replaced. After a full page reload, the downloaded project reopened and rendered WAV SHA-256 `d390a309300f10192a1c064ea4fdf74231de89b3b15d768df2d998cf3288198f`, matching the original render and independently hashed downloaded WAV. A later actual Chrome imported-source project roundtrip also passed: after full reload, reopening the saved 1-second synthetic stereo fixture (stored as mono) recreated the identical crossing cue SHA-256 `9a7eb5f574c43beaa40bc2f31033a2ba6ae6e70bf71691d28cb193374ea28779`, independently confirmed from the downloaded WAV. Windows project UI remains unqualified. This is not an artistic listening-quality claim.

## Scene-first chamber

The room is now the dominant workspace, with architectural wall/door artwork and two visible door panels bound to the actual muffling control. The panels obscure the spirit when closed; keyboard sliders remain available to position it. Creak is selected initially so audition is available without first changing source. Audio never starts automatically. Technical details are progressively disclosed while source privacy, mono conversion, input bounds and sketch/export distinction remain visible.

Actual cloud Chrome checks: Space toggles the door; audition starts, updates, and stops; panels reach the closed state; desktop browser zoom to 393 CSS pixels shows no horizontal overflow and a 44-pixel door target. This is desktop reflow testing, not native phone qualification. Normal zoom restored. The same creak/cross/closed-door recipe still renders SHA-256 `d390a309300f10192a1c064ea4fdf74231de89b3b15d768df2d998cf3288198f`. 75 tests pass; main DSP and audition engine/controller unchanged. Visual improvement is not a new artistic listening-quality claim.

## Scene starting points

Behind the door, Crossing hall and Retreating presence apply only room settings to the current source. They do not select a different sound, render, or autoplay. Imported clips require confirmation before existing settings/cue are replaced; Cancel/Escape retains them. Applying stops audio, invalidates the old rendered cue and focuses Summon. Movement is heard in the summoned cue, not static audition.

Actual Chrome checks rendered all three from the same synthetic creak with three distinct hashes matching independent shared-engine calculations. Imported synthetic stereo fixture: Escape retained the existing setup; confirmed Crossing hall changed x/y/route only. Before/after project downloads had exactly identical sourceBase64, sourceSHA, frame count, label and import identity. 75 existing tests pass; independent source/race review found no blocker. These are verified different signal transformations, not a human listening-quality judgment.

## Consistent listening level

Dry-source and rendered-WAV playback now use the same fixed 0.35 monitor gain as audition, avoiding the prior unity-versus-0.35 monitoring step between modes. This is not loudness normalization; different sources, effects and channel arrangements still have different perceived loudness. It does not attenuate exported WAV bytes. Normal playback uses audio-clock attack/release and natural-end fades of up to 15 ms (short clips use at most half their duration). One releasing voice plus one pending/current voice bounds switching; a pending replacement waits for release completion and can be cancelled before it starts. No delayed restart after Stop.

84 tests pass, including monitor node cleanup, rapid replacement cancellation, short clips, natural end and failure paths. Actual cloud Chrome invoked dry play/stop, rendered playback, repeated dry/wet switching, audition-to-rendered switching and Stop. The downloaded Crossing hall WAV SHA-256 remained `9563704552d8c01c2b9fdc2b43279ae9e4b85f86a35a15d72fedfce3a2848360`, matching the preceding checkpoint. Audition still has its separately disclosed hard-stop edge; this change does not claim all transitions are perceptually click-free. Human listening remains unqualified.

## Listening controls before the scene

The explicit Start/Stop and status panel now appears immediately above the room instead of below it. It stays in normal document flow, not a floating layer: an initial sticky trial visibly obscured the far wall and was rejected. Desktop native use verified Start, scroll, actual spirit drag, keyboard door and Stop; the full room and controls can be visible together at a practical scroll position. At 393 CSS pixels the compact controls reflow without horizontal overflow or canvas overlap. This is desktop browser zoom, not phone testing. Normal zoom restored. No application/audio logic changed; all original control IDs are retained and 84 tests pass.

## Chamber echo range

A 0–60% echo-contribution control now changes the existing reflected signal in both audition and Summon. It is a coefficient, not a physical energy or wet-mix percentage. Room size, delay timings, feedback and the bounded 1.5-second export tail stay fixed, including at zero echo. Existing down-only peak normalization is retained; strong echo on loud sources can reduce the entire cue's level for safety. Presets preserve the setting. Echo changes invalidate the prior WAV.

The central DSP extension was generated by genuine authenticated Kiro; source-safe prompt/raw response and exact integration notes are under `.kiro/provenance/echo-20261117`. Recipe v1 remains exact; v2 requires echoAmount0..0.6. Project v1 opens at0.30; v2 records the slider's0.01 grid and preserves exact source bytes.102 tests pass plus24 comparisons against the untouched toolbar engine confirming identical legacy/v2-default WAV bytes.

Native Chrome: a previously downloaded version-1 creak project reopened at30% and rendered the exact original SHA `d390a309300f10192a1c064ea4fdf74231de89b3b15d768df2d998cf3288198f`. Home/End keyboard changes rendered different zero/maximum echo cues; edits disabled old export. Live audition accepted echo changes and Stop, and presets retained60%. A saved version-2 project reopened after full page reload at60%; its downloaded WAV SHA `1989b62b5a3a4313147c9665bb8b1b94f452ea1238d70f855d7fb93c1e1be7d2` matched the pre-reload render. Downloaded project files confirmed exact original source bytes retained. This is behavior/signal verification, not a human listening-quality judgment.


## Explicit render-and-listen and nearby comparison

The primary “Summon & listen” action requests audio only from that explicit click, renders/validates the same WAV, then plays its decoded samples. Source selection, presets and project reopening do not start audio. The audio-ready handshake is bounded to 3 seconds; rejection/expiry does not discard a successfully rendered cue or download. Stop cancels pending listening while allowing a valid render to finish. Late callbacks require the same playback token, settings revision and current cue identity. Explicit replays can retry browser audio; they have Stop cancellation but do not share the primary action's readiness timeout.

Dry source and Rendered cue replay controls are adjacent. Both restart from the beginning at the same monitor gain; this is not phase-synchronous A/B or perceived-loudness matching. “Dry” is the app's mono source, not necessarily the original imported stereo channels. The source-panel navigation link focuses its playback button without starting sound.

109 tests pass, including seven deterministic tests of the actual intent helpers with modeled browser audio promises. These are not native failure-injection or artistic listening evidence. Actual cloud Chrome verified explicit primary playback, dry replay, rendered replay, Stop, source/preset silence and invalidation, navigation focus and dry/result/Stop keyboard order. At 393 CSS pixels in desktop browser zoom the comparison controls reflowed without overflow; normal zoom was restored. This is not phone testing. The downloaded Crossing hall WAV SHA-256 remained `9563704552d8c01c2b9fdc2b43279ae9e4b85f86a35a15d72fedfce3a2848360`, exactly matching the preceding output. DSP and export encoding are unchanged. Human artistic quality remains unverified.

This UI integration is integrator-authored on the genuine Kiro engine; it is not attributed to a new Kiro session. Its implementation record is under `.kiro/provenance/listen-integration-20261117`.


## Truthful playback state

Stop now reports whether the source/settings remain, a rendered WAV remains ready, or pending work will continue without starting playback. Natural completion replaces stale “Playing” text and does not overwrite a newer pending listen intent. This changes status text only, not DSP, monitor gain, node scheduling or export bytes.

111 tests pass, including modeled natural-end and newer-pending-intent coverage. Actual cloud Chrome observed source completion, rendered completion, source Stop and rendered Stop with playback off and the appropriate status; rendered Stop retained the download. The crossing cue hash stayed `9563704552d8c01c2b9fdc2b43279ae9e4b85f86a35a15d72fedfce3a2848360`. Pending-browser failure paths remain modeled, not native failure injection. No artistic listening-quality claim.


## Architectural listening-door detail

An original CSS-only pass adds a beveled foreground frame, recessed wooden panels, center seam, brass handles and a soft threshold shadow to the existing functional door. No new motion, acoustic feature or changed geometry is claimed. Closing still corresponds to the existing muffling control; the frame and artwork remain pointer-transparent. Existing reduced-motion styling remains in force.

Generated chamber illustrations were explored separately but were not persisted or integrated after an artifact-transfer limitation. This checkpoint contains no generated bitmap or new external asset. Application and DSP source are byte-identical to the prior status checkpoint.

Actual cloud Chrome compared open/closed states, keyboard Space, audition update/Stop and a pointer drag (position changed to x75/y56). Desktop zoom to 393 CSS pixels retained no horizontal overflow and the 44-pixel keyboard-focusable door target; normal zoom was restored. Crossing hall rendered the unchanged SHA-256 `9563704552d8c01c2b9fdc2b43279ae9e4b85f86a35a15d72fedfce3a2848360`. 111 checks pass. This is a restrained visual/interaction polish, not a phone test or artistic listening verdict.


## Imported sound replacement guard

Choosing a synthetic starting sound while an imported source is loaded now asks before replacement. Keep imported sound or Escape retains the source, room settings and current rendered WAV, and restores focus to the triggering button. Playback stops when the dialog opens; cancellation does not restart it. Explicit replacement keeps room settings, replaces only the tab's source and clears the old cue. The original disk file is never changed. This guard is specifically for imported-source to built-in-source selection, not a general undo or autosave system.

Actual cloud Chrome imported the synthetic stereo fixture, rendered it, opened the Tap replacement dialog, then cancelled with Escape and with the button. Source label, coordinates, rendered SHA and exact existing download URL were unchanged after Escape. Explicit replacement selected synthetic Tap, retained coordinates, disabled the old download, cleared the hash and remained silent. Focus returned correctly in both paths. Independent source review found no blocker; application regression checks remain 111 passing. No audio or exported project is included in source control.


## Draw the haunting — bounded creative proof

Choose Draw a motion path, then draw one pointer stroke through the room. Release commits the displayed sampled path; Cancel drawing or Escape retains the previous path and rendered cue. A timer samples the latest position about 15 times per second, including stationary holds. Timing is approximate at that sampling resolution, not every raw pointer event. Pointer-down/up endpoints are retained. Gestures longer than 8 seconds, shorter than 0.12 seconds, malformed or too detailed are rejected rather than silently shortened. One active pointer owns the stroke; interrupted capture cancels it.

Your relative gesture timing is scaled to the source sound's length. The interface shows stroke duration versus clip duration after capture; changing source retimes the selected path. This is authored movement, not live audio recording. Summon & listen renders that exact sampled trajectory using the unchanged shared DSP, validates its WAV and plays the decoded export. Audition on a drawn route is explicitly static listening at the path start. Position sliders are disabled while a drawn route is selected; choose another route or redraw to change it. Pointer drawing is not yet a keyboard path editor; existing movement choices remain keyboard accessible.

An explicitly labeled authoring overlay displays the draft and cursor above closed door artwork without changing the door's sound setting. Draft and committed paths are distinct; source/preset/project controls are locked during drawing. No exported cue is invalidated until a valid path commits. Cancellation stops no new sound and preserves the previous source/path/WAV.

The pure normalization and retiming helper was genuinely generated with authenticated Kiro CLI, then independently hardened. Source-safe original prompt/output, unchanged raw generated module and adaptation details are in `.kiro/provenance/motion-20261117`. Pointer sampling, app integration, authoring overlay and project-v3 persistence are explicitly integrator work. No new acoustic simulator or listening-quality claim.

Project v3 requires a drawn route, bounded 2–128 normalized points with strictly increasing time from 0 to 1, and the existing echo setting. Versions 1 and 2 retain their prior schema and behavior. Source samples remain exact. These are normalized relative times, not wall-clock timestamps; x/y fields retain independent static cursor state. The renderer uses the drawn points rather than those cursor fields.

Independent source reviews and modeled actual-handler tests cover pause capture, active-pointer ownership, cancellation, lost capture, time limits, old/new project restore, source retiming and static-start labels. They are not native-browser or human-listening evidence. At the initial motion checkpoint, native drawing was pending because computer-use access was unavailable. The later native follow-up below supersedes only that limited portion; Windows and touch usability remain pending. No recording or public deployment was performed.


Custom-path qualification: 161 source/model checks and three launcher checks pass, and the static build succeeds. A real source-level rehearsal normalized a 2.3-second synthetic gesture with a stationary hold onto a 2-second synthetic breath, saved/reopened project v3 and recreated an identical stereo PCM16 48 kHz WAV (672,044 bytes; SHA-256 `9e240928268064f5674888d6d773862d40e2fd3848927db064d2bd20bde88c73`). The scaled hold is approximately 0.435 seconds. Old v1/v2 project encodings remained byte-identical in the rehearsal; a separate codec review also compared 16 baseline cases. Audio/project rehearsal artifacts are private and excluded from source control. This proves renderer/project continuity, not actual pointer usability, native audio playback or artistic quality.


## Native custom-path follow-up (2026-11-17)

After cloud computer-use access recovered, actual Chrome pointer dragging captured a 0.14-second, three-point stroke and displayed its retiming onto the 1.20-second synthetic creak. Summon & listen rendered and invoked playback of the decoded WAV; the actual downloaded artifact is stereo PCM16, 48 kHz, 129,600 frames (2.70 seconds). Escape from a new drawing session retained the previous path and exact download URL. Irrelevant position sliders remained disabled and audition was explicitly labeled as static listening at the path start.

The browser downloaded project v3. After a page reload, the actual file chooser reopened that saved file with explicit replacement confirmation. Source, drawn route and three points returned without autoplay. Summon & listen then rendered/invoked playback again, and a second real WAV download was byte-identical to the first: SHA-256 `562119d5f1433a5d3b1c1496741937951de237803843d82e0ddfb27f70fc2352`. The saved project was independently parsed as version 3 with the expected source hash and normalized points. Private audio/project downloads are excluded from the repository.

A separate closed-door native trial showed the authoring cursor above the closed wooden leaves, accepted a pointer drag and rendered a drawn cue while retaining the closed-door setting. This was a simple desktop pointer journey, not a prolonged hold, multipointer, timeout, narrow-screen or touch trial. Those detailed capture behaviors remain source/model-tested only. Playback invocation and identical bytes do not establish human listening quality, perceptual trajectory fidelity or professional acoustic quality. No code changed in this follow-up.

## Transactional audio import recovery

Opening a new audio file stops current listening but keeps the existing source, room settings, rendered WAV and download until decoding and source validation succeed. Invalid, oversized, overlong or undecodable input leaves the prior cue available. A successful import replaces the source and invalidates the old rendered cue as before. The file input clears after the latest attempt so the same file can be retried; this does not modify the disk file. No audio restarts automatically.

170 source/model tests and three launcher checks pass. Nine new tests exercise the actual import handler for decoding failure, size/duration limits, successful stereo downmix, nonfinite samples and overlapping successful/failed requests. Native verification of this change is pending: the new private localhost preview could not be reached from the available CUA browser. Earlier native qualifications remain scoped to the preceding source. This integration-only change does not alter DSP, WAV encoding or genuine Kiro attribution.

Queued file-change events while rendering or drawing are ignored, with the file chooser reset and no playback or cue mutation. Two modeled actual-handler tests cover these guards.

## Native import-recovery qualification

Managed local preview restored browser access without changing network permissions. Actual cloud Chrome rendered the synthetic creak Crossing hall cue, selected an invalid WAV twice through the file chooser, and retained the identical download URL and WAV hash both times. The downloaded retained WAV was independently hashed as 9563704552d8c01c2b9fdc2b43279ae9e4b85f86a35a15d72fedfce3a2848360, matching the preceding source. Importing the existing 1-second synthetic stereo fixture then replaced the source, retained position/route/echo settings, cleared the previous cue, and successfully rendered/played a new 2.5-second cue. This qualifies decode-failure recovery, repeated file selection and valid replacement in cloud Chrome; oversized/overlong inputs and queued-event guards remain source/model tested. Windows and genuine listener/real-recording evaluation remain unqualified. No application source changed for this documentation update.

## Decoded source range validation

Imported audio is now checked against the renderer/project codec's supported mono sample range [-1, 1] before source replacement. Finite float audio outside that range is rejected with instructions to lower its level externally; it is not silently clipped or normalized. The previous source, settings and rendered cue remain available. Validation follows the existing stereo downmix, so supported mono results are unchanged.

179 source/model tests and three launcher checks pass. Actual cloud Chrome imported an original synthetic IEEE-float WAV with peak 1.25 after rendering Crossing hall: the range message appeared and the exact old download URL remained. A second synthetic float WAV with peak 0.5 imported successfully, retained room settings, cleared the old cue and rendered/played a 2.50-second cue. This verifies these native Chrome cases, not arbitrary formats, Windows or artistic listening quality. Test fixtures remain private and are excluded from source control.

## Reduced-motion playback

The system reduced-motion preference now suppresses JavaScript ghost flight as well as CSS transitions. Audio, render timing and exported WAV are unchanged. Enabling reduced motion during playback returns the spirit to its static placement and ends the visual loop; disabling it takes effect on the next playback rather than restarting mid-cue. Drawing remains an intentional user gesture.

182 source/model tests and three launcher checks pass. Tests execute the actual playback preparation and animation loop with modeled media-query state; no native operating-system preference toggle has been qualified. This is an integrator-authored accessibility change, not an acoustic change.

## Scene-first desktop workspace

The first viewport now prioritizes the functional chamber and its door. Motion authoring and scene presets follow the room. Summon and Stop playback sit together beside audition, with explicit text distinguishing the exported cue from the looping placement preview. Source choices, export/download, keyboard sliders and detailed explanations remain available. Desktop chamber sizing preserves its aspect ratio; narrow layouts remain vertically stacked.

Native cloud Chrome at 1165 × 757 CSS pixels showed the door control wholly in the initial viewport (bottom approximately 731 px), with Summon visible above it. Keyboard Space toggled the door; Summon and Stop remained functional. A desktop-browser zoom trial at 388 CSS-pixel width had no horizontal overflow and retained a 44-pixel door target; normal zoom was restored. This is desktop reflow evidence, not a real-phone or Windows test. Independent visual review approved the first-screen direction and caught wording ambiguity, which was corrected and re-inspected. The narrow trial was conducted by the implementer, not independently replicated.

182 source/model checks and three launcher checks pass. The native Crossing hall cue retained SHA-256 9563704552d8c01c2b9fdc2b43279ae9e4b85f86a35a15d72fedfce3a2848360. DSP modules and export mechanics are unchanged; the only app script change is the transport heading. No listener-quality claim.

## Isolated timed-door prototype (2026-11-17)

The optional “Time a door opening or closing” section changes the initial door state once within a rendered cue. Choose 10–90% of the source duration in 5% steps; the display states the exact start time. The change ramps over up to 150 ms and holds its final state through the export tail. A new source retimes the same fraction. Scene starting points clear the event. This is authored timing, not live gesture recording: spatial audition still uses the initial state only. Rendered playback animates the shared envelope unless reduced motion is enabled. This extends artistic filtering and gain, not physical acoustics.

Event recipes use version 3 and saved event projects use version 4 (including optional drawn movement). No-event recipes/projects retain existing formats and arithmetic. The extension is integrator-authored; the attempted Kiro generation failed authentication and supplied no code. See `.kiro/provenance/timed-door-20261117/README.md`.

202 source/model tests and three launcher checks pass. Independent core comparisons preserved 48 legacy WAV outputs; integration comparisons preserved 18 legacy project encodings. Native cloud Chrome saved/reopened an event project and recreated the identical downloaded WAV, with 336000 decoded channel samples matching. Initial and final visual states were observed, but precise native animation timing was not measured. These checks do not establish listener preference, click-free perception, Windows behavior, or competitive novelty. Independent integration and native UI reviews found no blocking issue. Native review covered both initial states and keyboard timing changes; subsequent wording clarifies opening versus closing and exposes the source percentage and seconds to assistive technology.

## Explicit hidden-presence starting scene

The first-screen source panel offers “Stage a hidden presence”: keep the current source and echo, start centered/far with a closed door, approach the listener, and open at 50% of source duration. A confirmation always describes exact seconds and the settings/cue it replaces. No audio starts until Summon. Existing drawn points remain selectable; Cancel/Escape preserves the prior cue/settings and restores focus. This is an integrator-authored composition of existing controls, not new DSP or a new Kiro-generated contribution.

205 modeled/source tests and three launcher checks pass. Independent code review passed the 22 motion-app tests. Native cloud Chrome verified first-screen visibility, Escape and button cancellation/focus, apply without playback, followed by an explicit 2.70-second creak render with opening at 0.60 seconds. Reopening then canceling retained the same WAV download URL. This iteration does not establish listener quality, new download-byte equality, narrow/mobile layout or Windows behavior.

## Import label preservation follow-up (2026-11-17)

Imported audio names must meet the saved-project label contract: nonblank, at most 200 JavaScript string code units, with no ASCII control characters. Unsupported names are rejected before file reading/decoding and before replacing the source, with a rename instruction. The previous source, room settings and rendered cue remain available. Filenames are not silently normalized.

213 source/model tests plus 3 launcher checks and build pass. Actual import-handler/install-source tests use modeled browser dependencies and the real project encoder/decoder to verify rejected names preserve a savable project and accepted boundary/Unicode names roundtrip. Independent focused review passed. Native file chooser behavior for these names is not yet qualified. This correction is integrator-authored, not a new Kiro contribution.

## Isolated reference-take prototype

An explicit “Keep current as reference” action retains one rendered decoded AudioBuffer while the creator edits and renders another take. “Play reference” replays it from the beginning through the same 0.35 monitor path, without animating the current room. “Current rendered cue” and Download remain bound only to current settings. This is not loudness matching, instantaneous A/B switching, synchronized playback or evidence of audible improvement.

Replacing a reference requires confirmation; Escape/cancel retains it. Clearing stops playback but leaves the current cue intact. A successfully validated source/project replacement clears the reference; rejected input leaves it intact. The reference lives only in tab memory and is excluded from project files. Its explicit reference slot retains one existing rendered stereo buffer, up to 456,000 frames / 3,648,000 sample bytes at current limits; no extra WAV bytes or download URL are retained. This is a slot-buffer estimate, not a total browser-memory guarantee. Pending audio-context resume promises can retain buffers until they settle; clearing the slot does not guarantee immediate memory reclamation.

Native cloud Chrome verified keep→edit→reference playback invocation→render again→replacement cancel/Escape→explicit replacement→clear→source change. The current download URL stayed unchanged on reference replacement/clear, and source change disabled reference playback. 234 source/model tests and four launcher checks pass, including actual source-install validation preserving the reference on rejection. Independent source and live desktop review found no blocker: the reviewer repeated keep/edit/reference/new-render/cancel/Escape and checked focus restoration and current-export wording. Sequential comparison through equal monitor gain is implemented, but no artistic listening, Windows or narrow-layout qualification is claimed. This remains a private isolated prototype pending the parent's integration decision.
