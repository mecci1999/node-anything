import { UniverseErrorCode } from '@/typings/error';
import Context from '../context';
import { UniverseError } from '../error';
import Star from '../star';

/**
 * 错误处理中间件
 */
const wrapActionErrorHandler = (handler: any, bind: any) => {
  const errorHandlerMiddleware = (ctx: Context) => {
    return handler(ctx).catch((err) => {
      if (!(err instanceof Error)) err = new UniverseError(err, UniverseErrorCode.SERVICE_ERROR);

      if (ctx.nodeID !== bind.star.nodeID) {
        if (bind.star.transit) {
          bind.star.transit?.removePendingRequest(ctx.id);
        }
      }

      bind.star.logger?.debug(`The '${ctx.action?.name}' request is rejected.`, { requestID: ctx.parentID, err });

      Object.defineProperty(err, 'ctx', { value: ctx, writable: true, enumerable: false });

      return ctx.star.errorHandler(err, { ctx, service: ctx.service, action: ctx.action });
    });
  };

  return errorHandlerMiddleware.bind(bind.star);
};

const wrapEventErrorHandler = (handler: any, star: Star) => {
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
