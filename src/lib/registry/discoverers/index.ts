import { isInheritedClass, isObject, isString } from '@/utils';
import BaseDiscoverer from './base';
import Etcd3Discoverer from './etcd3';
import RedisDiscoverer from './redis';
import LocalDiscoverer from './local';
import { StarOptionsError } from '@/lib/error';

/**
 * 服务发现模块
 */
const Discoverers = {
  Base: BaseDiscoverer,
  Local: LocalDiscoverer,
  Etcd3: Etcd3Discoverer,
  Redis: RedisDiscoverer
};

function getByName(name: string) {
  if (!name) return null;

  let instanceName = Object.keys(Discoverers).find((item) => item.toLocaleLowerCase() === name.toLocaleLowerCase());
  if (instanceName) return Discoverers[instanceName];
}

function resolve(options: object | string) {
  if (isObject(options) && isInheritedClass(options as object, Discoverers.Base)) {
    return options;
  } else if (isString(options)) {
    let DiscovererClass = getByName(options as string);
    if (DiscovererClass) return new DiscovererClass();

    if ((options as string).startsWith('redis://')) return new Discoverers.Base();

    throw new StarOptionsError(`Invalid Discoverer type '${options}'.`, { type: options as string });
  } else if (isObject(options)) {
    let DiscovererClass = getByName((options as any).type || 'Local');

    if (DiscovererClass) {
      return new DiscovererClass((options as any).options);
    } else {
      throw new StarOptionsError(`Invalid Discoverer type '${(options as any).type}'.`, {
        type: (options as any).type
      });
    }
  }

  return new Discoverers.Local();
}

function register(name, value) {
  Discoverers[name] = value;
}

export default Object.assign(Discoverers, { resolve, register });
