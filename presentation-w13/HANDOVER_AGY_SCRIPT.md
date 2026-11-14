# Handover: draft the 20-minute spoken script for D-Fence W13 v2

Yen Kit asked on 2026-11-08: draft a script for the speaker notes. The talk is 20 minutes, and
the script must suit a slower speaking speed. Start with an STE100 draft, then apply stop-slop,
then apply the scripting skill.
Do the work yourself. Do not spawn subagents. Do not commit, push or deploy.

## Read first (all paths under C:/Users/chowy/alfred)
1. `smart_nation/dengue/presentation-w13/dfence-w13-v2.outline.md`: the 18 slides. Each slide has a
   headline (topic sentence), its components and a `notes:` line with the facts. The notes are your
   source of facts. Do not add facts that are not in the outline.
2. Rendered slides: `smart_nation/dengue/presentation-w13/D-Fence-W13-v2_png/slide-01.png` to
   `slide-18.png`. Look at each one. Spoken numbers must appear on the slide or in its notes.
3. `.claude/skills/scripting/SKILL.md`: the scripting rules. Read all of it.
4. `.claude/skills/stop-slop/SKILL.md` and every file in `.claude/skills/stop-slop/references/`.

## Fixed parameters
- 20 minutes. Slower speaking speed: budget **115 words per minute**, not 135.
  Target 2,300 spoken words. Band 2,185 to 2,415. Hard floor 2,070.
  Count spoken words only, not cues, headings or the Q&A block.
- Audience: course examiners and classmates (SC2006 software engineering). Not adversarial, so no
  [PRE-EMPT] lines (scripting skill 4.1).
- Speakers: assume one speaker per beat is not known. Write it as one continuous voice. At
  natural section changes (Journey, Architecture, Delivery, Robustness, close) add an optional
  cue line `(handoff point if the team splits here)`.
- British English. Personas: Nur Aisyah (resident), Rachel Lim (operations manager),
  Ahmad Faizal (field officer).
- Every slide is spoken. Slide 1 is the cover.

## Steps
1. **Beat map.** One line per physical slide: number, the one argument, seconds. Seconds must total
   1,200 exactly. Put it at the top of the final script under the heading
   "Beat map, not yet confirmed", with any merges or splits listed.
2. **Draft 1, STE100.** Write the full script in ASD-STE100 style: short sentences (max 20 words,
   procedural style), one idea per sentence, active voice, approved simple words, no idioms.
   Save it as `smart_nation/dengue/presentation-w13/script-draft-1-ste.md`.
3. **Draft 2, stop-slop.** Apply every stop-slop rule to draft 1. Remove AI writing patterns.
   Keep the STE simplicity. Save nothing separately; carry it into step 4.
4. **Final, scripting skill.** Apply the scripting skill in full to draft 2:
   lead line per slide (10 to 18 words, no statistics), one figure per beat, energy beats
   (max one per 90 seconds, so at most 13, never the same phrase twice), cold open on a concrete
   loss, name D-Fence in the opening beat, no dashes or semicolons anywhere, delivery cues inline,
   close into Q&A naming the two questions expected, Q&A block, checks section, timing table with
   drop order. Save it as
   `smart_nation/dengue/presentation-w13/D-Fence W13 Presentation Script.md`.
5. **Notes file.** Write `smart_nation/dengue/presentation-w13/script-notes.json`: a JSON object
   with keys "1" to "18". Each value is that slide's spoken text exactly as in the final script,
   with cue lines kept in parentheses, paragraphs separated by a blank line ("\n\n"),
   no markdown (no `**`, no `>`), and no double quotes inside the text (use single quotes).

## Rules
- Write only the three output files above. Do not edit the outline, the PPTX, any skill file,
  memory files or governance files.
- Never speak a number that is not on the slide or in its notes.
- ASCII-only stdout. No code with backslashes via Bash heredocs.

## Verify before you report
- Search the final script and the JSON for the em dash, the en dash and ";". Zero hits.
- Count spoken words in the JSON values with a script. Report the count and implied minutes at 115
  words per minute.
- Check that the JSON parses and has 18 keys.

## Report
The three file paths, the spoken word count, the timing total, and any slide where a fact was
unclear.
