import Service from '@/lib/star/service';
import { ActionHandler, ActionParams, BulkheadOptions, RestSchema } from '.';
import { TracingEventOptions } from '../tracing';
import Context from '@/lib/context';

export interface EventSchema {
  name?: string;
  group?: string;
  params?: ActionParams;
  service?: Service;
  tracing?: boolean | TracingEventOptions;
  bulkhead?: BulkheadOptions;
  handler?: ActionHandler;
  context?: boolean;

  [key: string]: any;
}

export type ServiceEventLegacyHandler = (
  payload: any,
  sender: string,
  eventName: string,
  ctx: Context
) => void | Promise<void>;

export type ServiceEventHandler = (ctx: Context) => void | Promise<void>;

export interface ServiceEvent {
  name?: string;
  group?: string;
  params?: ActionParams;
  context?: boolean;
  debounce?: number;
  throttle?: number;
  handler?: ServiceEventHandler | ServiceEventLegacyHandler;
}
