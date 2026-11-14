# D-Fence W13 Demo Video: Director's Cue Sheet & Walkthrough Script
**System Target**: `https://dfence-sc2006.azurewebsites.net`  
**Video Target Duration**: 3 minutes 45 seconds (±15 seconds)  
**Style Standard**: British English, ~80% ASD-STE100, active voice, topic sentence first, youthful professional delivery  
**Companion Test Script**: `smart_nation\dengue\tools\w13_video_walkthrough_webdriver.py`

---

## 1. Pre-Recording Setup & Technical Checklist

| Item | Requirement | Command / Action |
| :--- | :--- | :--- |
| **Clean Database State** | Reset crew dispatch & work orders to initial `Assigned` state (or run `python tools\w13_video_walkthrough_webdriver.py --cleanup-only` to purge test sightings) | `cd smart_nation\dengue`<br>`npx tsx scratchpad\crew-seed.ts --cleanup`<br>`npx tsx scratchpad\crew-seed.ts` |
| **Display Resolution** | 1080p (1920 × 1080) for Operations Manager; Mobile view (430 × 932, iPhone 14 Pro) for Resident & Field Officer | Use Chrome/Edge DevTools Device Toolbar (`Ctrl+Shift+M`) or browser resizing |
| **Automated Replay Option** | You can run the included Python Webdriver script with `--headed` to drive the browser automatically while you narrate | `.\scratchpad\demo-webdriver-venv\Scripts\python.exe tools\w13_video_walkthrough_webdriver.py --headed --pause 2.5` |
| **Accounts Required** | Resident: `resident` / `resident`<br>Manager: `manager` / `manager`<br>Crew: `crew` / `crew` | Stored in `scratchpad\dispatch-demo-20261029\private-credentials.json` & `scratchpad\crew-login.json` |

---

## 2. Beat-by-Beat Walkthrough Table

```
========================================================================================================
ACT 1: RESIDENT CITIZEN INTAKE & MULTIMODAL SCREENING
Role: Aisha binti Rahman (Resident) | Viewport: Mobile (430 × 932) | Duration: 0:00 - 0:50
========================================================================================================
```

### Beat 1.1: Authentication & Critical Snake Sighting with AI Auto-Fill (0:00 – 0:28)
* **Screen / URL**: `/signin` then `/report`
* **What to Click**:
  1. Sign in with `resident` (`resident`) or `resident@d-fence.local` (`resident`).
  2. Tap **"Report a Sighting"** or navigate to `/report`.
  3. Under Photo Evidence, click the sample chip **"🐍 Reticulated Python (Drain)"** (or upload your snake photo).
  4. Notice the AI Vision structured output immediately auto-fills the entire report:
     * Taxon: **Snake** (classified under *Wildlife*).
     * Location context: **Inside a building** (`#context-Indoor`).
     * Condition: **Blocked drain** (`BlockedDrain`).
     * Description: auto-populated with authentic field description.
     * Count: confirmed with provisional **Critical** priority badge.
  5. Tap the prominent **"📍 Locate me"** button. GPS coordinates are auto-detected and verified with a green badge (`📍 Location acquired: 1.348500, 103.849200 (Singapore)`). Manual coordinates remain available under collapsible details.
  6. Tap **"Submit report"**.
* **What to Say**:
  > *"I begin on mobile as resident Aisha binti Rahman in Tampines. When Aisha spots an acute hazard, she attaches an evidence photograph.*
  > 
  > *D-Fence analyses the image using Gemini multimodal structured output. Notice that Aisha didn't have to fill tedious dropdowns or type raw coordinates: the vision model automatically identifies the taxon as a Reticulated Python, detects the drain condition, sets the location context to indoor, and drafts the description. A single tap on 'Locate me' captures her GPS position instantly.*
  > 
  > *Because an indoor snake poses immediate human danger, Rule 4.4.7 triggers a Critical Priority Override. Linear models cannot express life-safety threats; D-Fence elevates this report to Critical priority, immediately invalidating the server's cached dispatch plan."*
* **Core Logic & Architecture Callout**:
  * Multimodal Gemini structured output (`PestVisionGateway.ts` OpenAPI schema).
  * Auto-fill of pest taxon, location context, condition type, and description.
  * **Rule 4.4.7 Critical Override Evaluator**: `pestClass == 'Wildlife' && locationContext == 'Indoor' => PriorityTier.Critical`.
  * Dispatch cache invalidation: forces the route optimizer to replan for acute hazards.

### Beat 1.2: Spatial-Temporal Deduplication Enforcement (0:28 – 0:50)
* **Screen / URL**: `/report`
* **What to Click**:
  1. Immediately click **"Report a Sighting"** again to attempt a second report.
  2. Click **"🐍 Reticulated Python (Drain)"** (or select Snake, Inside a building).
  3. Input the **identical** latitude (`1.348500`) and longitude (`103.849200`).
  4. Click **"Submit report"**.
  5. Highlight the red alert banner: *"Refused duplicate report: a report of this type was already made nearby in the last 24 hours"*.
* **What to Say**:
  > *"Public agencies frequently suffer from duplicate alert spam during incidents. Watch what happens if Aisha submits an identical sighting at the same location.*
  > 
  > *The server immediately rejects the submission under Rule 5.1.11.*
  > 
  > *Our spatial-temporal deduplication engine enforces a 50-metre radius and 24-hour window, preventing citizen alert fatigue and wasted dispatches."*
  > 
  > *Our spatial-temporal deduplication engine checks existing reports within a 50-metre radius and 24-hour window, preventing citizen alert fatigue and duplicate dispatch waste."*
* **Core Logic & Architecture Callout**:
  * PostGIS spatial query (`ST_DWithin(geom, 50)`) combined with temporal filter (`createdAt >= NOW() - INTERVAL 24 HOUR`).
  * Server-side idempotency and dispatch cache invalidation.

```
========================================================================================================
ACT 2: OPERATIONS COMMAND — DYNAMIC RANKING & ROUTE PLANNING
Role: Rachel Lim (Operations Manager) | Viewport: Desktop (1920 × 1080) | Duration: 0:50 - 1:45
========================================================================================================
```

### Beat 2.1: Dynamic Priority Scoring & Environmental Drivers (0:50 – 1:15)
* **Screen / URL**: `/ops` (Operations Dashboard)
* **What to Click**:
  1. Sign in as Rachel Lim (`ychow015@e.ntu.edu.sg`).
  2. Open `/ops`.
  3. Expand the **"Operations Summary"** details disclosure if closed.
  4. Click on the top-priority cluster: **"Bishan St 12 (Blk 105, 106...)"**.
  5. The screen transitions to `/ops/clusters/:id` (Cluster Detail). Point your cursor to the breakdown cards.
* **What to Say**:
  > *"We switch to desktop as Regional Operations Manager Rachel Lim on the central operations console.*
  > 
  > *Rather than managing unweighted ticket queues, D-Fence runs a dynamic 0-to-100 priority scoring engine that continuously ingests live telemetry.*
  > 
  > *Clicking our top-ranked cluster reveals the complete mathematical driver breakdown: 72-hour cumulative rainfall from 87 weather stations, case growth delta, and days since last chemical treatment.*
  > 
  > *If telemetry feeds go offline, our system redistributes mathematical weights dynamically and flags the state as degraded without failing."*
* **Core Logic & Architecture Callout**:
  * **GoF Strategy Pattern**: Priority calculation decomposes into normalized environmental drivers ($Score = 100 \times \text{severity} \times \frac{\sum w_i x_i}{\sum w_i}$).
  * Stale telemetry weight reallocation algorithm.

### Beat 2.2: Multi-Team Road Route Planning under 4-Hour Shift Cap (1:15 – 1:45)
* **Screen / URL**: `/ops/dispatch` (Dispatch Proposals)
* **What to Click**:
  1. Click **"Dispatch"** on the top navigation bar.
  2. Change planning horizon dropdown to **"7 days"**.
  3. Inspect the Leaflet interactive map showing road-following vehicle lines and walking access segments.
  4. Point to Central Team 1 and the assigned vehicle: **Toyota Hiace (GBD 1234 A)**.
* **What to Say**:
  > *"Next, Rachel reviews the automated dispatch schedule on the interactive Leaflet map.*
  > 
  > *D-Fence connects directly to the Singapore OneMap road network graph to compute realistic driving circuits and pedestrian access legs.*
  > 
  > *Crucially, our route optimizer enforces a hard 4-hour fatigue cap per shift, scheduling 8 ordered stops for Central Team 1 with designated van GBD 1234 A and locking the plan against mid-shift replanning chaos."*
* **Core Logic & Architecture Callout**:
  * **GoF Template Method Pattern**: Routing pipeline standardises stop sequencing, road snapping, and walking access legs.
  * Real-world constraint satisfaction: $\sum (\text{drive\_time} + \text{service\_time}) \le 240 \text{ minutes}$.

```
========================================================================================================
ACT 3: FIELD CREW MOBILE EXECUTION & STATE MACHINE
Role: Ahmad Faizal (Field Officer) | Viewport: Mobile (430 × 932) | Duration: 1:45 - 2:40
========================================================================================================
```

### Beat 3.1: Equipment Checklist & Job Acceptance (1:45 – 2:10)
* **Screen / URL**: `/crew` (My Jobs)
* **What to Click**:
  1. Log into `/crew` as Field Officer Ahmad Faizal (`crew.demo@d-fence.local`).
  2. On the **"My Dispatch"** card, tick the equipment checkboxes:
     - `Personal Protective Equipment (PPE)`
     - `Ultra-low volume thermal fogger`
     - `Bti larvicide granular formulation`
  3. Scroll down to the ordered work orders list. Click the first job (`/crew/jobs/:id`).
  4. On the Job Detail screen, tap **"Accept this job"**.
  5. The status badge immediately flips from `Assigned` to `Accepted`.
* **What to Say**:
  > *"Now we move to vector control specialist Ahmad Faizal on mobile in the field.*
  > 
  > *Before departure, Ahmad checks off his equipment load-out checklist. Each tick persists immediately to the database, ensuring vector teams never arrive without mandatory chemical supplies.*
  > 
  > *Ahmad opens his first assigned stop in Toa Payoh. Following our table-driven finite state machine, he taps 'Accept this job'. The work order updates from Assigned to Accepted."*
* **Core Logic & Architecture Callout**:
  * Reactive checklist persistence via `PATCH /api/crew/dispatch/checklist`.
  * Finite state machine transition rules enforcing role-based permissions.

### Beat 3.2: Travel Start & Mandatory Photo Evidence Gate (2:10 – 2:40)
* **Screen / URL**: `/crew/jobs/:id` then `/crew/jobs/:id/complete`
* **What to Click**:
  1. Click **"Start work"** -> Status updates from `Accepted` to `InProgress`.
  2. Click **"Record completion"** (`/crew/jobs/:id/complete`).
  3. Without selecting a photo, click **"Submit completion"** -> Highlight the validation error indicating photo proof is required.
  4. Attach evidence photo (`client/public/visuals/clusters/hdb-perimeter-drain.jpg`).
  5. In Remediation Notes, type: `"Cleared debris and standing water in perimeter drain. Applied Bti larvicide granules. ULV misting completed."`
  6. Click **"Submit completion"** -> Status badge becomes `Completed`.
* **What to Say**:
  > *"When transit begins, Ahmad taps 'Start work', moving the order to In Progress.*
  > 
  > *After conducting eradication at the site, he taps 'Record completion'. Notice that if Ahmad attempts to submit without evidence, D-Fence refuses completion under Rule 8.3.6.*
  > 
  > *Remediation without verifiable proof is zero proof. Once Ahmad uploads the post-treatment photo and records his chemical dosage notes, he submits. The job is marked Completed."*
* **Core Logic & Architecture Callout**:
  * **Table-driven State Machine**: `Assigned` $\to$ `Accepted` $\to$ `InProgress` $\to$ `Completed`.
  * Precondition validation gate (Rule 8.3.6 / 8.3.7): `photoKeys.length >= 1`.
  * Evidence stored securely in Azure Blob Storage.

```
========================================================================================================
ACT 4: TWO-PERSON SUPERVISORY VERIFICATION & AUDIT TRAIL
Role: Rachel Lim (Operations Manager) | Viewport: Desktop (1920 × 1080) | Duration: 2:40 - 3:15
========================================================================================================
```

### Beat 4.1: Manager Verification Gate & Audit History (2:40 – 3:15)
* **Screen / URL**: `/ops/work-orders/:id` (Work Order Detail)
* **What to Click**:
  1. Switch back to Manager window (`ychow015@e.ntu.edu.sg`).
  2. Navigate directly to `/ops/work-orders/:id` (or click from dashboard).
  3. Highlight live state update: Status is `Completed`; Ahmad's photo evidence and treatment notes are visible.
  4. Click the blue **"Verify completion"** button.
  5. In the confirmation dialog, click **"Verify"**.
  6. The status transitions to `Verified`.
  7. Scroll down to the **"History"** section to display the chronological audit log.
* **What to Say**:
  > *"Returning to the Operations Manager console, Rachel sees the work order update to Completed in real time.*
  > 
  > *She inspects Ahmad's photo proof and remediation notes. D-Fence enforces a strict two-person rule: field crews cannot self-certify their own work.*
  > 
  > *Rachel clicks 'Verify completion'. The order is now Verified.*
  > 
  > *Beneath the card, our append-only audit trail logs every state transition, actor ID, and ISO timestamp—providing an tamper-evident record for environmental health compliance audits."*
* **Core Logic & Architecture Callout**:
  * **GoF Observer Pattern**: Real-time state synchronisation across authenticated sessions.
  * Two-person verification gate separating field execution from managerial certification.
  * Append-only ledger maintaining strict auditability.

```
========================================================================================================
ACT 5: CITIZEN LOOP CLOSURE & SUMMARY
Role: Aisha binti Rahman (Resident) | Viewport: Mobile (430 × 932) | Duration: 3:15 - 3:45
========================================================================================================
```

### Beat 5.1: Resident Loop Closure & Verified Outcome (3:15 – 3:45)
* **Screen / URL**: `/reports` (My Reports)
* **What to Click**:
  1. Switch back to Resident mobile window (`resident@d-fence.local`).
  2. Navigate to `/reports`.
  3. Show the resident's report card: The status pill is green, reading **"Verified"**.
  4. Tap the report to display resolution details.
* **What to Say**:
  > *"Finally, we return to resident Aisha's smartphone.*
  > 
  > *Opening My Reports, Aisha sees her report status has transitioned from Pending to Verified, alongside the confirmed completion timestamp.*
  > 
  > *Conventional complaint systems leave residents wondering if action was ever taken. D-Fence closes the operational loop completely—from citizen intake and AI screening, through dynamic ranking and route optimisation, to verified field eradication."*
* **Core Logic & Architecture Callout**:
  * Closed-loop citizen engagement architecture.
  * Public trust reinforcement via transparent remediation confirmation.

---

## 3. Quick Reference: Account Credentials

| Persona | Role | Email | Password | Primary Screens |
| :--- | :--- | :--- | :--- | :--- |
| **Aisha binti Rahman** | Resident | `resident` (or `resident@d-fence.local`) | `resident` | `/report`, `/reports` |
| **Rachel Lim** | Operations Manager | `manager` (or `ychow015@e.ntu.edu.sg`) | `manager` | `/ops`, `/ops/clusters/:id`, `/ops/dispatch`, `/ops/work-orders/:id` |
| **Ahmad Faizal** | Field Officer (Central Team 1) | `crew` (or `crew.demo@d-fence.local`) | `crew` | `/crew`, `/crew/jobs/:id`, `/crew/jobs/:id/complete` |

---

## 4. Troubleshooting & Fallback Cheat Sheet

1. **If a button is not clickable on mobile view**:
   * Scroll down slightly; on small viewports, the sticky bottom navigation bar (`/map`, `/reports`) can overlap lower form buttons.
2. **If cluster cards do not appear immediately**:
   * The priority engine calculates live scores asynchronously via `/api/ops/priority`. Allow 1–2 seconds for the cards to render.
3. **If you need to restart the entire sequence**:
   * Run in terminal: `npx tsx scratchpad/crew-seed.ts --cleanup && npx tsx scratchpad/crew-seed.ts`. It takes ~4 seconds and restores the exact clean state.
4. **If you prefer automatic browser recording**:
   * Run `.\scratchpad\demo-webdriver-venv\Scripts\python.exe tools\w13_video_walkthrough_webdriver.py --headed --pause 2.5`. The browser will perform every action smoothly with pauses while you record and narrate.
