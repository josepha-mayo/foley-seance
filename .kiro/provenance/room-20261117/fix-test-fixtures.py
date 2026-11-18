# Publication copy: machine-specific paths parameterized; see ../PUBLICATION_SANITIZATION.md.
from pathlib import Path
import argparse
parser=argparse.ArgumentParser(description="Sanitized historical adaptation harness; use a disposable workspace with the expected historical inputs.")
parser.add_argument("--workspace", required=True, type=Path)
args=parser.parse_args()
r=args.workspace
(r/'initial-adapted-test-output.txt').write_bytes((r/'actual-test-output.txt').read_bytes())
p=r/'foley-engine.test.mjs';s=p.read_text(encoding='utf-8')
s=s.replace('validateRecipe(recipe, 0), /trajectory must have 2..128 points/', 'validateRecipe(recipe, 1), /trajectory must have 2..128 points/')
s=s.replace('{ t: 0.5, x: 1, y: 1 }\n    ]\n  };\n  assert.throws(() => validateRecipe(recipe, 1), /must be strictly increasing/', '{ t: 0.5, x: 1, y: 1 },\n      { t: 2, x: 1, y: 1 }\n    ]\n  };\n  assert.throws(() => validateRecipe(recipe, 2), /must be strictly increasing/')
s=s.replace('decodeWav(truncated), /Data size mismatch/', 'decodeWav(truncated), /RIFF size mismatch/')
start=s.index('  const recipeLoud =');end=s.index('  const resultLoud =',start)
s=s[:start]+s[start:end].replace('x: 0.5','x: 0')+s[end:]
p.write_text(s,encoding='utf-8')
