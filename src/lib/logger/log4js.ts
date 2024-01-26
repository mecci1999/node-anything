import BaseLogger from './base';
import _ from 'lodash';
import { isFunction } from '@/utils';
import { GenericObject } from '@/typings';
import { LoggerFactory } from './factory';
import log4js, { Log4js, Logger } from 'log4js';
import Star from '../star';
import { BaseLoggerLevels } from '@/typings/logger';

export class Log4jsLogger extends BaseLogger {
  private log4js: Log4js | null = null;

  constructor(options: GenericObject) {
    super(options);

    this.options = _.defaultsDeep(this.options, {});
  }

  /**
   * init
   * 初始化
   */
  public init(loggerFactory: LoggerFactory) {
    super.init(loggerFactory);

    try {
      if (this.options.log4js) {
        // 配置日志记录器
        this.log4js = log4js.configure(this.options.log4js);
      }
    } catch (error) {
      (this.star as Star).fatal(
        "The 'log4js' package is missing! Please install it with 'npm install log4js --save' command!",
        error,
        true
      );
    }
  }

  /**
   * 停止写入日志
   */
  public stop(): Promise<any> {
    if (this.log4js) {
      return new Promise((resolve) => this.log4js?.shutdown(resolve));
    }

    return Promise.resolve();
  }

  /**
   * 日志处理方法
   */
  public getLogHandler(bindings: GenericObject): any {
    let level = bindings ? this.getLogLevel(bindings.mod) : null;
    if (!level) return null;

    let logger: Logger;
    if (isFunction(this.options.createLogger)) logger = this.options.createLogger(level, bindings);
    else {
      if (this.log4js) {
        // 获取日志实例
        logger = this.log4js?.getLogger(bindings.mod.toUpperCase());
        logger.level = level;
      }
    }

    return (type: BaseLoggerLevels, args: any) => logger[type]([...args]);
  }
}
