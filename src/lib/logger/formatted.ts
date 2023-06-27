import util from 'util';
import _ from 'lodash';
import kleur from 'kleur';
import { isObject, isFunction } from '@/utils/index';
import BaseLogger, { LEVELS } from './base';
import { BaseLoggerLevels } from '@/typings/logger';
import { GenericObject } from '@/typings';
import { LoggerFactory } from './factory';
import { FormattedLoggerOptions } from '@/typings/logger/index';

export function getColor(type: BaseLoggerLevels) {
  switch (type) {
    case BaseLoggerLevels.fatal:
      return kleur.red().inverse;
    case BaseLoggerLevels.error:
      return kleur.red;
    case BaseLoggerLevels.warn:
      return kleur.yellow;
    case BaseLoggerLevels.debug:
      return kleur.magenta;
    case BaseLoggerLevels.trace:
      return kleur.gray;
    case BaseLoggerLevels.info:
      return kleur.green;
    default:
      return kleur.green;
  }
}

export default class FormattedLogger extends BaseLogger {
  public options: GenericObject | FormattedLoggerOptions = {};
  public maxPrefixLength: number = 0;
  public objectPrinter: any;
  public levelColorStr: object = {};

  constructor(options: GenericObject | FormattedLoggerOptions) {
    super(options);

    this.options = _.defaultsDeep(this.options, {
      colors: true,
      moduleColors: false,
      formatter: 'full',
      objectPrinter: null,
      autoPadding: false
    });

    this.maxPrefixLength = 0;
  }

  /**
   * init
   * 初始化
   */
  public init(loggerFactory: LoggerFactory) {
    super.init(loggerFactory);

    if (!this.options.colors) kleur.enabled = false; // 禁止颜色输出
    // 对象输出打印方法
    this.objectPrinter = this.options.objectPrinter
      ? this.options.objectPrinter
      : (object: any) =>
          util.inspect(object, {
            showHidden: false,
            depth: 2,
            colors: kleur.enabled,
            breakLength: Number.POSITIVE_INFINITY
          });
    // 获取日志级别对应的颜色
    this.levelColorStr = LEVELS.reduce((err, level) => {
      err[level] = getColor(level)(_.padEnd(level.toUpperCase(), 5));
      return err;
    }, {});
    if (this.options.colors && this.options.moduleColor === true) {
      this.options.moduleColor = [
        'yellow',
        'bold.yellow',
        'cyan',
        'bold.cyan',
        'green',
        'bold.green',
        'magenta',
        'bold.magenta',
        'blue',
        'bold.blue'
        /*"red",*/
        /*"grey",*/
        /*"white,"*/
      ];
    }
  }

  // 获取模块对应的颜色
  public getNextColor(mod: string) {
    if (this.options.colors && Array.isArray(this.options.moduleColor)) {
    }

    return 'grey';
  }
}
