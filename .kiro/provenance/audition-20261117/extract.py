# Publication copy: machine-specific paths parameterized; see ../PUBLICATION_SANITIZATION.md.
import pathlib,re,shutil,argparse
parser=argparse.ArgumentParser(description="Sanitized historical extraction harness; use a disposable workspace.")
parser.add_argument("--workspace", required=True, type=pathlib.Path)
parser.add_argument("--engine-source", required=True, type=pathlib.Path)
args=parser.parse_args()
p=args.workspace
s=(p/'stdout.txt').read_text(encoding='utf-8');raw=p/'raw';raw.mkdir(exist_ok=True);c=p/'candidate';c.mkdir(exist_ok=True)
for name,code in re.findall(r'FILE:\s*([\w.-]+)\s*\n```[^\n]*\n(.*?)\n```',s,re.S):
 if name in ['audition-core.mjs','audition-worker.mjs','audition-controller.mjs','audition.test.mjs','CONTRACT.md']:(raw/name).write_text(code+'\n',encoding='utf-8');(c/name).write_text(code+'\n',encoding='utf-8')
shutil.copy2(args.engine_source,c/'foley-engine.mjs')
print([x.name for x in c.iterdir()])
