# Publication-copy sanitization

Five historical Python harnesses in this private submission tree are publication variants, not byte-identical originals. Machine-specific Windows workspace paths and a personal user-profile path were replaced with explicit command-line arguments. Original files and their hashes are retained privately outside this tree. No raw Kiro prompts, stdout/stderr, generated code drafts or exit records were changed. No new Kiro run is represented.

These historical scripts are not the current build process. Do not run them against this provenance tree: they write or replace outputs. Use disposable workspaces containing the expected historical inputs. The supplied CLI executable must already be installed and authenticated; no credentials are bundled.

- `audition-20261117/generate.py`: requires `--workspace` (containing prompt.txt) and `--kiro-cli` (installed executable). Running it generates NEW output and must never overwrite the preserved original evidence.
- `audition-20261117/extract.py`: requires `--workspace` containing historical stdout and `--engine-source` selecting the intended historical engine file.
- `audition-20261117/adapt-core.py`: `--workspace` points to the historical candidate directory.
- `room-20261117/adapt.py`: `--workspace` points to the historical room work directory containing iteration2.
- `room-20261117/fix-test-fixtures.py`: `--workspace` points to the historical candidate directory with the expected intermediate test outputs.

Only argument parsing, path assignment and this disclosure were added. Original transformation and generation command content remains unchanged. Parameterization does not promise replay reproducibility: external models and CLI versions may differ.
