import win32com.client
from pathlib import Path

ppt = win32com.client.Dispatch('PowerPoint.Application')

targets = [
    ('Vision Questers_SBCC2026_Finals.pptx', 1),
    ('Four Horsemen_SBCC2026.pptx', 15),
    ('Think Tank_SBCC2026.pptx', 13),
    ('Four Horsemen_SBCC2026.pptx', 6),
    ('Four Horsemen_SBCC2026.pptx', 5),
    ('Four Horsemen_SBCC2026.pptx', 11),
    ('Pls Fix Consulting Base Deck.pptx', 37),
    ('Pls Fix Consulting Base Deck.pptx', 4),
    ('Four Horsemen_SBCC2026.pptx', 10),
    ('Four Horsemen_SBCC2026.pptx', 21),
    ('Four Horsemen_SBCC2026.pptx', 2),
    ('Think Tank_SBCC2026.pptx', 4),
    ('Four Horsemen_SBCC2026.pptx', 23),
]

for fname, sidx in targets:
    fpath = str((Path('casing/templates') / fname).resolve())
    pres = ppt.Presentations.Open(fpath, WithWindow=False)
    slide = pres.Slides(sidx)
    print(f'=== {fname} Slide {sidx} (Shapes: {slide.Shapes.Count}) ===')
    for k in range(1, slide.Shapes.Count + 1):
        sh = slide.Shapes(k)
        text = ''
        if sh.HasTextFrame and sh.TextFrame.HasText:
            text = sh.TextFrame.TextRange.Text.replace('\r', ' ').replace('\n', ' ')[:40]
        print(f'  [{k}] type={sh.Type} pos=({sh.Left/72:.2f}, {sh.Top/72:.2f}, {sh.Width/72:.2f}, {sh.Height/72:.2f}) text="{text}"')
    pres.Close()
