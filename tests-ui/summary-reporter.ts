import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';

/** Prints only the failing pages, one line each: route, theme, width, rule. ASCII only. */
export default class SummaryReporter implements Reporter {
  private lines: string[] = [];
  private skipped: string[] = [];
  private ran = 0;

  onTestEnd(test: TestCase, result: TestResult): void {
    this.ran += 1;
    if (result.status === 'skipped') {
      const why = test.annotations.find((a) => a.type === 'skip')?.description ?? 'skipped';
      this.skipped.push(`${test.title}: ${why}`);
      return;
    }
    const found = test.annotations.filter((a) => a.type === 'ui-fail');
    for (const a of found) this.lines.push(a.description ?? '');
    if (found.length === 0 && result.status !== 'passed') {
      const msg = (result.error?.message ?? 'error').split('\n')[0]?.replace(/[^\x20-\x7e]/g, '?');
      this.lines.push(`${test.title} | test-error | ${msg}`);
    }
  }

  onEnd(): { status: 'passed' | 'failed' } {
    const out = ['', `UI sweep: ${this.ran} page checks, ${this.skipped.length} skipped, ${this.lines.length} failing finding(s)`];
    for (const s of [...new Set(this.skipped)]) out.push(`  skipped: ${s}`);
    for (const l of this.lines) out.push(`  FAIL ${l}`);
    console.log(out.join('\n'));
    return { status: this.lines.length === 0 ? 'passed' : 'failed' };
  }
}
