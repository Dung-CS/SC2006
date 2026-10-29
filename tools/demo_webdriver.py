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
    if (url.includes('/api/auth/signin') && response.ok) {
      const session = await response.clone().json();
      window.__demoToken = session.token;
    }
    return response;
  };
  window.__demoGet = async (path) => {
    const response = await nativeFetch(path, {
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

    def screenshot(self, name: str) -> None:
        # Never take or retain a screenshot while a credential form is visible.
        if self.driver.find_elements("css selector", 'input[type="password"]'):
            return
        self.driver.save_screenshot(str(self.shots / f"{name}.png"))

    def get_json(self, path: str) -> dict[str, Any]:
        result = self.driver.execute_async_script(
            "const path=arguments[0], done=arguments[arguments.length-1];"
            "window.__demoWaitGet(path,done);",
            path,
        )
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
            if payload.get("planStatus") == "ready" and len(payload.get("plans", [])) == 7:
                break
            time.sleep(2)
        if not payload or payload.get("planStatus") != "ready" or len(payload.get("plans", [])) != 7:
            raise AssertionError("seven-day horizon did not reach ready state")

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

        for index, plan in enumerate(plans):
            Select(self.driver.find_element(By.ID, "dispatch-day")).select_by_value(plan["date"])
            wait.until(lambda d, day=plan["date"]: day in d.find_element(By.CSS_SELECTOR, '[data-screen="DispatchProposal"] h1').text)
            self.visible('[data-part="planned-routes"]')
            rendered = self.driver.find_element(By.CSS_SELECTOR, '[data-part="planned-routes"]').text
            for route in plan.get("routes", []):
                for waypoint in route.get("waypointOrder", []):
                    order_id = waypoint.get("workOrderId")
                    if order_id and order_id in active_task_ids and waypoint.get("label") and waypoint["label"] not in rendered:
                        raise AssertionError(f"day {index + 1} screen omitted its planned DEMO stop label")
            urgent = self.driver.find_element(By.CSS_SELECTOR, '[data-part="urgent-task-queue"]')
            urgent_rows = urgent.find_elements(By.CSS_SELECTOR, 'li[data-priority="High"], li[data-priority="Critical"]')
            urgent_text = [" ".join(row.text.split()) for row in urgent_rows]
            expected_urgent = []
            for route in plan.get("routes", []):
                for waypoint in route.get("waypointOrder", []):
                    if waypoint.get("isHq") or waypoint.get("priority") not in {"High", "Critical"}:
                        continue
                    if waypoint.get("workOrderId") in settled:
                        continue
                    locality = waypoint.get("locality") or re.sub(r"^Stop\s+\d+:\s*", "", waypoint.get("label", ""))
                    expected_urgent.append((waypoint["priority"], locality))
            for item in payload.get("unassigned", []):
                if item.get("priority") not in {"High", "Critical"}:
                    continue
                if (item.get("scheduledDate") or item.get("date")) not in (None, "", plan["date"]):
                    continue
                expected_urgent.append((item["priority"], item.get("locality") or item.get("workOrderId", "")))
            for priority, locality in expected_urgent:
                if not any(priority in row and locality in row for row in urgent_text):
                    raise AssertionError(f"selected-day urgent queue omitted a {priority} route/unassigned task on day {index + 1}")
            self.screenshot(f"dispatch-day-{index + 1}")

        # The map is a real Leaflet control: explicitly zoom, wait past the 20-second route poll,
        # then confirm the poll did not restore the original viewport.
        map_section = self.driver.find_element(By.CSS_SELECTOR, '[aria-label="Dispatch Route Map"]')
        zoom_in = map_section.find_element(By.CSS_SELECTOR, 'a[title="Zoom in"]')
        pane = self.driver.find_element(By.CSS_SELECTOR, '.leaflet-map-pane')
        before = pane.get_attribute("style")
        zoom_in.click()
        wait.until(lambda d: d.find_element(By.CSS_SELECTOR, '.leaflet-map-pane').get_attribute("style") != before)
        time.sleep(1)  # Let Leaflet finish the zoom animation before capturing viewport state.
        zoomed = self.driver.find_element(By.CSS_SELECTOR, '.leaflet-map-pane').get_attribute("style")
        self.driver.execute_script("performance.clearResourceTimings()")
        before_polls = self.driver.execute_script(
            "return performance.getEntriesByType('resource').filter(e=>e.name.includes('/api/ops/dispatch/horizon')).length"
        )
        wait.until(lambda d: d.execute_script(
            "return performance.getEntriesByType('resource').filter(e=>e.name.includes('/api/ops/dispatch/horizon')).length"
        ) >= before_polls + 2)
        if self.driver.find_element(By.CSS_SELECTOR, '.leaflet-map-pane').get_attribute("style") != zoomed:
            raise AssertionError("map viewport changed during the route refresh poll")
        self.screenshot("dispatch-map-zoom-after-poll")

        self.driver.find_element(By.XPATH, "//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'unassigned / committed')]").click()
        self.visible('[data-part="unassigned-tasks"]')
        unassigned_text = self.driver.find_element(By.CSS_SELECTOR, '[data-part="unassigned-tasks"]').text
        for order_id in active_task_ids & unassigned.keys():
            item = unassigned[order_id]
            if (item.get("locality") or order_id) not in unassigned_text or item["reason"] not in unassigned_text:
                raise AssertionError("the unassigned DOM view did not show a DEMO task and its reason")
        self.screenshot("dispatch-unassigned")
        self.record("manager-seven-day-dispatch", "PASS", f"7 dates; {len(task_ids)} owned orders visible as planned or explained")

    def staff_and_vehicle_views(self) -> None:
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support import expected_conditions as ec
        from selenium.webdriver.support.ui import WebDriverWait

        self.driver.get(self.args.base + "/ops/staff")
        WebDriverWait(self.driver, 30).until(ec.visibility_of_element_located((By.CSS_SELECTOR, '[data-screen="StaffAccounts"]')))
        for staff in self.manifest["staff"]:
            row = self.driver.find_element(By.XPATH, f"//tr[.//*[contains(normalize-space(.), '{staff['email']}')] ]")
            if staff["email"] not in row.text:
                raise AssertionError("manager staff roster omits an owned DEMO account")
            if staff.get("hqLocation"):
                hq_select = row.find_element(By.CSS_SELECTOR, "select.staff-hq-select")
                if hq_select.get_attribute("value") != staff["hqLocation"]:
                    selected = hq_select.find_element(By.CSS_SELECTOR, "option:checked").get_attribute("value")
                    if selected != staff["hqLocation"]:
                        raise AssertionError("DEMO staff account has the wrong HQ in the manager view")
            if staff.get("specialisation"):
                capability = row.find_element(By.CSS_SELECTOR, "select.staff-spec-tag")
                selected = capability.find_element(By.CSS_SELECTOR, "option:checked").get_attribute("value")
                if selected != staff["specialisation"]:
                    raise AssertionError("DEMO staff account has the wrong capability in the manager view")
        self.screenshot("manager-demo-staff")

        self.driver.get(self.args.base + "/ops/vehicles")
        WebDriverWait(self.driver, 30).until(ec.visibility_of_element_located((By.CSS_SELECTOR, '[data-screen="VehicleRegistry"]')))
        body = self.driver.find_element(By.TAG_NAME, "body").text
        hq_labels = {"Central": "Central Regional Office", "NorthEast": "Eastern Regional Office",
                     "NorthWest": "North-West Regional Office", "SouthEast": "South-East Regional Office",
                     "SouthWest": "South-West Regional Office"}
        for vehicle in self.manifest["vehicles"]:
            row = self.driver.find_element(By.XPATH, f"//tr[.//strong[normalize-space()='{vehicle['registration']}']]")
            if vehicle.get("hqLocation") and hq_labels.get(vehicle["hqLocation"], vehicle["hqLocation"]) not in row.text:
                raise AssertionError("DEMO vehicle has the wrong HQ in the manager view")
        if self.manifest["vehicles"] and "Demo vehicle" not in body:
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
                Select(wait.until(ec.presence_of_element_located((By.ID, "crew")))).select_by_value(crew_id)
                self.driver.find_element(By.XPATH, "//button[normalize-space()='Assign']").click()
                wait.until(lambda d: self.get_json(f"/api/ops/work-orders/{order_id}").get("workOrder", {}).get("status") == "Assigned")
            elif status == "Assigned" and detail.get("assigneeId") != crew_id:
                Select(wait.until(ec.presence_of_element_located((By.ID, "crew")))).select_by_value(crew_id)
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
                self.driver.find_element(By.ID, "photo").send_keys(str(photo))
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
        if EDGE.is_file():
            options.binary_location = str(EDGE)
        if not self.args.headed:
            options.add_argument("--headless=new")
        options.add_argument("--window-size=1440,1000")
        options.add_argument("--disable-gpu")
        try:
            self.driver = webdriver.Edge(options=options)
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
                        self.screenshot(f"failure-{flow}")
                        self.record(flow, "FAIL", f"{type(error).__name__}: {str(error).splitlines()[0][:180]}")
            self.record("provider-walking-edge-cases", "SKIP", "not fabricated by live browser run; use deterministic local routing evidence")
        finally:
            try:
                from selenium.webdriver.common.by import By
                if self.driver.find_elements(By.XPATH, "//button[normalize-space()='Sign out']"):
                    self.sign_out()
            except Exception:
                pass
            self.driver.quit()
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
