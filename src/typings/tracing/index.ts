import Context from '@/lib/context';
import { GenericObject } from '..';
import BaseTraceExporter from '@/lib/tracing/exporters/base';

export type TracingActionTagsFuncType = (ctx: Context, response?: any) => GenericObject;

export type TracingEventTagsFuncType = (ctx: Context) => GenericObject;

export type TracingSpanNameOption = string | ((ctx: Context) => string);

export type TracingActionTags =
  | TracingActionTagsFuncType
  | {
      params?: boolean | string[];
      meta?: boolean | string[];
      response?: boolean | string[];
    };

export type TracingEventTags =
  | TracingEventTagsFuncType
  | {
      params?: boolean | string[];
      meta?: boolean | string[];
    };

export interface TracingOptions {
  enabled?: boolean;
  tags?: TracingActionTags | TracingEventTags;
  spanName?: TracingSpanNameOption;
  safetyTags?: boolean;
}

export interface TracingActionOptions extends TracingOptions {
  tags?: TracingActionTags;
}

export interface TracingEventOptions extends TracingOptions {
  tags?: TracingEventTags;
}

export interface TracerExporterOptions {
  type: string;
  options?: GenericObject;
}

export interface TracerOptions {
  enabled?: boolean;
  exporter?: string | TracerExporterOptions | (TracerExporterOptions | string)[] | null;
  sampling?: {
    rate?: number | null;
    tracesPerSecond?: number | null;
    minPriority?: number | null;
  };

  actions?: boolean;
  events?: boolean;

  errorFields?: string[];
  stackTrace?: boolean;

  defaultTags?: GenericObject | Function | null;

  tags?: {
    action?: TracingActionTags;
    event?: TracingEventTags;
  };
}

export type TraceExporter<T extends BaseTraceExporter = BaseTraceExporter> = T;

export interface SpanLogEntry {
  name: string;
  fields: GenericObject;
  time: number;
  elapsed: number;
}

export interface StarTrackingOptions {
  enabled?: boolean;
  shutdownTimeout?: number;
}
