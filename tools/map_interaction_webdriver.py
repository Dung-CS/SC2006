#!/usr/bin/env python3
"""Read-only dispatch map UI checks. Uses demo_webdriver's private input/auth helpers.

python tools/map_interaction_webdriver.py --base URL --manifest FILE \
  --credentials-file PRIVATE_FILE --out EVIDENCE_DIR [--headed]
python tools/map_interaction_webdriver.py --self-check

Only login and local view/filter/map controls are used. No job or fixture mutations.
"""
from __future__ import annotations

import time
import unittest

from demo_webdriver import AUTH_CAPTURE, EDGE, DemoRun, load_inputs, parse_args


MAP = '[data-part="dispatch-routes-map"]'
CANVAS = MAP + ' .map-canvas'
PINS = MAP + ' .route-stop-pin[data-task-id]'
CALLOUT = MAP + ' [data-part="task-callout"]'
CAPTURE = AUTH_CAPTURE + r"""
(() => {
  const previous = window.fetch.bind(window);
  window.__mapHorizonPolls = 0;
  window.fetch = async (input, init) => {
    const response = await previous(input, init);
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (response.ok && url.pathname === '/api/ops/dispatch/horizon') window.__mapHorizonPolls++;
    if (response.ok && url.pathname === '/api/ops/dispatch') {
      window.__mapProposalSnapshot = {date:url.searchParams.get('date'), body:await response.clone().json()};
    }
    return response;
  };
})();
"""

SNAPSHOT = r"""
const root=document.querySelector('[data-part="dispatch-routes-map"]');
const canvas=root?.querySelector('.map-canvas');
const checked=(name)=>[...document.querySelectorAll(`[data-filter="${name}"] input[value]:checked`)].map(i=>i.value);
const teams=checked('team'), types=checked('job-type');
const accepts=(team,type)=>teams.includes(team||'__unassigned')&&types.includes(type||'__unknown');
const located=p=>p&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude);
const day=document.querySelector('#dispatch-day')?.value;
const active=[...document.querySelectorAll('[data-part="dispatch-tabs"] button')].findIndex(b=>b.getAttribute('aria-pressed')==='true');
const horizon=window.__demoUiHorizon;
const plan=horizon?.plans?.find(p=>p.date===day);
let expected=[], expectedLines=0;
if(active===0){
  for(const route of plan?.routes||[]){
    if(route.route?.source!=='onemap')continue;
    if(!(route.waypointOrder||[]).some(w=>!w.isHq&&accepts(route.teamId,w.taskType)))continue;
    if((route.route?.coordinates||[]).length>=2)expectedLines++;
    for(const visit of route.route?.walkingVisits||[])
      for(const leg of [visit.outbound,visit.return])if((leg?.coordinates||[]).length>=2)expectedLines++;
    (route.waypointOrder||[]).forEach((w,i)=>{
      if(!w.isHq&&w.status!=='Completed'&&accepts(route.teamId,w.taskType)&&located(w.targetPoint||w.point))
        expected.push(w.workOrderId||`${day}:${route.teamId}:${i}`);
    });
  }
}else if(active===1){
  expected=(horizon?.unassigned||[]).filter(w=>accepts(w.teamId,w.taskType)&&located(w.point)).map(w=>w.workOrderId);
}else{
  const proposalTeam=p=>{
    const mapId=p.mapClusterId||(p.sourceReportId?`pest-${p.sourceReportId}`:p.clusterId);
    const teams=(plan?.routes||[]).filter(r=>(r.waypointOrder||[]).some(w=>!w.isHq&&w.taskType===p.suggestedTaskType&&
      (p.sourceReportId&&w.sourceReportId===p.sourceReportId||(w.mapClusterId||w.clusterId)===mapId))).map(r=>r.teamId);
    return new Set(teams).size===1?teams[0]:undefined;
  };
  expected=(window.__mapProposalSnapshot?.body.proposals||[])
    .filter(p=>accepts(proposalTeam(p),p.suggestedTaskType)&&located(p.point||p.mapPoint))
    .map(p=>`proposal:${p.sourceReportId||p.clusterId}:${p.pestType||'Mosquito'}`);
}
return {active,day,expected,expectedLines,
  actual:[...root.querySelectorAll('.route-stop-pin[data-task-id]')].map(e=>e.dataset.taskId),
  lines:root.querySelectorAll('svg path.leaflet-interactive').length,
  zoom:Number(canvas?.dataset.mapZoom),minZoom:Number(canvas?.dataset.mapMinZoom),
  latitude:Number(canvas?.dataset.mapLatitude),longitude:Number(canvas?.dataset.mapLongitude),
  polls:window.__mapHorizonPolls||0,
  popup:root.querySelector('[data-part="task-callout"]')?.dataset.taskId||null,
  ready:!!plan&&!!window.__mapProposalSnapshot&&window.__mapProposalSnapshot.date===day,
  overflow:document.documentElement.scrollWidth>window.innerWidth+1};
"""


def matching(snapshot: dict) -> bool:
    return bool(snapshot.get('ready')) and sorted(snapshot['actual']) == sorted(snapshot['expected']) and snapshot['lines'] == snapshot['expectedLines']


def assert_bounds(snapshot: dict) -> None:
    if snapshot['zoom'] < snapshot['minZoom']:
        raise AssertionError('zoom escaped minimum')
    if not (1.15 <= snapshot['latitude'] <= 1.51 and 103.55 <= snapshot['longitude'] <= 104.14):
        raise AssertionError('map centre escaped Singapore envelope')


class MapInteractionRun(DemoRun):
    def snapshot(self) -> dict:
        return self.driver.execute_script(SNAPSHOT)

    def settle(self) -> dict:
        from selenium.webdriver.support.ui import WebDriverWait
        return WebDriverWait(self.driver, 60).until(lambda _: (state if matching(state := self.snapshot()) else False))

    def checkbox(self, group: str, value: str | None = None):
        selector = f'[data-filter="{group}"] input' + ('[value]' if value is not None else ':not([value])')
        boxes = self.driver.find_elements('css selector', selector)
        return next(box for box in boxes if value is None or box.get_attribute('value') == value)

    def filters(self) -> None:
        for group in ('team', 'job-type'):
            self.checkbox(group).click()  # Explicit none, then two independent categories.
            state = self.settle()
            if state['actual'] or state['lines']:
                raise AssertionError(f'{group} none still draws tasks or lines')
            values = [box.get_attribute('value') for box in self.driver.find_elements('css selector', f'[data-filter="{group}"] input[value]')]
            if len(values) < 2:
                raise AssertionError(f'{group} needs at least two live options to prove multi-selection')
            self.checkbox(group, values[0]).click()
            self.settle()
            self.checkbox(group, values[1]).click()
            self.settle()
            if not all(self.checkbox(group, value).is_selected() for value in values[:2]):
                raise AssertionError(f'{group} second selection removed first')
            if not self.checkbox(group).is_selected():
                self.checkbox(group).click()
            self.settle()
        self.record('map-checkboxes', 'PASS', 'Both groups: All, none, single and two checked; source IDs and route line counts match')

    def callout_and_poll(self) -> None:
        from selenium.webdriver.support.ui import WebDriverWait
        wait = WebDriverWait(self.driver, 60)
        pins = self.driver.find_elements('css selector', PINS)
        if not pins:
            raise AssertionError('selected day has no map task for callout/poll check')
        # Fit task bounds first; choose a visible marker and let WebDriver perform the click.
        self.driver.find_element('xpath', f"//*[@data-part='dispatch-routes-map']//button[normalize-space()='Fit to map']").click()
        def visible_pin(_):
            return self.driver.execute_script('''
              const map=document.querySelector(arguments[0]).getBoundingClientRect();
              return [...document.querySelectorAll(arguments[1])].find(pin=>{
                const p=pin.getBoundingClientRect(),x=p.x+p.width/2,y=p.y+p.height/2;
                return x>map.left+24&&x<map.right-24&&y>map.top+24&&y<map.bottom-24;
              })||null;
            ''', CANVAS, PINS)
        pin = wait.until(visible_pin)
        self.driver.execute_script('arguments[0].scrollIntoView({block:"center"})', pin)
        pin.click()
        popup = wait.until(lambda d: d.find_element('css selector', CALLOUT))
        for field in ('Pest:', 'Task:', 'Priority:', 'Location:', 'Team:'):
            if field not in popup.text:
                raise AssertionError(f'callout missing {field}')
        wait.until(lambda d: d.execute_script('const p=document.querySelector(arguments[0]);const i=p?.querySelector("img");return i?.complete&&i.naturalWidth>1', CALLOUT))
        if not any(label in popup.text for label in ('Reference photo', 'Report photo')):
            raise AssertionError('callout photo lacks provenance label')
        self.driver.find_element('css selector', MAP + ' .leaflet-control-zoom-in').click()
        time.sleep(1)
        before = self.snapshot()
        # Count completed real UI horizon requests; no manual API GET substitutes for polls.
        print('Waiting for two completed UI horizon polls', flush=True)
        wait.until(lambda _: self.snapshot()['polls'] >= before['polls'] + 2)
        after = self.settle()
        if after['popup'] != before['popup'] or after['zoom'] != before['zoom']:
            raise AssertionError('poll changed selected callout or zoom')
        self.screenshot('desktop-callout-after-two-polls')
        self.record('map-callout-real-polls', 'PASS', 'Six fields/photo loaded; callout ID and zoom retained over two successful UI horizon polls')

    def boundaries(self) -> None:
        from selenium.webdriver import ActionChains
        from selenium.webdriver.common.keys import Keys
        from selenium.webdriver.common.actions.wheel_input import ScrollOrigin
        canvas = self.driver.find_element('css selector', CANVAS)
        self.driver.execute_script('arguments[0].scrollIntoView({block:"center"})', canvas)
        for _ in range(15):
            self.driver.find_element('css selector', MAP + ' .leaflet-control-zoom-out').click()
            time.sleep(.08)
        time.sleep(1)
        state = self.snapshot()
        assert_bounds(state)
        if state['zoom'] != state['minZoom']:
            raise AssertionError('repeated zoom-out did not stop at minimum')
        ActionChains(self.driver).scroll_from_origin(ScrollOrigin.from_element(canvas), 0, 1800).perform()
        time.sleep(1)
        assert_bounds(self.snapshot())
        canvas.click()
        canvas.send_keys(Keys.SUBTRACT * 8, Keys.ARROW_LEFT * 20, Keys.ARROW_UP * 20)
        time.sleep(1)
        assert_bounds(self.snapshot())
        ActionChains(self.driver).move_to_element(canvas).click_and_hold().move_by_offset(550, 180).release().perform()
        time.sleep(1)
        assert_bounds(self.snapshot())
        self.screenshot('desktop-pan-boundary')
        self.record('map-bounds', 'PASS', 'Repeated minus, wheel, keyboard and large drag remain at/above min zoom with centre inside Singapore')

    def map_checks(self) -> None:
        from selenium.webdriver.support.ui import Select, WebDriverWait
        self.driver.get(self.args.base + '/ops/dispatch')
        self.visible('[data-screen="DispatchProposal"]')
        Select(self.driver.find_element('id', 'horizon-days')).select_by_value('7')
        self.driver.execute_script(
            "Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(arguments[0],arguments[1]);arguments[0].dispatchEvent(new Event('input',{bubbles:true}));arguments[0].dispatchEvent(new Event('change',{bubbles:true}));",
            self.driver.find_element('id', 'date'), self.manifest['startDate'])
        wait = WebDriverWait(self.driver, 60)
        day = wait.until(lambda d: d.execute_script("const h=window.__demoUiHorizon;return h?.plans?.[0]?.date===arguments[0]?h.plans.find(p=>p.routes?.some(r=>r.waypointOrder?.some(w=>!w.isHq&&w.status!=='Completed')))?.date||null:null", self.manifest['startDate']))
        Select(self.driver.find_element('id', 'dispatch-day')).select_by_value(day)
        states = []
        for index in range(3):
            self.driver.find_elements('css selector', '[data-part="dispatch-tabs"] button')[index].click()
            state = self.settle()
            states.append((tuple(sorted(state['actual'])), state['lines']))
            if index and state['lines']:
                raise AssertionError('non-route view retains executable lines')
            self.screenshot(f'desktop-view-{index}')
        if len(set(states)) != 3:
            raise AssertionError('three live views did not produce three distinct pin/line sets; fixture coverage required')
        self.record('map-three-views', 'PASS', 'All three source task sets match; route polylines absent from disposition/proposals')
        self.driver.find_elements('css selector', '[data-part="dispatch-tabs"] button')[0].click()
        self.settle()
        self.filters()
        self.callout_and_poll()
        self.boundaries()
        for name, width, height in [('desktop', 1440, 1000), ('mobile', 390, 844)]:
            self.driver.set_window_size(width, height)
            time.sleep(1)
            state = self.settle()
            assert_bounds(state)
            if state['overflow']:
                raise AssertionError(f'{name} page overflows horizontally')
            self.driver.find_element('css selector', CANVAS).location_once_scrolled_into_view
            self.screenshot(f'{name}-map-overflow-check')
        self.record('map-responsive', 'PASS', 'Desktop/mobile screenshots captured; no horizontal page overflow')

    def run(self) -> int:
        from selenium import webdriver
        from selenium.webdriver.edge.options import Options
        options = Options()
        options.page_load_strategy = 'eager'
        if EDGE.is_file():
            options.binary_location = str(EDGE)
        if not self.args.headed:
            options.add_argument('--headless=new')
        options.add_argument('--window-size=1440,1000')
        options.add_argument('--disable-gpu')
        try:
            self.driver = webdriver.Edge(options=options)
            self.driver.set_page_load_timeout(45)
            self.driver.set_script_timeout(45)
            self.driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {'source': CAPTURE})
            self.sign_in('manager')
            self.map_checks()
        except Exception as error:
            self.record('map-interaction', 'FAIL', f'{type(error).__name__}: {str(error).splitlines()[0][:180]}')
            if self.driver:
                try:
                    self.screenshot('map-interaction-failure')
                except Exception:
                    pass
        finally:
            if self.driver:
                try:
                    self.driver.quit()
                except Exception:
                    pass
        return self.finish()


class Checks(unittest.TestCase):
    def test_source_identity_and_route_geometry_must_both_match(self):
        good = {'ready': True, 'actual': ['b', 'a'], 'expected': ['a', 'b'], 'lines': 2, 'expectedLines': 2}
        self.assertTrue(matching(good))
        self.assertFalse(matching({**good, 'actual': ['a']}))
        self.assertFalse(matching({**good, 'lines': 1}))
        self.assertFalse(matching({**good, 'ready': False}))

    def test_boundaries_reject_world_pan_and_below_min_zoom(self):
        good = {'zoom': 12, 'minZoom': 12, 'latitude': 1.35, 'longitude': 103.82}
        assert_bounds(good)
        for wrong in ({'zoom': 11}, {'latitude': 2}, {'longitude': 100}):
            with self.assertRaises(AssertionError):
                assert_bounds({**good, **wrong})


def main() -> int:
    args = parse_args()
    if args.self_check:
        return 0 if unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(Checks)).wasSuccessful() else 1
    manifest, credentials = load_inputs(args.manifest, args.credentials_file)
    args.out.mkdir(parents=True, exist_ok=True)
    return MapInteractionRun(args, manifest, credentials).run()


if __name__ == '__main__':
    raise SystemExit(main())
