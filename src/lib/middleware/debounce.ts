import Context from '../context';
import Star from '../star';

/**
 * 事件防抖
 */
const debounceMiddleware = (star: Star) => {
  const wrapEventDebounceMiddleware = (handler: any, event: any) => {
    if (event.debounce && event.debounce > 0) {
      let timer: any;

      return function debounceMiddleware(ctx: Context) {
        if (timer) {
          clearTimeout(timer);
        }

        timer = setTimeout(() => {
          timer = null;
          return handler(ctx);
        }, event.debounce);

        return Promise.resolve();
      }.bind(star);
    }

    return handler;
  };

  return {
    name: 'Debounce',
    localEvent: wrapEventDebounceMiddleware
  };
};

export default debounceMiddleware;
