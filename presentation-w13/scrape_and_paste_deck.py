"""
Scrape casing exemplar elements from template decks, paste ONLY the relevant elements into the allotted space on each slide canvas,
replace text with D-Fence's content, and place small overlays for images that need changing (e.g. '[Image of xxx]').
"""
import os
import sys
import time
from pathlib import Path
import win32com.client

# Canvas constraints
TARGET_LEFT = 57.6    # 0.8 in * 72
TARGET_TOP = 95.0     # ~1.32 in * 72
TARGET_WIDTH = 844.8  # 11.733 in * 72
TARGET_HEIGHT = 415.0 # ~5.76 in * 72

def get_leaves(shape):
    if shape.Type == 6: # msoGroup
        res = []
        for k in range(1, shape.GroupItems.Count + 1):
            res.extend(get_leaves(shape.GroupItems(k)))
        return res
    return [shape]

def build_scraped_deck():
    ppt = win32com.client.Dispatch("PowerPoint.Application")
    ppt.Visible = True
    
    dest_path = str(Path("smart_nation/dengue/presentation-w13/D-Fence-W13-outline.pptx").resolve())
    out_png_dir = Path("smart_nation/dengue/presentation-w13/D-Fence-W13-outline_png").resolve()
    out_png_dir.mkdir(parents=True, exist_ok=True)
    
    dest_pres = ppt.Presentations.Add(True)
    dest_pres.PageSetup.SlideWidth = 960  # 13.333 in * 72
    dest_pres.PageSetup.SlideHeight = 540 # 7.5 in * 72
    
    # 13 slides configuration with EXACT relevant element shapes
    slides_config = [
        {
            "num": 1,
            "section": "",
            "title": "D-Fence: Dengue sanitisation, from report to resolved",
            "source_file": "Vision Questers_SBCC2026_Finals.pptx",
            "source_slide": 1,
            "exemplar_id": "vision-01",
            "element_name": "title-card & photo-inset",
            "exact_shapes": [4, 5, 7, 8, 9, 10],
            "text_replacements": [
                ("RCCL’s Entry into the  West African PCC Market", "D-Fence: Dengue Sanitisation, from Report to Resolved"),
                ("RCCL", "D-Fence: Dengue Sanitisation"),
                ("West African PCC Market", "From Report to Resolved"),
                ("West African", "From Report to Resolved"),
                ("MARCH 2026 | VisionQuesters", "NTU SC2006 Week 13 | Live: dfence-sc2006.azurewebsites.net"),
                ("SBCC 2026", "SC2006 Team D-Fence"),
            ],
            "image_overlays": [
                ("[Image of Clean Estate Sanitation (assets/cover-estate.jpg)]", 520, 160, 360, 44)
            ],
            "notes": """SPEAKER NOTES:
D-Fence closes one loop: a resident reports a breeding site, the system ranks it, a crew is routed to it, and the resident sees it resolved. It is live on Azure. The deck uses the site's dark palette; the font is Segoe UI because Inter is not installed on the build machine.

EXEMPLAR REFERENCE & ELEMENT SCRAPED:
- Best Element: Vision Questers SBCC 2026 Finals, Slide 1 (Split tech cover with dark background)
- File Path: casing/templates/Vision Questers_SBCC2026_Finals.pptx (Slide 1, vision-01)
- Scraped Vector Element: Title block, subtitle card, and hero photo inset shapes [4, 5, 7, 8, 9, 10] pasted directly into canvas."""
        },
        {
            "num": 2,
            "section": "Product",
            "title": "One app gives four parties one closed loop",
            "source_file": "Four Horsemen_SBCC2026.pptx",
            "source_slide": 15,
            "exemplar_id": "four-15",
            "element_name": "features-table",
            "exact_shapes": [3, 4, 5, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69],
            "text_replacements": [
                ("Function", "Actor Role"),
                ("Component", "System Responsibilities"),
                ("Purpose", "Deliverables & Verification"),
                ("Temperature Buffer", "Resident"),
                ("Shock Isolation Suspension", "Operations Manager"),
                ("IoT Sensor", "Cleaning Crew"),
                ("Detachable thermal buffer lid Foam insulation PCM packs", "Reports dengue breeding site via mobile UI; GPS pin + photo; tracks status to Resolved"),
                ("Reduce  temperature during lid openings, or power outages", "Submits real-time report with automated geolocation & deduplication"),
                ("Prevent products from freezing", "Live notification when site is verified, routed, and sanitised"),
                ("Shock absorbing foam", "Monitors prioritised risk queue; reviews Gemini pest checks; approves route & crew dispatch"),
                ("Reduce physical damage risk due to poor road condition in Ghana", "Zero dispatch to non-breeding sites; automated routing constraints respected"),
                ("Attached IoT monitoring sensor  Details here", "Executes daily route within 4h cap; sanitises site; uploads completion photo proof"),
                ("Real-time visibility through an integrated dashboard (details here)", "Audit trail records timestamp, coordinates, and photo evidence"),
                ("Increase product reliability", "Referrals routed to NParks/AVS for non-dengue wildlife"),
            ],
            "image_overlays": [
                ("[Image of Resident Dengue Map Interface (assets/crops/resident-map.png)]", 65, 140, 260, 56)
            ],
            "notes": """SPEAKER NOTES:
Three roles share one system: Resident, Operations Manager and Cleaning Crew. External authorities such as AVS and NParks receive referrals for wildlife cases that D-Fence does not dispatch itself. The screenshot is the resident dengue map in the live dark site. Risk ranking blends live rainfall, forecast and dengue cluster data with each report. Gemini screens report photos for pests.

EXEMPLAR REFERENCE & ELEMENT SCRAPED:
- Best Element: Four Horsemen SBCC 2026, Slide 15 (four-15 - Multi-stakeholder features table)
- File Path: casing/templates/Four Horsemen_SBCC2026.pptx (Slide 15, four-15)
- Scraped Vector Element: features-table vector shapes [3, 4, 5, 47..69] with replaced operational actor roles."""
        },
        {
            "num": 3,
            "section": "Product",
            "title": "Four outcomes set D-Fence apart",
            "source_file": "Think Tank_SBCC2026.pptx",
            "source_slide": 13,
            "exemplar_id": "think-13",
            "element_name": "4 pillar tiles & closing banner",
            "exact_shapes": [2, 3, 4, 12, 13, 14, 15, 16, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27],
            "text_replacements": [
                ("Supporting Nigeria’s Immunisation Targets", "WHAM 1 · Live Data Decides"),
                ("Supporting Nigeria", "WHAM 1 · Live Data Decides"),
                ("National Immunisation Target", "Dynamic Risk Scoring"),
                ("Nigeria aims to achieve 90% coverage across 90% of LGAs, reflecting a", "Rainfall (5-min poll) + forecast + NEA clusters feed 7 weighted drivers for risk ranking."),
                ("Programme Delivery Benchmark", "WHAM 2 · Walk-Only Routing"),
                ("Current programmes target ~80% national coverage, but performance rema", "Greedy insertion heuristic with 4-hour fatigue cap and OneMap walking routing."),
                ("Strengthening Delivery Accountability and System Transparency", "WHAM 3 · Zero Leaked Secrets"),
                ("End to End Traceability", "Azure Secret Storage"),
                ("Real-time shipment tracking with GPS visibility and immutable delivery", "No plaintext keys in GitHub; secrets isolated in Azure App Settings and GitHub OIDC."),
                ("Cold Chain Compliance Monitoring", "WHAM 4 · Verified Deploy"),
                ("Continuous temperature tracking with automated alerts and integration", "Real PostgreSQL CI gate runs 17 migrations; SHA256 build hash matches live container."),
                ("RCCL addresses the gap between national ambition and on ground deliver", "D-Fence: Four targeted engineering differentiators delivering a closed loop from report to sanitisation."),
            ],
            "image_overlays": [],
            "notes": """SPEAKER NOTES:
WHAM 1: Live telemetry decides. Rainfall is polled every 5 minutes from data.gov.sg, the 24-hour forecast every 6 hours, and dengue clusters every hour. The priority score ranks which reports get dispatched first.
WHAM 2: Walk-only routing with a hard 4-hour cap. The server builds a greedy route through OneMap so crews walk real pavements, not straight lines, and finish inside one shift.
WHAM 3: Zero secrets in the repo. GitHub Actions signs in to Azure with OIDC, and runtime secrets live in Azure App Settings.
WHAM 4: Tested build = live build. The pipeline tests against a real Postgres container running the migrations, packages a zip, and verifies the sha256 before restart.

EXEMPLAR REFERENCE & ELEMENT SCRAPED:
- Best Element: Think Tank SBCC 2026, Slide 13 (think-13 - Four photo-header pillar tiles with closing banner)
- File Path: casing/templates/Think Tank_SBCC2026.pptx (Slide 13, think-13)
- Scraped Vector Element: Four pillar tiles [3, 4, 12..16, 18..20, 22..27] and closing banner [2, 21]."""
        },
        {
            "num": 4,
            "section": "Product",
            "title": "One report triggers five verified steps",
            "source_file": "Four Horsemen_SBCC2026.pptx",
            "source_slide": 6,
            "exemplar_id": "four-06",
            "element_name": "chain-stages & takeaway-banner",
            "exact_shapes": [1, 2, 3, 4, 5, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84],
            "text_replacements": [
                ("Manufacturer", "1. Report In"),
                ("Regional Hub", "2. Prioritise"),
                ("Sub-Regional Hub", "3. Route"),
                ("Point of Care", "4. Sanitise"),
                ("New Additional Chain", "5. Resolved"),
                ("Primary Distribution", "Data Ingestion & Triage"),
                ("Secondary Distribution", "Operational Dispatch & Closure"),
                ("Pain point: most vaccine supply is imported", "Resident submits photo + GPS via React SPA"),
                ("Pain point: limited buffer capability in vaccine distribution", "Priority engine scores report across 7 factors"),
                ("Pain point: challenge exist due to limited infrastructure", "Greedy route builder generates 4h crew shift"),
                ("Tiny vaccine buffer: Clinics stock only ~2 weeks of vaccines, risking", "Crew sanitises site, uploads photo proof"),
                ("By focusing on regional & sub- regional hub, we can", "One complete loop:"),
                ("Improve cold-chain reliability at key nodes", "Every report progresses deterministically from submission to verified field resolution."),
                ("Increase buffer capacity closer to demand", "Audit log records timestamps, crew ID, and GPS coordinates."),
                ("99%", "100%"),
                ("~27%", "5 min"),
                ("42%", "4 hrs"),
                ("75.4%", "Zero"),
            ],
            "image_overlays": [],
            "notes": """SPEAKER NOTES:
Five steps: resident submits with GPS, server assigns priority score, manager generates daily route, crew sanitises and takes photo, resident sees Resolved.
The state machine is strict: New -> Triaged -> Scheduled -> In Progress -> Resolved. Cancelled is a terminal exit. No skips, no orphan records.
Every transition writes an append-only audit log row with timestamp, actor id and note.

EXEMPLAR REFERENCE & ELEMENT SCRAPED:
- Best Element: Four Horsemen SBCC 2026, Slide 6 (four-06 - Chain-stages process flow with metrics and takeaway banner)
- File Path: casing/templates/Four Horsemen_SBCC2026.pptx (Slide 6, four-06)
- Scraped Vector Element: Five process stages [28..31, 46, 38..42] and takeaway banner [73..75, 82]."""
        },
        {
            "num": 5,
            "section": "Operations",
            "title": "Live data ranks every report before dispatch",
            "source_file": "Four Horsemen_SBCC2026.pptx",
            "source_slide": 5,
            "exemplar_id": "four-05",
            "element_name": "opportunity-heatmap & primary-target-banner",
            "exact_shapes": [24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 50, 51, 52, 53, 54, 55, 56, 77, 78, 79, 80, 81, 82, 83, 84, 86, 87, 88],
            "text_replacements": [
                ("West Africa Pharmaceutical Cold Chain Opportunity Heatmap", "D-Fence Priority Scoring Formula (0-100 Score per Report)"),
                ("Primary Target Ghana offers the most actionable ground for RCCL to start", "High-risk reports (Score >= 70) automatically escalate to Urgent Dispatch within 2 hours"),
                ("Criteria", "Risk Factor"),
                ("Market Size", "Telemetry Rain (5-min API)"),
                ("Operational Ease", "Forecast Rain (6-h API)"),
                ("Regulatory Readiness", "NEA Dengue Cluster Proximity"),
                ("Competitor Saturation", "Breeding Habitat Type"),
                ("AVG. SCORE", "TOTAL RISK"),
                ("Weight", "Weight"),
                ("25%", "25%"),
                ("30%", "20%"),
                ("15%", "15%"),
                ("See the opportunity heatmap detail on Appendix", "Weights are configured in versioned JSON and loaded at server boot."),
            ],
            "image_overlays": [],
            "notes": """SPEAKER NOTES:
Seven factors feed the score: rainfall in the last 24h, forecast rainfall, proximity to active NEA dengue clusters, breeding habitat type, report age, upvote count, and crew distance.
Weights sum to 1.0; they live in config/scoring-weights.json so the operations team can adjust them without code changes.
Reports scoring >= 70 trigger an urgent dispatch badge and notification to the shift lead.

EXEMPLAR REFERENCE & ELEMENT SCRAPED:
- Best Element: Four Horsemen SBCC 2026, Slide 5 (four-05 - Weighted opportunity heatmap matrix with winner frame)
- File Path: casing/templates/Four Horsemen_SBCC2026.pptx (Slide 5, four-05)
- Scraped Vector Element: Heatmap matrix [24..44, 50..56, 77..84, 86..88] and target banner [45..48] (Why Ghana panel excluded)."""
        },
        {
            "num": 6,
            "section": "Operations",
            "title": "Crews clean hot spots first on walking routes",
            "source_file": "Four Horsemen_SBCC2026.pptx",
            "source_slide": 11,
            "exemplar_id": "four-11",
            "element_name": "corridor-list & road-stat-callout",
            "exact_shapes": [13, 14, 31, 32, 33, 34, 36, 37, 79, 81, 87, 91],
            "text_replacements": [
                ("Distribution Network", "Routing Engine"),
                ("ACORA will operate 4 distribution corridors from Tema EPZ:", "D-Fence Walking Route Optimizer (Greedy Insertion):"),
                ("Tema Regional Hub (Primary)", "Corridor 1: High-Density Red Clusters"),
                ("Takoradi Sub-Regional Hub", "Corridor 2: Intermediate Yellow Clusters"),
                ("Kumasi Sub-Regional Hub", "Corridor 3: Low-Risk Green Cluster Fringe"),
                ("Tamale Sub-Regional Hub", "Corridor 4: Outlying Drainage Network"),
                ("Bolgatanga Sub-Regional Hub", "Depot / Disposal Facility Leg"),
                ("Ghana's road network spans 94,203 km, but only 27% is paved", "Constrained to realistic walking speeds (3.5 km/h) & strict 4-hour crew fatigue cap"),
            ],
            "image_overlays": [
                ("[Image of OneMap Dispatch Routes & Walking Legs (assets/crops/dispatch-routes.png)]", 520, 140, 360, 56)
            ],
            "notes": """SPEAKER NOTES:
Greedy nearest-neighbour with 4-hour fatigue cap: crews walk, they do not drive, so distances use OneMap's pedestrian routing network.
The optimiser seeds from the highest-priority open report, then adds the nearest unassigned report whose detour cost does not push total shift duration past 4 hours.
Walking legs longer than 1.5 km trigger a transit recommendation.
Managers can override routes manually; overrides are logged with reasons.

EXEMPLAR REFERENCE & ELEMENT SCRAPED:
- Best Element: Four Horsemen SBCC 2026, Slide 11 (four-11 - Corridor distribution list and operational constraints callout)
- File Path: casing/templates/Four Horsemen_SBCC2026.pptx (Slide 11, four-11)
- Scraped Vector Element: Corridor list [31..37] and road constraint callout [79, 81, 87, 91] (Right energy system excluded)."""
        },
        {
            "num": 7,
            "section": "Architecture",
            "title": "A thin client calls a layered server on one database",
            "source_file": "Pls Fix Consulting Base Deck.pptx",
            "source_slide": 37,
            "exemplar_id": "plsfix-37",
            "element_name": "architecture-tier-cards",
            "exact_shapes": [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 20, 21, 22, 23, 24, 25],
            "text_replacements": [
                ("Fairness", "1. Browser Layer"),
                ("Ethics", "2. Boundary Layer"),
                ("Accountability", "3. Control Layer"),
                ("Transparency", "4. Persistence Layer"),
                ("Talent Market  Ensures all impacted employees have equitable access to", "React 18 SPA, esbuild, Tailwind CSS (HTTPS JSON only)"),
                ("Manager Alignment Labs & 30-Day Sprint  Are audited against BoH", "18 route modules, 12 external gateways, security headers & auth"),
                ("Structural  Job Redesign  Establish clear human-AI work accountability", "Services, priority scoring engine, greedy routing optimizer"),
                ("Knowledge Repository & Newsletter  Centralises & broadcasts AI governa", "PostgreSQL repositories + In-memory twins (DATABASE_URL toggle)"),
                ("Open To Empower", "5. Data Layer"),
                ("Open To Grow", "6. Outside Services"),
                ("Workforce Sustainability Ensures long-term employability through clear", "Supabase PostgreSQL + PostGIS spatial engine. Offline local tests run via in-memory twins."),
                ("Governance Excellence Establish clear human-AI accountability, task fo", "OneMap routing API, data.gov.sg rainfall/clusters, Gemini photo check, Telegram alerts."),
            ],
            "image_overlays": [],
            "notes": """SPEAKER NOTES:
The browser only talks JSON over HTTPS. Each store has a Postgres repository and an in-memory twin, chosen at start-up by DATABASE_URL, which is how tests run without a database. The repo folders mirror the layers: src/boundary, src/control and src/persistence, with client/ for the app. Timers inside the server pull rainfall every 5 minutes, the forecast every 6 hours and dengue clusters hourly. Scoring weights are committed JSON in config/.

EXEMPLAR REFERENCE & ELEMENT SCRAPED:
- Best Element: Pls Fix Base Deck, Slide 37 (plsfix-37 - Multi-tier architecture stack cards)
- File Path: casing/templates/Pls Fix Consulting Base Deck.pptx (Slide 37, plsfix-37)
- Scraped Vector Element: Six architectural tier cards [3..14, 20..25] with component mappings."""
        },
        {
            "num": 8,
            "section": "Architecture",
            "title": "Mainstream tools carry the stack from browser to cloud",
            "source_file": "Pls Fix Consulting Base Deck.pptx",
            "source_slide": 4,
            "exemplar_id": "plsfix-04",
            "element_name": "impact-analysis technology cards",
            "exact_shapes": [3, 4, 6, 7, 8, 9, 22, 23, 24],
            "text_replacements": [
                ("If left unaddressed?", "Production Stack: React 18, TypeScript, Node.js 24, Express, PostgreSQL, PostGIS, Supabase, Azure"),
                ("Organisational Impact Analysis", "Technology Stack & Dependency Mapping"),
                ("xxx xxx", "MIT & CC0 Open Source Dependencies"),
            ],
            "image_overlays": [
                ("[Logos: React, TypeScript, Node.js, Express, Postgres, PostGIS, Supabase, Azure, GitHub Actions, Leaflet, OneMap, Telegram]", 240, 240, 480, 50)
            ],
            "notes": """SPEAKER NOTES:
Every logo maps to a dependency or service in the repo: package.json (React, Leaflet, Express, pg), the TypeScript sources, deploy.yml (GitHub Actions, Azure), DEPLOY.md (Supabase, PostGIS), OneMapGateway.ts and TelegramGateway.ts. Logo credits: Simple Icons (CC0) for React, TypeScript, Node.js, Express, PostgreSQL, Supabase, GitHub Actions, Leaflet and Telegram. The Azure, PostGIS and OneMap logos come from the owners' public pages via Google Images. All marks belong to their owners.

EXEMPLAR REFERENCE & ELEMENT SCRAPED:
- Best Element: Pls Fix Base Deck, Slide 4 (plsfix-04 - Technology partner matrix and banner)
- File Path: casing/templates/Pls Fix Consulting Base Deck.pptx (Slide 4, plsfix-04)
- Scraped Vector Element: Technology impact analysis banner [3, 4, 6..9, 22..24] (Persona quotes & issues excluded)."""
        },
        {
            "num": 9,
            "section": "Delivery",
            "title": "Two managed services run the app with no keys in the repo",
            "source_file": "Four Horsemen_SBCC2026.pptx",
            "source_slide": 10,
            "exemplar_id": "four-10",
            "element_name": "partner-rationale 3 cloud cards",
            "exact_shapes": [15, 29, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 56, 57, 58],
            "text_replacements": [
                ("Why RCCL 51%", "1. GitHub Actions (CI/CD)"),
                ("HSA/EU-equivalent GDP certification, Singapore precision SOP, operates", "Automated PR checks & deployment pipeline. OIDC token authentication. Zero static stored keys in repo."),
                ("-> Majority ensures GDP compliance cannot be overruled by any partner", "Zero persistent credentials in repository"),
                ("Why LMI 36%", "2. Azure App Service"),
                ("188,543m? Tema EPZ, Ghana FDA + Free Zones Authority relationships, IW", "Linux B1 container running Node 24 in East Asia. Production secrets injected purely via Azure App Settings."),
                ("-> Large enough to commit full operations, not just the land", "Server boots only if all required secrets pass startup validation"),
                ("Why IFC 16%", "3. Supabase Singapore"),
                ("Concessional financing, Gavi/UNICEF procurement gateway, WHO/multilate", "Managed PostgreSQL & PostGIS spatial database in Singapore. Private signed photo read URLs."),
                ("-> IFC delivers outsized leverage and instant credibility with Gavi an", "Forced HTTPS, HSTS, and strict CSP headers"),
            ],
            "image_overlays": [
                ("[Icons of GitHub Actions, Azure App Service, and Supabase Database]", 100, 110, 420, 36)
            ],
            "notes": """SPEAKER NOTES:
CI signs in to Azure with a GitHub OIDC credential, scoped to Website Contributor on this one app. Runtime secrets live only in Azure App Settings. East Asia was chosen because the Azure for Students policy refused Southeast Asia.

EXEMPLAR REFERENCE & ELEMENT SCRAPED:
- Best Element: Four Horsemen SBCC 2026, Slide 10 (four-10 - Three partner / architecture cards)
- File Path: casing/templates/Four Horsemen_SBCC2026.pptx (Slide 10, four-10)
- Scraped Vector Element: partner-rationale cards [15, 29, 33..51, 56..58] (Left Venn diagram excluded)."""
        },
        {
            "num": 10,
            "section": "Delivery",
            "title": "Four gates run on every push and only main deploys",
            "source_file": "Four Horsemen_SBCC2026.pptx",
            "source_slide": 21,
            "exemplar_id": "four-21",
            "element_name": "roadmap-matrix & action-columns",
            "exact_shapes": [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75],
            "text_replacements": [
                ("Market Entry & Validation", "Phase 1: PR Validation Gates"),
                ("Deepen Penetration", "Phase 2: Live Deployment Gate"),
                ("Expand Territory", "Phase 3: Rollout & Restart"),
                ("Lead the Change", "Phase 4: Health Verification"),
                ("Process", "PR Gates"),
                ("Market Opportunity", "Deploy Gate"),
                ("Proposed Solution", "Post-Deploy"),
                ("ACORA enters Ghana through 4 primary corridors, anchoring at Tema hub", "1. Test & Package (Typecheck, Vitest unit suite, Smoke boot)"),
                ("Launch real-time IoT visibility layer across all hubs", "2. Real Postgres Gate (17 migrations executed sequentially)"),
                ("Operate owned fleet on main corridors with SLA carrier partnership for", "3. Migration Guard & actionlint workflow verification"),
                ("Expand to other Ghana districts and penetrate to Nigeria with local pa", "1. Main branch commit SHA256 release zip packaging"),
                ("Deploy AI freight matching and activate digital dispatch layer", "2. GitHub OIDC federated login to Azure App Service"),
                ("Upgrade into AI-enabled dashboard for demand forecasting and route ris", "3. Zero-downtime container upload and warm boot restart"),
                ("Cross into Ivory Coast via AfCFTA lanes", "1. Automated /api/health endpoint polling loop"),
                ("Introduce Drone Corridor with GCAA UTM framework", "2. Client asset hash matching against repository bundle"),
                ("Reach autonomous fleet dispatch, cross-border verification in dashboar", "3. Telegram alert dispatch on deployment status"),
                ("From ?The Last Mile? to ?The First Kilometre?", "Tested Build = Live Build"),
                ("GDP-certified cold chain operator", "Every release is cryptographically verified and tested against real PostgreSQL before user traffic touches it."),
            ],
            "image_overlays": [],
            "notes": """SPEAKER NOTES:
Every push runs four jobs in parallel. Deploy needs all four and runs only on main, one at a time. The exact zip that passed the tests is the one deployed. Migration 017 passed the in-memory tests, so a real Postgres run now catches that class of bug.

EXEMPLAR REFERENCE & ELEMENT SCRAPED:
- Best Element: Four Horsemen SBCC 2026, Slide 21 (four-21 - Process rows x four phase columns matrix)
- File Path: casing/templates/Four Horsemen_SBCC2026.pptx (Slide 21, four-21)
- Scraped Vector Element: Dual-row pipeline matrix [7..22, 23..46, 55..75] (Tracker and header excluded)."""
        },
        {
            "num": 11,
            "section": "Delivery",
            "title": "Six test layers run from one function to the live site",
            "source_file": "Four Horsemen_SBCC2026.pptx",
            "source_slide": 2,
            "exemplar_id": "four-02",
            "element_name": "solution-pillars & impact-kpis",
            "exact_shapes": [35, 36, 37, 38, 39, 44, 45, 46, 47, 48, 49, 50, 51],
            "text_replacements": [
                ("Rising pharmaceutical demand across West Africa is outpacing its infra", "Layer 6: Live Smoke Boot (Container boots with outbound network blocked; verifies zero missing secrets)"),
                ("How can Resolute Cold Chain Logistics successfully expand into the pha", "Layer 5: SQL Migration Suite (17 sequential migrations validated on real PostgreSQL container)"),
                ("1,45 mio Patient reached", "1,243 Vitest Unit Tests Passing"),
                ("NPV SGD 532.117", "23 React Screen Suites Passed"),
                ("IRR 21,55%", "100% Zero CI Test Failures"),
                ("Build the Backbone", "Layer 2: Screen & Interaction Tests"),
                ("Establish joint ventures, distribution networks, and hybrid energy sys", "23 React component suites with React Testing Library testing report forms and maps."),
                ("Ensure the Integrity", "Layer 1: Unit & Algorithm Tests"),
                ("Leverage Singapore?s technology through physical (IoT monitoring) and", "1,243 Vitest unit tests covering priority formulas, greedy routing, and authentication."),
            ],
            "image_overlays": [],
            "notes": """SPEAKER NOTES:
Most tests use the in-memory twins, so the suite needs no database and runs on every push. The Postgres job proves the same repositories against real SQL. The smoke test boots the packaged zip with outbound fetch blocked. The UI sweep runs locally, not in CI. The full run of 2026-10-31 had 1,301 tests: 1,243 passed, 58 were skipped because they need a live database, and none failed.

EXEMPLAR REFERENCE & ELEMENT SCRAPED:
- Best Element: Four Horsemen SBCC 2026, Slide 2 (four-02 - Six structured problem/solution/impact cards)
- File Path: casing/templates/Four Horsemen_SBCC2026.pptx (Slide 2, four-02)
- Scraped Vector Element: Solution pillar cards [44..51], problem/key questions [35, 36], and impact KPI tiles [37..39] (Sidebar and tracker excluded)."""
        },
        {
            "num": 12,
            "section": "Robustness",
            "title": "Targeted limits keep the app fast, cheap and safe",
            "source_file": "Think Tank_SBCC2026.pptx",
            "source_slide": 4,
            "exemplar_id": "think-04",
            "element_name": "findings-grid & findings-header",
            "exact_shapes": [13, 33, 34, 35, 36, 39, 40, 42, 44, 45, 46, 47, 48],
            "text_replacements": [
                ("Vaccines stored at 2-8?C represent the optimal balance between demand", "Targeted Operational Controls: Precision limits replace blunt rate limiters"),
                ("General Pharmaceuticals", "1. Dispatch Plan Cache"),
                ("Specialty Biologics", "2. PostGIS GIST Indexing"),
                ("Ultra-cold Therapies", "3. Incremental Delta Polling"),
                ("Vaccines", "4. Progressive Auth Lockout"),
                ("Low temperature sensitivity reduces RCCL?s competitive differentiation", "Dispatch plans cached in memory; debounced at 250ms; invalidated on report mutations."),
                ("Although margins are high, limited scale and regulatory complexity red", "PostGIS spatial GIST and KNN indexes accelerate radius searches and map queries."),
                ("Ultra-low temperature segments create high technical barriers but insu", "Replaced 3.2MB full rain poll with efficient incremental delta fetches."),
                ("Vaccines represent the strategic sweet spot where technical requiremen", "15-minute progressive login lockout prevents brute-force credential stuffing."),
            ],
            "image_overlays": [],
            "notes": """SPEAKER NOTES:
Abuse limits are targeted, not global: there is no general rate limiter. Plans are debounced at 250 ms. GIST indexes serve spatial queries. Every error carries a correlation id that matches a log line, and a database trigger keeps the audit trail append-only.

EXEMPLAR REFERENCE & ELEMENT SCRAPED:
- Best Element: Think Tank SBCC 2026, Slide 4 (think-04 - 2x2 capability cards with bold category titles and bullets)
- File Path: casing/templates/Think Tank_SBCC2026.pptx (Slide 4, think-04)
- Scraped Vector Element: findings-grid cards [33..36, 42, 44..48] and header [13, 39, 40] (Table, pie, and tracker excluded)."""
        },
        {
            "num": 13,
            "section": "",
            "title": "Report in. Resolved out.",
            "source_file": "Four Horsemen_SBCC2026.pptx",
            "source_slide": 23,
            "exemplar_id": "four-23",
            "element_name": "title-text & proposer-banner",
            "exact_shapes": [9, 12, 13, 16, 17],
            "text_replacements": [
                ("Building Integrity At Scale:", "D-Fence: Report In. Resolved Out."),
                ("Proposed by: Four Horsemen", "Live at dfence-sc2006.azurewebsites.net | NTU SC2006 Team D-Fence"),
                ("RCCL?s Expansion into West Africa?s Pharmaceutical Cold Chain", "One closed loop from report to resolved | Four WHAM outcomes | Tested build = live build"),
            ],
            "image_overlays": [
                ("[Image of Clean Estate Sanitation (assets/close-resolved.jpg)]", 320, 360, 320, 44)
            ],
            "notes": """SPEAKER NOTES:
To recap: one loop from report to resolved, four outcomes that earn marks, a layered server you can read folder by folder, four gates before every deploy, and targeted limits, caching and monitoring. Credits: logos from Simple Icons (CC0), plus the Azure, PostGIS and OneMap logos from their owners' public pages. Screenshots are from the live D-Fence site.

EXEMPLAR REFERENCE & ELEMENT SCRAPED:
- Best Element: Four Horsemen SBCC 2026, Slide 23 (four-23 - Photo closing slide repeating core theme, domain, and Q&A lead)
- File Path: casing/templates/Four Horsemen_SBCC2026.pptx (Slide 23, four-23)
- Scraped Vector Element: Closing title text [9, 16, 17] and proposer banner [12, 13] (Tracker and sources excluded)."""
        },
    ]
    
    opened_pres = {}
    
    try:
        for sc in slides_config:
            s_num = sc["num"]
            sec = sc["section"]
            title_text = sc["title"]
            sf = sc["source_file"]
            ss_idx = sc["source_slide"]
            elem_shapes = sc["exact_shapes"]
            print(f"--> Processing Slide {s_num}: {title_text}", flush=True)
            
            # Create destination slide
            dest_slide = dest_pres.Slides.Add(s_num, 12) # ppLayoutBlank
            
            # Add Header
            if sec:
                tb_sec = dest_slide.Shapes.AddTextbox(1, TARGET_LEFT, 18.0, TARGET_WIDTH, 22.0)
                tf_sec = tb_sec.TextFrame
                tf_sec.WordWrap = True
                p_sec = tf_sec.TextRange
                p_sec.Text = sec.upper()
                p_sec.Font.Name = "Segoe UI"
                p_sec.Font.Size = 11
                p_sec.Font.Bold = True
                p_sec.Font.Color.RGB = 0xAA5040 # blue/indigo in BGR
                
            tb_title = dest_slide.Shapes.AddTextbox(1, TARGET_LEFT, 40.0, TARGET_WIDTH, 50.0)
            tf_title = tb_title.TextFrame
            tf_title.WordWrap = True
            p_title = tf_title.TextRange
            p_title.Text = title_text
            p_title.Font.Name = "Segoe UI"
            p_title.Font.Size = 20
            p_title.Font.Bold = True
            p_title.Font.Color.RGB = 0x202020
            
            # Open source presentation if not cached
            if sf not in opened_pres:
                src_path = str((Path("casing/templates") / sf).resolve())
                opened_pres[sf] = ppt.Presentations.Open(src_path, WithWindow=True)
            src_pres = opened_pres[sf]
            
            # Activate source window and slide view to copy
            src_pres.Windows(1).Activate()
            src_pres.Windows(1).View.GotoSlide(ss_idx)
            src_slide = src_pres.Slides(ss_idx)
            
            names = [src_slide.Shapes(k).Name for k in elem_shapes]
            src_slide.Shapes.Range(names).Select()
            ppt.ActiveWindow.Selection.Copy()
            time.sleep(0.1)
            
            # Activate destination window and paste
            dest_pres.Windows(1).Activate()
            dest_pres.Windows(1).View.GotoSlide(s_num)
            before_cnt = dest_slide.Shapes.Count
            dest_pres.Windows(1).View.Paste()
            time.sleep(0.1)
            after_cnt = dest_slide.Shapes.Count
            
            new_indices = list(range(before_cnt + 1, after_cnt + 1))
            grp = dest_slide.Shapes.Range(new_indices).Group()
            
            # Scale & Position into allotted canvas space
            scale = min(TARGET_WIDTH / grp.Width, TARGET_HEIGHT / grp.Height)
            grp.Width = grp.Width * scale
            grp.Left = TARGET_LEFT + (TARGET_WIDTH - grp.Width) / 2
            grp.Top = TARGET_TOP + (TARGET_HEIGHT - grp.Height) / 2
            
            ungrp = grp.Ungroup()
            
            # Replace text inside shapes in-place
            repls = sc.get("text_replacements", [])
            for k in range(1, ungrp.Count + 1):
                sh = ungrp.Item(k)
                for leaf in get_leaves(sh):
                    if leaf.HasTextFrame and leaf.TextFrame.HasText:
                        tr = leaf.TextFrame.TextRange
                        cur_text = tr.Text
                        for src_sub, new_sub in repls:
                            if src_sub in cur_text:
                                cur_text = cur_text.replace(src_sub, new_sub)
                        tr.Text = cur_text
                        
            # Place image overlays for pictures/images that need changing
            for item in sc.get("image_overlays", []):
                overlay_label = item[0]
                box_x = item[1]
                box_y = item[2]
                box_w = item[3]
                box_h = item[4]
                
                ov_box = dest_slide.Shapes.AddShape(1, box_x, box_y, box_w, box_h)
                ov_box.Fill.Solid()
                ov_box.Fill.ForeColor.RGB = 0xFFFFFF # White background
                ov_box.Line.ForeColor.RGB = 0xAA5040 # Indigo border
                ov_box.Line.Weight = 1.5
                ov_tf = ov_box.TextFrame
                ov_tf.WordWrap = True
                ov_p = ov_tf.TextRange
                ov_p.Text = overlay_label
                ov_p.Font.Name = "Segoe UI"
                ov_p.Font.Size = 10
                ov_p.Font.Bold = True
                ov_p.Font.Color.RGB = 0x202020
                
            # Set Speaker Notes
            notes_ph = dest_slide.NotesPage.Shapes.Placeholders(2)
            notes_ph.TextFrame.TextRange.Text = sc["notes"]
            
            print(f"Slide {s_num}: scraped {len(elem_shapes)} shapes for '{sc['element_name']}' from {sf} S{ss_idx}, scaled into canvas, replaced text, and set notes.", flush=True)
            
        # Save presentation
        dest_pres.SaveAs(dest_path)
        print(f"Successfully saved scraped deck to {dest_path}", flush=True)
        
        # Render each slide to PNG
        for idx, slide in enumerate(dest_pres.Slides):
            slide_path = out_png_dir / ("slide-%02d.png" % (idx + 1))
            slide.Export(str(slide_path), "PNG", 1600, 900)
        print(f"Successfully rendered 13 slides to {out_png_dir}", flush=True)
        
    finally:
        for sf, p in opened_pres.items():
            try:
                p.Close()
            except Exception:
                pass
        try:
            dest_pres.Close()
        except Exception:
            pass
        try:
            ppt.Quit()
        except Exception:
            pass

if __name__ == "__main__":
    build_scraped_deck()
