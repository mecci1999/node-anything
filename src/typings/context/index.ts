import Context from '@/lib/context';
import { ActionCacheOptions } from '../cachers';
import { TracingActionOptions } from '../tracing';
import { UniverseError } from '@/lib/error';
import { GenericObject } from '..';
import Service from '@/lib/star/service';

export interface RestSchema {
  path?: string;
  method?: 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH';
  fullPath?: string;
  basePath?: string;
}

export type ActionVisibility = 'published' | 'public' | 'protected' | 'private';

export type ActionHandler<T = any> = (ctx: Context) => Promise<T> | T;

export type ActionParamSchema = { [key: string]: any };

type ActionParamTypes =
  | 'any'
  | 'array'
  | 'boolean'
  | 'custom'
  | 'date'
  | 'email'
  | 'enum'
  | 'forbidden'
  | 'function'
  | 'number'
  | 'object'
  | 'string'
  | 'url'
  | 'uuid'
  | boolean
  | string
  | ActionParamSchema;

export type ActionParams = { [key: string]: ActionParamTypes };

export type FallbackHandler = (ctx: Context, err: UniverseError) => Promise<any>;
export type FallbackResponse = string | number | GenericObject;
export type FallbackResponseHandler = (ctx: Context, err: UniverseError) => Promise<any>;

/**
 * 动作协议
 */
export interface ActionSchema {
  name?: string;
  rest?: RestSchema | RestSchema[] | string | string[];
  visibility?: ActionVisibility;
  params?: ActionParams;
  service?: Service;
  cache?: boolean | ActionCacheOptions;
  handler?: ActionHandler;
  tracing?: boolean | TracingActionOptions;
  bulkhead?: BulkheadOptions;
  circuitBreaker?: StarCircuitBreakerOptions;
  retryPolicy?: RetryPolicyOptions;
  fallback?: string | FallbackHandler;
  hooks?: ActionHooks;

  [key: string]: any;
}

export type CheckRetryable = (err: UniverseError | Error) => boolean;

export interface BulkheadOptions {
  enabled?: boolean;
  concurrency?: number;
  maxQueueSize?: number;
}

export interface StarCircuitBreakerOptions {
  enabled?: boolean;
  threshold?: number;
  windowTime?: number;
  minRequestCount?: number;
  halfOpenTime?: number;
  check?: CheckRetryable;
}

export interface RetryPolicyOptions {
  enabled?: boolean;
  retries?: number;
  delay?: number;
  maxDelay?: number;
  factor?: number;
  check?: CheckRetryable;
}

export type ActionHookBefore = (ctx: Context) => Promise<void> | void;
export type ActionHookAfter = (ctx: Context, res: any) => Promise<any> | any;
export type ActionHookError = (ctx: Context, err: Error) => Promise<void> | void;

export interface ActionHooks {
  before?: string | ActionHookBefore | (string | ActionHookBefore)[];
  after?: string | ActionHookAfter | (string | ActionHookAfter)[];
  error?: string | ActionHookError | (string | ActionHookError)[];
}

export interface ContextParentSpan {
  id: string;
  traceID: string;
  sampled: boolean;
}

export interface CallingOptions {
  timeout?: number | null;
  retries?: number | null;
  fallbackResponse?: FallbackResponse | FallbackResponse[] | FallbackResponseHandler;
  nodeID?: string;
  meta?: GenericObject;
  parentSpan?: ContextParentSpan;
  parentCtx?: Context;
  requestID?: string;
  tracking?: boolean;
  paramsCloning?: boolean;
  caller?: string;
}
