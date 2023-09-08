import { GenericObject } from '@/typings';
import { Star } from '../star';
import { Middleware } from '@/typings/middleware';
import { isFunction, isObject, isString } from '@/utils';
import _ from 'lodash';
import Middlewares from './index';
import { StarOptionsError } from '../error';

export default class MiddlewareHandler {
  public star: Star;
  public list: Array<Middleware>;
  public registeredHooks: GenericObject;

  constructor(star: Star) {
    this.star = star;
    this.list = [];
    this.registeredHooks = {};
  }

  public add(middleware: any) {
    if (!middleware) return;

    if (isString(middleware)) {
      // 字符串
      const found = _.get(Middlewares, middleware);
      if (!found)
        throw new StarOptionsError(`Invalid built-in middleware type '${middleware}'.`, {
          type: middleware
        });
      middleware = found;
    }

    if (isFunction(middleware)) {
      middleware = middleware.call(this.star, this.star);
    }

    if (!middleware) return;

    if (!isObject(middleware)) {
      throw new StarOptionsError(`Invalid middleware type '${typeof middleware}'. Accept only Object or Function.`, {
        type: typeof middleware,
        value: middleware
      });
    }

    Object.keys(middleware).forEach((key) => {
      if (isFunction(middleware[key])) {
        if (Array.isArray(this.registeredHooks[key])) {
          this.registeredHooks[key].push(middleware[key]);
        } else {
          this.registeredHooks[key] = middleware[key];
        }
      }
    });

    this.list.push(middleware);
  }

  /**
   * 封装处理器
   * @param method
   * @param handler
   * @param def
   * @returns
   */
  public wrapHandler(method: string, handler: Function, def: Object) {
    if (this.registeredHooks[method] && this.registeredHooks[method].length) {
      handler = this.registeredHooks[method].reduce((handler, fn) => {
        return fn.call(this.star, handler, def);
      }, handler);
    }

    return handler;
  }

  /**
   * 异步完成所有的中间件的某个处理器
   * @param method
   * @param args
   * @param options
   * @returns
   */
  public callHandles(method: string, args: Array<any>, options: { reverse: boolean } = { reverse: false }) {
    if (this.registeredHooks[method] && this.registeredHooks[method].length) {
      const list = options.reverse ? Array.from(this.registeredHooks[method]).reverse() : this.registeredHooks[method];

      return list.reduce((p, fn) => {
        p.then(() => fn.apply(this.star, args));
      }, Promise.resolve());
    }
  }

  /**
   * 同步完成所有的中间件的某个处理器
   * @param method
   * @param args
   * @param options
   * @returns
   */
  public callSyncHandles(method: string, args: Array<any>, options: { reverse?: boolean } = { reverse: false }) {
    if (this.registeredHooks[method] && this.registeredHooks[method].length) {
      const list = options.reverse ? Array.from(this.registeredHooks[method]).reverse() : this.registeredHooks[method];

      return list.map((fn) => {
        fn.apply(this.star, args);
      });
    }
  }

  /**
   * 获取所有注册的中间件数量
   */
  public count() {
    return this.list.length;
  }

  /**
   * 封装一个方法
   */
  public wrapMethod(method: string, handler: Function, bindTo?: any, options?: { reverse?: boolean }) {
    if (this.registeredHooks[method] && this.registeredHooks[method].length) {
      const list = options?.reverse ? Array.from(this.registeredHooks[method]).reverse() : this.registeredHooks[method];
      handler = list.reduce((next, fn) => {
        return fn.call(bindTo, next);
      }, handler.bind(bindTo));
    }

    return handler;
  }
}
