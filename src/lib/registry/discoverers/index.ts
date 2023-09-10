import { isInheritedClass, isObject, isString } from '@/utils';
import BaseDiscoverer from './base';
import Etcd3Discoverer from './etcd3';
import RedisDiscoverer from './redis';

/**
 * 服务发现模块
 */
const Discoverers = {
  Base: BaseDiscoverer,
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
  }
}

function register(name, value) {
  Discoverers[name] = value;
}

export default Object.assign(Discoverers, { resolve, register });
