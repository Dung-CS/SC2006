"""Post-process D-Fence-W13-v2.pptx to apply Yen Kit's specific deck requirements:
1. S1: Full-bleed cover image with a translucent dark overlay behind the title text.
2. S2: Add authentic persona portrait photos to the three stakeholder cards.
3. Journey slides (S3, S4, S6, S8, S9, S11): Add the 6-stage tracker bar across the top
   with the active stage highlighted, plus acting persona portrait thumbnail on the left card.
All elements strictly comply with verify.py rules:
- Frame furniture named with "Furniture: " prefix
- Palette colors: 0C0120, 272036, 8653E3, AF89F4, 75F9AA, FFFFFF
- Text in solid template colors
- Font size >= 9pt
- Shapes inside bounds
"""
from pathlib import Path
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.oxml import parse_xml
from pptx.oxml.ns import nsdecls

SCRIPT_DIR = Path(__file__).resolve().parent
DECK_DIR = SCRIPT_DIR.parent
DECK_PATH = DECK_DIR / "D-Fence-W13-v2.pptx"
ASSETS_DIR = DECK_DIR / "assets"
V2_DIR = ASSETS_DIR / "v2"

# Colors matching the template dark palette
DARK_BG = RGBColor(12, 1, 32)          # 0C0120
RAISED_CARD = RGBColor(39, 32, 54)     # 272036
ACCENT_GREEN = RGBColor(117, 249, 170) # 75F9AA
PRIMARY_PURPLE = RGBColor(134, 83, 227) # 8653E3
SECONDARY_PURP = RGBColor(175, 137, 244) # AF89F4
TEXT_WHITE = RGBColor(255, 255, 255)

STAGES = [
    "1 · Report",
    "2 · Rank",
    "3 · Plan",
    "4 · Review",
    "5 · Dispatch",
    "6 · Resolve"
]

def add_translucent_overlay(slide, left, top, width, height, fill_hex="0C0120", alpha_pct=60):
    """Add a translucent dark rectangle using raw DrawingML alpha."""
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, width, height)
    shape.name = "Cover Overlay (overlap ok)"
    shape.line.fill.background()
    spPr = shape._element.spPr
    for child in list(spPr):
        if any(child.tag.endswith(f) for f in ['solidFill', 'gradFill', 'blipFill']):
            spPr.remove(child)
    alpha_val = int(alpha_pct * 1000)
    xml = f"""
    <a:solidFill {nsdecls('a')}>
        <a:srgbClr val="{fill_hex}">
            <a:alpha val="{alpha_val}"/>
        </a:srgbClr>
    </a:solidFill>
    """
    spPr.append(parse_xml(xml))
    return shape

def process_slide1(slide):
    """Full-bleed cover with translucent dark overlay."""
    print("Post-processing Slide 1 (Cover)...")
    cover_img_path = ASSETS_DIR / "cover-estate.jpg"
    
    # 1. Remove split cover rectangle panels and previous pictures
    for sh in list(slide.shapes):
        if sh.shape_type == 13 or sh.name in ["Rectangle 11", "Rectangle 12", "Cover Overlay (overlap ok)"]:
            sp = sh._element
            sp.getparent().remove(sp)
    
    # 2. Add full-bleed picture
    full_pic = slide.shapes.add_picture(
        str(cover_img_path), Inches(0), Inches(0), Inches(13.333), Inches(7.5)
    )
    full_pic.name = "Cover Full Bleed Image"
    slide.shapes._spTree.remove(full_pic._element)
    slide.shapes._spTree.insert(2, full_pic._element)
    
    # 3. Add translucent dark rectangle over text region (left side)
    overlay = add_translucent_overlay(
        slide, Inches(0), Inches(0), Inches(7.5), Inches(7.5), fill_hex="0C0120", alpha_pct=60
    )
    slide.shapes._spTree.remove(overlay._element)
    slide.shapes._spTree.insert(3, overlay._element)

def process_slide2(slide):
    """Add persona photos to the 3 stakeholder columns on Slide 2."""
    print("Post-processing Slide 2 (Three stakeholders)...")
    col_lefts = [Inches(0.37), Inches(4.65), Inches(8.93)]
    portraits = [
        V2_DIR / "persona-resident.jpg",
        V2_DIR / "persona-manager.jpg",
        V2_DIR / "persona-crew.jpg",
    ]
    
    for col_idx, (col_x, img_path) in enumerate(zip(col_lefts, portraits)):
        if img_path.exists():
            # Add portrait photo in top-right area of card
            pic = slide.shapes.add_picture(
                str(img_path), col_x + Inches(2.95), Inches(1.25), Inches(0.95), Inches(0.95)
            )
            pic.name = f"Persona Portrait {col_idx + 1}"

def add_stage_tracker(slide, active_stage_idx, acting_portrait_path=None):
    """Draw a 6-stage process tracker bar across the top of a journey slide."""
    track_top = Inches(0.90)
    track_h = Inches(0.23)
    start_x = Inches(0.37)
    total_w = Inches(12.60)
    gap = Inches(0.06)
    box_w = (total_w - (len(STAGES) - 1) * gap) / len(STAGES)
    
    for i, stage_name in enumerate(STAGES):
        x = start_x + i * (box_w + gap)
        is_active = (i == active_stage_idx)
        
        box = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, track_top, box_w, track_h)
        box.name = f"Furniture: Journey Stage {i + 1}"
        box.line.width = Pt(1)
        
        if is_active:
            box.fill.solid()
            box.fill.fore_color.rgb = PRIMARY_PURPLE
            box.line.color.rgb = ACCENT_GREEN
            txt_color = TEXT_WHITE
            is_bold = True
        else:
            box.fill.solid()
            box.fill.fore_color.rgb = RAISED_CARD
            box.line.color.rgb = PRIMARY_PURPLE
            txt_color = SECONDARY_PURP
            is_bold = False
            
        tf = box.text_frame
        tf.word_wrap = False
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
        p = tf.paragraphs[0]
        p.text = stage_name
        p.alignment = PP_ALIGN.CENTER
        p.font.name = "Segoe UI"
        p.font.size = Pt(10)
        p.font.bold = is_bold
        p.font.color.rgb = txt_color

    # Add acting persona portrait thumbnail on top left card
    if acting_portrait_path and acting_portrait_path.exists():
        pic = slide.shapes.add_picture(
            str(acting_portrait_path), Inches(4.35), Inches(1.22), Inches(0.85), Inches(0.85)
        )
        pic.name = f"Acting Persona Thumbnail (Stage {active_stage_idx + 1})"

def main():
    prs = Presentation(str(DECK_PATH))
    slides = list(prs.slides)
    
    # Slide 1: Cover
    process_slide1(slides[0])
    
    # Slide 2: Stakeholders
    process_slide2(slides[1])
    
    # Journey slides:
    # S3: Stage 1 (idx 2)
    print("Post-processing Slide 3 (Stage 1)...")
    add_stage_tracker(slides[2], 0, V2_DIR / "persona-resident.jpg")
    
    # S4: Stage 2 (idx 3)
    print("Post-processing Slide 4 (Stage 2)...")
    add_stage_tracker(slides[3], 1, V2_DIR / "persona-manager.jpg")
    
    # S6: Stage 3 (idx 5)
    print("Post-processing Slide 6 (Stage 3)...")
    add_stage_tracker(slides[5], 2, V2_DIR / "persona-manager.jpg")
    
    # S8: Stage 4 (idx 7)
    print("Post-processing Slide 8 (Stage 4)...")
    add_stage_tracker(slides[7], 3, V2_DIR / "persona-manager.jpg")
    
    # S9: Stage 5 (idx 8)
    print("Post-processing Slide 9 (Stage 5)...")
    add_stage_tracker(slides[8], 4, V2_DIR / "persona-crew.jpg")
    
    # S11: Stage 6 (idx 10)
    print("Post-processing Slide 11 (Stage 6)...")
    add_stage_tracker(slides[10], 5, V2_DIR / "persona-resident.jpg")
    
    prs.save(str(DECK_PATH))
    print(f"Post-processing complete. Saved to {DECK_PATH}")

if __name__ == "__main__":
    main()
