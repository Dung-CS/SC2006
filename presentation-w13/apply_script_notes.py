# Replaces each slide's notes: line in the outline with the spoken script from script-notes.json.
# Usage: python apply_script_notes.py dfence-w13-v2.outline.md script-notes.json
import json
import re
import sys
from pathlib import Path

outline, notes_file = Path(sys.argv[1]), Path(sys.argv[2])
notes = json.loads(notes_file.read_text(encoding="utf-8"))
lines = outline.read_text(encoding="utf-8").splitlines(keepends=True)
slide = 0
for i, line in enumerate(lines):
    if re.match(r'^notes: ".*"\s*$', line):
        slide += 1
        # A JSON string is a valid YAML double-quoted scalar.
        lines[i] = "notes: " + json.dumps(notes[str(slide)], ensure_ascii=False) + "\n"
if slide != len(notes):
    sys.exit(f"found {slide} notes lines but {len(notes)} script entries; outline not changed")
outline.write_text("".join(lines), encoding="utf-8")
print(f"replaced notes on {slide} slides")
