import Service from '@/lib/star/service';
import {
  ActionHandler,
  ActionHookAfter,
  ActionHookBefore,
  ActionHookError,
  ActionParams,
  ActionSchema
} from '../context';
import { ServiceEventHandler, ServiceEventLegacyHandler } from '../context/event';

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

export type ServiceMethods = { [key: string]: (...args: any[]) => any } & ThisType<Service>;

export interface ServiceHooksBefore {
  [key: string]: string | ActionHookBefore | (string | ActionHookBefore)[];
}

export interface ServiceHooksAfter {
  [key: string]: string | ActionHookAfter | (string | ActionHookAfter)[];
}

export interface ServiceHooksError {
  [key: string]: string | ActionHookError | (string | ActionHookError)[];
}

export interface ServiceHooks {
  before?: ServiceHooksBefore;
  after?: ServiceHooksAfter;
  error?: ServiceHooksError;
}

export interface ServiceEvent {
  name?: string;
  group?: string;
  params?: ActionParams;
  context?: boolean;
  debounce?: number;
  throttle?: number;
  handler?: ServiceEventHandler | ServiceEventLegacyHandler;
}

export type ServiceEvents<S = ServiceSettingSchema> = {
  [key: string]: ServiceEventHandler | ServiceEventLegacyHandler | ServiceEvent;
} & ThisType<Service<S>>;

export type ServiceSyncLifecycleHandler<S = ServiceSettingSchema> = (this: Service<S>) => void;

export type ServiceAsyncLifecycleHandler<S = ServiceSettingSchema> = (this: Service<S>) => void | Promise<void>;

// 服务协议
export interface ServiceSchema<S = ServiceSettingSchema> {
  name: string;
  version?: string | number;
  settings?: S;
  dependencies?: string | ServiceDependency | (string | ServiceDependency)[];
  metadata?: any;
  actions?: ServiceActionsSchema;
  mixins?: Partial<ServiceSchema>[];
  methods?: ServiceMethods;
  hooks?: ServiceHooks;

  events?: ServiceEvents;
  created?: ServiceSyncLifecycleHandler<S> | ServiceSyncLifecycleHandler<S>[];
  started?: ServiceAsyncLifecycleHandler<S> | ServiceAsyncLifecycleHandler<S>[];
  stopped?: ServiceAsyncLifecycleHandler<S> | ServiceAsyncLifecycleHandler<S>[];

  [name: string]: any;
}
