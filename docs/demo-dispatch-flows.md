# Dispatch demo WebDriver rehearsal

This rehearsal drives the deployed or local D-Fence screens in Microsoft Edge. It uses the Python Selenium WebDriver package pinned in `tools/requirements-webdriver.txt`; Selenium Manager resolves the matching Edge driver using the installed Edge browser.

## Inputs owned by the demo operator

Prepare two private JSON files outside tracked source:

- A manifest containing the IDs of only the DEMO reports, work orders, crew and vehicles created for this rehearsal.
- A credential file with `manager`, `resident` and `crew` objects, each containing `email` and `password`.

The manifest shape is:

```json
{
  "startDate": "YYYY-MM-DD",
  "days": 7,
  "tasks": [{"code":"DEMO-...", "reportId":"...", "orderId":"...", "taskType":"...", "pestType":"...", "scheduledDate":"YYYY-MM-DD", "label":"...", "point":{"latitude":1.3,"longitude":103.8}}],
  "staff": [{"id":"...", "email":"...", "hqLocation":"...", "specialisation":"..."}],
  "vehicles": [{"id":"...", "registration":"...", "hqLocation":"..."}],
  "lifecycleOrderId": "...",
  "lifecycleCrewId": "..."
}
```

`tasks[].orderId`, staff emails and vehicle registrations must match the owned records created through the app's supported APIs. Task labels are readable display names; identifiers and demo fixture prefixes belong in metadata or descriptions. Include the lifecycle order and crew in the owned sets. The runner reads credentials only to fill the sign-in form. It does not print credentials, API tokens, or page contents. Screenshots are taken only after sign-in, and the final browser page is signed out.

## Install and run

Use the task-scoped virtual environment and keep both input files private:

```powershell
python -m venv scratchpad/demo-webdriver-venv
scratchpad/demo-webdriver-venv/Scripts/python -m pip install -r tools/requirements-webdriver.txt
scratchpad/demo-webdriver-venv/Scripts/python tools/demo_webdriver.py `
  --base https://YOUR-DEPLOYMENT `
  --manifest scratchpad/demo-manifest.json `
  --credentials-file scratchpad/demo-credentials.json `
  --out scratchpad/demo-webdriver-results
```

For local rehearsal, use `--base http://localhost:3000`. Add `--headed` to watch the browser. Both `--name value` and `--name=value` are accepted. Results are written under `--out/results.json`; screenshots go in its `screenshots` directory. The process exits non-zero if any flow fails. `--self-check` runs the runner's standard-library argument checks without opening a browser.

## Flows and pass conditions

1. **Manager dispatch horizon.** Sign in through the real form; open Dispatch; select the manifest start date and seven-day horizon. Read the horizon endpoint through the authenticated browser session and read each owned order's current status. Wait for seven completed dated plans with a computed timestamp (ready or refreshing while completed plans remain visible). Assert every active owned task appears once in a daily route or in horizon-unassigned output with a reason. Record Verified orders as settled. Check High/Critical tasks within ordinary route and unplanned cards. Confirm the removed selected-day urgent and external-referral sections are absent. Match each rendered stop card to its task identity, then check its readable label and day. In Horizon unassigned / committed, match owned unassigned cards through metadata and verify each reason. Zoom the map and check retention after two new horizon polls. Record live walking visits and check both directions against the 600-second cap.
2. **Staff and fleet read views.** Open the manager's Staff and Vehicle Registry screens. Assert every manifest-owned demo staff email and vehicle registration is present in the actual DOM. Confirm the vehicle page labels demo vehicles.
3. **Owned work-order lifecycle.** Open the manifest lifecycle order. Assign it to the manifest crew if needed, sign in as that crew, open that exact job through My Jobs, accept and start it, then upload the repository's full-size `hdb-perimeter-drain.jpg` as clearly identified illustrative evidence and submit completion. Sign back in as manager, inspect evidence and verify the order. If a prior run already left the owned order Verified, the runner reports an idempotent replay only after reading that terminal state in the API and manager DOM. If a prior run reached Completed, the runner resumes with manager verification without repeating crew actions. Cancelled or Rejected remains a failure requiring a fresh owned fixture.

The script never creates or searches for records to mutate. It acts only on manifest IDs. A task that is missing from both planned and unassigned horizon output fails; an unassigned item without a reason fails. Route identity and uniqueness checks use the API payload, while the corresponding day route and unassigned reason are checked in rendered DOM.

## Card selector contract (v0.18)

- Use `[data-part="planned-routes"]` for the selected day's route cards and `[data-part="unassigned-tasks"]` for horizon dispositions.
- Use `[data-work-order-id]` and `[data-entity-id]` metadata where present to match owned records. Do not require a raw ID, DEMO prefix or serialised task enum in a title.
- Required task collections use `[data-cards]` / `.dispatch-task-cards`. Reference images must identify themselves as illustrative rather than incident evidence.
- Do not query the removed `[data-part="urgent-task-queue"]` or require a separate urgent/referral list. Verify urgent coverage through the API dispositions and the ordinary rendered cards.
- Authority-response fixtures use recorded `AuthorityResponse` staff capability; generic inspection staff must not appear as eligible. Insufficient crew, vehicle capacity or verified access must leave the task unassigned with a reason.

## Dispatch map interaction contract (v0.19; browser validation pending)

- The Routes view shows selected-day verified routes and matching tasks. Horizon Unassigned / Committed shows horizon disposition pins without executable route lines. Daily Proposals shows selected-day proposal pins without executable route lines.
- Team and Job Type are checkbox groups, initially all selected, with an All control. Multiple selections are supported; no selected values means no matching tasks. These filters apply to the mapped tasks and any matching detail cards.
- Task callouts show pest type, task type, priority, location, photo and assigned team. They use the task identity and do not show generated task-name headings. Unplanned tasks use their serialized `point` coordinates and optional `mapClusterId`. Official proposals use display-only `mapPoint` at the source boundary centroid when geometry exists; source-report `point` stays exact. Missing geometry does not create a pin, and no road access is inferred.
- Photos load only after a task is opened, through the authenticated report and image endpoints. If an incident image is absent or fails, the UI labels its reference fallback. No per-task photo fanout occurs on initial map load.
- Zoom and pan are bounded to the Singapore map extent. Normal page scrolling outside the map remains available. Polling updates preserve zoom and the selected task when its ID remains visible; filtering it away closes the callout.
- Local validation passed: 1,152 tests / 58 SQL skips, typecheck, build and clean package extraction smoke. Browser interaction and deployment checks remain pending.

The updated runner and live rehearsal passed. Dispatch checks atomically compare card metadata with the latest real horizon response consumed by the UI so a background refresh cannot create a stale-element or old-day assertion. Evidence is recorded in scratchpad/unified-ops-20261029/DEPLOYMENT.md.

## Evidence limits

This is a live UI/API rehearsal for the data in the private manifest. The runner does not synthesize a provider-verified short-walk, long-walk rejection, provider outage or disconnected-site case. Such access edge cases must be reported from deterministic local routing tests, separately from live browser results; do not present a real deployment as having demonstrated a walking case unless its own provider response verified that case. The illustrative JPEG is demonstration evidence only and is not a photograph of the work performed at a live site.
