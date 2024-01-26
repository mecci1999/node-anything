/**
 * 控制台类型输出日志
 */
import { GenericObject } from '@/typings';
import FormattedLogger from './formatted';
import kleur from 'kleur';
import { BaseLoggerLevels, FormattedLoggerOptions } from '@/typings/logger';
import { LoggerFactory } from './factory';
import { LEVELS } from './base';

export default class ConsoleLogger extends FormattedLogger {
  constructor(options: GenericObject | FormattedLoggerOptions) {
    super(options);

    this.maxPrefixLength = 0;
  }

  /**
   * init
   * 初始化
   */
  public init(loggerFactory: LoggerFactory) {
    super.init(loggerFactory);

    if (!this.options.colors) kleur.enabled = false;
  }

  /**
   * 日志输出格式处理方法
   */
  public getLogHandler(bindings: GenericObject): any {
    const level = bindings ? this.getLogLevel(bindings.mod) : null;
    if (!level) return null;

    // 获取索引值
    const levelIndex = LEVELS.indexOf(level);
    const formatter = this.getFormatter(bindings);

    return (type: BaseLoggerLevels, args: any) => {
      const typeIndex = LEVELS.indexOf(type);
      if (typeIndex > levelIndex) return;

      const pargs = formatter(type, args);
      switch (type) {
        case BaseLoggerLevels.fatal:
        case BaseLoggerLevels.error:
          return console.error(...pargs);
        case BaseLoggerLevels.warn:
          return console.warn(...pargs);
        default:
          return console.log(...pargs);
      }
    };
  }
}
