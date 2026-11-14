# D-Fence W13 presentation

```deck
deck:
  template: dfence-template.pptx
  sections: [Product, Algorithms, Architecture, Delivery, Robustness]
  tracker: [Product, Algorithms, Architecture, Delivery, Robustness]
  logo: false
  rec_images: none
  icon_fetch: false
  font: Segoe UI
  roles: {primary: 8653E3, secondary: AF89F4, accent: 75F9AA, light: 272036, text: FFFFFF}
```

### S1 · Cover
**Headline:** D-Fence
```deck
component: cover
form: split
deck_title: D-Fence
tagline: Dengue sanitisation, from report to resolved
occasion: SC2006 Week 13
image: assets/cover-estate.jpg
logo: false
notes: "D-Fence closes one loop: a resident reports a breeding site, the system ranks it, a crew is routed to it, and the resident sees it resolved. It is live on Azure. The deck uses the site's dark palette; the font is Segoe UI because Inter is not installed on the build machine."
```

### S2 · What it does
**Headline:** One app gives four parties one closed loop
```deck
section: Product
layout: left-right 55/45
left: {component: image, path: assets/crops/resident-map.png, focus: "0,0.5"}
right:
  component: icon_list
  direction: down
  items:
    - {label: Resident, text: "Reports a site. Tracks it to Resolved.", icon: smartphone}
    - {label: Operations Manager, text: "Sees ranked risk. Books crews and routes.", icon: dashboard}
    - {label: Crew, text: "Follows the route. Uploads photo proof.", icon: truck}
    - {label: "Authority (AVS, NParks)", text: "Receives wildlife referrals.", icon: building}
notes: "Three roles share one system: Resident, Operations Manager and Cleaning Crew. External authorities such as AVS and NParks receive referrals for wildlife cases that D-Fence does not dispatch itself. The screenshot is the resident dengue map in the live dark site. Risk ranking blends live rainfall, forecast and dengue cluster data with each report. Gemini screens report photos for pests."
```

### S3 · WHAM
**Headline:** Four outcomes set D-Fence apart
```deck
section: Product
layout: full
component: icon_list
direction: down
items:
  - {label: "1 Live data decides", text: "Rainfall, forecast and clusters become one ranked queue. Evidence: 7 weighted drivers; rain polled every 5 min.", icon: monitoring}
  - {label: "2 Routes hold", text: "Crews get road-verified routes inside four hours. Evidence: OneMap legs checked; 4-hour cap in code.", icon: map}
  - {label: "3 One shared record", text: "Residents, managers and crews act on the same data. Evidence: report, moderate, assign, complete, audit.", icon: handshake}
  - {label: "4 Tested = live", text: "Every release is the build that passed the tests. Evidence: hash check; 1,243 tests; real Postgres job.", icon: certified}
sources: ["Grader remarks 2026-08-28; course grading brief"]
notes: "These are the WHAM areas: outcomes that earn marks beyond the expected standard. The grader said the app must consume live data, process it, and support several users on shared state. The course also rewards architecture and a rigorous process. Each area is tagged with its number on the slides that prove it: 3 on the data flow, 1 on prioritisation, 2 on routing, 4 on CI/CD and testing."
```

### S4 · Data flow
**Headline:** One report moves through five steps to resolved
```deck
section: Product
layout: full + banner
body:
  component: process_flow
  numbered: true
  steps:
    - {name: "Resident reports", detail: "POST /api/reports with photos", icon: smartphone}
    - {name: "Server ranks", detail: "Plan cache clears. Report joins the queue.", icon: database}
    - {name: "Manager books", detail: "Assigns crew, vehicle and route", icon: dashboard}
    - {name: "Crew proves", detail: "Completes the job with photo proof", icon: truck}
    - {name: "Resident sees it", detail: "Report closes. Audit entry. Alert.", icon: inbox}
banner: {component: takeaway_banner, lead: "WHAM 3", text: "One shared record: report, moderate, assign, complete, audit.", style: solid}
notes: "Every step is an HTTPS JSON call: POST /api/reports, /api/ops/dispatch/assign, /api/crew/work-orders/:id/complete. Gemini checks the photo and the report is verified by default. The new report clears the plan cache, so it joins the plan as an unplanned task within seconds. Booked routes do not change on their own. Completing a work order closes the report, writes an audit entry and sends an alert, by Telegram when linked. Residents can also corroborate each other's reports."
```

### S5 · Prioritisation
**Headline:** Seven weighted drivers turn live data into a ranked queue
```deck
section: Algorithms
layout:
  areas: |
    flow flow
    wts tiers
  rows: [40, 60]
  banner: true
flow:
  component: process_flow
  steps:
    - {name: "Inputs", detail: "Clusters, rain, reports", icon: database}
    - {name: "Scale", detail: "Each driver to 0-1", icon: chart}
    - {name: "Score", detail: "100 x severity x weighted mean", icon: calculator}
    - {name: "Tier", detail: "Critical, High, Medium, Low", icon: flag}
    - {name: "Rank", detail: "One list, rank 1 first", icon: priority}
wts:
  component: data_table
  header: ["Driver", "Weight", "Scaled by"]
  rows:
    - ["Case size", "0.30", "log, ref 300"]
    - ["Case growth", "0.20", "log, ref 40"]
    - ["Days since treatment", "0.15", "decay, 60 days"]
    - ["Rainfall 72 h", "0.12", "cap 120 mm"]
    - ["Verified open reports", "0.10", "cap 5"]
    - ["Rainfall 24 h", "0.08", "cap 50 mm"]
    - ["Premises mix", "0.05", "as given"]
tiers:
  component: data_table
  header: ["Tier", "Rule"]
  rows:
    - ["Critical", "Verified report hits an override rule. Score kept."]
    - ["High", "Score 70.0 or above"]
    - ["Medium", "40.0 to 69.9"]
    - ["Low", "Below 40.0"]
    - ["Ties", "Severity, open reports, locality name"]
    - ["Grouping", "Within 100 m (default), same pest, type, task"]
banner: {component: takeaway_banner, lead: "WHAM 1", text: "Output: one ranked list, each score with its driver breakdown.", style: tint}
sources: ["config/scoring.default.json; src/control/Priority*.ts"]
notes: "Score = 100 x pest severity x (sum of weight x scaled value) / (sum of weights present). The mosquito has severity 1.0. A driver whose source is stale is dropped and the rest are re-weighted; the score is then marked degraded. Weights are committed JSON and must sum to 1.0 at load. Ranking puts every Critical first, then descending score, then severity, then verified open reports, then locality name, so the order is total. Critical comes from configured rules on verified reports only and keeps the score. The 100 m grouping is complete-link: every pair in a group must be within the limit (default 100 m, set between 1 and 1000)."
```

### S6 · Routing
**Headline:** Priority-first routing builds crew routes inside hard limits
```deck
section: Algorithms
layout:
  areas: |
    cons cons shot
    flow flow shot
  rows: [36, 64]
  cols: [26, 26, 48]
  banner: true
cons:
  component: icon_list
  direction: across
  items:
    - {label: Staff, text: "Capability, count and HQ match", icon: users}
    - {label: Cargo, text: "Seats, payload and cargo fit", icon: truck}
    - {label: "Four hours", text: "Drive, walk, work, delay", icon: clock}
    - {label: "OneMap", text: "Verified driving legs", icon: map}
flow:
  component: process_flow
  numbered: true
  steps:
    - {name: "Sort", detail: "Critical, High, Medium, Low", icon: priority}
    - {name: "Insert", detail: "Try each gap. Check up to 6 routes.", icon: target}
    - {name: "Verify", detail: "Road legs and walk access", icon: shield}
    - {name: "Improve", detail: "Reverse, swap or move a task", icon: speed}
shot: {component: image, path: assets/crops/dispatch-routes.png, focus: "0.5,0.5"}
banner: {component: takeaway_banner, lead: "WHAM 2", text: "Output: routes with verified roads, plus unassigned tasks.", style: tint}
sources: ["RouteOptimizationService.ts, routing/"]
notes: "The method is priority-first greedy insertion with bounded local search, so it does not prove the plan is shortest. Each route starts and ends at the crew HQ. Total time = driving + walking + work + on-call delay, at most four hours. For each task the planner ranks insertion candidates by a straight-line estimate, then checks up to six through OneMap and keeps the smallest accepted rise in verified travel time. Driving legs must join into one circuit. Walking access from a vehicle point must take ten minutes or less. Local search allows 64 within-route and 136 cross-route checks. A task can stay unassigned when no checked option meets every limit; a high priority does not guarantee a slot. Wildlife, bird, bee and wasp cases need the Authority Response capability. Source: docs/ROUTING-ALGORITHM-STE100.md and the code."
```

### S7 · System architecture
**Headline:** A thin client calls a layered server on one database
```deck
section: Architecture
layout: full
component: layers
layers_list:
  - {label: "Browser", items: ["React 18 SPA", "esbuild", "Tailwind"]}
  - {label: "Boundary", items: ["18 route modules", "12 gateways", "Security headers"]}
  - {label: "Control", items: ["Services", "Scoring", "Routing"]}
  - {label: "Persistence", items: ["Postgres repositories", "In-memory twins", "17 migrations"]}
  - {label: "Data", items: ["Supabase Postgres", "PostGIS", "Private photo buckets"]}
  - {label: "Outside services", items: ["OneMap", "data.gov.sg", "Gemini", "Telegram"]}
notes: "The browser only talks JSON over HTTPS. Each store has a Postgres repository and an in-memory twin, chosen at start-up by DATABASE_URL, which is how tests run without a database. The repo folders mirror the layers: src/boundary, src/control and src/persistence, with client/ for the app. Timers inside the server pull rainfall every 5 minutes, the forecast every 6 hours and dengue clusters hourly. Scoring weights are committed JSON in config/."
```

### S8 · Tech stack
**Headline:** Mainstream tools carry the stack from browser to cloud
```deck
section: Architecture
layout: full + banner
body:
  component: logo_strip
  heading: "Used in the repo"
  logos:
    - {image: assets/logos/react.png, caption: React}
    - {image: assets/logos/typescript.png, caption: TypeScript}
    - {image: assets/logos/nodedotjs.png, caption: Node.js}
    - {image: assets/logos/express.png, caption: Express}
    - {image: assets/logos/postgresql.png, caption: PostgreSQL}
    - {image: assets/logos/postgis.png, caption: PostGIS}
    - {image: assets/logos/supabase.png, caption: Supabase}
    - {image: assets/logos/azure.png, caption: Azure}
    - {image: assets/logos/githubactions.png, caption: GitHub Actions}
    - {image: assets/logos/leaflet.png, caption: Leaflet}
    - {image: assets/logos/onemap.png, caption: OneMap}
    - {image: assets/logos/telegram.png, caption: Telegram}
banner: {component: takeaway_banner, text: "React and Leaflet in the browser. Express on Node. Postgres on Supabase. Azure and GitHub Actions deliver it.", style: tint}
sources: ["Logos: Simple Icons (CC0); Azure, PostGIS, OneMap from owners' pages"]
notes: "Every logo maps to a dependency or service in the repo: package.json (React, Leaflet, Express, pg), the TypeScript sources, deploy.yml (GitHub Actions, Azure), DEPLOY.md (Supabase, PostGIS), OneMapGateway.ts and TelegramGateway.ts. Logo credits: Simple Icons (CC0) for React, TypeScript, Node.js, Express, PostgreSQL, Supabase, GitHub Actions, Leaflet and Telegram. The Azure, PostGIS and OneMap logos come from the owners' public pages via Google Images. All marks belong to their owners."
```

### S9 · Cloud
**Headline:** Two managed services run the app with no keys in the repo
```deck
section: Delivery
layout: full + banner
body:
  component: process_flow
  numbered: true
  steps:
    - {name: "GitHub Actions", detail: "Builds and tests. Signs in by OIDC.", icon: coding}
    - {name: "Azure App Service", detail: "Linux B1, Node 24, East Asia. Secrets in App Settings.", icon: globe}
    - {name: "Supabase Singapore", detail: "Postgres, PostGIS, signed photo reads over TLS.", icon: database}
banner: {component: takeaway_banner, text: "No stored deploy password. HTTPS is forced. The app refuses to start if a secret is missing.", style: tint}
notes: "CI signs in to Azure with a GitHub OIDC credential, scoped to Website Contributor on this one app. Runtime secrets live only in Azure App Settings. East Asia was chosen because the Azure for Students policy refused Southeast Asia."
```

### S10 · CI/CD
**Headline:** Four gates run on every push and only main deploys
```deck
section: Delivery
layout: rows 2 + banner
r1:
  component: process_flow
  steps:
    - {name: "Test and package", detail: "Typecheck, build, tests, smoke boot", icon: test-tube}
    - {name: "Real Postgres", detail: "All 17 migrations, SQL tests", icon: database}
    - {name: "Migration guard", detail: "Released files stay unedited", icon: shield}
    - {name: "Workflow lint", detail: "actionlint, checksum-pinned", icon: compliance}
r2:
  component: process_flow
  numbered: true
  steps:
    - {name: "Hash check", detail: "Archive equals tested archive", icon: certified}
    - {name: "Sign in", detail: "Azure by OIDC", icon: padlock}
    - {name: "Deploy", detail: "Upload, restart", icon: delivery}
    - {name: "Health poll", detail: "/api/health, 5 min", icon: monitoring}
    - {name: "Live hash", detail: "Server equals tested build", icon: tested}
banner: {component: takeaway_banner, lead: "WHAM 4", text: "Tested build = live build. Migration 017 reached production once; the Postgres gate now stops that.", style: solid}
sources: [".github/workflows/deploy.yml", "CI-CD.md"]
notes: "Every push runs four jobs in parallel. Deploy needs all four and runs only on main, one at a time. The exact zip that passed the tests is the one deployed. Migration 017 passed the in-memory tests, so a real Postgres run now catches that class of bug."
```

### S11 · Testing strategy
**Headline:** Six test layers run from one function to the live site
```deck
section: Delivery
layout: full + banner
body:
  component: icon_list
  direction: down
  items:
    - {label: "Live checks", text: "Health poll and server hash after each deploy", icon: tracking}
    - {label: "UI sweep", text: "Playwright and axe, run before release", icon: computer-vision}
    - {label: "Smoke boot", text: "Release zip boots with network blocked", icon: speed}
    - {label: "SQL tests", text: "17 migrations from empty on Postgres", icon: database}
    - {label: "Screen tests", text: "23 files with Testing Library", icon: smartphone}
    - {label: "Unit and service", text: "1,243 Vitest tests pass in the 2026-10-31 run", icon: calculator}
banner: {component: takeaway_banner, lead: "WHAM 4", text: "Each layer proves the same build: in memory, on real SQL, then live.", style: tint}
sources: ["tests/, tests-ui/; vitest run 2026-10-31"]
notes: "Most tests use the in-memory twins, so the suite needs no database and runs on every push. The Postgres job proves the same repositories against real SQL. The smoke test boots the packaged zip with outbound fetch blocked. The UI sweep runs locally, not in CI. The full run of 2026-10-31 had 1,301 tests: 1,243 passed, 58 were skipped because they need a live database, and none failed."
```

### S12 · Optimisations
**Headline:** Targeted limits keep the app fast, cheap and safe
```deck
section: Robustness
layout: full
component: background
facts:
  - {headline: Caching, detail: "Dispatch plans held in memory. New reports clear them.", icon: cache}
  - {headline: Database, detail: "PostGIS GIST indexes for maps. Time-ordered indexes.", icon: database}
  - {headline: Data cost, detail: "Cut a poll that moved 3.2 MB every 5 minutes.", icon: download}
  - {headline: Abuse limits, detail: "15-minute sign-in lock-out. HTTP 429 on photo AI quota.", icon: shield}
  - {headline: Security, detail: "scrypt passwords, server-side roles, CSP and HSTS.", icon: padlock}
  - {headline: Monitoring, detail: "Correlation ids, append-only audit, ingestion run log.", icon: monitoring}
notes: "Abuse limits are targeted, not global: there is no general rate limiter. Plans are debounced at 250 ms. GIST indexes serve spatial queries. Every error carries a correlation id that matches a log line, and a database trigger keeps the audit trail append-only."
```

### S13 · Close
**Headline:** Report in. Resolved out.
```deck
component: cover
form: split
deck_title: Report in. Resolved out.
tagline: dfence-sc2006.azurewebsites.net
occasion: Questions?
image: assets/close-resolved.jpg
logo: false
notes: "To recap: one loop from report to resolved, four outcomes that earn marks, a layered server you can read folder by folder, four gates before every deploy, and targeted limits, caching and monitoring. Credits: logos from Simple Icons (CC0), plus the Azure, PostGIS and OneMap logos from their owners' public pages. Screenshots are from the live D-Fence site."
```
