# D-Fence W13 presentation v2

```deck
deck:
  template: dfence-template.pptx
  sections: [Journey, Architecture, Delivery, Robustness]
  tracker: [Journey, Architecture, Delivery, Robustness]
  logo: false
  rec_images: none
  icon_fetch: false
  font: Segoe UI
  roles: {primary: "8653E3", secondary: "AF89F4", accent: "75F9AA", light: "272036", text: "FFFFFF"}
```

### S1 · Cover
**Headline:** D-Fence
```deck
component: cover
form: full
scrim: 55
deck_title: D-Fence
tagline: Dengue sanitisation, from report to resolved
occasion: SC2006 Week 13
image: assets/cover-estate.jpg
logo: false
notes: "Imagine it is Saturday night. You spot stagnant water behind your block, take a photo and report it.\n\nTwo weeks later, the water is still there. Nobody came, and your neighbour is down with dengue.\n\n(pause, let the story land)\n\nThat gap between a report and a fix is what we set out to close.\n\nWe are proud to present D-Fence.\n\nD-Fence joins residents, operations managers and field officers in one loop. It ranks every hazard with live government data and plans routes that fit a four-hour shift.\n\nThe system runs live on Azure today."
```

### S2 · Three stakeholders
**Headline:** Three roles share one loop, from the resident's report to the field team's fix
```deck
section: Journey
layout: full
component: profile
form: card
photo_share: 0.42
people:
  - name: Nur Aisyah
    role: Resident, Tampines
    image: {gemini: "Head-and-shoulders portrait photograph of a Malay Singaporean woman in her thirties wearing a light hijab, smiling, standing in an HDB void deck, soft natural daylight, realistic photo, no text"}
    points:
      - "Goal: report stagnant water in under a minute"
      - "Goal: see proof that the site was treated"
      - "Pain: past reports vanished with no progress update"
  - name: Rachel Lim
    role: Operations Manager
    image: {gemini: "Head-and-shoulders portrait photograph of a Chinese Singaporean woman in her forties with short hair, wearing a smart blouse and a staff lanyard, in a modern operations office with monitors behind her, soft light, realistic photo, no text"}
    points:
      - "Goal: treat the highest-risk sites first"
      - "Goal: send field teams on routes that fit one shift"
      - "Pain: scattered feeds and manual route planning"
  - name: Ahmad Faizal
    role: Field Officer
    image: {gemini: "Field officer portrait, head and shoulders, of a Malay Singaporean man in his forties wearing a bright orange high-visibility vest over a work polo shirt and a cap, standing outdoors in an HDB estate with greenery, daylight, realistic photo, no text"}
    points:
      - "Goal: a clear job list with stops in order"
      - "Goal: the right gear packed before leaving HQ"
      - "Pain: vague tasks and missing equipment on site"
sources: ["client/src/lib/staffVisuals.ts; resident portrait AI-generated"]
notes: "(handoff point if the team splits here)\n\nThree distinct roles share one system, from citizen hazard report to verified field resolution.\n\nOur software provides dedicated accounts for three key user roles.\n\nNur Aisyah lives in Tampines. She wants to report stagnant water in under one minute, and she needs proof that teams treated the site. In the past, her reports vanished without updates.\n\nRachel Lim directs operations. She needs to treat the highest-risk sites first and build routes that fit one shift. Scattered feeds and manual planning slowed her down.\n\nAhmad Faizal is our field officer. He needs an ordered job list and the right gear packed before leaving HQ. Vague tasks and missing tools wasted his time on site.\n\n(emphasize the contrast)\n\nWhat stands out in this design is that three separate roles share one verified data record.\n\nWildlife cases go to a dedicated wildlife response team in our own crew."
```

### S3 · Stage 1: Report
**Headline:** A resident uploads a photo, and an AI model detects and counts the pest in it
```deck
section: Journey
layout:
  areas: |
    track track
    who shot
  rows: [22, 78]
  cols: [30, 70]
track:
  component: process_flow
  form: chevron
  ghost: true
  bottleneck_at: Report
  steps:
    - {name: Report, detail: Resident}
    - {name: Rank, detail: Server}
    - {name: Plan, detail: Server}
    - {name: Review, detail: Manager}
    - {name: Dispatch, detail: Field team}
    - {name: Resolve, detail: Everyone}
who:
  component: profile
  form: card
  people:
    - name: Nur Aisyah
      role: Resident
      image: {gemini: "Head-and-shoulders portrait photograph of a Malay Singaporean woman in her thirties wearing a light hijab, smiling, standing in an HDB void deck, soft natural daylight, realistic photo, no text"}
      points:
        - "Finds the address with OneMap search or drops a pin"
        - "A Gemini vision model boxes and counts the pest in her photo"
        - "Duplicates of one pest within 50 m and 24 h are refused"
shot:
  component: device_mockup
  form: pair
  connector: curved
  devices:
    - {device: phone, image: assets/v2/resident-upload-screen.png, label: "Upload a photo"}
    - {device: phone, image: assets/v2/resident-vision-cockroach-screen.png, label: "AI detects the pest"}
sources: ["src/control/ReportController.ts"]
notes: "Residents submit pest photographs, while an automated vision model detects and counts specimens.\n\nStage one starts the operational loop. Nur Aisyah reports a pest hazard through our mobile web form or the map view.\n\nOneMap address search and device satellite coordinates resolve the exact location.\n\nShe uploads a camera photo, or picks a sample test image.\n\nOn upload, a Gemini vision model checks the photo.\n\nThe model draws bounding boxes around detected pests and counts every specimen.\n\n(point to the phone mockups on screen)\n\nNur Aisyah confirms the detected species and count with one tap before submitting.\n\nTo protect operational capacity, our server checks existing nearby submissions.\n\nThe platform refuses duplicate reports of the same pest within fifty metres.\n\nBackground ingestion jobs also collect records from public agency feeds, so the system never depends on resident reports alone."
```

### S4 · Stage 2: Rank
**Headline:** The server scores every task, for every pest, and shows how each score was reached
```deck
section: Journey
layout:
  areas: |
    track track
    who shot
  rows: [22, 78]
  cols: [30, 70]
track:
  component: process_flow
  form: chevron
  ghost: true
  bottleneck_at: Rank
  steps:
    - {name: Report, detail: Resident}
    - {name: Rank, detail: Server}
    - {name: Plan, detail: Server}
    - {name: Review, detail: Manager}
    - {name: Dispatch, detail: Field team}
    - {name: Resolve, detail: Everyone}
who:
  component: profile
  form: card
  people:
    - name: Rachel Lim
      role: Operations Manager
      image: {gemini: "Head-and-shoulders portrait photograph of a Chinese Singaporean woman in her forties with short hair, wearing a smart blouse and a staff lanyard, in a modern operations office with monitors behind her, soft light, realistic photo, no text"}
      points:
        - "Sees one ranked list instead of five data feeds"
        - "Opens any cluster to see each driver's share"
        - "A stale feed is flagged, not hidden"
shot:
  component: device_mockup
  device: laptop
  image: assets/v2/manager-cluster-detail.png
sources: ["src/control/PriorityScoringEngine.ts"]
notes: "The platform ranks every hazard into one list, combining severity with live environmental urgency.\n\nStage two computes operational priority.\n\nBackground ingestion jobs pull active dengue clusters from the National Environment Agency, alongside rainfall readings and weather forecasts.\n\nOur scoring engine rates every municipal task by multiplying species severity by environmental urgency.\n\nRachel Lim sees one clear ranked list instead of separate agency feeds.\n\nOn screen, you see an active dengue cluster with one hundred and one cases.\n\nThe engine calculates its priority score and places this cluster into the Medium tier.\n\n(steady tone, walk through the driver contributions)\n\nThe interface displays each driver's contribution so the manager understands the calculation.\n\nStale data feeds never hide.\n\nWhen a feed goes stale, the server redistributes that driver weight and flags the score as degraded."
```

### S5 · Rank in detail
**Headline:** Every task, whatever the pest, gets one 0-100 score: severity times urgency
```deck
section: Journey
layout:
  areas: |
    track track
    sev wts
  rows: [25, 75]
  cols: [40, 60]
  banner: true
track:
  component: process_flow
  form: chevron
  ghost: true
  bottleneck_at: Rank
  steps:
    - {name: Report, detail: Resident}
    - {name: Rank, detail: Server}
    - {name: Plan, detail: Server}
    - {name: Review, detail: Manager}
    - {name: Dispatch, detail: Field team}
    - {name: Resolve, detail: Everyone}
sev:
  component: data_table
  header: ["Pest (22 in catalogue)", "Severity", "Evidence"]
  rows:
    - ["Mosquito", "1.00", "A: NEA feeds"]
    - ["Rat", "1.00", "C: reports"]
    - ["Macaque", "0.92", "C: reports"]
    - ["Wild boar", "0.83", "C: reports"]
    - ["Cockroach", "0.75", "B: sightings"]
    - ["Snake", "0.75", "B: sightings"]
    - ["Bee or wasp", "0.75", "B: sightings"]
    - ["Pigeon", "0.58", "B: sightings"]
    - ["Bed bug", "0.50", "C: reports"]
    - ["Termite", "0.33", "B: sightings"]
  col_widths: [0.46, 0.22, 0.32]
wts:
  component: data_table
  header: ["Urgency driver", "A", "B", "C"]
  rows:
    - ["NEA case size and growth", "0.50", "-", "-"]
    - ["Rainfall, 72 h and 24 h", "0.20", "-", "-"]
    - ["Premises mix", "0.05", "-", "-"]
    - ["Open verified reports", "0.10", "0.30", "0.35"]
    - ["Report velocity, 14 days", "-", "0.20", "0.25"]
    - ["Corroborations", "-", "0.10", "0.15"]
    - ["iNaturalist sightings, 90 days", "-", "0.20", "-"]
    - ["Days since treatment", "0.15", "0.15", "0.20"]
    - ["Distance to a pest operator", "-", "0.05", "0.05"]
  col_widths: [0.55, 0.15, 0.15, 0.15]
banner: {component: takeaway_banner, text: "Score = 100 x severity x urgency. High is 70 or more, Medium 40 or more; a verified hazard overrides to Critical.", style: tint}
sources: ["PEST-PRIORITY-MODEL.md; config/pests.default.json"]
notes: "A unified scoring formula rates every pest species on disease risk and active evidence.\n\nOne unified scoring queue holds every task across our catalogue of twenty-two pests.\n\nSeverity is fixed per species based on disease risk, physical harm, statutory duty, and property damage.\n\nMosquitoes and rats sit at the top of the severity scale.\n\nUrgency sums normalised data drivers, and the active driver set depends on the evidence available for that species.\n\nMosquitoes belong to evidence tier A, supported by live government case counts and rainfall data.\n\nTier B species incorporate citizen wildlife observations from iNaturalist.\n\nTier C pests, including rats, depend on resident reports and treatment history.\n\n(lift energy on the practical trade-off)\n\nWhat surprised our team was that a high-volume rat block can legitimately outrank a moderate dengue cluster.\n\nAt the same time, an influx of ant complaints can never displace genuine disease vectors.\n\nLife-safety cases, such as a snake indoors, a crocodile or an injury, skip the calculation and enter Critical priority immediately."
```

### S6 · Stage 3: Plan
**Headline:** The server builds road-checked team routes that fit one four-hour shift
```deck
section: Journey
layout:
  areas: |
    track track
    who shot
  rows: [22, 78]
  cols: [30, 70]
track:
  component: process_flow
  form: chevron
  ghost: true
  bottleneck_at: Plan
  steps:
    - {name: Report, detail: Resident}
    - {name: Rank, detail: Server}
    - {name: Plan, detail: Server}
    - {name: Review, detail: Manager}
    - {name: Dispatch, detail: Field team}
    - {name: Resolve, detail: Everyone}
who:
  component: profile
  form: card
  people:
    - name: Rachel Lim
      role: Operations Manager
      image: {gemini: "Head-and-shoulders portrait photograph of a Chinese Singaporean woman in her forties with short hair, wearing a smart blouse and a staff lanyard, in a modern operations office with monitors behind her, soft light, realistic photo, no text"}
      points:
        - "Gets proposed routes for a seven-day horizon"
        - "Each colour is one field team's route from its HQ"
        - "Routes follow real roads, then a short walk"
shot:
  component: image
  path: assets/v2/manager-routes-map.png
  mode: cover
  focus: "0.5,0.5"
sources: ["src/control/RouteOptimizationService.ts"]
notes: "Automated route planning builds complete field schedules that fit within a single work shift.\n\nStage three plans field routes for the teams.\n\nThe route planner assigns ranked tasks to HQ teams for the days ahead.\n\nThe map displays proposed routes, where each colour represents one field team starting from HQ.\n\nOneMap driving routes check every road travel leg.\n\nWhen a vehicle cannot park directly at the work site, the system checks pedestrian access.\n\nThe planner allows only a short walk from the vehicle stopping point.\n\n(deliberate pace, stress the hard boundary)\n\nEach route sums driving travel, pedestrian walking, on-site treatment, and on-call buffer time.\n\nThe combined total keeps every field route strictly under the four-hour shift limit."
```

### S7 · Plan in detail
**Headline:** Cheap straight-line estimates shortlist each insertion; OneMap checks the best six
```deck
section: Journey
layout:
  areas: |
    track track
    flow flow
    opt opt
  rows: [30, 36, 34]
  cols: [50, 50]
  banner: true
track:
  component: process_flow
  form: chevron
  ghost: true
  bottleneck_at: Plan
  steps:
    - {name: Report, detail: Resident}
    - {name: Rank, detail: Server}
    - {name: Plan, detail: Server}
    - {name: Review, detail: Manager}
    - {name: Dispatch, detail: Field team}
    - {name: Resolve, detail: Everyone}
flow:
  component: process_flow
  steps:
    - {name: Sort, detail: "Critical first, then scarce skills"}
    - {name: Estimate, detail: "Rank every slot by straight-line time"}
    - {name: Verify, detail: "OneMap road and walk times, best 6"}
    - {name: Insert, detail: "Cheapest verified slot within 4 hours"}
    - {name: 2-opt, detail: "Reverse same-tier stops if shorter"}
    - {name: Swap, detail: "Move or swap jobs between crews"}
opt:
  component: data_table
  header: ["2-opt example", "Stop order", "Time"]
  rows:
    - ["Before", "Depot-1-2-3-4-5-Depot", "55 min"]
    - ["Cut legs", "1-2 and 4-5 cross", "-"]
    - ["Reverse 2 to 4", "Depot-1-4-3-2-5-Depot", "37 min"]
    - ["Keep it?", "Yes: OneMap time falls; same tier only", "-18 min"]
  col_widths: [0.22, 0.60, 0.18]
banner: {component: takeaway_banner, text: "2-opt cuts two legs and reverses the stops between them; it is kept only when OneMap time falls.", style: tint}
sources: ["src/control/RouteOptimizationService.ts; ROUTING-ALGORITHM.md"]
notes: "Fast straight-line filters screen candidate stops before official road routing verifies the best paths.\n\nOur route planner uses greedy insertion.\n\nThe algorithm sorts the tasks first. Critical hazards come first, then jobs that few crews can do, then short jobs.\n\nFor each task, the planner evaluates every available slot across all team schedules.\n\nThe algorithm estimates transit time using straight-line distances.\n\nThat simple estimate lets the engine test every potential slot cheaply.\n\n(lean forward, emphasize the optimization trick)\n\nThe best part is that OneMap verifies only the best six candidate slots.\n\nOneMap returns verified road and walking travel times, and the task takes the slot with the lowest verified time increase.\n\nThen two-opt optimization cleans up each route.\n\nTwo-opt cuts two legs and reverses the stops between them, keeping the change only when OneMap time decreases.\n\nReversals only operate across stops of identical priority tier.\n\nFinally, the planner moves or swaps jobs between crews when that shortens the routes."
```

### S8 · Stage 4: Review
**Headline:** Each dispatch is a full route: ordered stops, a crew, a vehicle and a logistics list
```deck
section: Journey
layout:
  areas: |
    track track
    who shot
  rows: [22, 78]
  cols: [30, 70]
track:
  component: process_flow
  form: chevron
  ghost: true
  bottleneck_at: Review
  steps:
    - {name: Report, detail: Resident}
    - {name: Rank, detail: Server}
    - {name: Plan, detail: Server}
    - {name: Review, detail: Manager}
    - {name: Dispatch, detail: Field team}
    - {name: Resolve, detail: Everyone}
who:
  component: profile
  form: card
  people:
    - name: Rachel Lim
      role: Operations Manager
      image: {gemini: "Head-and-shoulders portrait photograph of a Chinese Singaporean woman in her forties with short hair, wearing a smart blouse and a staff lanyard, in a modern operations office with monitors behind her, soft light, realistic photo, no text"}
      points:
        - "Reviews each proposed route from its HQ"
        - "Edits stops, crew, vehicle and logistics list"
        - "A saved edit locks the route against replanning"
shot:
  component: device_mockup
  form: pair
  connector: curved
  devices:
    - {device: laptop, image: assets/v2/manager-route-card.png, label: "Route: crew and stops"}
    - {device: laptop, image: assets/v2/manager-route-crew-vehicle-logistics.png, label: "Crew, vehicle, logistics"}
sources: ["client/src/screens/operations/"]
notes: "Operations managers review full vehicle dispatches with assigned crews and ordered stops.\n\nStage four provides the operations manager review gate.\n\nIn D-Fence, a dispatch is never an isolated individual task.\n\nA dispatch is one complete circuit that starts from HQ.\n\nThe left screen shows the Central Sanitation route.\n\nThe proposed schedule assigns field officers to ordered task locations.\n\nThis route takes three hours and twenty-eight minutes, inside the shift limit.\n\nThe right screen shows the route details page.\n\nRachel Lim inspects the assigned vehicle and crew members.\n\nThe page displays a logistics packing list that officers tick as they load equipment.\n\n(firm, authoritative)\n\nWhat I love most is that saving an edited route locks it against background re-planning.\n\nRachel Lim can adjust stops, swap vehicles, or modify crews, and her manual decision remains completely stable."
```

### S9 · Stage 5: Dispatch
**Headline:** The field officer opens one phone screen with the crew, van, load list and ordered stops
```deck
section: Journey
layout:
  areas: |
    track track
    who shot
  rows: [22, 78]
  cols: [30, 70]
track:
  component: process_flow
  form: chevron
  ghost: true
  bottleneck_at: Dispatch
  steps:
    - {name: Report, detail: Resident}
    - {name: Rank, detail: Server}
    - {name: Plan, detail: Server}
    - {name: Review, detail: Manager}
    - {name: Dispatch, detail: Field team}
    - {name: Resolve, detail: Everyone}
who:
  component: profile
  form: card
  people:
    - name: Ahmad Faizal
      role: Field Officer
      image: {gemini: "Field officer portrait, head and shoulders, of a Malay Singaporean man in his forties wearing a bright orange high-visibility vest over a work polo shirt and a cap, standing outdoors in an HDB estate with greenery, daylight, realistic photo, no text"}
      points:
        - "Sees crew, van and plate for today's route"
        - "Sees the route fill 82% of a 4-hour shift"
        - "Ticks the load list; stops run in priority order"
shot:
  component: device_mockup
  form: pair
  connector: curved
  devices:
    - {device: phone, image: assets/v2/crew-dispatch-top.png, label: "My dispatch"}
    - {device: phone, image: assets/v2/crew-dispatch-stops.png, label: "Ordered stops"}
sources: ["client/src/screens/crew/MyJobsScreen.tsx"]
notes: "Field officers manage daily work from a mobile device, packing required tools and following stops.\n\nStage five moves into physical field execution.\n\nAhmad Faizal signs in on his mobile phone and opens the My Jobs screen.\n\nThe top card displays today's dispatch for Central Team One.\n\nThe card shows the assigned crew, the van model, and the registration plate.\n\nThe planned route fills eighty-two per cent of the shift.\n\nField officers split time between vehicle travel and on-site treatment.\n\n(point to the mobile checklist)\n\nAhmad Faizal checks off gear on the equipment load list as items enter the van.\n\nEvery checkbox tap persists immediately to the database.\n\nThe right phone screen lists the task stops in priority order.\n\nThe crew performs high-priority mosquito fogging first, followed by medium and low jobs.\n\nThis crew and its route are demo data on the live site."
```

### S10 · Dispatch in detail
**Headline:** A table-driven state machine needs photo evidence before a job can close
```deck
section: Journey
layout:
  areas: |
    track track
    flow flow
    rules shot
  rows: [26, 22, 52]
  cols: [40, 60]
track:
  component: process_flow
  form: chevron
  ghost: true
  bottleneck_at: Dispatch
  steps:
    - {name: Report, detail: Resident}
    - {name: Rank, detail: Server}
    - {name: Plan, detail: Server}
    - {name: Review, detail: Manager}
    - {name: Dispatch, detail: Field team}
    - {name: Resolve, detail: Everyone}
flow:
  component: process_flow
  form: chevron
  steps:
    - {name: Created, detail: Server}
    - {name: Assigned, detail: Manager}
    - {name: Accepted, detail: Field team}
    - {name: "In Progress", detail: Field team}
    - {name: Completed, detail: "With evidence"}
    - {name: Verified, detail: Manager}
rules:
  component: data_table
  header: ["Rule", "Effect"]
  rows:
    - ["Evidence", "Photos, notes and time before Completed"]
    - ["Roles", "The field team completes; only a manager verifies"]
    - ["Rework", "Rejection returns the job to In Progress"]
  col_widths: [0.30, 0.70]
shot:
  component: image
  path: assets/v2/manager-wo-detail-crop.png
  mode: cover
  focus: "0.25,0.45"
sources: ["src/control/WorkOrderTransitionTable.ts"]
notes: "A strict lifecycle state table requires photographic evidence before any field task can close.\n\nA table-driven state machine governs the complete work order lifecycle.\n\nWe implemented this logic in our WorkOrderTransitionTable class.\n\nWe chose one declarative table over a separate class for each state.\n\nA single table keeps transition rules transparent and makes every branch directly testable.\n\nA work order advances across six defined lifecycle states: Created, Assigned, Accepted, In Progress, Completed, and Verified.\n\nOnly the assigned field officer can advance a job to Completed.\n\nThe system strictly demands completion photos, treatment notes, and a timestamp before closing.\n\n(emphasize role authority)\n\nThe key advantage is that only an operations manager can verify completed work.\n\nIf a manager rejects the submitted evidence, the job returns to In Progress with an explanatory reason."
```

### S11 · Stage 6: Resolve
**Headline:** The resident and the manager see the same verified status when the work is done
```deck
section: Journey
layout:
  areas: |
    track track
    who shot
  rows: [22, 78]
  cols: [30, 70]
track:
  component: process_flow
  form: chevron
  ghost: true
  bottleneck_at: Resolve
  steps:
    - {name: Report, detail: Resident}
    - {name: Rank, detail: Server}
    - {name: Plan, detail: Server}
    - {name: Review, detail: Manager}
    - {name: Dispatch, detail: Field team}
    - {name: Resolve, detail: Everyone}
who:
  component: profile
  form: card
  people:
    - name: Nur Aisyah
      role: Resident
      image: {gemini: "Head-and-shoulders portrait photograph of a Malay Singaporean woman in her thirties wearing a light hijab, smiling, standing in an HDB void deck, soft natural daylight, realistic photo, no text"}
      points:
        - "My Reports shows each report's current status"
        - "Gets a Telegram alert if she linked her account"
        - "Every status change is kept in an append-only audit log"
shot:
  component: device_mockup
  form: pair
  connector: curved
  devices:
    - {device: phone, image: assets/v2/m-resident-report-detail-2.png, label: "Resident: report timeline"}
    - {device: laptop, image: assets/v2/manager-wo-detail.png, label: "Manager: verified job"}
sources: ["src/control/observer/"]
notes: "Residents and managers track identical verified outcomes when field teams complete their assignments.\n\nStage six completes the loop.\n\nWhen Rachel Lim verifies a completed work order, all linked resident reports update immediately.\n\nNur Aisyah opens My Reports on her phone and sees the verified resolution status.\n\nThe operations manager sees the identical completion state on her dashboard.\n\nResidents who connected their account receive an automated Telegram alert confirming the treatment.\n\n(calm, conclusive)\n\nDomain observers record every status transition in an append-only database audit log.\n\nThe platform maintains a permanent, tamper-resistant history of all municipal actions.\n\nCitizen reports never disappear into unmonitored queues, because every step to verified resolution is recorded and visible to everyone."
```

### S12 · BCE architecture
**Headline:** Each use case runs down one chain of classes: route, controller, port, repository, entity
```deck
section: Architecture
layout: full
component: swimlane
lanes: [Boundary, Control, "Ports (interfaces)", Persistence, Entity]
steps: [Report, Rank, Plan, Close]
boxes:
  - {lane: Boundary, step: Report, label: "Report Routes"}
  - {lane: Control, step: Report, label: "Report Controller"}
  - {lane: "Ports (interfaces)", step: Report, label: "Report Store"}
  - {lane: Persistence, step: Report, label: "Report Repository"}
  - {lane: Entity, step: Report, label: "Report"}
  - {lane: Control, step: Rank, label: "Priority Scoring Engine", break: true}
  - {lane: "Ports (interfaces)", step: Rank, label: "Priority Score Store"}
  - {lane: Persistence, step: Rank, label: "Priority Score Repository"}
  - {lane: Entity, step: Rank, label: "Priority Score"}
  - {lane: Boundary, step: Plan, label: "Work Order Routes", break: true}
  - {lane: Control, step: Plan, label: "Route Optimization Service"}
  - {lane: "Ports (interfaces)", step: Plan, label: "IRouteStrategy"}
  - {lane: Boundary, step: Close, label: "Crew Routes", break: true}
  - {lane: Control, step: Close, label: "Work Order Lifecycle Controller"}
  - {lane: "Ports (interfaces)", step: Close, label: "Work Order Store"}
  - {lane: Persistence, step: Close, label: "Work Order Repository"}
  - {lane: Entity, step: Close, label: "Work Order"}
sources: ["Import statements in src/; src/server.ts"]
notes: "(handoff point if the team splits here)\n\nThree distinct architectural layers separate user interfaces from core business logic and storage.\n\nOur system architecture follows the Boundary, Control, Entity design pattern.\n\nRead each swimlane column on screen from top to bottom, where arrows represent dependency calls.\n\nA boundary route class receives incoming HTTP requests, validates syntax, and calls one controller.\n\nThe controller executes business rules and depends strictly on abstract port interfaces.\n\nFor example, ReportController depends only on the ReportStore interface. A PostgreSQL repository implements that port and returns Report domain entities.\n\nIn route planning, WorkOrderRoutes calls RouteOptimizationService, which depends on the IRouteStrategy port.\n\nOur OneMap road strategy implements that interface.\n\n(highlight testability)\n\nAnd this is where it gets interesting, because every port has an in-memory twin repository.\n\nUnit tests use these twins and run without a database. At start-up, the server picks the real or in-memory version from its configuration."
```

### S13 · Design patterns
**Headline:** Five design patterns keep algorithms swappable and data ingestion safe to fail
```deck
section: Architecture
layout: full
component: data_table
header: ["Pattern", "Where in the code", "Why we use it"]
rows:
  - ["Strategy", "NormalisationStrategy, IRouteStrategy, IPestVisionStrategy", "Swap a formula, router or vision model without changing callers"]
  - ["Template Method", "AbstractIngestionJob", "Every feed runs fetch, validate, transform, persist; a failure keeps old data"]
  - ["Observer", "IReportObserver, IWorkOrderObserver, AuditLogObserver", "State changes trigger audit and alerts without coupling"]
  - ["Adapter", "OneMapGateway, TelegramGateway, NEAFeedGateway", "External APIs map onto stable domain types"]
  - ["Repository", "ReportRepository, WorkOrderRepository + in-memory twins", "SQL and PostGIS stay behind port interfaces"]
col_widths: [0.18, 0.40, 0.42]
font_size: 16
sources: ["src/control/"]
notes: "Standard design patterns isolate external interfaces and keep background data ingestion pipelines resilient.\n\nOur design applies five design patterns to solve concrete architectural challenges.\n\nStrategy isolates normalisation formulas, routing algorithms, and pest vision models so we can swap implementations without altering callers.\n\nTemplate Method structures our ingestion pipeline in AbstractIngestionJob.\n\nEvery external feed follows a uniform sequence: fetch, validate, transform, and persist.\n\n(deliberate pace, stress safety)\n\nA failed agency feed never corrupts stored data.\n\nIf an external API fails, the ingestion job logs a skip and preserves earlier database records.\n\nObserver decouples work order lifecycle events from audit logging and Telegram alerts.\n\nAdapters wrap OneMap, Telegram, and National Environment Agency endpoints into stable internal models.\n\nRepositories isolate SQL queries and PostGIS spatial operations behind clean port contracts."
```

### S14 · Tech stack
**Headline:** One TypeScript stack runs from the browser to the cloud, grouped by purpose
```deck
section: Architecture
layout:
  areas: |
    fe be data
    maps ci test
  rows: [50, 50]
  cols: [36, 28, 36]
fe:
  component: logo_strip
  heading: Front end
  logos:
    - {image: assets/logos/react.png, caption: React}
    - {image: assets/logos/typescript.png, caption: TypeScript}
    - {image: assets/logos/tailwindcss.png, caption: Tailwind}
    - {image: assets/logos/leaflet.png, caption: Leaflet}
be:
  component: logo_strip
  heading: Back end
  logos:
    - {image: assets/logos/nodedotjs.png, caption: Node.js}
    - {image: assets/logos/express.png, caption: Express}
data:
  component: logo_strip
  heading: Data
  logos:
    - {image: assets/logos/postgresql.png, caption: PostgreSQL}
    - {image: assets/logos/postgis.png, caption: PostGIS}
    - {image: assets/logos/supabase.png, caption: Supabase}
maps:
  component: logo_strip
  heading: Maps and external APIs
  logos:
    - {image: assets/logos/onemap.png, caption: OneMap}
    - {image: assets/logos/telegram.png, caption: Telegram}
    - {image: assets/logos/googlegemini.png, caption: Gemini}
ci:
  component: logo_strip
  heading: CI/CD and hosting
  logos:
    - {image: assets/logos/githubactions.png, caption: Actions}
    - {image: assets/logos/azure.png, caption: Azure}
test:
  component: logo_strip
  heading: Testing
  logos:
    - {image: assets/logos/vitest.png, caption: Vitest}
    - {image: assets/logos/testinglibrary.png, caption: "Testing Library"}
    - {image: assets/logos/playwright.png, caption: Playwright}
sources: ["package.json; client/package.json. Logos: Simple Icons (CC0)"]
notes: "A unified TypeScript codebase connects browser interfaces with backend services and government endpoints.\n\nOur team chose a unified TypeScript stack across the entire application lifecycle.\n\nThe slide organises our tools across six functional groups.\n\nOn the front end, React, TypeScript, and Tailwind CSS deliver clean user interfaces, while Leaflet renders maps and cluster boundaries.\n\nOn the back end, Node.js and Express manage API routes and controllers.\n\nFor data, PostgreSQL with the PostGIS spatial extension runs on Supabase in Singapore.\n\nExternal services integrate OneMap for routing, Telegram for alerts, and Gemini for vision inspection.\n\nGitHub Actions manages automated deployment to Azure App Service using OpenID Connect.\n\nOur test suite runs on Vitest, React Testing Library, and Playwright."
```

### S15 · CI/CD pipeline
**Headline:** Four parallel checks gate every commit, then OIDC deploys the exact tested build
```deck
section: Delivery
layout: rows 2 + banner
r1:
  component: process_flow
  steps:
    - {name: "Test and package", detail: "Typecheck, build, 1,247 tests", icon: assets/logos/vitest.png}
    - {name: "Disposable SQL", detail: "17 migrations on PostGIS 15", icon: assets/logos/postgresql.png}
    - {name: "Migration guard", detail: "Released migrations stay append-only", icon: assets/logos/git.png}
    - {name: "Workflow lint", detail: "actionlint checks the workflows", icon: assets/logos/githubactions.png}
r2:
  component: process_flow
  numbered: true
  steps:
    - {name: "Sign in", detail: "Short-lived OIDC token, no stored password", icon: assets/logos/openid.png}
    - {name: "Add schema", detail: "New tables and columns go live first", icon: assets/logos/supabase.png}
    - {name: "Deploy", detail: "Zip deploy to App Service, restart", icon: assets/logos/azure.png}
    - {name: "Verify live", detail: "Health ok, live hash equals tested zip", icon: assets/logos/nodedotjs.png}
    - {name: "Remove schema", detail: "Drop unused schema, then recheck health", icon: assets/logos/postgis.png}
banner: {component: takeaway_banner, text: "The old build still fits the schema, so rollback just redeploys the last good zip.", style: solid}
sources: [".github/workflows/deploy.yml; tools/"]
notes: "(handoff point if the team splits here)

Every push runs four checks, and only a fully green build reaches production.

All of this lives in workflows/deploy.yml.

Test and package builds the app, runs the unit tests and zips the release. This stops us from shipping broken code.

Disposable SQL applies every migration to a blank PostGIS database. This catches a broken migration before it reaches the live DB.

Migration guard blocks edits to a released migration. This keeps the live DB and a fresh DB on the same schema.

Workflow lint checks the workflow file itself, so an error in the pipeline can't break or skip a deploy.

(strong security emphasis)

Once all four checks pass, GitHub signs in to Azure with a short-lived token.

It then adds any new tables and columns to the live DB, so the code never runs ahead of its schema.

Next, the zip with the app and its dependencies is unpacked and started. Health and file checks confirm that the right version is live.

Only after those checks pass does it remove old schema that the code no longer uses. Then it checks health once more. So if a release goes wrong, the last good zip still fits the database, and rollback is just a redeploy."
```

### S16 · Testing strategy
**Headline:** Six test layers check domain rules, real SQL and the live release
```deck
section: Delivery
layout: full + banner
body:
  component: icon_list
  direction: down
  items:
    - {label: "Unit tests", text: "1,247 Vitest tests on scoring, routing and state tables", icon: assets/logos/vitest.png}
    - {label: "Component tests", text: "23 screen suites with React Testing Library", icon: assets/logos/testinglibrary.png}
    - {label: "Integration tests", text: "Repository tests run real SQL on a disposable PostGIS 15", icon: assets/logos/postgis.png}
    - {label: "Smoke test", text: "The release zip boots with outbound network blocked", icon: assets/logos/nodedotjs.png}
    - {label: "End-to-end tests", text: "Playwright walkthroughs with axe-core checks", icon: assets/logos/playwright.png}
    - {label: "Deployment verification", text: "Health poll and live hash check after each deploy", icon: assets/logos/azure.png}
banner: {component: takeaway_banner, text: "Every layer tests the same build: in memory, on real SQL, then live.", style: tint}
sources: ["tests/; tests-ui/; tools/smoke-release.mjs"]
notes: "We perform six layers of testing, from unit tests to full end-to-end testing.\n\nEach layer catches what the one below it cannot. Unit tests are fast, so they run on every change. End-to-end tests are slower, but they prove the real app works for a real user.\n\nYou will find all of them in the tests folder."
```

### S17 · Operational robustness
**Headline:** Caching, spatial indexes and hardening keep the app fast and safe under load
```deck
section: Robustness
layout: full
component: background
facts:
  - {headline: "Dispatch caching", detail: "Plans are precomputed and served from memory; data changes refresh them", icon: cache}
  - {headline: "Spatial indexes", detail: "PostGIS GIST indexes speed up containment and distance queries", icon: database}
  - {headline: "Data efficiency", detail: "SQL aggregation removes 3.2 MB per 5 min of rainfall traffic", icon: download}
  - {headline: "Abuse protection", detail: "15-minute lockout after failed sign-ins; bounded back-off on 429s", icon: shield}
  - {headline: "Security hardening", detail: "scrypt hashing, server-side role checks, strict CSP and HSTS", icon: padlock}
  - {headline: "Append-only audit", detail: "Database triggers protect the audit log; errors carry a correlation ID", icon: monitoring}
sources: ["src/control, persistence, entity, boundary"]
notes: "(handoff point if the team splits here)\n\nSix safeguards keep the app fast under load and safe from abuse.\n\nThe left column is speed. The right column is safety.\n\nFor speed, DispatchPlanService builds route plans ahead of time and keeps them in memory.\n\nSpatial indexes in the first migration make map lookups fast. A spatial index groups shapes by location, so a query checks only the nearby areas instead of every one.\n\n(proud delivery on concrete engineering gain)\n\nSQL aggregation means the database adds up the rainfall readings itself and sends back only the totals. Here is the result I like best. Doing that cut three point two megabytes of traffic every five minutes.\n\nFor safety, Account dot ts locks an account after repeated failed sign-ins. The HTTP client backs off when an outside service says slow down.\n\nPasswords are stored as scrypt hashes. A database trigger blocks any edit to the audit log.\n\nAnd every error carries an ID, so one complaint maps to one log line."
```

### S18 · Close
**Headline:** Report in. Resolved out.
```deck
component: cover
form: full
scrim: 55
deck_title: Report in. Resolved out.
tagline: dfence-sc2006.azurewebsites.net
occasion: Questions and discussion
image: assets/close-resolved.jpg
logo: false
notes: "(handoff point if the team splits here)\n\nSo think back to that stagnant water behind your block.\n\nToo often, the resident never learns if anyone came.\n\nD-Fence closes that gap. The resident reports. The server ranks and plans. The manager reviews, and the field team fixes. Everyone sees the same verified result.\n\n(build the energy)\n\nPicture a future where every report ends in a fix. Residents trust that someone is coming. Managers send crews where the risk is highest. And dengue stops at the source, before it reaches the next neighbour.\n\n(slow down, look at the room)\n\nReport in. Resolved out. D-Fence is live today, at the address on screen.\n\n(pause)\n\nThank you. We are ready for your questions, on stale data feeds and on scaling to more crews."
```

### A1 · Appendix: how one priority score is built
**Headline:** One score multiplies fixed pest severity by evidence-driven urgency, then bands it
```deck
section: appendix
layout:
  areas: |
    flow flow
    wf rules
  rows: [30, 70]
  cols: [56, 44]
  banner: true
flow:
  component: process_flow
  steps:
    - {name: Normalise, detail: "Each driver scaled to 0 to 1"}
    - {name: Weight, detail: "Tier weights sum to 1"}
    - {name: Urgency, detail: "Weighted sum of drivers"}
    - {name: Severity, detail: "Times pest severity, times 100"}
    - {name: Band, detail: "High 70+, Medium 40+"}
    - {name: Override, detail: "Life-safety goes Critical"}
wf:
  component: waterfall
  mode: build
  heading: "Kampong Ubi dengue cluster, tier A, severity 1.00"
  unit: points
  steps:
    - {label: "Case size", value: 21.7}
    - {label: "Case growth", value: 11.8}
    - {label: "Days since treated", value: 7.5}
    - {label: "Rain 72 h", value: 4.0}
    - {label: "Rain 24 h", value: 1.9}
    - {label: "Open reports", value: 6.0}
    - {label: "Premises mix", value: 2.0}
  end_label: "Score"
rules:
  component: data_table
  header: ["Rule", "How it works"]
  rows:
    - ["Formula", "Score = 100 x severity x urgency"]
    - ["Severity", "Fixed per pest, 0 to 1. Mosquito and rat are 1.00"]
    - ["Urgency", "Sum of weight x normalised driver, 0 to 1"]
    - ["Stale feed", "Driver dropped. Other weights rescaled to sum to 1"]
    - ["Bands", "High 70 or more, Medium 40 or more, else Low"]
    - ["Override", "Verified life-safety report goes Critical"]
  col_widths: [0.3, 0.7]
banner: {component: takeaway_banner, text: "Each bar is weight x normalised driver x 100. A stale feed never drags a score down.", style: tint}
sources: ["PEST-PRIORITY-MODEL.md s1, s5.2, s7; UrgencyCalculator.ts"]
notes: "Not spoken. Use in Q&A on ranking.\n\nThe bars rebuild the Kampong Ubi row of the worked example. Each bar is one tier A weight times its normalised value. Case size, for example, is weight 0.30 on a normalised value of about 0.72, which gives 21.7 points.\n\nIf a feed is stale, UrgencyCalculator drops that driver and divides by the weights that remain. So a missing rainfall feed does not push every score down."
```

### A2 · Appendix: severity and overrides in one mixed queue
**Headline:** Severity stops a flood of minor reports outranking real risk, and overrides put life-safety first
```deck
section: appendix
layout:
  areas: |
    plot tbl
    plot ovr
  rows: [45, 55]
  cols: [44, 56]
  banner: true
plot:
  component: matrix_plot
  x_axis: {label: "Severity", low: "0", high: "1.0"}
  y_axis: {label: "Urgency", low: "0", high: "1.0"}
  marker: dot
  items:
    - {label: "Rat 71.0", x: 0.97, y: 0.71}
    - {label: "Mosquito 54.9", x: 0.97, y: 0.549}
    - {label: "Snake 38.6", x: 0.75, y: 0.515}
    - {label: "Ant 37.3", x: 0.5, y: 0.745}
tbl:
  component: data_table
  header: ["Place and pest", "Sev.", "Urg.", "Score", "Band"]
  rows:
    - ["Toa Payoh, rat", "1.00", "0.710", "71.0", "High"]
    - ["Kampong Ubi, mosquito", "1.00", "0.549", "54.9", "Medium"]
    - ["Bukit Timah, snake", "0.75", "0.515", "38.6", "Critical"]
    - ["Sims Drive, ant", "0.50", "0.745", "37.3", "Low"]
  col_widths: [0.4, 0.12, 0.12, 0.14, 0.22]
  highlight_rows: [2]
ovr:
  component: data_table
  header: ["Override (verified report)", "Condition"]
  rows:
    - ["Snake", "Indoors"]
    - ["Crocodile", "Any location"]
    - ["Wild boar", "Residential or school zone"]
    - ["Bee or wasp", "School or healthcare site"]
    - ["Macaque", "Indoors"]
    - ["Any pest", "Injury reported"]
  col_widths: [0.45, 0.55]
banner: {component: takeaway_banner, text: "The ant has the highest urgency yet finishes last. The snake scores 38.6 yet goes straight to Critical.", style: tint}
sources: ["PEST-PRIORITY-MODEL.md s6 (overrides), s7 (worked example)"]
notes: "Not spoken. Use in Q&A on ranking.\n\nRat and mosquito share severity 1.00, so urgency decides, and the rat block outranks the dengue cluster. The ant has the highest urgency, but severity 0.50 holds it down. The snake scores Low by arithmetic, but the indoor-snake rule forces it to Critical. Arithmetic and life-safety are kept in separate mechanisms. Wildlife cases go to AVS, and D-Fence does not send its own crew."
```

### A3 · Appendix: how the planner inserts one task
**Headline:** Cheap estimates rank every gap, OneMap checks the best six, and the smallest verified detour wins
```deck
section: appendix
layout:
  areas: |
    flow flow
    img tbl
  rows: [28, 72]
  cols: [60, 40]
  banner: true
flow:
  component: process_flow
  steps:
    - {name: Sort, detail: "Critical first, then scarce skills"}
    - {name: Filter, detail: "Staff, vehicle and cargo fit"}
    - {name: Estimate, detail: "Straight line, 35 km/h"}
    - {name: Verify, detail: "OneMap checks the best 6"}
    - {name: Insert, detail: "Smallest verified detour"}
img:
  component: image
  path: assets/appendix/insertion.png
  mode: contain
tbl:
  component: data_table
  header: ["Route time", "Rule"]
  rows:
    - ["Drive", "OneMap legs, HQ back to HQ"]
    - ["Walk", "Road ends over 25 m away: two walks, 10 min max each"]
    - ["Work", "Planning default, e.g. fogging 45 min"]
    - ["On-call", "Delay before on-call staff arrive"]
    - ["Total", "4 hours or less"]
  col_widths: [0.3, 0.7]
banner: {component: takeaway_banner, text: "X is tried in every gap that keeps priority order. The gap that adds the least verified time wins.", style: tint}
sources: ["ROUTING-ALGORITHM-STE100.md s4 to s7"]
notes: "Not spoken. Use in Q&A on routing.\n\nFor each task, the planner tries every gap in every compatible crew's route, plus a new route. It first drops gaps that break staff, vehicle or cargo limits. It ranks the rest by a straight-line estimate, then asks OneMap for real road and walking times on the best six only. The task goes into the gap with the smallest verified increase that keeps the route within four hours."
```

### A4 · Appendix: how the planner improves finished routes
**Headline:** Local search removes crossings and moves jobs between crews, keeping only verified time savings
```deck
section: appendix
layout:
  areas: |
    img tbl
  cols: [22, 78]
  banner: true
img:
  component: image
  path: assets/appendix/two-opt.png
  mode: contain
tbl:
  component: data_table
  header: ["Move", "What it does", "Kept only if"]
  rows:
    - ["2-opt", "Reverses a run of same-priority stops in one route", "OneMap time falls"]
    - ["Swap", "Exchanges equal-priority tasks between two routes", "Time falls and both crews still fit"]
    - ["Relocate", "Moves a task to another crew's route", "Time falls and the first route keeps a stop"]
    - ["Limits", "64 in-route and 136 cross-route checks, 30 s budget", "Stops at the first cross-route gain"]
  col_widths: [0.16, 0.48, 0.36]
banner: {component: takeaway_banner, text: "Every move must cut verified travel time and keep every limit. The plan is good, not proven shortest.", style: tint}
sources: ["ROUTING-ALGORITHM-STE100.md s8; RouteOptimizationService.ts. Timings illustrative"]
notes: "Not spoken. Use in Q&A on routing.\n\nLeft: legs 1-2 and 4-5 cross. 2-opt removes both legs and reverses stops 2 to 4, so the route no longer crosses itself. Reversal only runs over stops of the same priority, so priority order holds. Between crews, the planner swaps or moves tasks when verified time falls. The search has fixed limits, so the planner does not claim the shortest possible plan."
```
