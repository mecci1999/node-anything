// 基础错误类
export default class BaseError extends Error {
  constructor(message: string = '') {
    super(message);

    Object.defineProperty(this, 'message', { configurable: true, enumerable: false, value: message, writable: true });

    Object.defineProperty(this, 'name', { configurable: true, enumerable: false, value: this.constructor.name, writable: true });

    // 是否存在captureStackTrace()方法
    if (Object.prototype.hasOwnProperty.call(Error, 'captureStackTrace')) {
      Error.captureStackTrace(this, this.constructor);
      return;
    }

    Object.defineProperty(this, 'stack', { configurable: true, enumerable: false, value: new Error(message).stack, writable: true });
  }
}
