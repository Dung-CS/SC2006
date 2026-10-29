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

`tasks[].orderId`, `tasks[].label`, staff emails and vehicle registrations must match the owned records created through the app's supported APIs. Include the lifecycle order and crew in the owned sets. The runner reads credentials only to fill the sign-in form. It does not print credentials, API tokens, or page contents. Screenshots are taken only after sign-in, and the final browser page is signed out.

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

1. **Manager dispatch horizon.** Sign in through the real form; open Dispatch; select the manifest start date and seven-day horizon. Read the horizon endpoint through the authenticated browser session and read each owned order's current status. Wait for a ready seven-date response, then assert every active owned task appears in a daily route exactly once or in the global unassigned list with a reason. Already Verified owned orders are recorded explicitly as settled. On each selected date, the actual High/Critical queue is checked against urgent route stops and date-matched unassigned tasks. Planned stop labels must be visible in the matching day's route panel. The Horizon unassigned / committed view must show each owned unassigned item's locality/ID and reason. The map is zoomed and checked after at least two new horizon poll requests to ensure the viewport remains stable. Any provider walking visits in the live plan are recorded and each direction is checked against the 600-second cap.
2. **Staff and fleet read views.** Open the manager's Staff and Vehicle Registry screens. Assert every manifest-owned demo staff email and vehicle registration is present in the actual DOM. Confirm the vehicle page labels demo vehicles.
3. **Owned work-order lifecycle.** Open the manifest lifecycle order. Assign it to the manifest crew if needed, sign in as that crew, open that exact job through My Jobs, accept and start it, then upload the repository's full-size `hdb-perimeter-drain.jpg` as clearly identified illustrative evidence and submit completion. Sign back in as manager, inspect evidence and verify the order. If a prior run already left the owned order Verified, the runner reports an idempotent replay only after reading that terminal state in the API and manager DOM. If a prior run reached Completed, the runner resumes with manager verification without repeating crew actions. Cancelled or Rejected remains a failure requiring a fresh owned fixture.

The script never creates or searches for records to mutate. It acts only on manifest IDs. A task that is missing from both planned and unassigned horizon output fails; an unassigned item without a reason fails. Route identity and uniqueness checks use the API payload, while the corresponding day route and unassigned reason are checked in rendered DOM.

## Evidence limits

This is a live UI/API rehearsal for the data in the private manifest. The runner does not synthesize a provider-verified short-walk, long-walk rejection, provider outage or disconnected-site case. Such access edge cases must be reported from deterministic local routing tests, separately from live browser results; do not present a real deployment as having demonstrated a walking case unless its own provider response verified that case. The illustrative JPEG is demonstration evidence only and is not a photograph of the work performed at a live site.
