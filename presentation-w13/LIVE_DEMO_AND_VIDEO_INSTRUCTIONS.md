# D-Fence W13: Live Production Demo & Teammate Video Walkthrough Instructions

**Live Production System**: `https://dfence-sc2006.azurewebsites.net`  
**Database**: Supabase PostgreSQL (Production Cloud Database)  
**Style Standard**: British English, ~80% ASD-STE100, topic sentence first, active voice  
**Associated Automated Tests**:
* Live Presentation Test: `smart_nation/dengue/tools/w13_live_demo_webdriver.py`
* Video Walkthrough Test: `smart_nation/dengue/tools/w13_video_walkthrough_webdriver.py`

---

## 1. System Credentials & Personas

| Persona | Role | Username / Email | Password | Primary Screens |
| :--- | :--- | :--- | :--- | :--- |
| **Aisha binti Rahman** (Nur Aisyah) | Resident | `resident` (or `resident@d-fence.local`) | `resident` | `/report`, `/reports` |
| **Rachel Lim** (Chow Yen Kit) | Operations Manager | `manager` (or `ychow015@e.ntu.edu.sg`) | `manager` | `/ops`, `/ops/clusters/:id`, `/ops/dispatch`, `/ops/work-orders/:id` |
| **Ahmad Faizal** | Wildlife (AuthorityResponse) crew, SouthWest HQ: first on the route an NTU snake report joins | `crew` (or `crew.demo@d-fence.local`) | `crew` | `/crew`, `/crew/jobs/:id`, `/crew/jobs/:id/complete` |

---

## 2. Pre-Flight Setup & Clean Database State

To restore the live production database to a clean initial state before recording or demoing:

```powershell
cd C:\Users\chowy\alfred\smart_nation\dengue
npx tsx scratchpad\crew-seed.ts --cleanup
npx tsx scratchpad\crew-seed.ts
```
*Takes ~4 seconds. Seeds 4 Toa Payoh work orders, 1 dispatch assignment for today (`Central-Team-1`, Toyota Hiace `GBD 1234 A`), and Ahmad Faizal's active login credentials.*

> **2026-11-13 change:** For the NTU snake demo, do NOT run `crew-seed.ts`. It commits Ahmad Faizal to a Central route, and a committed crew never receives new tasks. `scratchpad/ntu-demo-crew.ts --apply` has already moved him to SouthWest AuthorityResponse with no committed route. After the officer verifies the NTU report, commit the `SouthWest-AuthorityResponse-Available` route in /ops/dispatch, then sign in as the crew.

To purge any lingering test snake reports without resetting the whole demo crew:
```powershell
.\scratchpad\demo-webdriver-venv\Scripts\python.exe tools\w13_video_walkthrough_webdriver.py --cleanup-only
```
*(Note: Automated test scripts `w13_video_walkthrough_webdriver.py` and `w13_live_demo_webdriver.py` now automatically delete all test reports they create upon run completion).*

---

## 3. How to Record the Demo Video

Your teammate has two ways to record the video:

### Method A: Automated Browser Replay (Zero Human Click Errors)
Let the Python WebDriver drive the real Microsoft Edge browser smoothly across all screens on the live site while you record your screen (OBS or Windows Game Bar: `Win + Alt + R`) and speak the script:
```powershell
cd C:\Users\chowy\alfred\smart_nation\dengue
.\scratchpad\demo-webdriver-venv\Scripts\python.exe tools\w13_video_walkthrough_webdriver.py --headed --pause 2.5
```
*(The script runs with 2.5-second pauses between every beat, keeping screens steady for narration).*

### Method B: Manual Walkthrough
Open Google Chrome or Microsoft Edge directly to `https://dfence-sc2006.azurewebsites.net` and follow the exact beat-by-beat cue sheet in Section 4.

---

## 4. Beat-by-Beat Video Cue Sheet ("What to Click and What to Say")

```
========================================================================================================
ACT 1: RESIDENT CITIZEN INTAKE & CRITICAL OVERRIDE
Role: Aisha binti Rahman (Resident) | Viewport: Mobile (430 × 932, iPhone 14 Pro) | Target: 0:00 - 0:50
========================================================================================================
```

### Beat 1.1: Authentication & Critical Snake Sighting with AI Auto-Fill (0:00 – 0:28)
* **Screen / URL**: `https://dfence-sc2006.azurewebsites.net/signin` then `/report`
* **What to Click**:
  1. Sign in as `resident` (`resident`) or `resident@d-fence.local` (`resident`).
  2. Tap **"Report a Sighting"** (`/report`).
  3. Under Photo Evidence, click the sample chip **"🐍 Reticulated Python (Drain)"** (or upload your snake photo).
  4. Notice the AI Vision structured output immediately auto-fills the entire report:
     * Taxon: **Snake** (classified under *Wildlife*).
     * Location context: **Inside a building** (`#context-Indoor`).
     * Condition: **Blocked drain** (`BlockedDrain`).
     * Description: auto-populated with authentic field description.
     * Count: confirmed with provisional **Critical** priority badge.
  5. Tap the prominent **"📍 Locate me"** button. The GPS location is auto-detected and verified immediately (`📍 Location acquired: 1.348500, 103.849200 (Singapore)`). Residents never have to type raw coordinates manually.
  6. Tap **"Submit report"**.
* **What to Say**:
  > *"I begin on mobile as resident Aisha binti Rahman in Tampines. When Aisha spots an acute hazard, she takes an evidence photograph.*
  > 
  > *D-Fence analyses the image using Gemini multimodal structured output. Notice that Aisha didn't have to fill tedious dropdowns or type raw coordinates: the vision model automatically identifies the taxon as a Reticulated Python, detects the drain condition, sets the location context to indoor, and drafts the description. With a single tap on 'Locate me', her device coordinates are auto-acquired without manual coordinate typing.*
  > 
  > *Because an indoor snake poses immediate human danger, Rule 4.4.7 triggers a Critical Priority Override. Linear models cannot express life-safety threats; D-Fence automatically elevates this report to Critical priority, immediately invalidating the server's cached dispatch plan."*
* **Core Logic Highlight**:
  * Multimodal Gemini structured output (`PestVisionGateway.ts` OpenAPI schema).
  * Auto-fill of pest taxon, location context, condition type, and description.
  * **Rule 4.4.7 Critical Override Evaluator**: `pestClass == 'Wildlife' && locationContext == 'Indoor' => PriorityTier.Critical`.
  * Dispatch cache invalidation: forces the route optimizer to replan for acute hazards.

### Beat 1.2: Spatial-Temporal Deduplication Enforcement (0:28 – 0:50)
* **Screen / URL**: `https://dfence-sc2006.azurewebsites.net/report`
* **What to Click**:
  1. Tap **"Report a Sighting"** again to attempt a second report.
  2. Click **"🐍 Reticulated Python (Drain)"**, select **"Snake"**, select **"Inside a building"**.
  3. Enter the **identical** latitude (`1.348500`) and longitude (`103.849200`).
  4. Tap **"Submit report"**.
  5. Point cursor to the red error banner: *"Refused duplicate report: a report of this type was already made nearby in the last 24 hours"*.
* **What to Say**:
  > *"Public agencies frequently suffer from duplicate alert spam during incidents. Watch what happens if Aisha submits a second sighting at the same location.*
  > 
  > *The server immediately rejects the submission under Rule 5.1.11.*
  > 
  > *Our spatial-temporal deduplication engine enforces a 50-metre radius and 24-hour window, preventing citizen alert fatigue and wasted dispatches."*
* **Core Logic Highlight**: PostGIS `ST_DWithin` spatial query + 24-hour temporal window filter.

```
========================================================================================================
ACT 2: OPERATIONS COMMAND — DYNAMIC RANKING & CRITICAL DISPATCH UPDATE
Role: Rachel Lim (Operations Manager) | Viewport: Desktop (1920 × 1080) | Target: 0:50 - 1:45
========================================================================================================
```

### Beat 2.1: Critical Queue Elevation & Environmental Scoring (0:50 – 1:15)
* **Screen / URL**: `https://dfence-sc2006.azurewebsites.net/ops` (Operations Dashboard)
* **What to Click**:
  1. Sign in as Rachel Lim (`manager` / `manager` or `ychow015@e.ntu.edu.sg` / `manager`).
  2. Open `/ops`.
  3. Expand **"Operations Summary"** details disclosure if closed.
  4. Point out the newly submitted indoor Snake sitting at the top with a red **Critical** priority badge.
  5. Click on cluster **"Bishan St 12 (Blk 105, 106...)"** to show the 7-driver environmental breakdown (`/ops/clusters/:id`).
* **What to Say**:
  > *"We switch to desktop as Regional Operations Manager Rachel Lim on the central operations console.*
  > 
  > *Notice that Aisha's indoor python report has jumped straight to the top of our queue with a red Critical badge, demonstrating the override engine in action.*
  > 
  > *For standard dengue clusters, D-Fence runs a dynamic 0-to-100 scoring engine that continuously integrates 5-minute rainfall telemetry from 87 weather stations, case growth delta, and days since treatment.*
  > 
  > *Every score shows its exact mathematical breakdown, preserving full operational transparency."*
* **Core Logic Highlight**: GoF Strategy Pattern ($Score = 100 \times \text{severity} \times \frac{\sum w_i x_i}{\sum w_i}$) and Critical priority queue elevation.

### Beat 2.2: Live Multi-Team Route Optimisation under 4-Hour Shift Cap (1:15 – 1:45)
* **Screen / URL**: `https://dfence-sc2006.azurewebsites.net/ops/dispatch` (Dispatch Proposals)
* **What to Click**:
  1. Click **"Dispatch"** on the top navigation bar.
  2. Switch planning horizon dropdown to **"7 days"**.
  3. Inspect the Leaflet map showing road-following vehicle lines and pedestrian access legs.
  4. Point to Central Team 1, van **Toyota Hiace (GBD 1234 A)**, and the ordered stops.
* **What to Say**:
  > *"Next, Rachel reviews the dispatch proposal on our interactive Leaflet map.*
  > 
  > *Because the Critical report invalidated the previous plan, D-Fence replans the route using the Singapore OneMap road network graph.*
  > 
  > *Our optimizer enforces a strict 4-hour fatigue cap per shift, scheduling 8 ordered stops for Central Team 1 with designated van GBD 1234 A and locking the plan against mid-shift replanning chaos."*
* **Core Logic Highlight**: OneMap road-network graph traversal, complete-link spatial clustering within 100 metres, and hard constraint satisfaction: $\sum (\text{drive\_time} + \text{service\_time}) \le 240 \text{ minutes}$.

```
========================================================================================================
ACT 3: FIELD CREW MOBILE EXECUTION & STATE MACHINE
Role: Ahmad Faizal (Field Officer) | Viewport: Mobile (430 × 932) | Target: 1:45 - 2:40
========================================================================================================
```

### Beat 3.1: Equipment Checklist & Job Acceptance (1:45 – 2:10)
* **Screen / URL**: `https://dfence-sc2006.azurewebsites.net/crew` (My Jobs)
* **What to Click**:
  1. Log into `/crew` as Field Officer Ahmad Faizal (`crew` / `crew` or `crew.demo@d-fence.local` / `crew`).
  2. On **"My Dispatch"**, tick the top 3 equipment checkboxes:
     - `Personal Protective Equipment (PPE)`
     - `Ultra-low volume thermal fogger`
     - `Bti larvicide granular formulation`
  3. Scroll down to the ordered stops list. Click the first job (`/crew/jobs/:id`).
  4. Tap **"Accept this job"** -> Status flips from `Assigned` to `Accepted`.
* **What to Say**:
  > *"Now we move to vector control specialist Ahmad Faizal on mobile in the field.*
  > 
  > *Before departure, Ahmad checks off his equipment load-out checklist. Each tick persists immediately to the database, ensuring vector teams never arrive without mandatory supplies.*
  > 
  > *Ahmad opens his first assigned stop in Toa Payoh. Following our table-driven finite state machine, he taps 'Accept this job'. The work order updates from Assigned to Accepted."*
* **Core Logic Highlight**: Reactive checklist persistence (`PATCH /api/crew/dispatch/checklist`) and role-based state machine guards.

### Beat 3.2: Travel Start & Mandatory Photo Evidence Gate (2:10 – 2:40)
* **Screen / URL**: `/crew/jobs/:id` then `/crew/jobs/:id/complete`
* **What to Click**:
  1. Tap **"Start work"** -> Status updates from `Accepted` to `InProgress`.
  2. Tap **"Record completion"** (`/crew/jobs/:id/complete`).
  3. Click **"Submit completion"** without a photo -> Point out the validation error requiring photo evidence.
  4. Attach evidence photo (`client/public/visuals/clusters/hdb-perimeter-drain.jpg`).
  5. In Remediation Notes, type: `"Captured and relocated reptile safely with NParks AVS wildlife unit. Cleared obstruction in storm drain. Larvicided perimeter."`
  6. Tap **"Submit completion"** -> Status badge becomes `Completed`.
* **What to Say**:
  > *"When transit begins, Ahmad taps 'Start work', moving the order to In Progress.*
  > 
  > *After conducting eradication at the site, he taps 'Record completion'. Notice that if Ahmad attempts to submit without evidence, D-Fence refuses completion under Rule 8.3.6.*
  > 
  > *Remediation without verifiable proof is zero proof. Once Ahmad uploads the post-treatment photo and records his remediation notes, he submits. The job is marked Completed."*
* **Core Logic Highlight**: Table-driven finite state machine (`Assigned` $\to$ `Accepted` $\to$ `InProgress` $\to$ `Completed`) and Rule 8.3.6 mandatory photo evidence gate.

```
========================================================================================================
ACT 4: TWO-PERSON SUPERVISORY VERIFICATION & AUDIT TRAIL
Role: Rachel Lim (Operations Manager) | Viewport: Desktop (1920 × 1080) | Target: 2:40 - 3:15
========================================================================================================
```

### Beat 4.1: Manager Verification Gate & Audit History (2:40 – 3:15)
* **Screen / URL**: `https://dfence-sc2006.azurewebsites.net/ops/work-orders/:id`
* **What to Click**:
  1. Switch back to Manager window (`ychow015@e.ntu.edu.sg`).
  2. Navigate to `/ops/work-orders/:id`.
  3. Point out live update: Status shows `Completed`; Ahmad's photo proof and remediation notes are displayed.
  4. Click the blue **"Verify completion"** button.
  5. In the confirmation dialog, click **"Verify"** -> Status becomes `Verified`.
  6. Scroll down to the **"History"** section to display the chronological audit log.
* **What to Say**:
  > *"Returning to the Operations Manager console, Rachel sees the work order update to Completed in real time.*
  > 
  > *She inspects Ahmad's photo proof and remediation notes. D-Fence enforces a strict two-person rule: field crews cannot self-certify their own work.*
  > 
  > *Rachel clicks 'Verify completion'. The order is now Verified.*
  > 
  > *Beneath the card, our append-only audit trail logs every state transition, actor ID, and ISO timestamp—providing a tamper-evident record for environmental health compliance audits."*
* **Core Logic Highlight**: GoF Observer pattern for real-time state synchronisation, two-person verification gate, and append-only immutable audit trail.

```
========================================================================================================
ACT 5: CITIZEN LOOP CLOSURE & SUMMARY
Role: Aisha binti Rahman (Resident) | Viewport: Mobile (430 × 932) | Target: 3:15 - 3:45
========================================================================================================
```

### Beat 5.1: Resident Loop Closure & Verified Outcome (3:15 – 3:45)
* **Screen / URL**: `https://dfence-sc2006.azurewebsites.net/reports` (My Reports)
* **What to Click**:
  1. Switch back to Resident mobile window (`resident@d-fence.local`).
  2. Navigate to `/reports`.
  3. Point to the resident's report badge showing green **"Verified"**.
* **What to Say**:
  > *"Finally, we return to resident Aisha's smartphone.*
  > 
  > *Opening My Reports, Aisha sees her report status has transitioned from Pending to Verified, alongside the confirmed completion timestamp.*
  > 
  > *Conventional complaint systems leave residents wondering if action was ever taken. D-Fence closes the operational loop completely—from citizen intake and AI screening, through dynamic ranking and route optimisation, to verified field eradication."*
* **Core Logic Highlight**: Full closed-loop citizen engagement architecture and public trust reinforcement.

---

## 5. Summary of Automated Verification Commands

| Command | Purpose |
| :--- | :--- |
| `python tools/w13_live_demo_webdriver.py` | Runs the full 6-stage presentation test (Slides 1-18) headlessly against the live site. |
| `python tools/w13_video_walkthrough_webdriver.py` | Runs the full multi-account video walkthrough test headlessly with snake Critical override. |
| `python tools/w13_video_walkthrough_webdriver.py --headed --pause 2.5` | Launches headed Edge browser with 2.5s pacing for recording the demo video live. |
