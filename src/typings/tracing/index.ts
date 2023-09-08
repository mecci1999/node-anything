import Context from '@/lib/context';
import { GenericObject } from '..';

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
