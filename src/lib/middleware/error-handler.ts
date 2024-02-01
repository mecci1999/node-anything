import { UniverseErrorCode } from '@/typings/error';
import Context from '../context';
import { UniverseError } from '../error';

/**
 * 错误处理中间件
 */
const wrapActionErrorHandler = (handler: any) => {
  const errorHandlerMiddleware = (ctx: Context) => {
    return handler(ctx).catch((err) => {
      if (!(err instanceof Error)) err = new UniverseError(err, UniverseErrorCode.SERVICE_ERROR);

      if (ctx.nodeID !== (this as any).nodeID) {
        if ((this as any).transit) {
          (this as any).transit.removePendingRequest(ctx.id);
        }
      }

      (this as any).logger.debug(`The '${ctx.action?.name}' request is rejected.`, { requestID: ctx.parentID, err });

      Object.defineProperty(err, 'ctx', { value: ctx, writable: true, enumerable: false });

      return ctx.star.errorHandler(err, { ctx, service: ctx.service, action: ctx.action });
    });
  };

  return errorHandlerMiddleware.bind(this);
};

const wrapEventErrorHandler = (handler: any) => {
  const errorHandlerMiddleware = (ctx: Context) => {
    return handler(ctx)
      .catch((err) => {
        if (!(err instanceof Error)) err = new UniverseError(err, UniverseErrorCode.SERVICE_ERROR);

        (this as any).logger.debug(`The '${ctx.action?.name}' request is rejected.`, { requestID: ctx.parentID, err });

        Object.defineProperty(err, 'ctx', { value: ctx, writable: true, enumerable: false });

        return ctx.star.errorHandler(err, { ctx, service: ctx.service, action: ctx.action });
      })
      .catch((err) => {
        ctx.star.logger?.error(err);
      });
  };

  return errorHandlerMiddleware.bind(this);
};

export default function () {
  return {
    name: 'ErrorHandler',

    localAction: wrapActionErrorHandler,
    remoteAction: wrapEventErrorHandler,
    localEvent: wrapEventErrorHandler
  };
}
