# Publication copy: machine-specific paths parameterized; see ../PUBLICATION_SANITIZATION.md.
import subprocess,pathlib,argparse
parser=argparse.ArgumentParser(description="Sanitized historical replay harness; writes generation output into the supplied disposable workspace.")
parser.add_argument("--workspace", required=True, type=pathlib.Path)
parser.add_argument("--kiro-cli", required=True)
args=parser.parse_args()
p=args.workspace
cli=args.kiro_cli
with (p/'stdout.txt').open('w',encoding='utf-8') as out,(p/'stderr.txt').open('w',encoding='utf-8') as err:
 r=subprocess.run([cli,'chat','--no-interactive','--trust-tools=','--model','claude-sonnet-4.5'],input=(p/'prompt.txt').read_text(encoding='utf-8-sig'),text=True,encoding='utf-8',cwd=p,stdout=out,stderr=err,timeout=300)
(p/'exit-code.txt').write_text(str(r.returncode))
print('Kiro exit',r.returncode)
