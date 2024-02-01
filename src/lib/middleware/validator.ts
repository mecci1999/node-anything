import { deprecate, isFunction } from '@/utils';
import Star from '../star';

/**
 * 参数校验
 */
export default function ValidatorMiddleware(star: Star) {
  if (star.validator && isFunction(star.validator.middleware)) {
    const middleware = star.validator.middleware(star);
    if (isFunction(middleware)) {
      deprecate('Validator middleware returning a Function is deprecated. Return a middleware object instead.');

      return {
        name: 'Validator',
        localAction: middleware
      };
    }

    return middleware;
  }

  return null;
}
