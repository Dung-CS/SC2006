"""Stack the crew + vehicle choice and the logistics checklist from the dispatch details capture.

The vehicle reference photo does not load on the live site, so that block is left out.
"""
from pathlib import Path
from PIL import Image

V2 = Path(__file__).resolve().parent.parent / "assets" / "v2"
full = Image.open(V2 / "manager-route-details-full.png")
w, h = full.size
s = h / 2000  # crop rows were read off the 2000px-high preview
crew_vehicle = full.crop((0, int(565 * s), w, int(835 * s)))
logistics = full.crop((0, int(1175 * s), w, int(1518 * s)))
gap = int(14 * s)
out = Image.new("RGB", (w, crew_vehicle.height + gap + logistics.height), full.getpixel((5, int(890 * s))))
out.paste(crew_vehicle, (0, 0))
out.paste(logistics, (0, crew_vehicle.height + gap))
out.save(V2 / "manager-route-crew-vehicle-logistics.png")
print("saved", out.size)
