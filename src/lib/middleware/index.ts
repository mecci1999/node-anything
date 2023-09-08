import { actionHookMiddleware } from './action-hook';

const Middlewares = {
  ActionHook: actionHookMiddleware
};

function register(name: string, value: any) {
  Middlewares[name] = value;
}

export default Object.assign(Middlewares, { register });
