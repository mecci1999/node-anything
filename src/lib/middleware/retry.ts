import Context from '../context';
import { METRIC } from '../metrics';
import Star from '../star';

const RetryMiddleware = (star: Star) => {
  const wrapRetryMiddleware = (handler: any, action: any) => {
    const actionName = action.name;
    const service = action.service ? action.service.fullName : null;

    const options = Object.assign({}, (this as any).options.retryPolicy, action.retryPolicy || {});
    if (options.enabled) {
      return function RetryMiddleware(ctx: Context) {
        const attempts = typeof ctx.options.retries === 'number' ? ctx.options.retries : options.retries;

        if ((ctx as any)._retryAttempts == null) (ctx as any)._retryAttempts = 0;

        return handler(ctx).catch((err) => {
          if (ctx.nodeID != star.nodeID && ctx.endpoint?.local) {
            return Promise.reject(err);
          }

          if (options.check(err)) {
            star.metrics?.increment(METRIC.UNIVERSE_REQUEST_RETRY_ATTEMPTS_TOTAL, { service, action: action.name });

            if ((ctx as any)._retryAttempts < attempts) {
              (ctx as any)._retryAttempts++;
            }
          }
        });
      };
    }
  };

  return wrapRetryMiddleware.bind(this);
};

export default RetryMiddleware;
