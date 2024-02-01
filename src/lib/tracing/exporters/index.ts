import { isInheritedClass, isObject, isString } from '@/utils';
import { StarOptionsError } from '../../error';
import BaseTraceExporter from './base';
import { UniverseErrorOptionsType } from '@/typings/error';

const Exporters = {
  Base: BaseTraceExporter
};

/**
 * 根据模块名获得实例
 * @param name
 * @returns
 */
function getByName(name: string) {
  if (!name) return null;

  let instanceName = Object.keys(Exporters).find((key) => key.toLocaleLowerCase() === name.toLocaleLowerCase());

  if (instanceName) return Exporters[instanceName];
}

function resolve(options: object | string) {
  if (isObject(options) && isInheritedClass(options as object, Exporters.Base)) {
    return options;
  } else if (isString(options)) {
    let ExporterClass = getByName(options as string);

    if (ExporterClass) {
      return new ExporterClass();
    } else {
      throw new StarOptionsError(`Invalid tracing expoter type '${options}'.`, {
        type: options as UniverseErrorOptionsType
      });
    }
  } else if (isObject(options)) {
    let ExporterClass = getByName((options as any).type);
    if (ExporterClass) {
      return new ExporterClass((options as any).options);
    } else {
      throw new StarOptionsError(`Invalid tracing exporter type '${(options as any).type}.'`, {
        type: (options as any).type as UniverseErrorOptionsType
      });
    }
  }

  throw new StarOptionsError(`Invalid tracing exporter type ${options}.`, { type: options as any });
}

function register(name: string, value: typeof BaseTraceExporter) {
  Exporters[name] = value;
}

export default Object.assign(Exporters, { resolve, register });
