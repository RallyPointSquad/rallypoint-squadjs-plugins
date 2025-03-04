import { SquadServer } from '../SquadJS.js';

export interface PluginOptionSpec {
  required: boolean;
  description: string;
  connector?: string;
  default?: unknown;
  example?: unknown;
}

export type PluginOptionsSpec = Record<string, PluginOptionSpec>;

export type PluginOptions = Record<string, unknown>;

export default class BasePlugin<PluginOptions = Record<string, never>> {

  static description: string;

  static defaultEnabled: boolean;

  static optionsSpecification: PluginOptionsSpec;

  server: SquadServer;

  options: PluginOptions;

  constructor(server: SquadServer, options: PluginOptions, connectors: Record<string, unknown>);

  prepareToMount(): Promise<void>;

  mount(): Promise<void>;

  unmount(): Promise<void>;

  verbose(...args: (string|number)[]): void;

}
