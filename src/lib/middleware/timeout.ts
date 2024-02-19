import promiseTimeout from '@/utils/promiseTimeout';
import Context from '../context';
import { RequestTimeoutError } from '../error/custom';
import { METRIC } from '../metrics';
import Star from '../star';

/**
 * 超时处理
 */
const timeoutHandlerMiddleware = (star: Star) => {
  const wrapTimeoutMiddleware = (handler: any, action: any) => {
    const actionTimeout = action?.timeout;
    const actionName = action?.name;
    const service = action.service ? action.service.fullName : null;

    return function timeoutMiddleware(ctx: Context) {
      if (ctx.options.timeout == null) {
        if (actionTimeout != null) {
          ctx.options.timeout = actionTimeout;
        } else {
          ctx.options.timeout = star.options.requestTimeout;
        }
      }

      if ((ctx.options.timeout as number) > 0 && !ctx.starHrTime) {
        ctx.starHrTime = process.hrtime();
      }
      console.log(`------------ timeout ------------`, handler, action);
      const p = handler(ctx) as Promise<any>;
      if ((ctx.options.timeout as number) > 0) {
        return promiseTimeout(p, ctx.options.timeout as number).catch((err) => {
          if (err) {
            const nodeID = ctx.nodeID;
            star.logger?.warn(`Request '${actionName}' is timed out.`, {
              requestID: ctx.requestID,
              nodeID,
              timeout: ctx.options.timeout
            });
            err = new RequestTimeoutError({ action: actionName, nodeID: nodeID || 'Unknown' });
            star.metrics?.increment(METRIC.UNIVERSE_REQUEST_TIMEOUT_TOTAL, { service, action: actionName });
          }

          throw err;
        });
      }

      return p;
    }.bind(star);
  };

  return {
    name: 'Timeout',
    created(star: Star) {
      if (star.isMetricsEnabled()) {
        star.metrics?.register({
          name: METRIC.UNIVERSE_REQUEST_TIMEOUT_TOTAL,
          type: METRIC.TYPE_COUNTER,
          labelNames: ['service', 'action'],
          description: 'Number of timed out requests',
          rate: true
        });
      }
    },
    localAction: wrapTimeoutMiddleware,
    remoteAction: wrapTimeoutMiddleware
  };
};

export default timeoutHandlerMiddleware;
