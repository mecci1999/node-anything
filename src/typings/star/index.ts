import BaseLogger from '@/lib/logger/base';
import { BaseLoggerLevels, LogLevelConfig } from '../logger';
import { GenericObject } from '..';
import { StarRegistryOptions } from '../registry';
import { Serialize } from '../serializers';
import { Transporter } from '../transit/transporters';
import { Regenerator, UniverseError } from '@/lib/error';
import Context from '@/lib/context';
import { StarTransitOptions } from '../transit';
import Service from '@/lib/star/service';
import { ServiceSchema } from '../service';
import Star from '@/lib/star';
import { Middleware } from '../middleware';
import { Cacher } from '../cachers';
import { MetricRegistryOptions } from '../metric';
import BaseValidator from '@/lib/validators/base';

/**
 * 配置项
 */
export interface StarOptions {
  namespace?: string | null; // 命名
  nodeID?: string | null; // nodeID

  metadata?: GenericObject;

  logger?: BaseLogger | LogLevelConfig | LogLevelConfig[] | boolean | null; // 日志对象
  logLevel?: BaseLoggerLevels | LogLevelConfig | null; // 日志级别

  registry?: StarRegistryOptions; // 注册配置

  contextParamsCloning?: boolean;
  maxCallLevel?: number;
  heartbeatInterval?: number;
  heartbeatTimeout?: number;

  transporter?: Transporter | string | GenericObject | null;

  transit?: StarTransitOptions;

  serializer?: Serialize | string | GenericObject | null;

  errorRegenerator?: Regenerator | null;

  uidGenerator?: () => string;

  errorHandler?: ((err: Error, info: any) => void) | null;

  Promise?: PromiseConstructorLike;

  ContextFactory?: Context;

  requestTimeout?: number;
  // retryPolicy?: RetryPolicyOptions;

  // tracking?: BrokerTrackingOptions;

  disableBalancer?: boolean;

  // circuitBreaker?: BrokerCircuitBreakerOptions;

  // bulkhead?: BulkheadOptions;

  cacher?: boolean | Cacher | string | GenericObject | null;

  validator?: boolean | BaseValidator | ValidatorNames | ValidatorOptions | null;

  metrics?: boolean | MetricRegistryOptions;
  // tracing?: boolean | TracerOptions;

  internalServices?:
    | boolean
    | {
        [key: string]: Partial<ServiceSchema>;
      };
  internalMiddlewares?: boolean;

  dependencyInterval?: number;
  dependencyTimeout?: number;

  hotReload?: boolean | HotReloadOptions;

  middlewares?: (Middleware | string)[];

  replCommands?: GenericObject[] | null;
  replDelimiter?: string;

  ServiceFactory?: Service;

  created?: StarSyncLifecyleHandler;
  started?: StarAsyncLifecyleHandler;
  stopped?: StarAsyncLifecyleHandler;

  // /**
  //  * If true, process.on("beforeExit/exit/SIGINT/SIGTERM", ...) handler won't be registered!
  //  * You have to register this manually and stop broker in this case!
  //  */
  skipProcessEventRegistration?: boolean;

  maxSafeObjectSize?: number;
}

export interface HotReloadOptions {
  modules?: string[];
}

export type StarAsyncLifecyleHandler = (star: Star) => void;
export type StarSyncLifecyleHandler = (star: Star) => void | Promise<void>;

// ------ Call Action 的相关参数
export type FallbackHandler = (ctx: Context, err: UniverseError) => Promise<any>;
export type FallbackResponse = string | number | GenericObject;
export type FallbackResponseHandler = (ctx: Context, err: UniverseError) => Promise<any>;

export interface ContextParentSpan {
  id: string;
  traceID: string;
  sampled: boolean;
}

export interface CallCallingOptions {
  timeout?: number;
  retries?: number;
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

export interface MCallCallingOptions extends CallCallingOptions {
  settled?: boolean;
}

export interface StarCallActionParams<P extends GenericObject = GenericObject> {
  action: string;
  params?: P;
}

export interface StarMCallActionParams<P extends GenericObject = GenericObject> extends StarCallActionParams {
  options?: CallCallingOptions;
}

export interface ValidatorOptions {
  type: string;
  options?: GenericObject;
}

export type ValidatorNames = 'Fastest';
