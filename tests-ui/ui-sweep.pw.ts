import { test, type Browser, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import { ROUTES } from '../client/src/app/routes';
import { Role } from '../src/entity/enums';
import { SESSION_KEY } from '../client/src/lib/SessionPersistence';
import { MANAGER, RESIDENT } from '../playwright.config';

const CREW = { email: 'ui-crew@d-fence.local', password: 'UiCrew2026!' };
const THEMES = ['light', 'dark'] as const;
const WIDTHS = [390, 1280] as const;

const tokens: Partial<Record<string, string>> = {};
const ids: Record<string, string> = {};

async function signIn(page: Page, who: { email: string; password: string }): Promise<string> {
  await page.goto('/signin');
  await page.getByLabel('Email').fill(who.email);
  await page.getByLabel('Password').fill(who.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForFunction(() => !window.location.pathname.startsWith('/signin'), null, { timeout: 20_000 });
  return page.evaluate((k) => window.localStorage.getItem(k) ?? '', SESSION_KEY);
}

/** GET (or POST) the API from inside the signed-in page: the session is a bearer token, not a cookie. */
async function api(page: Page, path: string, token: string, method = 'GET', body?: unknown): Promise<unknown> {
  return page.evaluate(
    async ([p, t, m, b]) => {
      const r = await fetch(p as string, {
        method: m as string,
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${t}` },
        ...(b ? { body: JSON.stringify(b) } : {}),
      });
      return r.ok ? r.json() : null;
    },
    [path, token, method, body ?? null] as const,
  );
}

function firstId(node: unknown, keys: string[], seen = new Set<unknown>()): string | null {
  if (node === null || typeof node !== 'object' || seen.has(node)) return null;
  seen.add(node);
  if (!Array.isArray(node)) {
    for (const k of keys) {
      const v = (node as Record<string, unknown>)[k];
      if (typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)) return v;
    }
  }
  for (const v of Object.values(node)) {
    const f = firstId(v, keys, seen);
    if (f) return f;
  }
  return null;
}

async function bootstrap(browser: Browser): Promise<void> {
  const page = await browser.newPage();
  try {
    tokens.resident = await signIn(page, RESIDENT);
    const mine = await api(page, '/api/reports/mine', tokens.resident);
    ids.report = firstId(mine, ['id', 'reportId']) ?? '';
    await page.evaluate((k) => window.localStorage.removeItem(k), SESSION_KEY);

    tokens.manager = await signIn(page, MANAGER);
    const m = tokens.manager;
    ids.cluster = firstId(await api(page, '/api/ops/priority', m), ['clusterId', 'localityId', 'id']) ?? '';
    ids.pending = firstId(await api(page, '/api/ops/moderation', m), ['reportId', 'id']) ?? '';
    ids.workOrder = firstId(await api(page, '/api/ops/work-orders', m), ['workOrderId', 'id']) ?? '';
    // Local in-memory server only: a crew account has to exist to open the crew screens.
    await api(page, '/api/ops/staff', m, 'POST', { email: CREW.email, role: Role.CleaningCrew, password: CREW.password });
    ids.crewMember = firstId(await api(page, '/api/ops/staff', m), ['accountId', 'id']) ?? '';
    await page.evaluate((k) => window.localStorage.removeItem(k), SESSION_KEY);

    tokens.crew = await signIn(page, CREW);
    const jobs = await api(page, '/api/crew/work-orders', tokens.crew);
    ids.job = firstId(jobs, ['id', 'workOrderId']) ?? ids.workOrder ?? '';
  } finally {
    await page.close();
  }
}

/** Fills :params; returns [url, reasonToSkip]. */
function resolveUrl(path: string, screenId: string): [string, string | null] {
  const byScreen: Record<string, string> = {
    ReportDetail: ids.report ?? '',
    ClusterDetail: ids.cluster ?? '',
    ReportReview: ids.pending ?? '',
    Referral: ids.pending ?? '',
    WODetail: ids.workOrder ?? '',
    CrewDetail: ids.crewMember ?? '',
    JobDetail: ids.job ?? '',
    JobCompletion: ids.job ?? '',
  };
  if (screenId === 'ResetForm') return [path.replace(':token', 'example-reset-token'), null];
  if (!path.includes(':id')) {
    return [screenId === 'WOCreate' && ids.cluster ? `${path}?clusterId=${ids.cluster}` : path, null];
  }
  const id = byScreen[screenId];
  return id ? [path.replace(':id', id), null] : ['', `no seeded id for ${screenId}`];
}

test.beforeAll(async ({ browser }) => {
  test.setTimeout(180_000);
  mkdirSync('ui-report', { recursive: true });
  await bootstrap(browser);
  console.log(`ui-sweep ids: ${JSON.stringify(ids)}`);
});

for (const route of ROUTES) {
  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      const name = `${route.screenId} ${route.path} ${theme} ${width}`;
      test(name, async ({ page }) => {
        const [url, skip] = resolveUrl(route.path, route.screenId);
        test.skip(skip !== null, skip ?? '');

        const fails: string[] = [];
        const fail = (rule: string): number => fails.push(`${route.path} | ${theme} | ${width} | ${rule}`);

        const role = route.roles === null ? null : route.roles[0] === Role.Resident ? 'resident'
          : route.roles[0] === Role.CleaningCrew ? 'crew' : 'manager';
        // ReportDetail allows two roles; Resident is first and owns the seeded report.
        const token = role === null ? undefined : tokens[role];
        if (role !== null && !token) {
          test.skip(true, `no ${role} session`);
        }

        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme: theme });
        await page.addInitScript(
          ([k, t, th]) => {
            if (t) window.localStorage.setItem(k as string, t as string);
            document.documentElement?.setAttribute('data-theme', th as string);
          },
          [SESSION_KEY, token ?? '', theme] as const,
        );
        page.on('pageerror', (e) => fail(`page-error: ${e.message.split('\n')[0]?.slice(0, 80)}`));
        page.on('console', (m) => {
          if (m.type() === 'error') fail(`console-error: ${m.text().split('\n')[0]?.slice(0, 80)}`);
        });

        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => !document.body.innerText.includes('Restoring your session'), null, { timeout: 20_000 }).catch(() => undefined);
        await page.locator('[data-screen]').first().waitFor({ timeout: 20_000 }).catch(() => undefined);
        await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
        await page.waitForTimeout(500);

        const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (over > 1) fail(`horizontal-overflow: ${over}px`);

        const axe = await new AxeBuilder({ page }).analyze();
        for (const v of axe.violations) fail(`axe ${v.id} (${v.nodes.length})`);
        for (const i of axe.incomplete) if (i.id === 'color-contrast') fail(`axe-incomplete color-contrast (${i.nodes.length})`);

        const file = `${route.path.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home'}-${theme}-${width}.png`;
        await page.screenshot({ path: `ui-report/${file}`, fullPage: true });

        // De-duplicate repeated console messages, then hand the findings to the reporter.
        for (const f of new Set(fails)) test.info().annotations.push({ type: 'ui-fail', description: f });
      });
    }
  }
}
