Foley Seance - local source and static web app

1. This is a source-only package. With existing Node.js, run node build.mjs
   from this folder first to create dist/.
2. Windows: double-click start-windows.cmd.
   macOS/Linux: in this folder run python3 run-local.py.
   If py cannot find a usable Python, try python run-local.py manually
   with an existing Python 3.9+ installation. Nothing installs automatically.
3. Your default browser opens the local app. Start at low listening volume.
4. Keep the launcher window open. Press Ctrl+C there to stop.

Requires existing Node.js and Python 3.9+ installations. No administrator access,
package installation, account, payment, microphone or cloud upload required.
The launcher serves only the packaged static app files at 127.0.0.1 on a
free port. Chosen audio stays in browser memory and is not sent to the server.

Try Creak, Start spatial audition, move the spirit, click the door, then
Stop, then choose Summon & listen to render and hear the isolated cue.
Compare Dry source and Rendered cue beside the output. Both restart from
the beginning at the same monitor gain, not matched perceived loudness.
Download your WAV before closing. To keep your source
and room settings, open Keep this seance and save a local project file.
Reopen that .foley.json later; replacement requires confirmation. There is
no automatic saving. Project files contain your audio, so keep them private.
Imported audio is downmixed to mono at 48 kHz; up to 8 seconds / 12 MiB.
The output is stereo PCM WAV with a bounded 1.5-second tail. Audition is a
spatial sketch, not a recording or necessarily the isolated exported cue.

Human artistic quality, phone/touch use and broad browser compatibility
are not yet qualified. See README.md for exact verification and limits.
MIT-licensed source; publication is not proof of competition submission.

For a non-disruptive test: python run-local.py --no-browser
For bundle verification only: python run-local.py --check

Reference takes are tab-only and excluded from saved projects. Use short trusted
audio: compressed decoding memory is not bounded by the encoded file-size cap.

The build refuses unexpected files or redirected outputs in dist/ without deleting
them. Use a fresh source copy or inspect/move unexpected files before rebuilding.
