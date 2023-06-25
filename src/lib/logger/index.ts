/**
 * 日志模块
 */
import { BaseLoggerLevels } from '@/typings/logger';
import { StarOptionsError } from '../error';
import BaseLogger, { LEVELS } from './base';
import { isInheritedClass, isObject, isString } from '@/utils';

export const Loggers = {
  BaseLogger,

  LEVELS: LEVELS
};

/**
 * 根据日志名获取类型的实例
 */
export function getLoggerByName(name: string) {
  if (!name) return null;

  let logger = Object.keys(Loggers).find((logger) => logger.toLocaleLowerCase() == name.toLocaleLowerCase());
  if (logger) return Loggers[logger];
}

/**
 * 根据选项创建对应类型的日志实例
 */
export function resolve(options: any) {
  if (isObject(options) && isInheritedClass(options, BaseLogger)) {
    return options;
  } else if (isString(options)) {
    let LoggerClass = getLoggerByName(options);
    if (LoggerClass) return new LoggerClass();
  } else if (isObject(options)) {
    let LoggerClass = getLoggerByName(options.type);
    if (LoggerClass) return new LoggerClass(options.options);

    throw new StarOptionsError(`Invalid logger configuration. Type '${options.type}'`, { type: options.type });
  }

  throw new StarOptionsError(`Invalid logger configuration: '${options}'`, { type: options });
}

export function register(name: string, value: any) {
  Loggers[name] = value;
}

export default { Loggers, resolve, register };
