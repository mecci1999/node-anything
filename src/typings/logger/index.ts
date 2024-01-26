import { GenericObject } from '..';

// 日志分类
export enum BaseLoggerLevels {
  fatal = 'fatal', // 崩溃
  error = 'error', // 错误
  warn = 'warn', // 警告
  debug = 'debug', // debug
  info = 'info', // 信息
  trace = 'trace' // 跟踪
}

/**
 * 格式化日志模块选项
 */
export interface FormattedLoggerOptions {
  colors?: boolean; // 是否开启颜色
  moduleColor?: boolean | string[] | string; // 颜色模块
  formatter?: any; // 格式化模式
  objectPrinter?: any;
  autoPadding?: boolean;
  folder: string; // 日志文件路径
  filename: string; // 日志文件名
  eol: any; // 换行符
  interval: number; // 日志更新时间
}

export interface LogLevelConfig {
  type?: BaseLoggerLevels; // 类型
  options?: GenericObject;
}

export interface LoggerBindings {
  nodeID?: string;
  namespace?: string;
  mod?: string;
  svc?: string;
  ver?: string;
}

// 日志实例类
export class LoggerInstance {
  fatal(...args: any[]): void {}
  error(...args: any[]): void {}
  warn(...args: any[]): void {}
  info(...args: any[]): void {}
  debug(...args: any[]): void {}
  trace(...args: any[]): void {}
}
