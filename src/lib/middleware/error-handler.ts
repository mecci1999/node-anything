import { UniverseErrorCode } from '@/typings/error';
import Context from '../context';
import { UniverseError } from '../error';
import Star from '../star';

/**
 * 错误处理中间件
 */
const wrapActionErrorHandler = (star: Star, handler: any) => {
  const errorHandlerMiddleware = (ctx: Context) => {
    return handler(ctx).catch((err) => {
      if (!(err instanceof Error)) err = new UniverseError(err, UniverseErrorCode.SERVICE_ERROR);

      if (ctx.nodeID !== star.nodeID) {
        if (star.transit) {
          star.transit?.removePendingRequest(ctx.id);
        }
      }

      star.logger?.debug(`The '${ctx.action?.name}' request is rejected.`, { requestID: ctx.parentID, err });

      Object.defineProperty(err, 'ctx', { value: ctx, writable: true, enumerable: false });

      return ctx.star.errorHandler(err, { ctx, service: ctx.service, action: ctx.action });
    });
  };

  return errorHandlerMiddleware.bind(star);
};

const wrapEventErrorHandler = (star: Star, handler: any) => {
  const errorHandlerMiddleware = (ctx: Context) => {
    return handler(ctx)
      .catch((err) => {
        if (!(err instanceof Error)) err = new UniverseError(err, UniverseErrorCode.SERVICE_ERROR);

        star.logger?.debug(`The '${ctx.action?.name}' request is rejected.`, { requestID: ctx.parentID, err });

        Object.defineProperty(err, 'ctx', { value: ctx, writable: true, enumerable: false });

        return ctx.star.errorHandler(err, { ctx, service: ctx.service, action: ctx.action });
      })
      .catch((err) => {
        ctx.star.logger?.error(err);
      });
  };

  return errorHandlerMiddleware.bind(star);
};

export default function () {
  return {
    name: 'ErrorHandler',

    localAction: wrapActionErrorHandler,
    remoteAction: wrapActionErrorHandler,
    localEvent: wrapEventErrorHandler
  };
}
