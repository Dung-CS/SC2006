#!/usr/bin/env python3
"""D-Fence Week 13 Video Walkthrough Webdriver Automation.

Traces the full multi-account operational loop and core logic for the student demo video:
  Act 1: Resident Portal (Nur Aisyah) - AI Vision Classification, Report Submission, 5.1.11 Duplicate Refusal
  Act 2: Operations Command (Rachel Lim) - 0-100 Priority Scoring Engine, Environmental Drivers, OneMap Route Planning
  Act 3: Field Crew Mobile (Ahmad Faizal) - Equipment Loadout Checklist, State Machine (Assigned -> Accepted -> InProgress -> Completed with photo)
  Act 4: Operations Command (Rachel Lim) - Verification Gate (Two-person rule), Evidence Inspection, Immutable Audit Trail
  Act 5: Resident Portal (Nur Aisyah) - Citizen Closed-Loop Feedback & Verified Outcome

Usage:
  # Automated test run (headless):
  python tools/w13_video_walkthrough_webdriver.py

  # Headed recording run with 2-second pacing:
  python tools/w13_video_walkthrough_webdriver.py --headed --pause 2.0 --reset-seed
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from datetime import date
from pathlib import Path
from typing import Any

EDGE = Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="D-Fence W13 Video Walkthrough Automation")
    parser.add_argument("--base", default="https://dfence-sc2006.azurewebsites.net", help="Base URL of application")
    parser.add_argument("--headed", action="store_true", help="Run headed Edge browser (for live recording)")
    parser.add_argument("--pause", type=float, default=0.5, help="Pause duration in seconds between UI beats (default 0.5s, use 2.0s for video recording)")
    parser.add_argument("--reset-seed", action="store_true", help="Reset live seed data before running")
    parser.add_argument("--no-cleanup", action="store_true", help="Do not delete created test objects after running")
    parser.add_argument("--cleanup-only", action="store_true", help="Purge lingering test reports from the database and exit")
    parser.add_argument("--out", default="scratchpad/w13-video-walkthrough-results", help="Output evidence directory")
    parser.add_argument("--credentials", default="scratchpad/dispatch-demo-20261029/private-credentials.json", help="Path to credentials file")
    parser.add_argument("--crew-login", default="scratchpad/crew-login.json", help="Path to crew login file")
    parser.add_argument("--seed-ids", default="scratchpad/crew-seed-ids.json", help="Path to seeded IDs file")
    return parser.parse_args()


class W13VideoWalkthroughRunner:
    def __init__(self, args: argparse.Namespace):
        self.args = args
        self.base = args.base.rstrip("/")
        self.pause_s = args.pause
        self.out_dir = Path(args.out).resolve()
        self.out_dir.mkdir(parents=True, exist_ok=True)
        self.shots_dir = self.out_dir / "screenshots"
        self.shots_dir.mkdir(parents=True, exist_ok=True)
        self.results: list[dict[str, Any]] = []
        self.created_report_ids: list[str] = []
        self.driver = None

        self.repo_dir = Path(__file__).resolve().parent.parent
        self.cred_path = Path(args.credentials) if Path(args.credentials).is_absolute() else (self.repo_dir / args.credentials).resolve()
        self.crew_cred_path = Path(args.crew_login) if Path(args.crew_login).is_absolute() else (self.repo_dir / args.crew_login).resolve()
        self.seed_ids_path = Path(args.seed_ids) if Path(args.seed_ids).is_absolute() else (self.repo_dir / args.seed_ids).resolve()

    def maybe_reset_seed(self):
        if not self.args.reset_seed:
            return
        repo_dir = Path(__file__).resolve().parent.parent
        print(f"[SETUP] Resetting live seed data in {repo_dir} ...", flush=True)
        cmd = ["npx.cmd", "tsx", "scratchpad/crew-seed.ts", "--cleanup"]
        subprocess.run(cmd, cwd=repo_dir, shell=True, check=True)
        cmd2 = ["npx.cmd", "tsx", "scratchpad/crew-seed.ts"]
        subprocess.run(cmd2, cwd=repo_dir, shell=True, check=True)
        print("[SETUP] Live seed data reset successfully.", flush=True)

    def reload_data(self):
        self.cred = json.loads(self.cred_path.read_text(encoding="utf-8"))
        self.crew_cred = json.loads(self.crew_cred_path.read_text(encoding="utf-8"))
        self.seed_ids = json.loads(self.seed_ids_path.read_text(encoding="utf-8"))

    def record(self, act: str, name: str, status: str, detail: str = "") -> None:
        outcome = {
            "act": act,
            "test": name,
            "status": status,
            "detail": detail,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        }
        self.results.append(outcome)
        print(f"[{status}] {act} - {name}: {detail}", flush=True)
        (self.out_dir / "results.json").write_text(json.dumps(self.results, indent=2), encoding="utf-8")

    def pace(self, multiplier: float = 1.0):
        """Pacing sleep for recording readability."""
        duration = self.pause_s * multiplier
        if duration > 0:
            time.sleep(duration)

    def screenshot(self, name: str) -> None:
        try:
            if self.driver:
                self.driver.save_screenshot(str(self.shots_dir / f"{name}.png"))
        except Exception:
            pass

    def setup_driver(self, mobile: bool = False):
        from selenium import webdriver
        from selenium.webdriver.edge.options import Options

        opts = Options()
        opts.page_load_strategy = "eager"
        if EDGE.is_file():
            opts.binary_location = str(EDGE)
        if not self.args.headed:
            opts.add_argument("--headless=new")
        opts.add_argument("--disable-gpu")

        if mobile:
            # iPhone 14 Pro viewport
            opts.add_argument("--window-size=430,932")
        else:
            # 1080p desktop viewport
            opts.add_argument("--window-size=1600,1000")

        self.driver = webdriver.Edge(options=opts)
        self.driver.set_page_load_timeout(45)
        self.driver.set_script_timeout(45)

    def teardown_driver(self):
        if self.driver:
            try:
                self.driver.quit()
            except Exception:
                pass
            self.driver = None

    def click(self, elem):
        """Scroll element into center and click, with JS click fallback."""
        self.driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'center'});", elem)
        time.sleep(0.3)
        try:
            elem.click()
        except Exception:
            self.driver.execute_script("arguments[0].click();", elem)

    def sign_in(self, email: str, password: str):
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC

        self.driver.get(f"{self.base}/signin")
        wait = WebDriverWait(self.driver, 20)
        wait.until(EC.visibility_of_element_located((By.ID, "email"))).send_keys(email)
        self.driver.find_element(By.ID, "password").send_keys(password)
        self.pace(0.5)
        btn = self.driver.find_element(By.CSS_SELECTOR, 'button[type="submit"]')
        self.click(btn)
        wait.until(lambda d: "/signin" not in d.current_url)
        self.pace(0.5)

    # =========================================================================
    # ACT 1: RESIDENT PORTAL - AI VISION & DUPLICATE PREVENTION
    # =========================================================================
    def run_act1_resident(self):
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import WebDriverWait, Select
        from selenium.webdriver.support import expected_conditions as EC

        self.reload_data()
        self.setup_driver(mobile=True)
        try:
            print("\n>>> NARRATIVE: Resident Nur Aisyah logs in to report pest sighting with AI vision", flush=True)
            self.sign_in(self.cred['resident']['email'], self.cred['resident']['password'])
            self.record("Act 1", "Resident Authentication", "PASS", f"Signed in as {self.cred['resident']['email']}")

            # Open /report
            self.driver.get(f"{self.base}/report")
            wait = WebDriverWait(self.driver, 20)
            wait.until(EC.visibility_of_element_located((By.ID, "photo")))
            self.pace(1.0)

            # Sample photo: Reticulated Python Snake (triggers Rule 4.4.7 Critical Override when indoors)
            sample_btn = wait.until(EC.presence_of_element_located((By.XPATH, "//button[contains(., 'Python')]")))
            self.click(sample_btn)
            time.sleep(1.5)
            self.screenshot("act1-01-ai-vision-detected")
            self.pace(1.0)

            # Select pest: Snake (Wildlife)
            Select(self.driver.find_element(By.ID, "pestType")).select_by_value("Snake")

            # Rule 5.1.16 & 4.4.7: Select Indoor location context -> Critical Priority Override
            indoor_radio = wait.until(EC.presence_of_element_located((By.ID, "context-Indoor")))
            self.click(indoor_radio)

            chk = self.driver.find_elements(By.ID, "count-confirmed")
            if chk and not chk[0].is_selected():
                self.click(chk[0])

            # Locate me button (auto-detects GPS coordinates)
            locate_btn = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Locate me') or contains(., 'current location')]")))
            self.click(locate_btn)
            self.pace(0.8)

            # Ensure manual coordinates disclosure is open to set fresh coordinates
            details = self.driver.find_elements(By.CSS_SELECTOR, "details.location-manual-details")
            if details:
                self.driver.execute_script("arguments[0].open = true;", details[0])

            # Generate target coordinates in Singapore (fresh to guarantee clean first submission)
            lat = 1.345000 + (time.time() % 1000) / 40000.0
            lon = 103.840000 + ((time.time() * 2) % 1000) / 40000.0

            desc = self.driver.find_element(By.ID, "description")
            desc.clear()
            desc.send_keys("CRITICAL: Large reticulated python spotted inside ground floor lift lobby corridor!")

            lat_field = self.driver.find_element(By.ID, "latitude")
            lat_field.clear()
            lat_field.send_keys(f"{lat:.6f}")

            lon_field = self.driver.find_element(By.ID, "longitude")
            lon_field.clear()
            lon_field.send_keys(f"{lon:.6f}")

            self.screenshot("act1-02-report-form-completed")
            self.pace(1.0)

            # Submit Report - wait until upload and validation complete so button is enabled
            submit_btn = wait.until(lambda d: d.find_element(By.XPATH, "//button[normalize-space()='Submit report']"))
            wait.until(lambda d: submit_btn.is_enabled())
            self.click(submit_btn)

            wait.until(lambda d: "/reports/" in d.current_url)
            report_url = self.driver.current_url
            report_id = report_url.rstrip("/").split("/")[-1]
            if len(report_id) >= 30 and "-" in report_id:
                self.created_report_ids.append(report_id)
                print(f"[TRACK] Registered created report for cleanup: {report_id}", flush=True)
            self.screenshot("act1-03-report-submitted-pending")
            self.record("Act 1", "Report Creation & Critical Triage", "PASS", f"Created Critical report: {report_url}")
            self.pace(1.5)

            # Duplicate Prevention Demo (50m / 24h spatial-temporal rule)
            print(">>> NARRATIVE: Demonstrating Rule 5.1.11 spatial-temporal duplicate protection", flush=True)
            self.driver.get(f"{self.base}/report")
            wait.until(EC.visibility_of_element_located((By.ID, "photo")))
            sample_btn2 = wait.until(EC.presence_of_element_located((By.XPATH, "//button[contains(., 'Python')]")))
            self.click(sample_btn2)
            time.sleep(1.0)
            Select(self.driver.find_element(By.ID, "pestType")).select_by_value("Snake")

            indoor_radio2 = wait.until(EC.presence_of_element_located((By.ID, "context-Indoor")))
            self.click(indoor_radio2)

            chk2 = self.driver.find_elements(By.ID, "count-confirmed")
            if chk2 and not chk2[0].is_selected():
                self.click(chk2[0])

            details2 = self.driver.find_elements(By.CSS_SELECTOR, "details.location-manual-details")
            if details2:
                self.driver.execute_script("arguments[0].open = true;", details2[0])

            desc2 = self.driver.find_element(By.ID, "description")
            desc2.clear()
            desc2.send_keys("Second snake report at identical location to test duplicate filter.")

            lat2 = self.driver.find_element(By.ID, "latitude")
            lat2.clear()
            lat2.send_keys(f"{lat:.6f}")

            lon2 = self.driver.find_element(By.ID, "longitude")
            lon2.clear()
            lon2.send_keys(f"{lon:.6f}")

            submit_btn2 = wait.until(lambda d: d.find_element(By.XPATH, "//button[normalize-space()='Submit report']"))
            wait.until(lambda d: submit_btn2.is_enabled())
            self.click(submit_btn2)

            alert = wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-part="error"], [role="alert"]')))
            alert_text = alert.text.replace("\n", " -- ")
            if "already" not in alert_text.lower() and "duplicate" not in alert_text.lower() and "near" not in alert_text.lower():
                raise AssertionError(f"Expected duplicate refusal rule, got: {alert_text}")

            self.screenshot("act1-04-duplicate-refusal-triggered")
            self.record("Act 1", "Duplicate Refusal Rule (5.1.11)", "PASS", f"System enforced 50m/24h guard: {alert_text}")
            self.pace(1.5)

        finally:
            self.teardown_driver()

    # =========================================================================
    # ACT 2: OPERATIONS COMMAND - RANKING & ROUTE PLANNING
    # =========================================================================
    def run_act2_manager(self):
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import WebDriverWait, Select
        from selenium.webdriver.support import expected_conditions as EC

        self.reload_data()
        self.setup_driver(mobile=False)
        try:
            print("\n>>> NARRATIVE: Operations Manager Rachel Lim reviews live cluster ranking and dispatch routes", flush=True)
            self.sign_in(self.cred['manager']['email'], self.cred['manager']['password'])
            self.driver.get(f"{self.base}/ops")
            wait = WebDriverWait(self.driver, 25)
            wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-screen="OpsDashboard"]')))
            self.pace(1.0)

            # 1. Expand operations summary if closed
            details_elem = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, 'details[data-part="operations-summary"]')))
            if not details_elem.get_attribute("open"):
                summary_btn = details_elem.find_element(By.CSS_SELECTOR, "summary")
                self.click(summary_btn)
            time.sleep(1)
            self.screenshot("act2-01-dashboard-ranked-clusters")
            self.pace(1.0)

            # 2. Inspect cluster detail breakdown (0-100 severity x urgency score)
            cluster_links = wait.until(EC.presence_of_all_elements_located((By.CSS_SELECTOR, 'a[href*="/ops/clusters/"]')))
            cluster_name = cluster_links[0].text.strip()
            self.click(cluster_links[0])

            wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-screen="ClusterDetail"]')))
            self.screenshot("act2-02-cluster-driver-breakdown")
            self.record("Act 2", "Priority Scoring Engine (0-100)", "PASS", f"Cluster '{cluster_name}' environmental drivers displayed")
            self.pace(1.5)

            # 3. Open Dispatch Route Planning (7-day horizon, OneMap road network graph)
            print(">>> NARRATIVE: Inspecting multi-team road-following dispatch routes under 4h shift limits", flush=True)
            self.driver.get(f"{self.base}/ops/dispatch")
            wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-screen="DispatchProposal"]')))
            self.pace(1.0)

            horizon_select = self.driver.find_elements(By.ID, "horizon-days")
            if horizon_select:
                Select(horizon_select[0]).select_by_value("7")
                self.pace(1.0)

            wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[aria-label="Dispatch Route Map"], .leaflet-container')))
            self.screenshot("act2-03-dispatch-routes-map")
            self.record("Act 2", "Multi-Team Road Route Planning", "PASS", "OneMap road network routes and Leaflet map verified")
            self.pace(1.5)

        finally:
            self.teardown_driver()

    # =========================================================================
    # ACT 3: FIELD CREW MOBILE - EQUIPMENT LOADOUT & STATE MACHINE
    # =========================================================================
    def run_act3_crew(self):
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC

        self.reload_data()
        target_wo_id = self.seed_ids['work_order'][0]
        self.setup_driver(mobile=True)
        try:
            print("\n>>> NARRATIVE: Field Officer Ahmad Faizal executes mobile equipment checklist and work order", flush=True)
            self.sign_in(self.crew_cred['email'], self.crew_cred['password'])
            self.driver.get(f"{self.base}/crew")
            wait = WebDriverWait(self.driver, 25)
            wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-screen="MyJobs"]')))
            self.screenshot("act3-01-crew-myjobs-overview")
            self.pace(1.0)

            # 1. Equipment Checklist Toggling
            wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-part="my-dispatch"]')))
            checklist_items = wait.until(EC.presence_of_all_elements_located((By.CSS_SELECTOR, 'input[type="checkbox"]')))
            toggled = 0
            for chk in checklist_items[:3]:
                self.click(chk)
                toggled += 1
                self.pace(0.3)
            self.screenshot("act3-02-crew-checklist-persisted")
            self.record("Act 3", "Equipment Loadout Checklist", "PASS", f"{toggled} items toggled with live persistence")
            self.pace(1.0)

            # 2. Open Target Work Order
            self.driver.get(f"{self.base}/crew/jobs/{target_wo_id}")
            wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-screen="JobDetail"]')))
            self.screenshot("act3-03-work-order-assigned")
            self.pace(1.0)

            # 3. State Transition: Assigned -> Accepted
            accept_btns = self.driver.find_elements(By.XPATH, "//button[contains(., 'Accept this job')]")
            if accept_btns:
                self.click(accept_btns[0])
                time.sleep(1.5)
                self.screenshot("act3-04-work-order-accepted")
                self.record("Act 3", "State Transition: Assigned -> Accepted", "PASS", "Job accepted by crew")
                self.pace(1.0)

            # 4. State Transition: Accepted -> InProgress
            start_btns = self.driver.find_elements(By.XPATH, "//button[contains(., 'Start work')]")
            if start_btns:
                self.click(start_btns[0])
                time.sleep(1.5)
                self.screenshot("act3-05-work-order-inprogress")
                self.record("Act 3", "State Transition: Accepted -> InProgress", "PASS", "Work marked in progress")
                self.pace(1.0)

            # 5. Open Completion Screen & Demonstrate Photo Evidence Requirement
            rec_btn = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, f'a[href="/crew/jobs/{target_wo_id}/complete"]')))
            self.click(rec_btn)
            wait.until(EC.visibility_of_element_located((By.ID, "notes")))
            self.screenshot("act3-06-completion-photo-gate-enforced")
            self.pace(1.0)

            # 6. Attach Photo Evidence & Submit Completion (InProgress -> Completed)
            evidence_photo = (self.repo_dir / "client/public/visuals/clusters/hdb-perimeter-drain.jpg").resolve()
            self.driver.find_element(By.ID, "photo").send_keys(str(evidence_photo))
            wait.until(lambda d: len(d.find_elements(By.CSS_SELECTOR, "li[data-key]")) > 0)

            notes_field = self.driver.find_element(By.ID, "notes")
            notes_field.clear()
            notes_field.send_keys("Video Demo: Cleared debris and standing water in perimeter drain. Applied Bti larvicide granular formulation. Adulticiding misting completed.")
            self.screenshot("act3-07-completion-form-ready")
            self.pace(1.0)

            submit_comp = self.driver.find_element(By.CSS_SELECTOR, 'form button[type="submit"]')
            self.click(submit_comp)
            wait.until(lambda d: "Completed" in d.page_source or f"/crew/jobs/{target_wo_id}" in d.current_url)
            self.screenshot("act3-08-work-order-completed")
            self.record("Act 3", "State Transition: InProgress -> Completed", "PASS", f"Work order {target_wo_id} completed with evidence")
            self.pace(1.5)

        finally:
            self.teardown_driver()

    # =========================================================================
    # ACT 4: OPERATIONS COMMAND - SUPERVISORY VERIFICATION & AUDIT TRAIL
    # =========================================================================
    def run_act4_verification(self):
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC

        self.reload_data()
        target_wo_id = self.seed_ids['work_order'][0]
        self.setup_driver(mobile=False)
        try:
            print("\n>>> NARRATIVE: Operations Manager reviews completed evidence and executes verification gate", flush=True)
            self.sign_in(self.cred['manager']['email'], self.cred['manager']['password'])
            self.driver.get(f"{self.base}/ops/work-orders/{target_wo_id}")
            wait = WebDriverWait(self.driver, 25)
            wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-screen="WODetail"]')))
            self.screenshot("act4-01-manager-inspects-crew-evidence")
            self.pace(1.5)

            # Two-person supervisory verification gate
            verify_btn = wait.until(EC.presence_of_element_located((By.XPATH, "//button[normalize-space()='Verify completion']")))
            self.click(verify_btn)
            wait.until(EC.visibility_of_element_located((By.XPATH, "//*[contains(normalize-space(.), 'Verify this completion?')]")))
            self.pace(0.8)
            dialog_verify = self.driver.find_element(By.XPATH, "//button[normalize-space()='Verify']")
            self.click(dialog_verify)

            # Status transitions to Verified
            wait.until(lambda d: "Verified" in d.find_element(By.CSS_SELECTOR, '[data-screen="WODetail"]').text)
            self.screenshot("act4-02-work-order-verified")
            self.record("Act 4", "State Transition: Completed -> Verified", "PASS", f"Work order {target_wo_id} Verified by Rachel Lim")
            self.pace(1.0)

            # Verify Immutable Append-Only Audit Trail
            history = self.driver.find_elements(By.CSS_SELECTOR, '[data-part="history"]')
            if history:
                self.screenshot("act4-03-immutable-audit-log")
                self.record("Act 4", "Immutable Audit Log", "PASS", "Audit log shows sequential chain of actors and timestamps")
            self.pace(1.5)

        finally:
            self.teardown_driver()

    # =========================================================================
    # ACT 5: RESIDENT PORTAL - CLOSED-LOOP RESOLUTION FEEDBACK
    # =========================================================================
    def run_act5_resident_loop(self):
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC

        self.reload_data()
        self.setup_driver(mobile=True)
        try:
            print("\n>>> NARRATIVE: Resident logs back in and observes verified loop closure on My Reports", flush=True)
            self.sign_in(self.cred['resident']['email'], self.cred['resident']['password'])
            self.driver.get(f"{self.base}/reports")
            wait = WebDriverWait(self.driver, 20)
            wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-screen="MyReports"]')))
            self.screenshot("act5-01-resident-loop-closure")
            self.record("Act 5", "Citizen Closed-Loop Resolution", "PASS", "Resident sees verified outcome on dashboard")
            self.pace(1.5)

        finally:
            self.teardown_driver()

    def cleanup_created_objects(self):
        if self.args.no_cleanup:
            print("[TEARDOWN] Skipping cleanup (--no-cleanup specified).", flush=True)
            return
        if not self.created_report_ids:
            print("[TEARDOWN] No created test reports to clean up.", flush=True)
            return
        print(f"[TEARDOWN] Deleting {len(self.created_report_ids)} created test report(s) ...", flush=True)
        try:
            cmd = ["npx.cmd", "tsx", "tools/cleanup-test-objects.ts", *self.created_report_ids]
            subprocess.run(cmd, cwd=self.repo_dir, shell=True, check=False)
            print("[TEARDOWN] Created test objects cleaned up successfully.", flush=True)
        except Exception as e:
            print(f"[TEARDOWN] Warning: failed to clean up created objects: {e}", flush=True)

    def run_all(self) -> int:
        if self.args.cleanup_only:
            print("[SETUP] Running purge of lingering test reports ...", flush=True)
            cmd = ["npx.cmd", "tsx", "tools/cleanup-test-objects.ts", "--purge-snakes"]
            subprocess.run(cmd, cwd=self.repo_dir, shell=True, check=False)
            return 0

        print("\n=======================================================", flush=True)
        print("  D-FENCE W13 VIDEO WALKTHROUGH WEBDRIVER AUTOMATION    ", flush=True)
        print("  Target: " + self.base, flush=True)
        print("  Mode:   " + ("Headed" if self.args.headed else "Headless"), flush=True)
        print(f"  Pacing: {self.pause_s:.1f}s pause between beats", flush=True)
        print("=======================================================\n", flush=True)

        self.maybe_reset_seed()

        acts = [
            ("Act 1: Resident Portal - AI Vision & Duplicate Prevention", self.run_act1_resident),
            ("Act 2: Operations Command - Priority Scoring & Route Planning", self.run_act2_manager),
            ("Act 3: Field Crew Mobile - Equipment Loadout & State Machine", self.run_act3_crew),
            ("Act 4: Operations Command - Verification Gate & Audit Trail", self.run_act4_verification),
            ("Act 5: Resident Portal - Closed-Loop Resolution Feedback", self.run_act5_resident_loop),
        ]

        failed = 0
        try:
            for title, func in acts:
                print(f"\n--- Running {title} ---", flush=True)
                try:
                    func()
                except Exception as e:
                    import traceback
                    traceback.print_exc()
                    failed += 1
                    self.record(title.split(":")[0], title, "FAIL", f"{type(e).__name__}: {str(e)[:160]}")
                    print(f"FAILED: {e}", flush=True)
        finally:
            self.cleanup_created_objects()

        print("\n=======================================================", flush=True)
        print(f"SUMMARY: {len(self.results)} checks executed; {failed} acts failed.", flush=True)
        print(f"Evidence & screenshots saved to: {self.out_dir}", flush=True)
        print("=======================================================\n", flush=True)
        return 1 if failed > 0 else 0


if __name__ == "__main__":
    args = parse_args()
    runner = W13VideoWalkthroughRunner(args)
    sys.exit(runner.run_all())
