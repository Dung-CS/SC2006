# Handover to AGY: Generate Slide Outline PPTX for Smart Nation D-Fence

## Goal
Generate a separate slide outline PowerPoint file: `smart_nation/dengue/presentation-w13/D-Fence-W13-outline.pptx`.
This is an **Outline Deck** (storyboard/wireframe), NOT a finished built deck. Claude remains the only agent allowed to build finished slides.

## Input File
- Outline markdown: `smart_nation/dengue/presentation-w13/dfence-w13.outline.md`

## Output File
- `smart_nation/dengue/presentation-w13/D-Fence-W13-outline.pptx`

## Rules
1. **Widescreen 16:9**: Slide dimensions 13.333 inches width, 7.5 inches height.
2. **Topic Sentence in Full**: Every slide title must contain the full topic sentence from the outline headline. Font: Arial or Segoe UI, 20-24pt, bold.
3. **Canvas Placeholders**: The slide body must use clean placeholder boxes/shapes indicating layout structure and element slots (e.g. "[Placeholder: Resident Map 55%]", "[Placeholder: 4 Actor Cards 45%]", "[Placeholder: 5-Step Process Flow]", "[Placeholder: 3x4 Tech Stack Logo Grid]").
4. **Content in Speaker Notes**: Every slide must have its full details, bullets, data, evidence lines, and exemplar references in the **Speaker Notes** of that slide.
5. **Autonomy**: Do the work yourself using a Python script with `python-pptx`; do not spawn subagents.

## Slides Specification (13 Slides)
1. **S1 - Cover**:
   - Title: "D-Fence: Dengue sanitisation, from report to resolved"
   - Placeholders: Split cover layout box [Hero Image Placeholder (assets/cover-estate.jpg)] + [Occasion / Metadata Box: SC2006 Week 13]
   - Notes: Full notes from S1 outline, plus exemplar ref: Vision Questers SBCC2026 Slide 1 (vision-01).

2. **S2 - What it does**:
   - Title: "One app gives four parties one closed loop"
   - Placeholders: Left box (55% width) [Map Screenshot Placeholder: resident-map.png] + Right box (45% width) [4 Actor Cards: Resident, Ops Manager, Crew, Authority]
   - Notes: Full notes and items from S2, plus exemplar ref: Four Horsemen Slide 15 (four-15).

3. **S3 - WHAM**:
   - Title: "Four outcomes set D-Fence apart"
   - Placeholders: 4 vertical cards across the canvas [Card 1: Live data decides], [Card 2: Routes hold], [Card 3: One shared record], [Card 4: Tested = live]
   - Notes: Full notes, evidence lines, sources, and exemplar ref: Think Tank Slide 13 (think-13).

4. **S4 - Data flow**:
   - Title: "One report moves through five steps to resolved"
   - Placeholders: 5 horizontal process chevrons/boxes [1. Resident reports] -> [2. Server ranks] -> [3. Manager books] -> [4. Crew proves] -> [5. Resident sees it] + Bottom Takeaway Banner [WHAM 3: One shared record]
   - Notes: Full steps, JSON endpoints, notes, and exemplar ref: Four Horsemen Slide 6 (four-06).

5. **S5 - Prioritisation**:
   - Title: "Seven weighted drivers turn live data into a ranked queue"
   - Placeholders: Top row [5 Flow Steps: Inputs -> Scale -> Score -> Tier -> Rank] + Bottom Left [7-Driver Weight Table] + Bottom Right [4-Tier Classification Table] + Bottom Banner [WHAM 1]
   - Notes: Full scoring formula, weights, tier rules, and exemplar ref: Four Horsemen Slide 5 (four-05).

6. **S6 - Routing**:
   - Title: "Priority-first routing builds crew routes inside hard limits"
   - Placeholders: Left Top [4 Constraints Cards: Staff, Cargo, 4 Hours, OneMap] + Left Bottom [4-Step Insertion Flow] + Right Box [Route Map Screenshot: dispatch-routes.png] + Bottom Banner [WHAM 2]
   - Notes: Full greedy insertion specs, 4h limits, local search checks, and exemplar ref: Four Horsemen Slide 11 (four-11).

7. **S7 - System architecture**:
   - Title: "A thin client calls a layered server on one database"
   - Placeholders: 6 stacked horizontal layer bars [1. Browser (React SPA)] / [2. Boundary (18 routes)] / [3. Control (Services/Scoring/Routing)] / [4. Persistence (Postgres/In-memory)] / [5. Data (Postgres/PostGIS)] / [6. Outside services (OneMap/data.gov.sg/Gemini/Telegram)]
   - Notes: Layer definitions, in-memory twins explanation, and exemplar ref: Pls Fix Base Deck Slide 37 (plsfix-37).

8. **S8 - Tech stack**:
   - Title: "Mainstream tools carry the stack from browser to cloud"
   - Placeholders: 3x4 grid of tool logo placeholder tiles (React, TS, Node, Express, Postgres, PostGIS, Supabase, Azure, GitHub Actions, Leaflet, OneMap, Telegram) + Bottom Takeaway Banner
   - Notes: Full mapping to repo dependencies and licensing credits, plus exemplar ref: Pls Fix Base Deck Slide 4 (plsfix-04).

9. **S9 - Cloud**:
   - Title: "Two managed services run the app with no keys in the repo"
   - Placeholders: 3 cloud topology cards [GitHub Actions: CI/OIDC] -> [Azure App Service: Linux B1 Node 24] -> [Supabase Singapore: Postgres/PostGIS/TLS] + Bottom Banner
   - Notes: Full cloud configuration and security details, plus exemplar ref: Four Horsemen Slide 10 (four-10).

10. **S10 - CI/CD**:
    - Title: "Four gates run on every push and only main deploys"
    - Placeholders: Row 1 [4 Parallel Test Gates] + Row 2 [5 Sequential Deploy Steps] + Bottom Banner [WHAM 4: Tested build = live build]
    - Notes: Parallel jobs, OIDC deploy, hash verification, and exemplar ref: Four Horsemen Slide 21 (four-21).

11. **S11 - Testing strategy**:
    - Title: "Six test layers run from one function to the live site"
    - Placeholders: 6 stacked test tier bars [Live checks] / [UI sweep (Playwright/axe)] / [Smoke boot (network blocked)] / [SQL tests (17 migrations)] / [Screen tests (23 files)] / [Unit and service (1,243 Vitest tests)] + Bottom Banner
    - Notes: Full test suite counts, in-memory twins rationale, and exemplar ref: Four Horsemen Slide 2 (four-02).

12. **S12 - Optimisations**:
    - Title: "Targeted limits keep the app fast, cheap and safe"
    - Placeholders: 2x3 grid of 6 defensive optimization cards [Caching], [Database GIST], [Data cost 3.2MB cut], [Abuse limits 15min lock], [Security scrypt/CSP], [Monitoring audit log]
    - Notes: Exact mechanism details, debouncing, append-only trigger, and exemplar ref: Think Tank Slide 4 (think-04).

13. **S13 - Close**:
    - Title: "Report in. Resolved out."
    - Placeholders: Split close layout [Hero Photo Placeholder: close-resolved.jpg] + [Summary Text Card: dfence-sc2006.azurewebsites.net & Questions?]
    - Notes: Full closing recap, sources, and exemplar ref: Four Horsemen Slide 23 (four-23).

## Verification
Write and run a Python script to build the PPTX. Verify that:
1. `smart_nation/dengue/presentation-w13/D-Fence-W13-outline.pptx` exists and is non-empty.
2. Contains exactly 13 slides.
3. Every slide has the topic sentence in full as the title.
4. Every slide contains placeholder boxes for visual structure.
5. Every slide has full notes in `slide.notes_slide.notes_text_frame.text`.
