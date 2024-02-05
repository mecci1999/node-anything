import { actionHookMiddleware } from './action-hook';
import bulkheadMiddleware from './bulkhead';
import cacherMiddleware from './cacher';
import circuitBreakerMiddleware from './circuit-breaker';
import contextTrackerMiddleware from './context-tracker';
import debounceMiddleware from './debounce';
import errorHandlerMiddleware from './error-handler';
import FallbackMiddleware from './fallback';
import HotReloadMiddleware from './hot-reload';
import metricsHandlerMiddleware from './metrics';
import retryMiddleware from './retry';
import throttleMiddleware from './throttle';
import timeoutHandlerMiddleware from './timeout';
import tracingMiddleware from './tracing';
import ValidatorMiddleware from './validator';

const Middlewares = {
  ActionHook: actionHookMiddleware,
  Bulkhead: bulkheadMiddleware,
  Cacher: cacherMiddleware,
  CircuitBreaker: circuitBreakerMiddleware,
  ContextTracker: contextTrackerMiddleware,
  Debounce: debounceMiddleware,
  ErrorHandler: errorHandlerMiddleware,
  Fallback: FallbackMiddleware,
  HotReload: HotReloadMiddleware,
  Metrics: metricsHandlerMiddleware,
  Retry: retryMiddleware,
  Throttle: throttleMiddleware,
  Timeout: timeoutHandlerMiddleware,
  Tracing: tracingMiddleware,
  Validator: ValidatorMiddleware
};

function register(name: string, value: any) {
  Middlewares[name] = value;
}

export default Object.assign(Middlewares, { register });
