/**
 * Unified entry point for application startup, service resolution, health and shutdown.
 * The facade keeps callers away from configuration and infrastructure construction details.
 */
import { AppConfigurator, ServiceRegistration } from '../config/AppConfigurator';
import { ConfigSet } from '../config/ConfigSet';

export class DengueSystemFacade {
  private readonly configurator: AppConfigurator;

  constructor(modules: ServiceRegistration[] = []) {
    this.configurator = new AppConfigurator();
    for (const module of modules) this.configurator.addModule(module);
  }

  /** Load configuration, establish infrastructure services and register feature factories. */
  boot(): Promise<void> {
    return this.configurator.bootstrap();
  }

  /** Resolve a lazily constructed service by its registered name. */
  resolveController<T>(name: string): T {
    return this.configurator.resolveController<T>(name);
  }

  /** Return a read-only view of the validated runtime configuration. */
  getConfiguration(): ConfigSet {
    return this.configurator.getConfiguration();
  }

  /** Report facade and optional database readiness without exposing connection details. */
  getHealth(): ReturnType<AppConfigurator['getHealth']> {
    return this.configurator.getHealth();
  }

  /** Close resources owned by this application instance. Safe to call more than once. */
  shutdown(): Promise<void> {
    return this.configurator.shutdown();
  }
}
