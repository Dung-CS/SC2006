"""
Generate slide outline PPTX with:
1. Pasted cropped exemplar element images directly on the slide canvas.
2. Structured overlays on top to label and fill in D-Fence's content.
3. Full topic sentences in the header.
4. Complete speaker notes with narrative, bullets, and casing exemplar citations.
"""
from pathlib import Path
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

def build_deck():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # Colors
    HEADER_TEXT = RGBColor(20, 25, 35)
    SECTION_TEXT = RGBColor(90, 80, 200)       # purple/indigo brand
    OVERLAY_BG = RGBColor(255, 255, 255)       # crisp white card overlay
    OVERLAY_BORDER = RGBColor(70, 60, 180)     # purple brand border
    ACCENT_BG = RGBColor(240, 243, 255)
    BANNER_BG = RGBColor(235, 250, 240)        # soft green banner
    BANNER_BORDER = RGBColor(40, 160, 90)
    DARK_TEXT = RGBColor(25, 30, 40)
    MUTED_TEXT = RGBColor(80, 90, 105)

    crop_dir = Path("smart_nation/dengue/presentation-w13/cropped_elements")

    def add_header(slide, section_name, title_text):
        if section_name:
            tag_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.25), Inches(11.733), Inches(0.35))
            tf_tag = tag_box.text_frame
            tf_tag.word_wrap = True
            p_tag = tf_tag.paragraphs[0]
            p_tag.text = section_name.upper()
            p_tag.font.name = "Segoe UI"
            p_tag.font.size = Pt(11)
            p_tag.font.bold = True
            p_tag.font.color.rgb = SECTION_TEXT

        title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.55), Inches(11.733), Inches(0.85))
        tf_title = title_box.text_frame
        tf_title.word_wrap = True
        p_title = tf_title.paragraphs[0]
        p_title.text = title_text
        p_title.font.name = "Segoe UI"
        p_title.font.size = Pt(20)
        p_title.font.bold = True
        p_title.font.color.rgb = HEADER_TEXT

    def add_element_picture(slide, img_name):
        img_path = crop_dir / img_name
        # 11.733 inches width, positioned at top 1.5 inches
        pic = slide.shapes.add_picture(str(img_path), Inches(0.8), Inches(1.5), width=Inches(11.733))
        return pic

    def add_overlay_card(slide, left, top, width, height, title, subtitle="", style="card"):
        shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, width, height)
        shape.fill.solid()
        if style == "accent":
            shape.fill.fore_color.rgb = ACCENT_BG
            shape.line.color.rgb = OVERLAY_BORDER
            shape.line.width = Pt(1.5)
        elif style == "banner":
            shape.fill.fore_color.rgb = BANNER_BG
            shape.line.color.rgb = BANNER_BORDER
            shape.line.width = Pt(1.5)
        elif style == "pill":
            shape.fill.fore_color.rgb = OVERLAY_BG
            shape.line.color.rgb = OVERLAY_BORDER
            shape.line.width = Pt(1.2)
        else:
            shape.fill.fore_color.rgb = OVERLAY_BG
            shape.line.color.rgb = OVERLAY_BORDER
            shape.line.width = Pt(1.5)

        tf = shape.text_frame
        tf.word_wrap = True
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        p1 = tf.paragraphs[0]
        p1.text = title
        p1.font.name = "Segoe UI"
        p1.font.size = Pt(11.5)
        p1.font.bold = True
        p1.font.color.rgb = DARK_TEXT

        if subtitle:
            p2 = tf.add_paragraph()
            p2.text = subtitle
            p2.font.name = "Segoe UI"
            p2.font.size = Pt(9.5)
            p2.font.color.rgb = MUTED_TEXT

        return shape

    def set_notes(slide, notes_content):
        notes_slide = slide.notes_slide
        tf = notes_slide.notes_text_frame
        tf.text = notes_content

    # ==========================================
    # SLIDE 1: Cover
    # ==========================================
    s1 = prs.slides.add_slide(blank_layout)
    add_header(s1, "", "D-Fence: Dengue sanitisation, from report to resolved")
    add_element_picture(s1, "s01_cover.png")
    add_overlay_card(s1, Inches(1.2), Inches(2.2), Inches(6.0), Inches(3.2),
                     "D-FENCE SYSTEM OVERVIEW",
                     "Closed-loop municipal dengue sanitisation operations connecting residents, ops managers, and cleaning crews.\n\n"
                     "• Occasion: NTU SC2006 Week 13 Project Presentation\n"
                     "• Live URL: dfence-sc2006.azurewebsites.net\n"
                     "• Cloud Stack: Azure App Service (Linux B1) + Supabase Postgres", "accent")
    add_overlay_card(s1, Inches(7.5), Inches(5.6), Inches(4.5), Inches(0.9),
                     "STATUS: LIVE ON AZURE",
                     "1,243 Vitest tests passing | Full CI/CD automation", "banner")
    set_notes(s1, """SPEAKER NOTES:
D-Fence closes one loop: a resident reports a breeding site, the system ranks it, a crew is routed to it, and the resident sees it resolved. It is live on Azure. The deck uses the site's dark palette; the font is Segoe UI because Inter is not installed on the build machine.

EXEMPLAR REFERENCE & ELEMENT SELECTION:
- Best Element: Vision Questers SBCC 2026 Finals, Slide 1 (Split cover with left text, dark tech theme matching D-Fence dark mode, photo on right)
- File Path: casing/templates/Vision Questers_SBCC2026_Finals.pptx (Slide 1, vision-01)
- 1-Click Preview Link: file:///C:/Users/chowy/alfred/casing/templates/library/previews/vision-01.png
- Cropped Element Image: file:///C:/Users/chowy/alfred/smart_nation/dengue/presentation-w13/cropped_elements/s01_cover.png""")

    # ==========================================
    # SLIDE 2: What it does (Product)
    # ==========================================
    s2 = prs.slides.add_slide(blank_layout)
    add_header(s2, "Product", "One app gives four parties one closed loop")
    add_element_picture(s2, "s02_features.png")
    add_overlay_card(s2, Inches(1.0), Inches(1.8), Inches(4.8), Inches(1.1),
                     "INTERFACE EXHIBIT: RESIDENT APP",
                     "Live map displays real-time dengue clusters, rainfall heatmaps, and report submission points.", "accent")
    add_overlay_card(s2, Inches(6.2), Inches(1.7), Inches(6.0), Inches(1.0),
                     "1. Resident Role",
                     "Reports breeding site with photo & GPS; tracks progress live to Resolved.", "card")
    add_overlay_card(s2, Inches(6.2), Inches(2.85), Inches(6.0), Inches(1.0),
                     "2. Operations Manager Role",
                     "Reviews multi-factor risk queue; assigns crew, vehicle & road-verified route.", "card")
    add_overlay_card(s2, Inches(6.2), Inches(4.0), Inches(6.0), Inches(1.0),
                     "3. Cleaning Crew Role",
                     "Executes turn-by-turn route within 4h cap; uploads photographic completion proof.", "card")
    add_overlay_card(s2, Inches(6.2), Inches(5.15), Inches(6.0), Inches(1.0),
                     "4. Authorities (AVS / NParks)",
                     "Automated referral dispatch for non-sanitisation wildlife and hazard cases.", "card")
    set_notes(s2, """SPEAKER NOTES:
Three roles share one system: Resident, Operations Manager and Cleaning Crew. External authorities such as AVS and NParks receive referrals for wildlife cases that D-Fence does not dispatch itself. The screenshot is the resident dengue map in the live dark site. Risk ranking blends live rainfall, forecast and dengue cluster data with each report. Gemini screens report photos for pests.

EXEMPLAR REFERENCE & ELEMENT SELECTION:
- Best Element: Four Horsemen SBCC 2026, Slide 15 (four-15 - Exploded product interface left with multi-stakeholder spec table right)
- File Path: casing/templates/Four Horsemen_SBCC2026.pptx (Slide 15, four-15)
- 1-Click Preview Link: file:///C:/Users/chowy/alfred/casing/templates/library/previews/four-15.png
- Cropped Element Image: file:///C:/Users/chowy/alfred/smart_nation/dengue/presentation-w13/cropped_elements/s02_features.png""")

    # ==========================================
    # SLIDE 3: WHAM (Product)
    # ==========================================
    s3 = prs.slides.add_slide(blank_layout)
    add_header(s3, "Product", "Four outcomes set D-Fence apart")
    add_element_picture(s3, "s03_wham_pillars.png")
    add_overlay_card(s3, Inches(1.0), Inches(1.7), Inches(2.7), Inches(4.6),
                     "WHAM 1 · Live Data",
                     "Rainfall (5-min poll) + forecasts + cluster records feed 7 weighted drivers for real-time risk scoring.", "accent")
    add_overlay_card(s3, Inches(3.9), Inches(1.7), Inches(2.7), Inches(4.6),
                     "WHAM 2 · Routes Hold",
                     "OneMap road network verification with 10-min pedestrian radius and hard 4-hour crew shift ceiling.", "card")
    add_overlay_card(s3, Inches(6.8), Inches(1.7), Inches(2.7), Inches(4.6),
                     "WHAM 3 · Shared State",
                     "Unified HTTPS JSON architecture: report, moderate, assign, complete, and immutable audit logs.", "card")
    add_overlay_card(s3, Inches(9.7), Inches(1.7), Inches(2.7), Inches(4.6),
                     "WHAM 4 · Tested = Live",
                     "Release archive SHA256 match; 1,243 Vitest tests; 17 migrations verified on real Postgres in CI.", "accent")
    set_notes(s3, """SPEAKER NOTES:
These are the WHAM areas: outcomes that earn marks beyond the expected standard. The grader said the app must consume live data, process it, and support several users on shared state. The course also rewards architecture and a rigorous process. Each area is tagged with its number on the slides that prove it: 3 on the data flow, 1 on prioritisation, 2 on routing, 4 on CI/CD and testing.

EXEMPLAR REFERENCE & ELEMENT SELECTION:
- Best Element: Think Tank SBCC 2026, Slide 13 (think-13 - Four photo-header pillar tiles with targets and benefits, closing statement)
- File Path: casing/templates/Think Tank_SBCC2026.pptx (Slide 13, think-13)
- 1-Click Preview Link: file:///C:/Users/chowy/alfred/casing/templates/library/previews/think-13.png
- Cropped Element Image: file:///C:/Users/chowy/alfred/smart_nation/dengue/presentation-w13/cropped_elements/s03_wham_pillars.png""")

    # ==========================================
    # SLIDE 4: Data flow (Product)
    # ==========================================
    s4 = prs.slides.add_slide(blank_layout)
    add_header(s4, "Product", "One report moves through five steps to resolved")
    add_element_picture(s4, "s04_process_flow.png")
    # 5 step overlays
    step_w = Inches(2.15)
    gap = Inches(0.2)
    s_x = Inches(1.0)
    add_overlay_card(s4, s_x + 0*(step_w+gap), Inches(1.8), step_w, Inches(3.4),
                     "1. Resident Reports", "POST /api/reports\nPhoto + coordinates\nGemini pest filter", "card")
    add_overlay_card(s4, s_x + 1*(step_w+gap), Inches(1.8), step_w, Inches(3.4),
                     "2. Server Ranks", "Plan cache clears\nJoins priority queue\nWeather re-scaled", "accent")
    add_overlay_card(s4, s_x + 2*(step_w+gap), Inches(1.8), step_w, Inches(3.4),
                     "3. Manager Books", "/api/ops/dispatch/assign\nCrew & van allocated\n4h limit verified", "card")
    add_overlay_card(s4, s_x + 3*(step_w+gap), Inches(1.8), step_w, Inches(3.4),
                     "4. Crew Proves", "/api/crew/work-orders\nComplete on-site\nUpload photo proof", "card")
    add_overlay_card(s4, s_x + 4*(step_w+gap), Inches(1.8), step_w, Inches(3.4),
                     "5. Resident Closes", "Status Resolved\nAppend audit trail\nTelegram push alert", "accent")
    add_overlay_card(s4, Inches(1.0), Inches(5.6), Inches(11.3), Inches(0.9),
                     "WHAM 3 TAKEAWAY: ONE SHARED OPERATIONAL RECORD",
                     "Every action executes through authenticated HTTPS JSON calls maintaining ACID integrity across all actors.", "banner")
    set_notes(s4, """SPEAKER NOTES:
Every step is an HTTPS JSON call: POST /api/reports, /api/ops/dispatch/assign, /api/crew/work-orders/:id/complete. Gemini checks the photo and the report is verified by default. The new report clears the plan cache, so it joins the plan as an unplanned task within seconds. Booked routes do not change on their own. Completing a work order closes the report, writes an audit entry and sends an alert, by Telegram when linked. Residents can also corroborate each other's reports.

EXEMPLAR REFERENCE & ELEMENT SELECTION:
- Best Element: Four Horsemen SBCC 2026, Slide 6 (four-06 - Five-chain process flow with icon headers, gap metrics, and takeaway strip)
- File Path: casing/templates/Four Horsemen_SBCC2026.pptx (Slide 6, four-06)
- 1-Click Preview Link: file:///C:/Users/chowy/alfred/casing/templates/library/previews/four-06.png
- Cropped Element Image: file:///C:/Users/chowy/alfred/smart_nation/dengue/presentation-w13/cropped_elements/s04_process_flow.png""")

    # ==========================================
    # SLIDE 5: Prioritisation (Algorithms)
    # ==========================================
    s5 = prs.slides.add_slide(blank_layout)
    add_header(s5, "Algorithms", "Seven weighted drivers turn live data into a ranked queue")
    add_element_picture(s5, "s05_prioritisation.png")
    add_overlay_card(s5, Inches(1.0), Inches(1.65), Inches(11.3), Inches(0.85),
                     "MATHEMATICAL SCORING SPECIFICATION",
                     "Score = 100 × Severity × (∑ Weight_i × ScaledValue_i) / ∑ Weights_present | Stale telemetry drops weight with degraded flag", "accent")
    add_overlay_card(s5, Inches(1.0), Inches(2.7), Inches(5.5), Inches(2.7),
                     "7 WEIGHTED TELEMETRY DRIVERS",
                     "• Case Size: 0.30 (log-scaled, ref 300)\n"
                     "• Case Growth: 0.20 (log-scaled, ref 40)\n"
                     "• Treatment Recency: 0.15 (decay 60 days)\n"
                     "• Rainfall 72h: 0.12 (cap 120 mm)\n"
                     "• Verified Reports: 0.10 (cap 5 reports)\n"
                     "• Rainfall 24h: 0.08 (cap 50 mm)\n"
                     "• Premises Mix: 0.05 (configured ratio)", "card")
    add_overlay_card(s5, Inches(6.8), Inches(2.7), Inches(5.5), Inches(2.7),
                     "4 PRIORITY TIERS & TIE-BREAKERS",
                     "• Critical: Verified report triggers hard rule override\n"
                     "• High: Computed score ≥ 70.0\n"
                     "• Medium: Computed score 40.0 – 69.9\n"
                     "• Low: Computed score < 40.0\n\n"
                     "Tie-breaking hierarchy: Severity → Open Reports → Locality\n"
                     "Spatial Grouping: 100m complete-link clustering", "card")
    add_overlay_card(s5, Inches(1.0), Inches(5.6), Inches(11.3), Inches(0.9),
                     "WHAM 1 TAKEAWAY: DETERMINISTIC TOTAL RANKING",
                     "Every report is assigned an unambiguous queue position with full mathematical driver provenance.", "banner")
    set_notes(s5, """SPEAKER NOTES:
Score = 100 x pest severity x (sum of weight x scaled value) / (sum of weights present). The mosquito has severity 1.0. A driver whose source is stale is dropped and the rest are re-weighted; the score is then marked degraded. Weights are committed JSON and must sum to 1.0 at load. Ranking puts every Critical first, then descending score, then severity, then verified open reports, then locality name, so the order is total. Critical comes from configured rules on verified reports only and keeps the score. The 100 m grouping is complete-link: every pair in a group must be within the limit (default 100 m, set between 1 and 1000).

EXEMPLAR REFERENCE & ELEMENT SELECTION:
- Best Element: Four Horsemen SBCC 2026, Slide 5 (four-05 - Weighted 1-5 heatmap with winner frame, beside parameter panels)
- File Path: casing/templates/Four Horsemen_SBCC2026.pptx (Slide 5, four-05)
- 1-Click Preview Link: file:///C:/Users/chowy/alfred/casing/templates/library/previews/four-05.png
- Cropped Element Image: file:///C:/Users/chowy/alfred/smart_nation/dengue/presentation-w13/cropped_elements/s05_prioritisation.png""")

    # ==========================================
    # SLIDE 6: Routing (Algorithms)
    # ==========================================
    s6 = prs.slides.add_slide(blank_layout)
    add_header(s6, "Algorithms", "Priority-first routing builds crew routes inside hard limits")
    add_element_picture(s6, "s06_routing_map.png")
    add_overlay_card(s6, Inches(1.0), Inches(1.7), Inches(5.5), Inches(1.8),
                     "4 HARD OPERATIONAL CONSTRAINTS",
                     "• Staff: Capability match, team size & HQ depot origin\n"
                     "• Cargo: Available seats, vehicle payload & tool capacity\n"
                     "• 4-Hour Cap: Drive time + walk access + on-site effort + delay\n"
                     "• OneMap: Actual road network geometry (no straight lines)", "accent")
    add_overlay_card(s6, Inches(1.0), Inches(3.65), Inches(5.5), Inches(1.8),
                     "GREEDY INSERTION + LOCAL SEARCH",
                     "1. Priority Sort (Critical → High → Medium → Low)\n"
                     "2. Best Insertion (checks top 6 candidate insertion gaps)\n"
                     "3. Road Leg Verification (calls OneMap route services)\n"
                     "4. Local Optimization (64 within-route, 136 cross-route swaps)", "card")
    add_overlay_card(s6, Inches(6.8), Inches(1.7), Inches(5.5), Inches(3.75),
                     "SINGAPORE ROAD ROUTE VERIFICATION",
                     "• Vehicle stops at nearest legal road point\n"
                     "• Max 10-minute pedestrian walk access to site\n"
                     "• Driving legs connected into continuous closed circuit\n"
                     "• Tasks without viable access pushed to unassigned queue\n\n"
                     "Source: docs/ROUTING-ALGORITHM-STE100.md", "card")
    add_overlay_card(s6, Inches(1.0), Inches(5.6), Inches(11.3), Inches(0.9),
                     "WHAM 2 TAKEAWAY: REALISTIC CREW FEASIBILITY",
                     "Guaranteed adherence to physical road networks, parking constraints, and 4-hour working shift boundaries.", "banner")
    set_notes(s6, """SPEAKER NOTES:
The method is priority-first greedy insertion with bounded local search, so it does not prove the plan is shortest. Each route starts and ends at the crew HQ. Total time = driving + walking + work + on-call delay, at most four hours. For each task the planner ranks insertion candidates by a straight-line estimate, then checks up to six through OneMap and keeps the smallest accepted rise in verified travel time. Driving legs must join into one circuit. Walking access from a vehicle point must take ten minutes or less. Local search allows 64 within-route and 136 cross-route checks. A task can stay unassigned when no checked option meets every limit; a high priority does not guarantee a slot. Wildlife, bird, bee and wasp cases need the Authority Response capability. Source: docs/ROUTING-ALGORITHM-STE100.md and the code.

EXEMPLAR REFERENCE & ELEMENT SELECTION:
- Best Element: Four Horsemen SBCC 2026, Slide 11 (four-11 - Corridor map with route list, system constraint diagram and legend)
- File Path: casing/templates/Four Horsemen_SBCC2026.pptx (Slide 11, four-11)
- 1-Click Preview Link: file:///C:/Users/chowy/alfred/casing/templates/library/previews/four-11.png
- Cropped Element Image: file:///C:/Users/chowy/alfred/smart_nation/dengue/presentation-w13/cropped_elements/s06_routing_map.png""")

    # ==========================================
    # SLIDE 7: System architecture (Architecture)
    # ==========================================
    s7 = prs.slides.add_slide(blank_layout)
    add_header(s7, "Architecture", "A thin client calls a layered server on one database")
    add_element_picture(s7, "s07_layers.png")
    layers = [
        ("1. Browser Client", "React 18 SPA | Tailwind CSS | esbuild | HTTPS JSON only"),
        ("2. Boundary Layer", "18 route modules | 12 gateways | Strict Auth & security headers"),
        ("3. Control Layer", "Services | Scoring engine | Priority-first greedy routing"),
        ("4. Persistence Layer", "PostgreSQL repositories + In-memory twins (DATABASE_URL toggle)"),
        ("5. Data Layer", "Supabase PostgreSQL | PostGIS spatial extensions | Private photo buckets"),
        ("6. Outside Services", "OneMap routing | data.gov.sg weather feeds | Gemini AI | Telegram"),
    ]
    top_y = Inches(1.7)
    row_h = Inches(0.68)
    row_gap = Inches(0.12)
    for i, (lname, ldesc) in enumerate(layers):
        add_overlay_card(s7, Inches(1.0), top_y + i*(row_h+row_gap), Inches(11.3), row_h,
                         lname, ldesc, "accent" if i in [1, 3] else "card")
    set_notes(s7, """SPEAKER NOTES:
The browser only talks JSON over HTTPS. Each store has a Postgres repository and an in-memory twin, chosen at start-up by DATABASE_URL, which is how tests run without a database. The repo folders mirror the layers: src/boundary, src/control and src/persistence, with client/ for the app. Timers inside the server pull rainfall every 5 minutes, the forecast every 6 hours and dengue clusters hourly. Scoring weights are committed JSON in config/.

EXEMPLAR REFERENCE & ELEMENT SELECTION:
- Best Element: Pls Fix Base Deck, Slide 37 (plsfix-37 - Multi-tier architecture stack with structured component blocks)
- File Path: casing/templates/Pls Fix Consulting Base Deck.pptx (Slide 37, plsfix-37)
- 1-Click Preview Link: file:///C:/Users/chowy/alfred/casing/templates/library/previews/plsfix-37.png
- Cropped Element Image: file:///C:/Users/chowy/alfred/smart_nation/dengue/presentation-w13/cropped_elements/s07_layers.png""")

    # ==========================================
    # SLIDE 8: Tech stack (Architecture)
    # ==========================================
    s8 = prs.slides.add_slide(blank_layout)
    add_header(s8, "Architecture", "Mainstream tools carry the stack from browser to cloud")
    add_element_picture(s8, "s08_tech_grid.png")
    add_overlay_card(s8, Inches(1.0), Inches(1.8), Inches(5.5), Inches(1.7),
                     "FRONTEND ARCHITECTURE",
                     "• React 18 & TypeScript: Deterministic UI state & components\n"
                     "• Tailwind CSS: Dark design system matching DESIGN.md\n"
                     "• Leaflet: Interactive spatial clustering & polygon mapping", "accent")
    add_overlay_card(s8, Inches(6.8), Inches(1.8), Inches(5.5), Inches(1.7),
                     "BACKEND & DATA LAYER",
                     "• Node.js 24 & Express: High-throughput async REST server\n"
                     "• PostgreSQL & PostGIS: Geospatial calculations & indexing\n"
                     "• Supabase: Managed database & signed TLS photo storage", "card")
    add_overlay_card(s8, Inches(1.0), Inches(3.7), Inches(5.5), Inches(1.7),
                     "CLOUD & CONTINUOUS DELIVERY",
                     "• Azure App Service: Linux B1 container in East Asia\n"
                     "• GitHub Actions: OIDC passwordless deploy & 4 gates\n"
                     "• Gemini Vision: Automated pest screening on upload", "card")
    add_overlay_card(s8, Inches(6.8), Inches(3.7), Inches(5.5), Inches(1.7),
                     "INTEGRATIONS & OBSERVABILITY",
                     "• OneMap API: Official Singapore road routing & legs\n"
                     "• data.gov.sg: Real-time rainfall & NEA cluster feeds\n"
                     "• Telegram Bot: Push alerts & notifications to residents", "accent")
    add_overlay_card(s8, Inches(1.0), Inches(5.6), Inches(11.3), Inches(0.9),
                     "PRODUCTION LICENSING COMPLIANCE",
                     "Every dependency verified: Simple Icons (CC0), MIT open source libraries, zero IP encumbrance.", "banner")
    set_notes(s8, """SPEAKER NOTES:
Every logo maps to a dependency or service in the repo: package.json (React, Leaflet, Express, pg), the TypeScript sources, deploy.yml (GitHub Actions, Azure), DEPLOY.md (Supabase, PostGIS), OneMapGateway.ts and TelegramGateway.ts. Logo credits: Simple Icons (CC0) for React, TypeScript, Node.js, Express, PostgreSQL, Supabase, GitHub Actions, Leaflet and Telegram. The Azure, PostGIS and OneMap logos come from the owners' public pages via Google Images. All marks belong to their owners.

EXEMPLAR REFERENCE & ELEMENT SELECTION:
- Best Element: Pls Fix Base Deck, Slide 4 (plsfix-04 - 3x4 partner / technology matrix with clear icon tiles and banner)
- File Path: casing/templates/Pls Fix Consulting Base Deck.pptx (Slide 4, plsfix-04)
- 1-Click Preview Link: file:///C:/Users/chowy/alfred/casing/templates/library/previews/plsfix-04.png
- Cropped Element Image: file:///C:/Users/chowy/alfred/smart_nation/dengue/presentation-w13/cropped_elements/s08_tech_grid.png""")

    # ==========================================
    # SLIDE 9: Cloud (Delivery)
    # ==========================================
    s9 = prs.slides.add_slide(blank_layout)
    add_header(s9, "Delivery", "Two managed services run the app with no keys in the repo")
    add_element_picture(s9, "s09_cloud_cards.png")
    add_overlay_card(s9, Inches(1.0), Inches(1.8), Inches(3.6), Inches(3.6),
                     "1. GitHub Actions (CI/CD)",
                     "• Authenticates via GitHub OIDC\n"
                     "• Zero static deploy passwords stored\n"
                     "• Scoped to Website Contributor\n"
                     "• Runs 4 parallel verification gates\n"
                     "• Strict release hash matching", "card")
    add_overlay_card(s9, Inches(4.85), Inches(1.8), Inches(3.6), Inches(3.6),
                     "2. Azure App Service (Compute)",
                     "• Linux B1 container, Node 24 runtime\n"
                     "• Region: East Asia\n"
                     "• Secrets isolated in App Settings\n"
                     "• Enforced HTTPS & security headers\n"
                     "• Boot fails if any env var missing", "accent")
    add_overlay_card(s9, Inches(8.7), Inches(1.8), Inches(3.6), Inches(3.6),
                     "3. Supabase Singapore (Database)",
                     "• PostgreSQL engine with PostGIS\n"
                     "• Private encrypted photo storage buckets\n"
                     "• Signed short-lived read URLs over TLS\n"
                     "• Automated SSL certificate checks\n"
                     "• Append-only DB audit triggers", "card")
    add_overlay_card(s9, Inches(1.0), Inches(5.6), Inches(11.3), Inches(0.9),
                     "SECURITY TOPOLOGY SUMMARY",
                     "Zero stored credentials in source control. Enforced TLS everywhere. Hardware-isolated compute & database.", "banner")
    set_notes(s9, """SPEAKER NOTES:
CI signs in to Azure with a GitHub OIDC credential, scoped to Website Contributor on this one app. Runtime secrets live only in Azure App Settings. East Asia was chosen because the Azure for Students policy refused Southeast Asia.

EXEMPLAR REFERENCE & ELEMENT SELECTION:
- Best Element: Four Horsemen SBCC 2026, Slide 10 (four-10 - Three partner / architecture cards with credential and security badges)
- File Path: casing/templates/Four Horsemen_SBCC2026.pptx (Slide 10, four-10)
- 1-Click Preview Link: file:///C:/Users/chowy/alfred/casing/templates/library/previews/four-10.png
- Cropped Element Image: file:///C:/Users/chowy/alfred/smart_nation/dengue/presentation-w13/cropped_elements/s09_cloud_cards.png""")

    # ==========================================
    # SLIDE 10: CI/CD (Delivery)
    # ==========================================
    s10 = prs.slides.add_slide(blank_layout)
    add_header(s10, "Delivery", "Four gates run on every push and only main deploys")
    add_element_picture(s10, "s10_cicd_pipeline.png")
    add_overlay_card(s10, Inches(1.0), Inches(1.7), Inches(11.3), Inches(1.8),
                     "ROW 1: FOUR PARALLEL PR VERIFICATION GATES",
                     "1. Test & Package: TypeScript typecheck, Vite build, Vitest suite, network-blocked smoke boot\n"
                     "2. Real Postgres: Executes all 17 migrations from clean state against real Postgres engine\n"
                     "3. Migration Guard: Validates released SQL migration files have zero unapproved edits\n"
                     "4. Workflow Lint: Checksum-pinned actionlint validates GitHub workflow security", "card")
    add_overlay_card(s10, Inches(1.0), Inches(3.65), Inches(11.3), Inches(1.8),
                     "ROW 2: FIVE SEQUENTIAL MAIN DEPLOY GATES",
                     "1. Hash Check: SHA256 of release zip exactly equals verified tested artifact\n"
                     "2. OIDC Sign-in: Passwordless short-lived authentication into Azure subscription\n"
                     "3. Blue/Green Deploy: ZIP upload, atomic app restart on Linux App Service container\n"
                     "4. Health Polling: Polls /api/health endpoint every 5 seconds until HTTP 200 OK\n"
                     "5. Live Hash Verification: Confirms running server hash matches tested package", "accent")
    add_overlay_card(s10, Inches(1.0), Inches(5.6), Inches(11.3), Inches(0.9),
                     "WHAM 4 TAKEAWAY: TESTED BUILD = LIVE BUILD",
                     "Deterministic release integrity guarantees that no unverified change ever reaches the live production server.", "banner")
    set_notes(s10, """SPEAKER NOTES:
Every push runs four jobs in parallel. Deploy needs all four and runs only on main, one at a time. The exact zip that passed the tests is the one deployed. Migration 017 passed the in-memory tests, so a real Postgres run now catches that class of bug.

EXEMPLAR REFERENCE & ELEMENT SELECTION:
- Best Element: Four Horsemen SBCC 2026, Slide 21 (four-21 - Process rows x four phase columns with numbered actions and vision panel)
- File Path: casing/templates/Four Horsemen_SBCC2026.pptx (Slide 21, four-21)
- 1-Click Preview Link: file:///C:/Users/chowy/alfred/casing/templates/library/previews/four-21.png
- Cropped Element Image: file:///C:/Users/chowy/alfred/smart_nation/dengue/presentation-w13/cropped_elements/s10_cicd_pipeline.png""")

    # ==========================================
    # SLIDE 11: Testing strategy (Delivery)
    # ==========================================
    s11 = prs.slides.add_slide(blank_layout)
    add_header(s11, "Delivery", "Six test layers run from one function to the live site")
    add_element_picture(s11, "s11_testing_layers.png")
    test_tiers = [
        ("Layer 6: Live Deployment Checks", "Post-deploy health poll & client asset SHA256 integrity check against source build"),
        ("Layer 5: UI Interaction Sweep", "Headless Playwright end-to-end user workflows & axe accessibility audit"),
        ("Layer 4: Smoke Boot Verification", "Packaged release archive boots successfully with external outbound network blocked"),
        ("Layer 3: SQL Migration Tests", "Executes all 17 migrations from empty database against actual PostgreSQL container"),
        ("Layer 2: Screen Component Tests", "23 React test suites executed using React Testing Library with mocked stores"),
        ("Layer 1: Unit & Algorithm Tests", "1,243 Vitest tests pass across scoring formulas, insertion routing, and repos"),
    ]
    t_y = Inches(1.7)
    t_h = Inches(0.58)
    t_gap = Inches(0.07)
    for i, (tname, tdesc) in enumerate(test_tiers):
        add_overlay_card(s11, Inches(1.0), t_y + i*(t_h+t_gap), Inches(11.3), t_h,
                         tname, tdesc, "accent" if i in [0, 3] else "card")
    add_overlay_card(s11, Inches(1.0), Inches(5.6), Inches(11.3), Inches(0.9),
                     "WHAM 4 TAKEAWAY: MULTI-LAYER PROOF",
                     "Fast in-memory twin execution in local dev; real SQL verification in CI; automated live checks in production.", "banner")
    set_notes(s11, """SPEAKER NOTES:
Most tests use the in-memory twins, so the suite needs no database and runs on every push. The Postgres job proves the same repositories against real SQL. The smoke test boots the packaged zip with outbound fetch blocked. The UI sweep runs locally, not in CI. The full run of 2026-10-31 had 1,301 tests: 1,243 passed, 58 were skipped because they need a live database, and none failed.

EXEMPLAR REFERENCE & ELEMENT SELECTION:
- Best Element: Four Horsemen SBCC 2026, Slide 2 (four-02 - Six structured problem/solution/impact rows with icon badges and KPI tiles)
- File Path: casing/templates/Four Horsemen_SBCC2026.pptx (Slide 2, four-02)
- 1-Click Preview Link: file:///C:/Users/chowy/alfred/casing/templates/library/previews/four-02.png
- Cropped Element Image: file:///C:/Users/chowy/alfred/smart_nation/dengue/presentation-w13/cropped_elements/s11_testing_layers.png""")

    # ==========================================
    # SLIDE 12: Optimisations (Robustness)
    # ==========================================
    s12 = prs.slides.add_slide(blank_layout)
    add_header(s12, "Robustness", "Targeted limits keep the app fast, cheap and safe")
    add_element_picture(s12, "s12_optimisations.png")
    opts = [
        ("1. In-Memory Cache", "Dispatch plans cached in RAM; invalidated immediately on new report arrival. Debounced at 250ms."),
        ("2. Spatial Database Indexing", "PostGIS GIST spatial indexes accelerate geographic radius & bounding-box queries."),
        ("3. Polling Waste Reduction", "Replaced 3.2MB full rain poll with efficient incremental delta fetches every 5 minutes."),
        ("4. Abuse & Quota Controls", "15-minute progressive login lockout on failed auth. Exponential backoff on Gemini 429 quota."),
        ("5. Security Architecture", "scrypt password hashing, server-side RBAC role gates, CSP headers and strict HSTS."),
        ("6. Observability & Audit", "Correlation IDs on every HTTP request and error log line. Database triggers enforce append-only audit trail."),
    ]
    o_w = Inches(3.6)
    o_h = Inches(1.8)
    for i, (otitle, odesc) in enumerate(opts):
        col = i % 3
        row = i // 3
        add_overlay_card(s12, Inches(1.0) + col*(o_w + Inches(0.25)),
                         Inches(1.7) + row*(o_h + Inches(0.2)),
                         o_w, o_h, otitle, odesc, "accent" if i in [0, 4] else "card")
    add_overlay_card(s12, Inches(1.0), Inches(5.6), Inches(11.3), Inches(0.9),
                     "SYSTEM RESILIENCE SUMMARY",
                     "Every optimization addresses a concrete measured constraint: memory, latency, egress costs, or security.", "banner")
    set_notes(s12, """SPEAKER NOTES:
Abuse limits are targeted, not global: there is no general rate limiter. Plans are debounced at 250 ms. GIST indexes serve spatial queries. Every error carries a correlation id that matches a log line, and a database trigger keeps the audit trail append-only.

EXEMPLAR REFERENCE & ELEMENT SELECTION:
- Best Element: Think Tank SBCC 2026, Slide 4 (think-04 - 2x3 grid of capability cards with bold category titles and bullets)
- File Path: casing/templates/Think Tank_SBCC2026.pptx (Slide 4, think-04)
- 1-Click Preview Link: file:///C:/Users/chowy/alfred/casing/templates/library/previews/think-04.png
- Cropped Element Image: file:///C:/Users/chowy/alfred/smart_nation/dengue/presentation-w13/cropped_elements/s12_optimisations.png""")

    # ==========================================
    # SLIDE 13: Close
    # ==========================================
    s13 = prs.slides.add_slide(blank_layout)
    add_header(s13, "", "Report in. Resolved out.")
    add_element_picture(s13, "s13_closing.png")
    add_overlay_card(s13, Inches(1.5), Inches(2.0), Inches(10.3), Inches(3.4),
                     "D-FENCE: REPORT IN. RESOLVED OUT.",
                     "• One Closed Loop: Resident report → live scoring → optimized route → verified completion.\n"
                     "• Four WHAM Differentiators: Live telemetry priority, road-verified routes, shared state, CI/CD parity.\n"
                     "• Layered Architecture: Strict separation of Boundary, Control, and Persistence with in-memory twins.\n"
                     "• Live Production System: dfence-sc2006.azurewebsites.net\n\n"
                     "Open for Questions, Live System Walkthrough & Demonstration", "accent")
    add_overlay_card(s13, Inches(1.5), Inches(5.6), Inches(10.3), Inches(0.9),
                     "NTU SC2006 WEEK 13 PROJECT PRESENTATION",
                     "Thank you for your time. Team D-Fence.", "banner")
    set_notes(s13, """SPEAKER NOTES:
To recap: one loop from report to resolved, four outcomes that earn marks, a layered server you can read folder by folder, four gates before every deploy, and targeted limits, caching and monitoring. Credits: logos from Simple Icons (CC0), plus the Azure, PostGIS and OneMap logos from their owners' public pages. Screenshots are from the live D-Fence site.

EXEMPLAR REFERENCE & ELEMENT SELECTION:
- Best Element: Four Horsemen SBCC 2026, Slide 23 (four-23 - Photo closing slide repeating core theme, domain, and Q&A lead)
- File Path: casing/templates/Four Horsemen_SBCC2026.pptx (Slide 23, four-23)
- 1-Click Preview Link: file:///C:/Users/chowy/alfred/casing/templates/library/previews/four-23.png
- Cropped Element Image: file:///C:/Users/chowy/alfred/smart_nation/dengue/presentation-w13/cropped_elements/s13_closing.png""")

    out_path = Path("smart_nation/dengue/presentation-w13/D-Fence-W13-outline.pptx")
    prs.save(str(out_path))
    print(f"Saved updated deck with pasted images and overlays to {out_path.resolve()}")

if __name__ == "__main__":
    build_deck()
