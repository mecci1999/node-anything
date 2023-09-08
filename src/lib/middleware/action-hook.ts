import { isFunction, isString, match } from '@/utils';
import Context from '../context';
import { Star } from '../star';
import _ from 'lodash';

export function actionHookMiddleware(star: Star) {
  function callHook(hook: any, service: any, ctx: Context, res?: any) {
    if (isFunction(hook)) {
      return hook.call(service, ctx, res);
    } else if (Array.isArray(hook)) {
      return hook.reduce((p, fn) => p.then((res) => fn.call(service, ctx, res)), Promise.resolve(res));
    }
  }

  function callErrorHook(hook: any, service: any, ctx: Context, error?: any) {
    if (isFunction(hook)) {
      return hook.call(service, ctx, error);
    } else if (Array.isArray(hook)) {
      return hook.reduce((p, fn) => p.then((res) => fn.call(service, ctx, res)), Promise.reject(error));
    }
  }

  function sanitizeHooks(hooks: any, service?: any) {
    if (isString(hooks)) return service && isFunction(service[hooks]) ? service[hooks] : null;

    if (Array.isArray(hooks)) {
      return _.compact(
        hooks.map((h) => {
          if (isString(h)) return service && isFunction(service[h]) ? service[h] : null;

          return h;
        })
      );
    }

    return hooks;
  }

  function wrapActionHookMiddleware(handler: any, action: any) {
    const name = action.rawName || action.name;
    const hooks = action.service && action.service.schema ? action.service.schema.hooks : null;

    if (hooks || action.hooks) {
      const beforeAllHook = hooks && hooks.before ? sanitizeHooks(hooks.before['*'], action.service) : null;
      const afterAllHook = hooks && hooks.after ? sanitizeHooks(hooks.after['*'], action.service) : null;
      const errorAllHook = hooks && hooks.error ? sanitizeHooks(hooks.error['*'], action.service) : null;

      const matchHook = (hookName) => {
        if (hookName === '*') return false;
        const patterns = hookName.split('|');
        return patterns.some((pattern) => match(name, pattern));
      };

      const beforeHookMatches = hooks && hooks.before ? Object.keys(hooks.before).filter(matchHook) : null;
      const beforeHook =
        beforeHookMatches && beforeHookMatches.length > 0
          ? beforeHookMatches.map((hookName) => sanitizeHooks(hooks.before[hookName], action.service))
          : null;

      const afterHookMatches = hooks && hooks.after ? Object.keys(hooks.after).filter(matchHook) : null;
      const afterHook =
        afterHookMatches && afterHookMatches.length > 0
          ? afterHookMatches.map((hookName) => sanitizeHooks(hooks.after[hookName], action.service))
          : null;

      const errorHookMatches = hooks && hooks.error ? Object.keys(hooks.error).filter(matchHook) : null;
      const errorHook =
        errorHookMatches && errorHookMatches.length > 0
          ? errorHookMatches.map((hookName) => sanitizeHooks(hooks.error[hookName], action.service))
          : null;

      const actionBeforeHook =
        action.hooks && action.hooks.before ? sanitizeHooks(action.hooks.before, action.service) : null;
      const actionAfterHook =
        action.hooks && action.hooks.after ? sanitizeHooks(action.hooks.after, action.service) : null;
      const actionErrorHook =
        action.hooks && action.hooks.error ? sanitizeHooks(action.hooks.error, action.service) : null;

      star.logger?.debug(`Service Level 'Before' Hooks of '${name}' action:`, [
        ...(beforeAllHook ? ['*'] : []),
        ...(beforeHookMatches ? beforeHookMatches : [])
      ]);
      star.logger?.debug(`Service Level 'After' Hooks of '${name}' action:`, [
        ...(afterHookMatches ? afterHookMatches : []),
        ...(afterAllHook ? ['*'] : [])
      ]);
      star.logger?.debug(`Service Level 'Error' Hooks of '${name}' action`, [
        ...(errorHookMatches ? errorHookMatches : []),
        ...(errorAllHook ? ['*'] : [])
      ]);

      if (
        beforeAllHook ||
        beforeHook ||
        actionBeforeHook ||
        afterAllHook ||
        afterHook ||
        actionAfterHook ||
        errorAllHook ||
        errorHook ||
        actionErrorHook
      ) {
        return function actionHookMiddleware(ctx: Context) {
          if (!ctx.service) return;
          let p = Promise.resolve();
          if (beforeAllHook) p = p.then(() => callHook(beforeAllHook, ctx.service, ctx));
          if (beforeHook) {
            beforeHook.forEach((fnHook) => {
              p = p.then(() => callHook(fnHook, ctx.service, ctx));
            });
          }
          if (actionBeforeHook) {
            p = p.then(() => {
              callHook(actionBeforeHook, ctx.service, ctx);
            });
          }

          p = p.then(() => handler(ctx));

          if (actionAfterHook) {
            p = p.then((res) => {
              callHook(actionAfterHook, ctx.service, ctx, res);
            });
          }
          if (afterHook) {
            afterHook.forEach((fnHook) => {
              p = p.then((res) => callHook(fnHook, ctx.service, ctx, res));
            });
          }
          if (afterAllHook) {
            p = p.then((res) => callHook(afterAllHook, ctx.service, ctx, res));
          }

          if (actionErrorHook) {
            p = p.catch((error) => callErrorHook(actionErrorHook, ctx.service, ctx, error));
          }
          if (errorHook) {
            errorHook.forEach((fnHook) => {
              p = p.catch((error) => callErrorHook(fnHook, ctx.service, ctx, error));
            });
          }
          if (errorAllHook) {
            p = p.catch((error) => callErrorHook(errorAllHook, ctx.service, ctx, error));
          }

          return p;
        };
      }
    }

    return handler;
  }

  return { name: 'ActionHook', localAction: wrapActionHookMiddleware };
}
