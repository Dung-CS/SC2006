// CI helper: fail if a migration that exists on the base ref was edited, renamed or deleted.
// List new migrations in the job summary. Never touches a database.
// Usage: BASE_REF=<ref or sha> node tools/check-migrations.mjs
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

const DIR = 'src/persistence/migrations/';
const base = process.env.BASE_REF ?? '';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const summary = (text) => {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n');
  console.log(text);
};

if (base === '' || /^0+$/.test(base)) {
  summary('Migration check skipped: no base ref (first push of a branch).');
  process.exit(0);
}

const mergeBase = git('merge-base', base, 'HEAD');
const lines = git('diff', '--name-status', '--no-renames', mergeBase, 'HEAD', '--', DIR)
  .split('\n')
  .filter(Boolean)
  .map((line) => line.split('\t'));

const added = lines.filter(([s]) => s === 'A').map(([, f]) => f.slice(DIR.length));
const changed = lines.filter(([s]) => s !== 'A').map(([s, f]) => `${s} ${f.slice(DIR.length)}`);

summary('## Migrations');
if (added.length) {
  summary('New migrations. Apply to production by hand (`npx tsx src/tools/migrate.ts`), CI never does:');
  for (const f of added) summary(`- ${f}`);
} else {
  summary('No new migrations.');
}
if (changed.length) {
  summary('\nFAILED: released migrations were edited. Write a new migration instead:');
  for (const c of changed) summary(`- ${c}`);
  process.exit(1);
}
