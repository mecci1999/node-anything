/**
 * 使用pino库处理日志
 */
import BaseLogger from './base';
import _ from 'lodash';
import { GenericObject } from '@/typings';
import { isFunction } from '@/utils';
import { LoggerFactory } from './factory';
import Pino from 'pino';
import { Star } from '../star';
import { BaseLoggerLevels } from '@/typings/logger';

export class PinoLogger extends BaseLogger {
  private pino: any = null;

  constructor(options: GenericObject) {
    super(options);

    this.options = _.defaultsDeep(this.options, {
      pino: {
        options: null, // http://getpino.io/#/docs/api?id=options-object
        destination: null // http://getpino.io/#/docs/api?id=destination-sonicboom-writablestream-string
      }
    });
  }

  /**
   * init
   * 初始化
   */
  public init(loggerFactory: LoggerFactory) {
    super.init(loggerFactory);

    try {
      this.pino = Pino(
        this.options.pino && this.options.options ? this.options.pino.options : undefined,
        this.options.pino && this.options.pino.destination ? this.options.pino.destination : undefined
      );
    } catch (error) {
      (this.star as Star).fatal(
        "The 'pino' package is missing! Please install it with 'yarn add pino --save' command!",
        error,
        true
      );
    }
  }

  public getLogHandler(bindings: GenericObject): any {
    let level = bindings ? this.getLogLevel(bindings.mod) : null;
    if (!level) return null;

    const logger = isFunction(this.options.createLogger)
      ? this.options.createLogger(level, bindings)
      : this.pino.child(bindings, { level });

    return (type: BaseLoggerLevels, args: any) => logger[type](...args);
  }
}
