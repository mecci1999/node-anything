/**
 * 日志模块中的基础类
 */
import _ from 'lodash';
import { isObject, isString } from '@/utils/index';
import { BaseLoggerLevels } from '@/typings/logger';

// 日志模块分类
const LEVELS: BaseLoggerLevels[] = [
  BaseLoggerLevels.fatal, // 崩溃
  BaseLoggerLevels.error, // 错误
  BaseLoggerLevels.warn, // 警告
  BaseLoggerLevels.info, // 信息
  BaseLoggerLevels.debug, // debug
  BaseLoggerLevels.trace // 跟踪
];

// 基础类
export class BaseLogger {
  // 选项
  private options = {};
  private Promise;

  constructor(options) {
    this.options = _.defaultsDeep(options, { level: BaseLoggerLevels.info, createLogger: null });
    // 使用Promise
    this.Promise = Promise;
  }

  // 初始化
  public init() {}
}
