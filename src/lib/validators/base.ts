import { GenericObject } from '@/typings';
import { ValidationError } from '../error';
import _ from 'lodash';
import Star from '../star';
import Context from '../context';
import { ActionHandler, ActionSchema } from '@/typings/context';
import { EventSchema } from '@/typings/context/event';

export default class BaseValidator {
  public options: GenericObject;
  public star: Star | null = null;

  constructor(options: GenericObject) {
    this.options = _.defaultsDeep(options, { paramName: 'params' });
  }

  /**
   * 初始化
   */
  public init(star: Star) {
    this.star = star;
  }

  /**
   * 编译一串验证代码协议
   */
  public compile(schema: any) {
    throw new Error('Abstract method');
  }

  /**
   * 验证方法
   */
  public validate(params: any, schema: any) {
    throw new Error('Abstract method');
  }

  /**
   * 转换协议
   */
  public convertSchemaToUniverse(schema: any) {
    throw new Error('Abstract method');
  }

  /**
   * 作为中间件进行注册
   */
  public middleware(star: Star) {
    const self = this;
    const paramName = this.options.paramName;

    const processCheckResponse = function (ctx: Context, handler: ActionHandler, res: any, additionalInfo: any) {
      if (res === true) return handler(ctx);
      else {
        res = res.map((data) => Object.assign(data, additionalInfo));

        return Promise.reject(new ValidationError('Parameters validation error!', undefined, res));
      }
    };

    return {
      name: 'Validator',
      localAction: function validtorMiddleware(handler: ActionHandler, action: ActionSchema) {
        if (action[paramName] && typeof action[paramName] === 'object') {
          const check: any = self.compile(action[paramName]);

          return function validateContextParams(ctx: Context) {
            const res = check(ctx.params !== null ? ctx.params : {}, { meta: ctx });

            if (check.async) {
              // 异步事件
              return res.then((res) =>
                processCheckResponse(ctx, handler, res, { nodeID: ctx.nodeID, action: ctx.action?.name })
              );
            } else {
              return processCheckResponse(ctx, handler, res, { nodeID: ctx.nodeID, action: ctx.action?.name });
            }
          };
        }

        return handler;
      },

      localEvent: function validatorMiddleware(handler: ActionHandler, event: EventSchema) {
        if (event[paramName] && typeof event[paramName] === 'object') {
          const check: any = self.compile(event[paramName]);

          return function validateContextParams(ctx: Context) {
            const res = check(ctx.params !== null ? ctx.params : {}, { meta: ctx });

            if (check.async) {
              // 异步事件
              return res.then((res) =>
                processCheckResponse(ctx, handler, res, { nodeID: ctx.nodeID, event: ctx.event?.name })
              );
            } else {
              return processCheckResponse(ctx, handler, res, { nodeID: ctx.nodeID, event: ctx.event?.name });
            }
          };
        }

        return handler;
      }
    };
  }
}
