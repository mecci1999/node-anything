import BaseDiscoverer from '@/lib/registry/discoverers/base';
import { GenericObject } from '..';
import { DiscovererOptions } from './discoverers';

export interface StarRegistryOptions {
  strategy?: Function | string;
  strategyOptions?: GenericObject;
  preferLocal?: boolean;
  discoverer?: RegistryDiscovererOptions | BaseDiscoverer | string;
  stopDelay?: number;
}

export interface RegistryDiscovererOptions {
  type: string;
  options: DiscovererOptions;
}
