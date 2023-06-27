import { GenericObject } from '..';

// 日志分类
export enum BaseLoggerLevels {
  fatal = 'fatal', // 崩溃
  error = 'error', // 错误
  warn = 'warn', // 警告
  info = 'info', // 信息
  debug = 'debug', // debug
  trace = 'trace' // 跟踪
}

/**
 * 格式化日志模块选项
 */
export interface FormattedLoggerOptions {
  colors?: boolean; // 是否开启颜色
  moduleColor?: boolean | string[] | string; // 颜色模块
  formatter?: string; // 格式化模式
  objectPrinter?: any;
  autoPadding?: boolean;
}

export interface LogLevelConfig {
  type?: BaseLoggerLevels; // 类型
  options?: GenericObject;
}

export interface LoggerBindings {
  nodeID: string;
  ns: string;
  mod: string;
  svc: string;
  ver?: string;
}
