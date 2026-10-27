/**
 * Application composition lifecycle used by DengueSystemFacade.
 * Feature modules register their factories before boot; boot then loads configuration and binds
 * infrastructure services in one place.
 */
import { ServiceContainer, Factory } from './ServiceContainer';
import { ConfigSet } from './ConfigSet';
import { ConfigLoader } from './ConfigLoader';
import { Database } from '../persistence/Database';

export type ServiceRegistration = (container: ServiceContainer, config: ConfigSet) => void;

export class AppConfigurator {
  readonly container = new ServiceContainer();
  private config: ConfigSet | null = null;
  private database: Database | null = null;
  private readonly registrations: ServiceRegistration[] = [];
  private bootPromise: Promise<void> | null = null;
  private stopped = false;

  /** Add a feature's factories before boot. Registrations run once, in insertion order. */
  addModule(registration: ServiceRegistration): this {
    if (this.config !== null || this.bootPromise !== null) {
      throw new Error('modules must be registered before boot');
    }
    this.registrations.push(registration);
    return this;
  }

  /** Register one lazy service factory before boot. */
  register<T>(name: string, factory: Factory<T>): this {
    return this.addModule((container) => container.register(name, factory));
  }

  /** Load configuration and expose shared infrastructure to registered feature modules. */
  bootstrap(): Promise<void> {
    if (this.stopped) return Promise.reject(new Error('application has been shut down'));
    if (this.bootPromise !== null) return this.bootPromise;
    this.bootPromise = Promise.resolve().then(() => {
      const config = ConfigLoader.load();
      const connectionString = config.get('DATABASE_URL');
      const database = connectionString === '' ? null : new Database(connectionString);
      this.config = config;
      this.database = database;
      this.container.register('config', () => config);
      this.container.register('database', () => database);
      for (const registration of this.registrations) registration(this.container, config);
    }).catch((error: unknown) => {
      this.bootPromise = null;
      throw error;
    });
    return this.bootPromise;
  }

  getConfiguration(): ConfigSet {
    if (this.config === null) throw new Error('application has not booted');
    return this.config;
  }

  resolveController<T>(name: string): T {
    if (this.config === null) throw new Error('application has not booted');
    return this.container.resolve<T>(name);
  }

  async getHealth(): Promise<{ status: 'ready' | 'degraded' | 'stopped'; database: 'connected' | 'not-configured' | 'unavailable' }> {
    if (this.stopped) return { status: 'stopped', database: 'not-configured' };
    if (this.config === null) return { status: 'degraded', database: 'not-configured' };
    if (this.database === null) return { status: 'ready', database: 'not-configured' };
    try {
      await this.database.query('SELECT 1');
      return { status: 'ready', database: 'connected' };
    } catch {
      return { status: 'degraded', database: 'unavailable' };
    }
  }

  async shutdown(): Promise<void> {
    if (this.stopped) return;
    if (this.bootPromise !== null) await this.bootPromise;
    this.stopped = true;
    await this.database?.close();
  }
}
