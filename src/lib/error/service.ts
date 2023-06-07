import { UniverseErrorOptions, UniverseErrorType } from '@/typings/error';
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

export function recreateError(error: UniverseErrorOptions) {
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

export class Regenerator {
  private star: Star | null = null;

  // 初始化
  init(star: Star) {
    this.star = star;
  }
}
