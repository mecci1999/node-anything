import { UniverseErrorOptions, UniverseErrorType, UniversePlainError } from '@/typings/error';
import {
  GracefulStopTimeoutError,
  InvalidPacketDataError,
  MaxCallLevelError,
  ProtocolVersionMismatchError,
  QueueIsFullError,
  ServiceNotFoundError,
  ServiceSchemaError,
  StarClientError,
  StarDisconnectedError,
  StarOptionsError,
  StarServerError,
  UniverseError,
  UniverseRetryableError,
  ValidationError
} from './custom';
import { Star } from '../star';
import { GenericObject } from '@/typings';

export function recreateError(error: UniversePlainError) {
  switch (error.name) {
    case UniverseErrorType.UniverseError:
      return new UniverseError(error.message, error.code, error.type, error.data);
    case UniverseErrorType.UniverseRetryableError:
      return new UniverseRetryableError(error.message, error.code, error.type, error.data);
    case UniverseErrorType.StarServerError:
      return new StarServerError(error.message, error.code, error.type, error.data);
    case UniverseErrorType.StarClientError:
      return new StarClientError(error.message, error.code, error.type, error.data);

    case UniverseErrorType.ValidationError:
      return new ValidationError(error.message, error.type, error.data);

    case UniverseErrorType.ServiceNotFoundError:
      return new ServiceNotFoundError(error.data);
    case UniverseErrorType.ServiceNotAvailableError:
      return new ServiceNotFoundError(error.data);
    case UniverseErrorType.RequestSkippedError:
      return new ServiceNotFoundError(error.data);
    case UniverseErrorType.RequestRejectedError:
      return new ServiceNotFoundError(error.data);
    case UniverseErrorType.RequestTimeoutError:
      return new ServiceNotFoundError(error.data);
    case UniverseErrorType.MaxCallLevelError:
      return new MaxCallLevelError(error.data);
    case UniverseErrorType.QueueIsFullError:
      return new QueueIsFullError(error.data);
    case UniverseErrorType.GracefulStopTimeoutError:
      return new GracefulStopTimeoutError(error.data);
    case UniverseErrorType.ProtocolVersionMismatchError:
      return new ProtocolVersionMismatchError(error.data);
    case UniverseErrorType.InvalidPacketDataError:
      return new InvalidPacketDataError(error.data);

    case UniverseErrorType.ServiceSchemaError:
      return new ServiceSchemaError(error.message, error.data);
    case UniverseErrorType.StarOptionsError:
      return new StarOptionsError(error.message, error.data);

    case UniverseErrorType.StarDisconnectedError:
      return new StarDisconnectedError();
  }
}

/**
 * 错误生成器
 */
export class Regenerator {
  public star: Star | null = null;

  /**
   * init
   * 初始化
   */
  public init(star: Star) {
    this.star = star;
  }

  /**
   * Restore an Error object
   * 根据错误类型定义，创建对应的错误类实例
   */
  public restore(plainError: UniversePlainError, payload: GenericObject): Error {
    let err = this.restoreCustomError(plainError, payload);
    if (!err) err = recreateError(plainError);
    // 默认兜底
    if (!err) err = this.createDefaultError(plainError);

    // 初始化
    this.restoreExternalFields(plainError, err, payload);
    this.restoreStack(plainError, err);

    return err;
  }

  /**
   * Hook to restore a custom error in a child class
   * 创建一个自定义错误子类
   */
  public restoreCustomError(plainError: UniversePlainError, payload: GenericObject): Error | undefined {
    return undefined;
  }

  /**
   * Creates a default error if not found
   * 如果该错误类型未知，则创建一个默认的错误类
   */
  private createDefaultError(plainError: UniversePlainError): UniverseError {
    const err = new UniverseError(plainError.message);
    err.name = plainError.name;
    err.code = plainError.code;
    err.type = plainError.type;
    err.data = plainError.data;

    return err;
  }

  /**
   * Restores external error fields
   * 将外部的错误信息，存储到本地错误中
   */
  private restoreExternalFields(plainError: UniversePlainError, err: any, payload: GenericObject) {
    err.retryable = plainError.retryable;
    err.nodeID = plainError.nodeID || payload.sender;
  }

  /**
   * Restores an error stack
   */
  private restoreStack(plainError: UniversePlainError, err: any) {
    if (plainError.stack) err.stack = plainError.stack;
  }
}

export function resolveRengerator(options: any): Regenerator {
  if (options instanceof Regenerator) {
    return options;
  }

  return new Regenerator();
}
