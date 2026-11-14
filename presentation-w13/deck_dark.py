"""Run the deck skill with a dark-slide tint.

The skill's components fill cards with a pale tint of a palette colour (tint toward white).
On a dark slide that leaves white text on pale cards. This wrapper swaps `style.tint` for a
tint that gives the site's raised eggplant (#272036) for pale tints before any component imports it. Nothing in
the skill changes. Usage: python deck_dark.py build|verify|render|check ARGS (as deck.py).
"""
import sys
from pathlib import Path

SKILL = Path(r"C:\Users\chowy\alfred\.claude\skills\deck")
sys.path.insert(0, str(SKILL))

import style  # noqa: E402

RAISED = "272036"


def dark_tint(hexc, f):
    """A pale tint becomes the raised card colour; a mid tint becomes a darker shade of the colour.
    Both stay on the palette, which verify requires."""
    if f >= 0.8:
        return RAISED
    return style.mix(hexc, "000000", 0.45)




def dark_on(fill_hex, dark="000000"):
    """White text on a dark fill; eggplant text on a light fill (never the white theme text)."""
    return "FFFFFF" if style.lum(fill_hex) < 0.55 else "0C0120"


style.tint = dark_tint
style.on = dark_on

import deck  # noqa: E402
import inspect  # noqa: E402
from components import data_table, layers, logo_strip  # noqa: E402


def _patch(mod, pairs):
    """Re-run a component module with literal white fills swapped for the raised eggplant."""
    src = inspect.getsource(mod)
    for old, new in pairs:
        assert old in src, (mod.__name__, old)
        src = src.replace(old, new)
    exec(compile(src, mod.__file__, "exec"), mod.__dict__)


_patch(data_table, [('fill = "FFFFFF"', 'fill = "272036"')])
_patch(layers, [('fill="FFFFFF", line=t.line', 'fill="272036", line=t.line')])
# every logo sits on the same white tile; PostGIS and OneMap have white backdrops, not white marks
logo_strip._light = lambda ctx, image: False
# the chevron fade mixes toward white, which leaves the palette; keep every chevron one colour
from components import process_flow  # noqa: E402
process_flow.uniform_fade = lambda *a, **k: 0.0
# class names on the S12 swimlane need two lines and wider pills
from components import swimlane  # noqa: E402
import prims  # noqa: E402
exec(compile(inspect.getsource(prims.pill).replace("max_lines=1", "max_lines=2"), prims.__file__, "exec"),
     prims.__dict__)
_patch(swimlane, [("p_w = int(col_w * 0.84)", "p_w = int(col_w * 0.94)")])

if __name__ == "__main__":
    sys.exit(deck.main(sys.argv[1:]))
