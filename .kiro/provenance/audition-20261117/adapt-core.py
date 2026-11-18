# Publication copy: machine-specific paths parameterized; see ../PUBLICATION_SANITIZATION.md.
from pathlib import Path
import argparse
parser=argparse.ArgumentParser(description="Sanitized historical adaptation harness; use a disposable workspace with the expected historical inputs.")
parser.add_argument("--workspace", required=True, type=Path)
args=parser.parse_args()
p=args.workspace
f=p/'audition-core.mjs';s=f.read_text();s=s.replace('const MASTER_GAIN = 0.35;', 'const MASTER_GAIN = 1; // Stable 0.35 master gain is applied once by controller.').replace('const MAX_NORMALIZE_THRESHOLD = 0.99;', 'const MAX_NORMALIZE_THRESHOLD = 1;').replace("if (!settings || typeof settings !== 'object') {", "if (!settings || typeof settings !== 'object' || Object.getPrototypeOf(settings) !== Object.prototype) {")
s=s.replace('  const { kind, sampleRate, x, y, doorClosed } = settings;', '''  const fields = ['kind','sampleRate','x','y','doorClosed'];
  if (Reflect.ownKeys(settings).length !== fields.length || Reflect.ownKeys(settings).some(k=>!fields.includes(k) || !Object.hasOwn(Object.getOwnPropertyDescriptor(settings,k),'value'))) throw new Error('Settings must contain exact data fields');
  const { kind, sampleRate, x, y, doorClosed } = settings;''')
s=s.replace("if (typeof normalizationGain === 'number' && normalizationGain < MAX_NORMALIZE_THRESHOLD)", "if (normalizationGain !== MAX_NORMALIZE_THRESHOLD)")
s=s.replace('(outputFrames - i) / fadeSamples','(outputFrames - 1 - i) / (fadeSamples - 1)').replace('i / fadeSamples','i / (fadeSamples - 1)')
f.write_text(s)
(p/'audition-worker.mjs').write_text('''import { buildAudition } from './audition-core.mjs';
// Worker-only side effect; safe to import in Node.
if (typeof self !== 'undefined' && typeof self.postMessage === 'function' && typeof document === 'undefined') {
 self.onmessage = event => {
  const id = event?.data?.id;
  try {
   if (!Number.isSafeInteger(id) || id < 1) throw new Error('Invalid request id');
   const result=buildAudition(event.data.settings);
   self.postMessage({id,result},[result.wavBytes.buffer]);
  } catch(error) { self.postMessage({id,error:error instanceof Error ? error.message : String(error)}); }
 };
}
''')
