# Foley Séance

A browser-local sound-design instrument for **Kiroween · Costume Contest**. Place a small sound in a haunted chamber, shape its stereo position, distance, door muffling, an authored opening or closing, and echo, then download a stereo WAV. The spooky room controls the effect rather than merely decorating it.

**MIT-licensed source and browser-local static app. Cloud-Chrome drawing, failed-import recovery and timed-door save/reopen journeys have recorded qualification; current Windows usability remains unqualified. No human listening-quality claim is made.**

## Run locally

This source package requires existing Node.js and Python 3.9+ installations and a modern browser with Web Audio, Workers, Web Crypto and downloads. No package installation, account, microphone or cloud service is needed.

First, run `node build.mjs` from this source folder to create `dist/`. The launcher serves that generated directory, not the source root. A separately prepared built preview kit does not need Node.js; this source-only package does.

- Windows: after building, double-click `start-windows.cmd`.
- macOS/Linux: after building, run `python3 run-local.py` in this folder.
- Keep the launcher open; press Ctrl+C to stop. It binds only to `127.0.0.1`.
- To check the package without opening a browser: `python3 run-local.py --check`.

Start at a low listening volume. Choose a synthetic starting sound or import up to 8 seconds / 12 MiB. Imports are downmixed to mono at 48 kHz. Place the spirit, choose a movement, and select **Summon & listen**. Export is stereo PCM16 WAV at 48 kHz with a bounded 1.5-second tail. Preview uses the decoded export bytes; hardware/browser resampling remains outside that equality claim.

Audition is a repeating spatial sketch, not a recorded performance or the isolated export. Save a local project to retain source and settings; there is no autosave. Project files contain source audio. Nothing is uploaded. A visible reminder identifies edits since opening or the last project-download request. Check browser downloads before closing; a requested download is not proof it was saved. The best-effort exit warning is not qualified protection against data loss. Drawn paths are approximate sampled relative timing, not raw-pointer recording; existing movement choices remain keyboard accessible.

An optional door event changes the initial door state once at 10–90% of source length. Its transition lasts up to 150 ms; the final state holds through the tail. Changing source retimes the event. Spatial audition uses only the initial door state; Summon renders the event. This is authored timing, not live performance recording or physical acoustic simulation. Event projects use v4; older no-event formats remain supported.

For a concrete starting cue, **Stage a hidden presence** preserves your source and echo while proposing an approach from behind a closed door, opening halfway through the source. Its confirmation states what changes and the exact time; cancel retains your work. Applying it does not start audio: select Summon explicitly.

The chamber-adjacent take controls group rendering, current/reference playback and WAV export. Additional explanation is expandable; the reference identity and tab-only warning remain visible. Narrow screens still require vertical scrolling.

## Where the rendered cue fits

Movement, door timing and echo are baked into a stereo WAV for a fixed listening perspective. A short film, fixed-camera scene, game cutscene or other preauthored cue is the intended demonstration, not a live game-audio system. The exported file does not react to a moving player, changed world geometry or runtime door state. Stereo is not inherently incompatible with game engines; downstream integration and any additional spatial processing need their own test. No engine integration has been qualified.

## Compare a revision

After rendering, **Keep current as reference** retains one older take while you edit and render another. Play reference and Current rendered cue restart sequentially at the same monitor gain, not matched perceived loudness. Reference playback does not animate the current room or replace its download. Replacing a reference asks first. The reference is tab-only, clears on successful source/project replacement, and is not saved in project files. Download or save current work before closing.

## Audio import resource limits

The 12 MiB encoded-file and accepted 8-second duration limits do not bound browser decoding memory or CPU. Exact canonical PCM/float WAVs have an early duration check; other variants and compressed formats still undergo full native decoding before duration validation. Small compressed files can expand greatly, and stale-result guards do not cancel decoding. Use short trusted clips. This is not a hardened arbitrary-file decoder or a production security certification. See the preserved history for exact checks and limitations.

## Test and build

With existing Node.js and Python installations:

```sh
node --test engine/*.test.mjs
python3 -m unittest test_run_local.py
node build.mjs
```

Build produces `dist/` locally. The `docs/` folder also contains the reviewed static build for GitHub Pages; its app assets are byte-identical to the source build. To refresh them after changing source, rebuild and copy the contents of `dist/` into `docs/` without replacing the documentation Markdown files. The build refuses unexpected files or redirected outputs in `dist/` before writing. It does not delete them: use a fresh source copy/output directory or inspect and move unexpected files yourself before retrying. There are no external runtime dependencies or bundled third-party audio.

## Evidence and remaining gates

- [Verification and limitations](docs/QUALIFICATION.md)
- [Genuine Kiro contribution](docs/KIRO_USAGE.md), with original records under [`.kiro/provenance`](.kiro/provenance)
- [Rights inventory and MIT license](docs/RIGHTS_AND_LICENSE.md)
- [Preserved development verification history](docs/VERIFICATION_HISTORY.md)

The source is released under the [MIT License](LICENSE), copyright Joseph Ayanda. Publication does not imply competition submission or acceptance. Current Windows motion verification, human listening feedback and final submission evidence remain separate qualification gates.

## Exact digital-silence notice

The source notice identifies all-zero samples and when mono averaging of nonzero decoded channels produces all-zero samples. Cancellation or numerical underflow can cause this. It does not detect quiet audio or partial cancellation and does not normalize, repair or reject your sound. Reopened silent projects show the generic notice because original channel data are not saved.
