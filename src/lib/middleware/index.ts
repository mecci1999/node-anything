import { actionHookMiddleware } from './action-hook';
import bulkheadMiddleware from './bulkhead';
import cacherMiddleware from './cacher';
import debounceMiddleware from './debounce';
import throttleMiddleware from './throttle';
import timeoutHandlerMiddleware from './timeout';
import ValidatorMiddleware from './validator';

const Middlewares = {
  ActionHook: actionHookMiddleware,
  Bulkhead: bulkheadMiddleware,
  Cacher: cacherMiddleware,
  Debounce: debounceMiddleware,
  Throttle: throttleMiddleware,
  Timeout: timeoutHandlerMiddleware,
  Validator: ValidatorMiddleware
};

function register(name: string, value: any) {
  Middlewares[name] = value;
}

export default Object.assign(Middlewares, { register });
