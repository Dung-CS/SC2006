# LAB 5: Demonstration Video & Narration Script

**Module:** SC2006 / CZ2006 Software Engineering  
**Project:** D-Fence — Smart Nation Vector & Pest Control Platform  
**Live Production URL:** [https://dfence-sc2006.azurewebsites.net](https://dfence-sc2006.azurewebsites.net)  
**Video Target Duration:** 5–7 minutes  
**Video Resolution:** 1080p (1920 × 1080) Desktop / 430 × 932 Mobile  
**Audio Standard:** British English, ~80% ASD-STE100, active voice  
**Submission Video Link:** [https://youtu.be/PLACEHOLDER_DEMO_VIDEO](https://youtu.be/PLACEHOLDER_DEMO_VIDEO) *(Placeholder for final video submission)*  

---

## 1. Automated Webdriver Demonstration Runner

To execute the full demonstration script automatically via Playwright against the live production deployment:

```bash
# 1. Ensure dependencies are installed
npm install

# 2. Run the automated video walkthrough test script with headed browser
python tools/w13_video_walkthrough_webdriver.py --headed --pause 2.5

# 3. Clean up test sightings after recording
python tools/w13_video_walkthrough_webdriver.py --cleanup-only
```

---

## 2. Walkthrough Structure & Roles

| Act | Scene / Workflow | User Role | Duration | Key Technical Feature Demonstrated |
|:---:|---|---|:---:|---|
| **Act 1** | Citizen Reporting & AI Screening | Resident (`resident`) | 1:15 | Multimodal Gemini Vision auto-fill, GPS acquisition, Rule 4.4.7 Critical Override, 50m/24h deduplication. |
| **Act 2** | Operations Review & Auto-Replanning | Operations Manager (`manager`) | 1:45 | Real-time map, multi-pest prioritization, automatic dispatch invalidation, TSP vehicle routing. |
| **Act 3** | Interactive Multi-Vehicle Dispatch | Operations Manager (`manager`) | 1:30 | Multi-vehicle tabs, drag-and-drop reassignment, `isFixed` pin locking, OSRM road route geometry. |
| **Act 4** | Field Officer Execution & Evidence | Field Officer (`crew`) | 1:15 | Mobile job queue, route navigation, photographic evidence upload, table-driven state transitions (`InProgress` $\to$ `Verified`). |

---

## 3. Beat-by-Beat Video Narration Script

### Act 1: Resident Citizen Intake & AI Screening (0:00 – 1:15)
* **Screen:** `/signin` $\to$ `/report` (Mobile Viewport: 430 × 932)
* **Action:**
  1. Sign in with resident credentials (`resident` / `resident`).
  2. Navigate to **"Report a Sighting"** (`/report`).
  3. Under Photo Evidence, select sample chip **"🐍 Reticulated Python (Drain)"**.
  4. Observe automatic population of Taxon (*Snake*), Location Context (*Indoor*), Condition (*Blocked Drain*), and drafted narrative description.
  5. Click **"📍 Locate me"** to acquire device GPS coordinates.
  6. Submit the report.
  7. Attempt to submit an identical report at the same coordinates within 50 metres.
* **Narration:**
  > *"We begin from the citizen perspective on mobile as resident Aisha in Tampines. When Aisha identifies an acute hazard, she uploads a photograph.*
  > 
  > *D-Fence connects directly to Google AI Studio Gemini Vision through our `PestVisionGateway`. Notice that Aisha does not need to navigate complex dropdowns or type geographic coordinates manually: our multimodal model extracts the taxon as a Reticulated Python, identifies the blocked drain condition, sets the location context to indoor, and drafts the description.*
  > 
  > *A single tap on 'Locate me' captures her GPS position instantly. Because an indoor venomous or constrictor snake presents immediate life danger, Rule 4.4.7 triggers a Critical Priority Override. Linear scoring models cannot represent acute life-safety hazards; D-Fence elevates this report to Critical priority, immediately invalidating the operational dispatch cache.*
  > 
  > *If Aisha attempts to submit the identical sighting a second time, the server rejects it under Rule 5.1.11: our spatial-temporal deduplication engine enforces a 50-metre radius and 24-hour window, preventing agency inbox flooding and alert fatigue."*

---

### Act 2: Operations Management & Automated Replanning (1:15 – 3:00)
* **Screen:** `/dashboard` $\to$ `/operations/clusters` (Desktop Viewport: 1920 × 1080)
* **Action:**
  1. Sign in as Operations Manager (`manager` / `manager`).
  2. Inspect the live Singapore map showing Dengue clusters, Gravitrap indices, weather stations, and community reports.
  3. Filter by pest species (Mosquito, Rodent, Wildlife).
  4. View the acute Snake sighting highlighted with a pulsing red Critical badge.
  5. Inspect the Priority Score breakdown (Severity Multiplier $\times$ Urgency + Driver Weights).
* **Narration:**
  > *"Switching to desktop operations view as Manager Tan, we see Singapore's consolidated bio-risk surface. D-Fence unifies government data feeds—including NEA Dengue clusters, National Environment Agency rainfall stations, and iNaturalist observations—with community reports into a single spatial model.*
  > 
  > *The newly submitted snake report appears immediately with a pulsing Critical badge. D-Fence's Clean Architecture strictly separates presentation from computational logic: the `PriorityScoringEngine` computes multi-criteria priority scores combining premises vulnerability, 72-hour rainfall history, and historical treatment decay.*
  > 
  > *Because the Critical override invalidated the existing schedule, the route optimizer automatically generated a revised Travelling Salesperson dispatch proposal, inserting the acute hazard into the nearest active crew itinerary."*

---

### Act 3: Multi-Vehicle Fleet Dispatch Editor (3:00 – 4:30)
* **Screen:** `/operations/dispatch-proposals`
* **Action:**
  1. Review the proposed vehicle routes for Van-1 (West Depot, Soon Lee) and Van-2 (Central Depot).
  2. Inspect turn-by-turn routing powered by Singapore OneMap / OSRM verified road geometry.
  3. Demonstrate manual intervention: reassign a work order from Van-1 to Van-2.
  4. Toggle the **"Pin / Fix"** checkbox (`isFixed = true`) on the Critical snake task.
  5. Click **"Recalculate Route"**: show that the pinned task remains locked in place while the rest of the schedule optimizes around it.
  6. Click **"Approve & Dispatch"**.
* **Narration:**
  > *"In the Dispatch Editor, operations managers maintain full supervisory control over automated proposals. D-Fence models vehicle capacities, payload limits, and depot origins across our municipal fleet.*
  > 
  > *Every route uses verified driving road networks from Singapore OneMap; offshore or non-road locations are safely partitioned to prevent unreachable dispatches.*
  > 
  > *Here, Manager Tan can reassign tasks between vehicles. By selecting 'Pin / Fix', the Critical snake intervention is locked at stop order 1. When Tan triggers route re-optimization, our heuristic solver respects all pinned constraints, reordering the remaining jobs for minimum travel time and fuel consumption.*
  > 
  > *Tan approves the plan. In doing so, work orders transition atomically from `Created` to `Assigned`, and dispatch notifications are pushed to field crews."*

---

### Act 4: Field Execution & Verification Loop (4:30 – 5:45)
* **Screen:** `/crew/jobs` $\to$ `/crew/jobs/:id` (Mobile Viewport: 430 × 932)
* **Action:**
  1. Sign in as Field Officer (`crew` / `crew`).
  2. View assigned job queue ordered by stop sequence.
  3. Open Job #1 (Critical Snake Removal).
  4. Tap **"Accept & Start Job"** (Status moves to `InProgress`).
  5. Upload completion evidence photograph and enter field notes ("Secured specimen and handed over to AVS").
  6. Tap **"Complete Job"** (Status moves to `Completed`).
  7. Return to Manager dashboard: verify work order, which atomically creates a `TreatmentRecord` and updates the neighborhood risk score.
* **Narration:**
  > *"On the ground, field officer Farhan receives his daily assignments on mobile. The jobs are sequenced according to the optimized road route.*
  > 
  > *Farhan opens the Critical task and taps 'Accept & Start Job'. Our table-driven `WorkOrderLifecycleController` validates that only legal state transitions can occur, moving the record from `Assigned` to `InProgress`.*
  > 
  > *Upon resolving the hazard, Farhan captures photo evidence and notes the intervention. When he taps 'Complete', the job moves to `Completed`.*
  > 
  > *Back at headquarters, Manager Tan verifies the evidence. Verification writes a permanent `TreatmentRecord`, feeding our historical treatment decay driver so future risk scores in this locality reflect recent remediation. This closes the complete operational loop from citizen report to verified field action."*

---

### Conclusion (5:45 – 6:15)
* **Screen:** Architecture summary slide / GitHub repo.
* **Narration:**
  > *"To summarize: D-Fence delivers a production-grade, full-stack software system built strictly on Clean Architecture and Boundary-Control-Entity principles. With 1,258 automated unit tests, complete GoF pattern implementations, and live deployment on Azure and Supabase, D-Fence establishes a scalable, automated standard for Smart Nation urban vector control. Thank you."*
