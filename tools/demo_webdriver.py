#!/usr/bin/env python3
"""Run browser-visible dispatch demo checks with Selenium and installed Microsoft Edge.

The runner only acts on IDs named in the root-owned demo manifest. It writes screenshots
and a JSON result file beneath --out (both are local demo evidence, not source artefacts).
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import unittest
from datetime import date, timedelta
from pathlib import Path
from typing import Any


EDGE = Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe")
AUTH_CAPTURE = r"""
(() => {
  const nativeFetch = window.fetch.bind(window);
  window.__demoToken = null;
  window.fetch = async (input, init) => {
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init && init.headers ? init.headers : undefined).forEach((value, key) => headers.set(key, value));
    const authorization = headers.get('Authorization');
    if (authorization && authorization.startsWith('Bearer ')) window.__demoToken = authorization.slice(7);
    const response = await nativeFetch(input, init);
    const url = typeof input === 'string' ? input : input.url;
    if (url.includes('/api/ops/dispatch/horizon') && response.ok) {
      window.__demoUiHorizon = await response.clone().json();
    }
    if (url.includes('/api/auth/signin') && response.ok) {
      const session = await response.clone().json();
      window.__demoToken = session.token;
    }
    return response;
  };
  window.__demoGet = async (path) => {
    const response = await nativeFetch(path, {
      signal: AbortSignal.timeout(20000),
      headers: window.__demoToken ? { Authorization: `Bearer ${window.__demoToken}` } : {},
    });
    return { status: response.status, body: await response.json() };
  };
  window.__demoWaitGet = async (path, done) => {
    const deadline = Date.now() + 20000;
    while (!window.__demoToken && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
    if (!window.__demoToken) return done({ status: 0, body: { error: 'authenticated browser session was not restored' } });
    try { done(await window.__demoGet(path)); }
    catch (error) { done({ status: 0, body: { error: String(error) } }); }
  };
})();
"""


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    raw = list(sys.argv[1:] if argv is None else argv)
    values: dict[str, str] = {}
    flags: set[str] = set()
    index = 0
    while index < len(raw):
        item = raw[index]
        if not item.startswith("--"):
            raise ValueError(f"unexpected argument: {item}")
        name, separator, value = item[2:].partition("=")
        if separator:
            values[name] = value
        elif name in {"headed", "self-check"}:
            flags.add(name)
        else:
            if index + 1 >= len(raw):
                raise ValueError(f"--{name} needs a value")
            index += 1
            values[name] = raw[index]
        index += 1

    if "self-check" in flags:
        return argparse.Namespace(self_check=True)
    missing = {"base", "manifest", "credentials-file", "out"} - values.keys()
    if missing:
        raise ValueError("missing arguments: " + ", ".join(f"--{name}" for name in sorted(missing)))
    return argparse.Namespace(
        self_check=False,
        base=values["base"].rstrip("/"),
        manifest=Path(values["manifest"]).resolve(),
        credentials_file=Path(values["credentials-file"]).resolve(),
        out=Path(values["out"]).resolve(),
        headed="headed" in flags,
    )


def load_inputs(manifest_path: Path, credentials_path: Path) -> tuple[dict[str, Any], dict[str, Any]]:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    credentials = json.loads(credentials_path.read_text(encoding="utf-8"))
    required_manifest = {"startDate", "days", "tasks", "staff", "vehicles", "lifecycleOrderId", "lifecycleCrewId"}
    if missing := required_manifest - manifest.keys():
        raise ValueError(f"manifest misses required keys: {', '.join(sorted(missing))}")
    if int(manifest["days"]) != 7:
        raise ValueError("the live horizon rehearsal requires a seven-day manifest")
    if not manifest["tasks"]:
        raise ValueError("manifest has no owned DEMO tasks")
    if len({task.get("orderId") for task in manifest["tasks"]}) != len(manifest["tasks"]):
        raise ValueError("manifest repeats a DEMO work-order ID")
    for task in manifest["tasks"]:
        if not task.get("orderId") or not task.get("label"):
            raise ValueError("each manifest task needs orderId and label")
    for role in ("manager", "resident", "crew"):
        if not isinstance(credentials.get(role), dict) or not credentials[role].get("email") or not credentials[role].get("password"):
            raise ValueError(f"credential file needs {role}.email and {role}.password")
    owned_crew = next((member for member in manifest["staff"] if member.get("id") == manifest["lifecycleCrewId"]), None)
    if owned_crew is None or owned_crew.get("email", "").casefold() != credentials["crew"]["email"].casefold():
        raise ValueError("lifecycleCrewId must identify the crew account in the private credential file")
    return manifest, credentials


class DemoRun:
    def __init__(self, args: argparse.Namespace, manifest: dict[str, Any], credentials: dict[str, Any]):
        self.args, self.manifest, self.credentials = args, manifest, credentials
        self.started_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        self.outcomes: list[dict[str, str]] = []
        self.driver = None
        self.shots = args.out / "screenshots"
        self.shots.mkdir(parents=True, exist_ok=True)

    def record(self, name: str, status: str, detail: str = "") -> None:
        self.outcomes.append({"flow": name, "status": status, **({"detail": detail} if detail else {})})
        (self.args.out / "results.json").write_text(json.dumps({"base": self.args.base, "startedAt": self.started_at, "outcomes": self.outcomes}, indent=2) + "\n", encoding="utf-8")

    def screenshot(self, name: str) -> None:
        # Never take or retain a screenshot while a credential form is visible.
        if self.driver.find_elements("css selector", 'input[type="password"]'):
            return
        self.driver.save_screenshot(str(self.shots / f"{name}.png"))

    def get_json(self, path: str) -> dict[str, Any]:
        for attempt in range(3):
            result = self.driver.execute_async_script(
                "const path=arguments[0], done=arguments[arguments.length-1];"
                "window.__demoWaitGet(path,done);",
                path,
            )
            if result["status"] != 0 or attempt == 2:
                break
            time.sleep(1)
        if result["status"] != 200:
            raise AssertionError(f"API returned HTTP {result['status']} for {path}")
        return result["body"]

    def crew_status(self, order_id: str) -> str:
        body = self.get_json(f"/api/crew/work-orders/{order_id}")
        return str(body.get("workOrder", {}).get("status", ""))

    def sign_in(self, role: str) -> None:
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support import expected_conditions as ec
        from selenium.webdriver.support.ui import WebDriverWait

        self.driver.get(self.args.base + "/signin")
        wait = WebDriverWait(self.driver, 30)
        wait.until(ec.visibility_of_element_located((By.ID, "email"))).send_keys(self.credentials[role]["email"])
        self.driver.find_element(By.ID, "password").send_keys(self.credentials[role]["password"])
        self.driver.find_element(By.CSS_SELECTOR, 'form button[type="submit"]').click()
        wait.until(lambda driver: "/signin" not in driver.current_url)
        wait.until(lambda driver: driver.execute_script("return !!window.__demoToken"))

    def sign_out(self) -> None:
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support import expected_conditions as ec
        from selenium.webdriver.support.ui import WebDriverWait

        WebDriverWait(self.driver, 20).until(ec.element_to_be_clickable((By.XPATH, "//button[normalize-space()='Sign out']"))).click()
        WebDriverWait(self.driver, 20).until(lambda d: not d.find_elements(By.XPATH, "//button[normalize-space()='Sign out']"))

    def visible(self, selector: str, text: str | None = None) -> None:
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support import expected_conditions as ec
        from selenium.webdriver.support.ui import WebDriverWait

        element = WebDriverWait(self.driver, 30).until(ec.visibility_of_element_located((By.CSS_SELECTOR, selector)))
        if text and text not in element.text:
            raise AssertionError(f"visible {selector} did not include expected demo label")

    def dispatch_horizon(self) -> None:
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support import expected_conditions as ec
        from selenium.webdriver.support.ui import Select, WebDriverWait

        self.driver.get(self.args.base + "/ops/dispatch")
        wait = WebDriverWait(self.driver, 30)
        wait.until(ec.visibility_of_element_located((By.CSS_SELECTOR, '[data-screen="DispatchProposal"]')))
        days = Select(wait.until(ec.presence_of_element_located((By.ID, "horizon-days"))))
        days.select_by_value("7")
        start = self.manifest["startDate"]
        date_input = self.driver.find_element(By.ID, "date")
        self.driver.execute_script(
            "Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(arguments[0],arguments[1]); "
            "arguments[0].dispatchEvent(new Event('input',{bubbles:true})); "
            "arguments[0].dispatchEvent(new Event('change',{bubbles:true}));",
            date_input,
            start,
        )

        end = date.fromisoformat(start) + timedelta(days=6)
        payload = None
        deadline = time.monotonic() + 480
        next_progress = time.monotonic()
        while time.monotonic() < deadline:
            payload = self.get_json(f"/api/ops/dispatch/horizon?date={start}&days=7")
            if time.monotonic() >= next_progress:
                ready_days = sum(plan.get("planStatus") == "ready" for plan in payload.get("plans", []))
                print(f"Waiting for horizon: {payload.get('planStatus')}; {ready_days}/7 days ready", flush=True)
                next_progress = time.monotonic() + 30
            complete = len(payload.get("plans", [])) == 7 and all(plan.get("planStatus") == "ready" for plan in payload["plans"])
            if payload.get("planStatus") in {"ready", "refreshing"} and payload.get("computedAt") and complete:
                break
            time.sleep(2)
        if not payload or payload.get("planStatus") not in {"ready", "refreshing"} or not payload.get("computedAt") or len(payload.get("plans", [])) != 7 or not all(plan.get("planStatus") == "ready" for plan in payload["plans"]):
            raise AssertionError("seven-day horizon did not reach ready state")

        if payload.get("referrals") or any(day.get("referrals") for day in payload.get("plans", [])):
            raise AssertionError("authority-only referrals still exclude jobs from unified dispatch")
        plans = payload["plans"]
        expected_days = [(date.fromisoformat(start) + timedelta(days=offset)).isoformat() for offset in range(7)]
        if [plan["date"] for plan in plans] != expected_days or plans[-1]["date"] != end.isoformat():
            raise AssertionError("horizon dates do not cover seven consecutive calendar days")

        task_ids = {task["orderId"] for task in self.manifest["tasks"]}
        owned_orders = {order_id: self.get_json(f"/api/ops/work-orders/{order_id}").get("workOrder", {})
                        for order_id in task_ids}
        settled = {order_id for order_id, order in owned_orders.items() if order.get("status") == "Verified"}
        active_task_ids = task_ids - settled

        scheduled: dict[str, list[str]] = {}
        for plan in plans:
            for route in plan.get("routes", []):
                for order_id in route.get("workOrderIds", []):
                    scheduled.setdefault(order_id, []).append(plan["date"])
        for order_id, dates in scheduled.items():
            if len(dates) != 1:
                raise AssertionError(f"work order appears more than once in horizon: {order_id}")

        unassigned = {item.get("workOrderId"): item for item in payload.get("unassigned", [])}
        if len(unassigned) != len(payload.get("unassigned", [])):
            raise AssertionError("an unassigned task appears more than once in the horizon")
        for order_id in active_task_ids:
            if order_id not in scheduled and order_id not in unassigned:
                raise AssertionError(f"owned DEMO task is missing from all seven plans and reasons: {order_id}")
            if order_id in scheduled and order_id in unassigned:
                raise AssertionError(f"owned DEMO task is both planned and unassigned: {order_id}")
            if order_id in unassigned and not str(unassigned[order_id].get("reason", "")).strip():
                raise AssertionError(f"unassigned DEMO task has no explanation: {order_id}")

        former = self.manifest.get("formerAuthorityTasks", [])
        if former:
            planned_sources = set()
            unassigned_sources = set()
            authority_routes = []
            for day in plans:
                for route in day.get("routes", []):
                    if "AuthorityResponse" in route.get("teamId", ""):
                        authority_routes.append(route)
                    for waypoint in route.get("waypointOrder", []):
                        if waypoint.get("sourceReportId"):
                            planned_sources.add(waypoint["sourceReportId"])
                        planned_sources.update(waypoint.get("reportIds", []))
            for item in payload.get("unassigned", []):
                if item.get("sourceReportId"):
                    unassigned_sources.add(item["sourceReportId"])
                unassigned_sources.update(item.get("reportIds", []))
            for task in former:
                report_id = task.get("sourceReportId")
                if report_id and report_id not in planned_sources | unassigned_sources:
                    raise AssertionError("formerly external-authority report is absent from ordinary dispatch dispositions")
            if not authority_routes:
                raise AssertionError("no qualified authority-response route was produced")
            self.record("unified-authority-dispatch", "PASS", f"{len(former)} former authority tasks covered; {len(authority_routes)} qualified daily response routes")

        if settled:
            self.record("settled-demo-orders", "PASS", f"already Verified and absent from new allocation: {', '.join(sorted(settled))}")

        walking_visits = []
        for plan in plans:
            for route in plan.get("routes", []):
                for visit in route.get("route", {}).get("walkingVisits", []):
                    outbound = visit.get("outbound", {}).get("durationSeconds")
                    returning = visit.get("return", {}).get("durationSeconds")
                    if not isinstance(outbound, (int, float)) or not isinstance(returning, (int, float)):
                        raise AssertionError("live walking access visit lacks both directional durations")
                    for leg_name in ("outbound", "return"):
                        leg = visit[leg_name]
                        if leg.get("source") != "onemap" or leg.get("mode") != "walk":
                            raise AssertionError("live walking access leg is not labelled as OneMap walking evidence")
                    if outbound > 600 or returning > 600:
                        raise AssertionError("live walking access leg exceeds the ten-minute one-way cap")
                    walking_visits.append((outbound, returning))
        if walking_visits:
            self.record("provider-walking-access", "PASS", f"live plan returned {len(walking_visits)} verified walking visit(s); both directions are within 600 seconds")
        else:
            self.record("provider-walking-access", "SKIP", "no walking visit was present in this live plan; do not infer a walking case")

        self.driver.find_element(By.XPATH, "//button[contains(., 'Planned Multi-Team Routes')]").click()
        for index, plan in enumerate(plans):
            Select(self.driver.find_element(By.ID, "dispatch-day")).select_by_value(plan["date"])
            wait.until(lambda d, day=plan["date"]: day in d.find_element(By.CSS_SELECTOR, '[data-screen="DispatchProposal"] h1').text)
            self.visible('[data-part="planned-routes"]')
            if self.driver.find_elements(By.CSS_SELECTOR, '[data-part="urgent-task-queue"]'):
                raise AssertionError("removed selected-day urgent text block is still present")
            if "Urgent referrals requiring external authority" in self.driver.find_element(By.TAG_NAME, "body").text:
                raise AssertionError("removed external referral text block is still present")
            # Compare against the latest real response consumed by the UI: a live refresh
            # may legitimately move a carried task to an earlier day while this flow runs.
            def day_matches_live_response(driver):
                snapshot = driver.execute_script("""
                  const plan=window.__demoUiHorizon?.plans.find(p=>p.date===arguments[0]);
                  const cards=[...document.querySelectorAll('[data-part="planned-routes"] article[data-team] [data-work-order-id]')].map(c=>({
                    id:c.dataset.workOrderId, priority:c.dataset.priority, title:c.querySelector('strong')?.textContent||'',
                    images:[...c.querySelectorAll('img')].map(i=>i.complete&&i.naturalWidth>1)
                  }));
                  return {plan:plan||null,cards};
                """, plan["date"])
                current = snapshot["plan"]
                if not current:
                    return False
                expected = {job for route in current.get("routes", []) for job in route.get("workOrderIds", [])}
                actual = {card["id"] for card in snapshot["cards"]}
                if expected != actual:
                    return False
                return snapshot if all(card["images"] and all(card["images"]) for card in snapshot["cards"]) else False
            current = wait.until(day_matches_live_response)
            priorities = {waypoint["workOrderId"]: waypoint.get("priority") for route in current["plan"].get("routes", [])
                          for waypoint in route.get("waypointOrder", []) if waypoint.get("workOrderId")}
            for card in current["cards"]:
                if priorities.get(card["id"]) and card["priority"] != priorities[card["id"]]:
                    raise AssertionError("selected-day task card has the wrong priority")
                if re.search(r"\bDEMO\b|20261029|[0-9a-f]{8}-[0-9a-f-]{20,}", card["title"], re.I):
                    raise AssertionError("selected-day task title exposes a fixture marker or opaque identifier")
            self.screenshot(f"dispatch-day-{index + 1}")

        # The map is a real Leaflet control: explicitly zoom, wait past the 20-second route poll,
        # then confirm the poll did not restore the original viewport.
        map_section = self.driver.find_element(By.CSS_SELECTOR, '[aria-label="Dispatch Route Map"]')
        zoom_in = map_section.find_element(By.CSS_SELECTOR, 'a[title="Zoom in"]')
        def viewport() -> dict[str, str]:
            return self.driver.execute_script("""
              const root=document.querySelector('[aria-label="Dispatch Route Map"]');
              const path=root.querySelector('svg path.leaflet-interactive');
              return {pane:root.querySelector('.leaflet-map-pane').getAttribute('style'), shape:path?.getAttribute('d')||''};
            """)
        before = viewport()
        if not before["shape"]:
            raise AssertionError("selected-day map has no rendered route geometry to verify zoom")
        zoom_in.click()
        wait.until(lambda d: viewport()["shape"] != before["shape"])
        time.sleep(1)
        zoomed = viewport()
        self.driver.execute_script("performance.clearResourceTimings()")
        wait.until(lambda d: d.execute_script(
            "return performance.getEntriesByType('resource').filter(e=>e.name.includes('/api/ops/dispatch/horizon')).length"
        ) >= 2)
        if viewport() != zoomed:
            raise AssertionError("map viewport changed during the route refresh poll")
        self.screenshot("dispatch-map-zoom-after-poll")

        self.driver.find_element(By.XPATH, "//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'unassigned / committed')]").click()
        self.visible('[data-part="unassigned-tasks"]')
        def unassigned_matches_live_response(driver):
            snapshot = driver.execute_script("""
              return {tasks:window.__demoUiHorizon?.unassigned||[], cards:[...document.querySelectorAll('[data-part="unassigned-tasks"] [data-work-order-id]')].map(c=>({id:c.dataset.workOrderId,text:c.textContent}))};
            """)
            actual = {card["id"]: card["text"] for card in snapshot["cards"]}
            return snapshot if all(task["workOrderId"] in actual and task["reason"] in actual[task["workOrderId"]] for task in snapshot["tasks"]) else False
        wait.until(unassigned_matches_live_response)
        details = self.driver.find_elements(By.CSS_SELECTOR, '[data-part="unassigned-tasks"] details:not([open]) summary')
        if details:
            details[0].click()
            wait.until(lambda d: d.find_elements(By.CSS_SELECTOR, '[data-part="unassigned-tasks"] details[open] p'))
        self.driver.find_element(By.CSS_SELECTOR, '[data-part="unassigned-tasks"]').location_once_scrolled_into_view
        self.screenshot("dispatch-unassigned")
        self.record("manager-seven-day-dispatch", "PASS", f"7 completed dates; {len(task_ids)} owned orders visible as planned or explained; snapshot state {payload['planStatus']}")

    def staff_and_vehicle_views(self) -> None:
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support import expected_conditions as ec
        from selenium.webdriver.support.ui import WebDriverWait

        self.driver.get(self.args.base + "/ops/staff")
        WebDriverWait(self.driver, 30).until(ec.visibility_of_element_located((By.CSS_SELECTOR, '[data-screen="StaffAccounts"]')))
        remaining = {staff["email"]: staff for staff in self.manifest["staff"]}
        WebDriverWait(self.driver, 30).until(lambda d: d.find_elements(By.CSS_SELECTOR, '[data-part="staff-cards"] > [data-entity-id]'))
        for page in range(100):
            rows = self.driver.find_elements(By.CSS_SELECTOR, '[data-part="staff-cards"] > [data-entity-id]')
            for row in rows:
                row_text = row.text
                for email, staff in list(remaining.items()):
                    if email not in row_text:
                        continue
                    if staff.get("hqLocation"):
                        selected = row.find_element(By.CSS_SELECTOR, "select.staff-hq-select option:checked").get_attribute("value")
                        if selected != staff["hqLocation"]:
                            raise AssertionError("DEMO staff account has the wrong HQ in the manager view")
                    if staff.get("specialisation"):
                        selected = row.find_element(By.CSS_SELECTOR, "select.staff-spec-tag option:checked").get_attribute("value")
                        if selected != staff["specialisation"]:
                            raise AssertionError("DEMO staff account has the wrong capability in the manager view")
                    title = row.find_element(By.CSS_SELECTOR, '[data-part="entity-title"]').text
                    if re.search(r"\bDEMO\b|20261029|[0-9a-f]{8}-[0-9a-f-]{20,}", title, re.I):
                        raise AssertionError("staff title exposes a fixture or identifier")
                    image = row.find_element(By.CSS_SELECTOR, 'img')
                    WebDriverWait(self.driver, 30).until(lambda d, img=image: d.execute_script("return arguments[0].complete && arguments[0].naturalWidth>1", img))
                    del remaining[email]
            if not remaining:
                break
            next_buttons = self.driver.find_elements(By.CSS_SELECTOR, 'button[aria-label="Go to next page"]')
            if not next_buttons or not next_buttons[0].is_enabled():
                raise AssertionError(f"manager staff pages omit {len(remaining)} owned DEMO accounts")
            first = rows[0]
            next_buttons[0].click()
            WebDriverWait(self.driver, 30).until(ec.staleness_of(first))
        if remaining:
            raise AssertionError("staff pagination exceeded the rehearsal bound")
        self.driver.find_element(By.CSS_SELECTOR, '[data-part="staff-cards"]').screenshot(str(self.shots / "manager-staff-cards.png"))
        self.screenshot("manager-demo-staff")

        self.driver.get(self.args.base + "/ops/vehicles")
        WebDriverWait(self.driver, 30).until(ec.visibility_of_element_located((By.CSS_SELECTOR, '[data-screen="VehicleRegistry"]')))
        hq_labels = {"Central": "Central Regional Office", "NorthEast": "Eastern Regional Office",
                     "NorthWest": "North-West Regional Office", "SouthEast": "South-East Regional Office",
                     "SouthWest": "South-West Regional Office"}
        for vehicle in self.manifest["vehicles"]:
            row = WebDriverWait(self.driver, 30).until(ec.visibility_of_element_located((By.CSS_SELECTOR, f'[data-part="vehicle-cards"] > [data-entity-id="{vehicle["id"]}"]')))
            if row.get_attribute("data-registration") != vehicle["registration"]:
                raise AssertionError("vehicle identity metadata was lost")
            if vehicle.get("hqLocation") and vehicle["hqLocation"] != row.get_attribute("data-hq"):
                raise AssertionError("owned vehicle has the wrong HQ in the manager view")
            title = row.find_element(By.CSS_SELECTOR, '[data-part="entity-title"]').text
            if re.search(r"\bDEMO\b|20261029|[0-9a-f]{8}-[0-9a-f-]{20,}", title, re.I):
                raise AssertionError("vehicle title exposes a fixture or identifier")
            image = row.find_element(By.CSS_SELECTOR, 'img')
            WebDriverWait(self.driver, 30).until(lambda d, img=image: d.execute_script("return arguments[0].complete && arguments[0].naturalWidth>1", img))
        if self.manifest["vehicles"] and "Demo vehicle" not in self.driver.find_element(By.TAG_NAME, "body").text:
            raise AssertionError("DEMO fleet rows are not visibly labelled")
        self.screenshot("manager-demo-vehicles")
        self.record("manager-staff-and-fleet-views", "PASS", "owned DEMO staff and vehicles shown in manager screens")

    def lifecycle(self) -> None:
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support import expected_conditions as ec
        from selenium.webdriver.support.ui import Select, WebDriverWait

        order_id = self.manifest["lifecycleOrderId"]
        crew_id = self.manifest["lifecycleCrewId"]
        detail = self.get_json(f"/api/ops/work-orders/{order_id}").get("workOrder", {})
        status = detail.get("status") or detail.get("currentStatus")
        if status == "Verified":
            self.driver.get(self.args.base + f"/ops/work-orders/{order_id}")
            self.visible('[data-screen="WODetail"]')
            WebDriverWait(self.driver, 30).until(ec.text_to_be_present_in_element((By.CSS_SELECTOR, '[data-screen="WODetail"]'), 'Verified'))
            if "Verified" not in self.driver.find_element(By.CSS_SELECTOR, '[data-screen="WODetail"]').text:
                raise AssertionError("manager screen did not show the owned order's Verified state")
            self.record("demo-order-lifecycle", "PASS", "idempotent replay: manager UI/API confirmed owned order is already Verified")
            return
        if status in {"Cancelled", "Rejected"}:
            raise AssertionError(f"owned lifecycle order is terminal or blocked at {status}; new owned fixture required")
        if status in {"Accepted", "InProgress"} and detail.get("assigneeId") != crew_id:
            raise AssertionError("partly completed lifecycle order belongs to another crew; refusing to act as a different account")

        wait = WebDriverWait(self.driver, 30)
        resumed_completed = status == "Completed"
        if not resumed_completed:
            self.driver.get(self.args.base + f"/ops/work-orders/{order_id}")
            wait.until(ec.visibility_of_element_located((By.CSS_SELECTOR, '[data-screen="WODetail"]')))
            if status in {"Created", "Pending"}:
                wait.until(ec.presence_of_element_located((By.CSS_SELECTOR, f'#crew option[value="{crew_id}"]')))
                Select(self.driver.find_element(By.ID, "crew")).select_by_value(crew_id)
                self.driver.find_element(By.XPATH, "//button[normalize-space()='Assign']").click()
                wait.until(lambda d: self.get_json(f"/api/ops/work-orders/{order_id}").get("workOrder", {}).get("status") == "Assigned")
            elif status == "Assigned" and detail.get("assigneeId") != crew_id:
                wait.until(ec.presence_of_element_located((By.CSS_SELECTOR, f'#crew option[value="{crew_id}"]')))
                Select(self.driver.find_element(By.ID, "crew")).select_by_value(crew_id)
                self.driver.find_element(By.XPATH, "//button[normalize-space()='Reassign']").click()
                wait.until(lambda d: self.get_json(f"/api/ops/work-orders/{order_id}").get("workOrder", {}).get("assigneeId") == crew_id)

            self.screenshot("manager-lifecycle-assigned")
            self.sign_out()
            self.sign_in("crew")
            self.driver.get(self.args.base + "/crew")
            wait.until(ec.visibility_of_element_located((By.CSS_SELECTOR, '[data-screen="MyJobs"]')))
            link = wait.until(ec.element_to_be_clickable((By.CSS_SELECTOR, f'a[href="/crew/jobs/{order_id}"]')))
            link.click()
            wait.until(ec.visibility_of_element_located((By.CSS_SELECTOR, '[data-screen="JobDetail"]')))
            status = self.crew_status(order_id)
            if status == "Assigned":
                self.driver.find_element(By.XPATH, "//button[normalize-space()='Accept this job']").click()
                wait.until(lambda d: self.crew_status(order_id) == "Accepted")
                status = "Accepted"
            if status == "Accepted":
                self.driver.find_element(By.XPATH, "//button[normalize-space()='Start work']").click()
                wait.until(lambda d: self.crew_status(order_id) == "InProgress")
                status = "InProgress"
            if status == "InProgress":
                self.driver.find_element(By.LINK_TEXT, "Record completion").click()
                wait.until(ec.visibility_of_element_located((By.CSS_SELECTOR, '[data-screen="JobCompletion"]')))
                photo = Path(__file__).resolve().parents[1] / "client/public/visuals/clusters/hdb-perimeter-drain.jpg"
                if not photo.is_file() or photo.stat().st_size < 10_000:
                    raise AssertionError("known illustrative DEMO evidence image is missing or unexpectedly small")
                wait.until(ec.presence_of_element_located((By.ID, "photo"))).send_keys(str(photo))
                wait.until(lambda d: len(d.find_elements(By.CSS_SELECTOR, 'li[data-key]')) > 0)
                self.driver.find_element(By.ID, "notes").send_keys("DEMO rehearsal: illustrative reference photograph, not a live site record.")
                self.driver.find_element(By.XPATH, "//button[normalize-space()='Submit completion']").click()
                wait.until(lambda d: self.crew_status(order_id) == "Completed")
                self.screenshot("crew-demo-completion")

        if not resumed_completed:
            self.sign_out()
            self.sign_in("manager")
        self.driver.get(self.args.base + f"/ops/work-orders/{order_id}")
        wait.until(ec.visibility_of_element_located((By.CSS_SELECTOR, '[data-screen="WODetail"]')))
        status = self.get_json(f"/api/ops/work-orders/{order_id}").get("workOrder", {}).get("status")
        if status == "Completed":
            self.driver.find_element(By.XPATH, "//button[normalize-space()='Verify completion']").click()
            wait.until(ec.visibility_of_element_located((By.XPATH, "//*[contains(normalize-space(.), 'Verify this completion?')]")))
            self.driver.find_element(By.XPATH, "//button[normalize-space()='Verify']").click()
            wait.until(lambda d: self.get_json(f"/api/ops/work-orders/{order_id}").get("workOrder", {}).get("status") == "Verified")
        if self.get_json(f"/api/ops/work-orders/{order_id}").get("workOrder", {}).get("status") != "Verified":
            raise AssertionError("manager UI did not verify the owned lifecycle order")
        self.visible('[data-part="evidence"]')
        self.screenshot("manager-demo-verified")
        detail_text = "manager verified an order resumed from Completed" if status == "Completed" else "manager assignment, crew accept/start/evidence completion, manager verification"
        self.record("demo-order-lifecycle", "PASS", detail_text)

    def run(self) -> int:
        from selenium import webdriver
        from selenium.webdriver.edge.options import Options

        options = Options()
        options.page_load_strategy = "eager"
        if EDGE.is_file():
            options.binary_location = str(EDGE)
        if not self.args.headed:
            options.add_argument("--headless=new")
        options.add_argument("--window-size=1440,1000")
        options.add_argument("--disable-gpu")
        try:
            self.driver = webdriver.Edge(options=options)
            self.driver.set_page_load_timeout(45)
            self.driver.set_script_timeout(45)
        except Exception as error:
            self.record("webdriver-start", "FAIL", f"{type(error).__name__}: {str(error).splitlines()[0][:180]}")
            return self.finish()
        try:
            try:
                self.driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {"source": AUTH_CAPTURE})
                self.sign_in("manager")
            except Exception as error:
                self.record("manager-sign-in", "FAIL", f"{type(error).__name__}: {str(error).splitlines()[0][:180]}")
                for flow in ("manager-seven-day-dispatch", "manager-staff-and-fleet-views", "demo-order-lifecycle"):
                    self.record(flow, "SKIP", "manager sign-in did not complete")
            else:
                for flow, action in (("manager-seven-day-dispatch", self.dispatch_horizon),
                                     ("manager-staff-and-fleet-views", self.staff_and_vehicle_views),
                                     ("demo-order-lifecycle", self.lifecycle)):
                    try:
                        action()
                    except Exception as error:  # Record useful failure class, never page bodies/tokens.
                        self.record(flow, "FAIL", f"{type(error).__name__}: {str(error).splitlines()[0][:180]}")
                        try:
                            self.screenshot(f"failure-{flow}")
                        except Exception:
                            pass
            self.record("provider-walking-edge-cases", "SKIP", "not fabricated by live browser run; use deterministic local routing evidence")
        finally:
            try:
                from selenium.webdriver.common.by import By
                if self.driver.find_elements(By.XPATH, "//button[normalize-space()='Sign out']"):
                    self.sign_out()
            except Exception:
                pass
            try:
                self.driver.quit()
            except Exception:
                pass
        return self.finish()

    def finish(self) -> int:
        result = {"base": self.args.base, "startedAt": self.started_at, "outcomes": self.outcomes}
        (self.args.out / "results.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
        for outcome in self.outcomes:
            print(f"{outcome['status']} {outcome['flow']}: {outcome.get('detail', '')}")
        return 1 if any(row["status"] == "FAIL" for row in self.outcomes) else 0


class RunnerChecks(unittest.TestCase):
    def test_flag_and_equal_argument_forms(self) -> None:
        args = parse_args(["--base=https://example.test", "--manifest", "m.json", "--credentials-file=c.json", "--out", "out", "--headed"])
        self.assertEqual(args.base, "https://example.test")
        self.assertTrue(args.headed)

    def test_rejects_unexpected_arguments(self) -> None:
        with self.assertRaises(ValueError):
            parse_args(["--nonsense"])


def main() -> int:
    try:
        args = parse_args()
        if args.self_check:
            suite = unittest.defaultTestLoader.loadTestsFromTestCase(RunnerChecks)
            return 0 if unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful() else 1
        manifest, credentials = load_inputs(args.manifest, args.credentials_file)
        args.out.mkdir(parents=True, exist_ok=True)
        return DemoRun(args, manifest, credentials).run()
    except Exception as error:
        print(f"FAIL demo-webdriver: {type(error).__name__}: {str(error).splitlines()[0][:180]}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
