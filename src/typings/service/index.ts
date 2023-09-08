import Service from '@/lib/star/service';
import { ActionHandler, ActionSchema } from '../context';

export interface ServiceSettingSchema {
  $noVersionPrefix?: boolean;
  $noServiceNamePrefix?: boolean;
  $dependencyTimeout?: number;
  $shutdownTimeout?: number;
  $secureSettings?: string[];
  [name: string]: any;
}

export interface ServiceDependency {
  name: string;
  version?: string | number;
}

// 服务动作协议
export type ServiceActionsSchema<S = ServiceSettingSchema> = {
  [key: string]: ActionSchema | ActionHandler | boolean;
} & ThisType<Service<S>>;

// 服务协议
export interface ServiceSchema<S = ServiceSettingSchema> {
  name: string;
  version?: string | number;
  settings?: S;
  dependencies?: string | ServiceDependency | (string | ServiceDependency)[];
  metadata?: any;
  actions?: ServiceActionsSchema;
  mixins?: Partial<ServiceSchema>[];
  // methods?: ServiceMethods;
  // hooks?: ServiceHooks;

  // events?: ServiceEvents;
  // created?: ServiceSyncLifecycleHandler<S> | ServiceSyncLifecycleHandler<S>[];
  // started?: ServiceAsyncLifecycleHandler<S> | ServiceAsyncLifecycleHandler<S>[];
  // stopped?: ServiceAsyncLifecycleHandler<S> | ServiceAsyncLifecycleHandler<S>[];

  [name: string]: any;
}
