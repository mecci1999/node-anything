import BaseLogger from '@/lib/logger/base';
import { BaseLoggerLevels, LogLevelConfig } from '../logger';

/**
 * 星星类
 */
export interface StarOptions {
  namespace?: string | null; // 命名
  nodeID?: string | null; // nodeID

  logger?: BaseLogger | LogLevelConfig | LogLevelConfig[] | boolean | null; // 日志对象
  logLevel?: BaseLoggerLevels | LogLevelConfig | null; // 日志级别

  Promise?: PromiseConstructorLike;
}
