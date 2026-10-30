import { defineConfig } from '@playwright/test';

/**
 * UI sweep config (npm run ui:check). The server is LOCAL and IN-MEMORY: every secret that would
 * bind a live service (Postgres, Supabase, Telegram, OneMap) is blanked, and the process
 * environment wins over src/.env in ConfigLoader. Seed accounts are throwaway local ones.
 */
export const PORT = 3917;
export const MANAGER = { email: 'ui-manager@d-fence.local', password: 'UiManager2026!' };
export const RESIDENT = { email: 'ui-resident@d-fence.local', password: 'UiResident2026!' };

export default defineConfig({
  testDir: 'tests-ui',
  testMatch: '**/*.pw.ts',
  workers: 1,
  timeout: 60_000,
  reporter: [['./tests-ui/summary-reporter.ts']],
  use: { baseURL: `http://localhost:${PORT}`, channel: 'msedge' },
  webServer: {
    command: 'npm run serve',
    url: `http://localhost:${PORT}/signin`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      PORT: String(PORT),
      DATABASE_URL: '',
      SUPABASE_URL: '',
      SUPABASE_ANON_KEY: '',
      SUPABASE_SERVICE_KEY: '',
      TELEGRAM_BOT_TOKEN: '',
      TELEGRAM_CHAT_ID: '',
      ONE_MAP_TOKEN: '',
      ONE_MAP_EMAIL: '',
      ONE_MAP_PASSWORD: '',
      DFENCE_SEED_MANAGER_EMAIL: MANAGER.email,
      DFENCE_SEED_MANAGER_PASSWORD: MANAGER.password,
      DFENCE_SEED_RESIDENT_EMAIL: RESIDENT.email,
      DFENCE_SEED_RESIDENT_PASSWORD: RESIDENT.password,
    },
  },
});
