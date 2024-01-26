/**
 * 缓存模块
 */
import { isObject, isString, isInheritedClass } from '@/utils/index';
import BaseCacher from './base';
import { StarOptionsError } from '../error';
import RedisCacher from './redis';
import MemoryCacher from './memory';
import MemoryLRUCacher from './memory-lru';

const Cachers = {
  Base: BaseCacher,
  Redis: RedisCacher,
  Memory: MemoryCacher,
  MemoryLRU: MemoryLRUCacher
};

function getByName(name: string) {
  /* istanbul ignore next */
  if (!name) return null;

  let n = Object.keys(Cachers).find((n) => n.toLowerCase() == name.toLowerCase());
  if (n) return Cachers[n];
}

function resolve(opt) {
  if (isObject(opt) && isInheritedClass(opt, Cachers.Base)) {
    return opt;
  } else if (opt === true) {
    return new Cachers.Memory({});
  } else if (isString(opt)) {
    let CacherClass = getByName(opt);
    if (CacherClass) return new CacherClass();

    if (opt.startsWith('redis://') || opt.startsWith('rediss://')) CacherClass = Cachers.Redis;

    if (CacherClass) return new CacherClass(opt);
    else throw new StarOptionsError(`Invalid cacher type '${opt}'.`, { type: opt });
  } else if (isObject(opt)) {
    let CacherClass = getByName(opt.type || 'Memory');
    if (CacherClass) return new CacherClass(opt.options);
    else throw new StarOptionsError(`Invalid cacher type '${opt.type}'.`, { type: opt.type });
  }

  return null;
}

function register(name, value) {
  Cachers[name] = value;
}

export default Object.assign(Cachers, { resolve, register });
