/**
 * 自定义错误模块
 */
import { UniverseErrorType, UniverseErrorCode } from '@/typings/error';
import BaseError from './base';

/**
 * 自定义基础错误类
 * 该类用来作为微服务应用所有错误类的基础类
 */
export class UniverseError extends BaseError {
  public code?: number; // 错误码
  public type?: string; // 错误类型
  public data?: any; // 错误数据
  public retryable: boolean; // 是否可以重新连接

  constructor(message: string, code?: UniverseErrorCode, type?: UniverseErrorType, data?: any) {
    super(message);
    this.code = code || UniverseErrorCode.BAD_GETWAY;
    this.type = type;
    this.data = data;
    this.retryable = false;
  }
}

/**
 * 可重试错误类
 * 为了满足在微服务应用中出现的可重试错误场景，创建该错误类
 */
export class UniverseRetryableError extends UniverseError {
  constructor(message: string, code?: UniverseErrorCode, type?: UniverseErrorType, data?: any) {
    super(message, code, type, data);
    this.retryable = true;
  }
}

/**
 * 可重试断开链接错误类
 * 为了处理在微服务应用中star的连接中断时，可重新连接的错误
 */
export class StarDisconnectedError extends UniverseRetryableError {
  constructor() {
    super(`The star's transporter has disconnected. Please try again when a connection is reestablished.`, 502, UniverseErrorType.BAD_GETWAY);
    this.stack = '';
  }
}

/**
 * 服务端错误类
 * 为了处理可重试的服务器错误
 */
export class StarServerError extends UniverseRetryableError {}

/**
 * 客户端错误类
 * 为了处理不可重试的客户端错误
 */
export class StarClientError extends UniverseError {
  constructor(message: string, code: UniverseErrorCode, type: UniverseErrorType, data?: any) {
    super(message, code || UniverseErrorCode.RESPONSE_ERROR, type, data);
  }
}

/**
 * 服务未发现错误类
 * 为了处理没有找到对应服务错误
 */
export class ServiceNotFoundError extends UniverseRetryableError {
  constructor(data: { nodeID?: string; version?: string; action?: any; service?: any } = {}) {
    let msg: string = '';

    if (data?.nodeID && data?.action) msg = `Service '${data?.action}' is not found on '${data?.nodeID}' node.`;
    else if (data?.action) msg = `Service '${data?.action}' is not found.`;
    if (data?.service && data?.version) msg = `Service '${data?.version}.${data?.service}' not found.`;
    else if (data?.service) msg = `Service '${data?.service}' not found.`;

    super(msg, UniverseErrorCode.SERVICE_NOT_FOUND, UniverseErrorType.SERVICE_NOT_FOUND, data);
  }
}

/**
 * 服务不可用错误类
 * 为了处理服务当前无法提供服务，例如正在维护、服务停止、网络错误、数据中心故障等
 */
export class ServiceNotAvailableError extends UniverseRetryableError {
  constructor(data: { nodeID?: string; action?: any } = {}) {
    let msg: string = '';
    if (data?.nodeID) msg = `Service '${data?.action}' is not available on '${data?.nodeID}' node.`;
    else msg = `Service '${data?.action}' is not available.`;

    super(msg, UniverseErrorCode.SERVICE_NOT_FOUND, UniverseErrorType.SERVICE_NOT_AVAILABLE, data);
  }
}
