import Context from '../context';
import Star from '../star';

/**
 * 事件节流
 */
const throttleMiddleware = (star: Star) => {
  const wrapEventThrottleMiddleware = (handler: any, event: any) => {
    if (event.throttle && event.throttle > 0) {
      // 上一次阻止时间
      let lastInvoke = 0;

      return function throttleMiddleware(ctx: Context) {
        const now = Date.now();
        if (now - lastInvoke < event.throttle) {
          // 没有到下一次可触发时间
          return Promise.resolve();
        }

        lastInvoke = now;

        return handler(ctx);
      }.bind(this);
    }

    return handler;
  };

  return {
    name: 'Throttle',
    localEvent: wrapEventThrottleMiddleware
  };
};

export default throttleMiddleware;
