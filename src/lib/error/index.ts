/**
 * 错误处理模块
 * 该模块用来描述微服务异常过程中所产生的异常场景
 */
import { recreateError, resolveRengerator, Regenerator } from './service';
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

export {
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
  ValidationError,
  recreateError,
  resolveRengerator,
  Regenerator
};
