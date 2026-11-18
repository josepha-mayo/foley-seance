# Publication copy: machine-specific paths parameterized; see ../PUBLICATION_SANITIZATION.md.
from pathlib import Path
import argparse
parser=argparse.ArgumentParser(description="Sanitized historical adaptation harness; use a disposable workspace with the expected historical inputs.")
parser.add_argument("--workspace", required=True, type=Path)
args=parser.parse_args()
r=args.workspace
s=(r/'iteration2/foley-engine.mjs').read_text(encoding='utf-8')
rate="\n  if (sampleRate !== 24000 && sampleRate !== 48000) throw new Error('sampleRate must be 24000 or 48000');\n"
s=s.replace('export function encodeWav(channels, sampleRate) {','export function encodeWav(channels, sampleRate) {'+rate)
s=s.replace('  const sampleRate = view.getUint32(24, true);','  const sampleRate = view.getUint32(24, true);'+rate)
s=s.replace('  const numFrames = dataSize / blockAlign;','  const numFrames = dataSize / blockAlign;\n  if (numFrames === 0) throw new Error("WAV must be nonempty");')
s=s.replace('export function renderRecipe(source, sampleRate, recipe) {','export function renderRecipe(source, sampleRate, recipe) {'+rate)
a=s.index('  // Clamp to ensure all samples finite')
b=s.index('  // Find peak',a)
s=s[:a]+'''  // Integrated correction: fade the final 50ms of the included tail, then
  // normalize the unclipped stereo render once. Never clip before measuring peak.
  const fadeFrames = Math.round(sampleRate * 0.05);
  for (let i = 0; i < outputFrames; i++) {
    if (!Number.isFinite(leftOut[i]) || !Number.isFinite(rightOut[i]))
      throw new Error('Render produced nonfinite audio');
    if (i >= outputFrames - fadeFrames) {
      const gain = (outputFrames - 1 - i) / (fadeFrames - 1);
      leftOut[i] *= gain;
      rightOut[i] *= gain;
    }
  }

'''+s[b:]
# canonical data only, rejects accessor fields without invoking them.
helper='''function ownDataObject(value, fields, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
    throw new Error(label + ' must be a plain data object');
  const keys = Reflect.ownKeys(value);
  for (const key of keys) {
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !fields.includes(key) || !d.enumerable || !('value' in d))
      throw new Error(label + ' contains unknown or non-data fields');
  }
}

'''
s=helper+s
s=s.replace('export function validateRecipe(recipe, sourceDuration) {','export function validateRecipe(recipe, sourceDuration) {\n  ownDataObject(recipe, ["version", "doorClosed", "trajectory"], "recipe");')
s=s.replace('    const pt = traj[i];','    const pt = traj[i];\n    ownDataObject(pt, ["t", "x", "y"], `trajectory[${i}]`);')
# Avoid changing existing generated unknown-field messages for ordinary extra keys.
s=s.replace("!fields.includes(key) || !d.enumerable", "!d.enumerable")
c=r/'candidate';c.mkdir(exist_ok=True)
(c/'foley-engine.mjs').write_text(s,encoding='utf-8')
(c/'foley-engine.test.mjs').write_bytes((r/'iteration2/foley-engine.test.mjs').read_bytes())
