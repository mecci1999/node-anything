import Context from '../context';
import { GracefulStopTimeoutError } from '../error';
import Star from '../star';

const contextTrackerMiddleware = (star: Star) => {
  const addContext = (ctx: Context) => {
    if (ctx.service) {
      (ctx.service as any)._trackedContexts.push(ctx);
    } else {
      (ctx.star as any)._trackedContexts.push(ctx);
    }
  };

  function removeContenxt(ctx: Context) {
    if (ctx.service) {
      const index = (ctx.service as any)._trackedContexts.indexOf(ctx);
      if (index !== -1) {
        (ctx.service as any)._trackedContexts.splice(index, 1);
      }
    } else {
      const index = (ctx.star as any)._trackedContexts.indexOf(ctx);
      if (index !== -1) {
        (ctx.star as any)._trackedContexts.splice(index, 1);
      }
    }
  }

  function wrapTrackerMiddleware(handler: any) {
    if (star.options.tracking && star.options.tracking.enabled) {
      return function ContextTrackerMiddleware(ctx: Context) {
        const tracked = ctx.options.tracking !== null ? ctx.options.tracking : star.options.tracking?.enabled;

        if (!tracked) {
          return handler(ctx);
        }

        addContext(ctx);

        let p = handler(ctx);

        p = p
          .then((res) => {
            removeContenxt(ctx);
            return res;
          })
          .catch((err) => {
            removeContenxt(ctx);
            throw err;
          });

        return p;
      };
    }

    return handler;
  }

  function waitingForActiveContexts(list: any[], logger: any, time: number, service?: any): Promise<void> {
    if (!list || list.length === 0) return Promise.resolve();

    return new Promise((resolve) => {
      let timeOut = false;

      const timeout = setTimeout(() => {
        timeOut = true;
        logger.error(new GracefulStopTimeoutError({ service }));
        list.length = 0;
        resolve();
      }, time);

      let first = true;

      const checkForContexts = () => {
        if (list.length === 0) {
          clearTimeout(timeout);
          resolve();
        } else {
          if (first) {
            logger.warn(`Waiting for ${list.length} running context(s)...`);
            first = false;
          }

          if (!timeOut) {
            setTimeout(checkForContexts, 100);
          }
        }
      };

      setImmediate(checkForContexts);
    });
  }

  return {
    name: 'ContextTracker',
    localAction: wrapTrackerMiddleware,
    remoteAction: wrapTrackerMiddleware,

    localEvent: wrapTrackerMiddleware,

    created(star: any) {
      star._trackedContexts = [];
    },

    serviceStarting(service: any) {
      service._trackedContexts = [];
    },

    serviceStopping(service: any) {
      return waitingForActiveContexts(
        service._trackedContexts,
        service.logger,
        service.settings.$shutdownTimeout || service.star.options.tracking.shutdownTimeout,
        service
      );
    },

    stopping(star: any) {
      return waitingForActiveContexts(star._trackedContexts, star.logger, star.options.tracking.shutdownTimeout);
    }
  };
};

export default contextTrackerMiddleware;
