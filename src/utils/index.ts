/**
 * 辅助方法模块
 */
import path from 'path';
import fs from 'fs';
import os from 'os';
import BaseError from '@/lib/error/base';

const RegexCache = new Map();

const lut: string[] = [];
for (let i = 0; i < 256; i++) {
  lut[i] = (i < 16 ? '0' : '') + i.toString(16);
}

class TimeoutError extends BaseError {}

// 检查参数是否为对象
export function isObject(o: any): boolean {
  return o !== null && typeof o === 'object' && !(o instanceof String);
}

// 检查参数是否为字符串
export function isString(s: any): boolean {
  return s !== null && (typeof s === 'string' || s instanceof String);
}

// 检查参数是否为方法
export function isFunction(fn: any): boolean {
  return typeof fn === 'function';
}

// 检查是否是继承对象
export function isPlainObject(o) {
  return o != null ? Object.getPrototypeOf(o) === Object.prototype || Object.getPrototypeOf(o) === null : false;
}

/**
 * Get the name of constructor of an object.
 * 获取一个对象参数的构造方法名
 *
 * @param {Object} obj
 * @returns {String}
 */
export function getConstructorName(obj: any): string | undefined {
  if (obj == null) return undefined;

  let target = obj.prototype;
  if (target && target.constructor && target.constructor.name) {
    return target.constructor.name;
  }
  if (obj.constructor && obj.constructor.name) {
    return obj.constructor.name;
  }
  return undefined;
}

/**
 * Check whether the instance is an instance of the given class.
 * 检查一个实例参数是否是另一个类生成的实例对象
 *
 * @param {Object} instance
 * @param {Object} baseClass
 * @returns {Boolean}
 */
export function isInheritedClass(instance: object, baseClass: object): boolean {
  const baseClassName = getConstructorName(baseClass);
  let proto = instance;
  // 循环遍历寻找对象的继承链
  while ((proto = Object.getPrototypeOf(proto))) {
    const protoName = getConstructorName(proto);
    if (baseClassName == protoName) return true;
  }

  return false;
}

/**
 * 字符串匹配器，用来匹配带有分隔符的事件或动作名称
 * @param text 待匹配的文本
 * @param pattern 待匹配的模式
 * @returns
 */
export function matchActionOrEvent(text: string, pattern: string): boolean {
  // 模式是否带有?
  if (pattern.indexOf('?') == -1) {
    // 找到第一个*的索引
    const firstStarPosition = pattern.indexOf('*');
    if (firstStarPosition == -1) {
      return pattern === text;
    }

    // 获取模式长度
    const len = pattern.length;
    if (len > 2 && pattern.endsWith('**') && firstStarPosition > len - 3) {
      pattern = pattern.substring(0, len - 2);
      return text.startsWith(pattern);
    }

    // Eg. "prefix*"
    if (len > 1 && pattern.endsWith('*') && firstStarPosition > len - 2) {
      pattern = pattern.substring(0, len - 1);
      if (text.startsWith(pattern)) {
        return text.indexOf('.', len) == -1;
      }
      return false;
    }

    // Accept simple text, without point character (*)
    if (len == 1 && firstStarPosition == 0) {
      return text.indexOf('.') == -1;
    }

    // Accept all inputs (**)
    if (len == 2 && firstStarPosition == 0 && pattern.lastIndexOf('*') == 1) {
      return true;
    }
  }

  const origPattern = pattern;
  let regex = RegexCache.get(origPattern);
  if (regex == null) {
    if (pattern.startsWith('$')) {
      pattern = '\\' + pattern;
    }
    pattern = pattern.replace(/\?/g, '.');
    pattern = pattern.replace(/\*\*/g, '§§§');
    pattern = pattern.replace(/\*/g, '[^\\.]*');
    pattern = pattern.replace(/§§§/g, '.*');

    pattern = '^' + pattern + '$';

    // eslint-disable-next-line security/detect-non-literal-regexp
    regex = new RegExp(pattern, '');
    RegexCache.set(origPattern, regex);
  }
  return regex.test(text);
}

/**
 * 根据文件路径创建对应的目录结构
 */
export function makeDirs(filePath: string) {
  filePath.split(path.sep).reduce((prevPath, folder) => {
    // 当前路径
    const currentPath = path.join(prevPath, folder, path.sep);
    // 判断目录是否存在
    if (!fs.existsSync(currentPath)) {
      // 不存在，就创建目录，这里使用同步创建，是为了避免创建目录顺序错乱导致创建失败
      fs.mkdirSync(currentPath);
    }

    return currentPath;
  }, '');
}

/**
 * 生成一个nodeID，生成规则为系统主机名-进程id
 */
export function getNodeID(): string {
  return os.hostname().toLocaleLowerCase() + '-' + process.pid;
}

/**
 * 生成uuid  https://jsperf.com/uuid-generator-opt/18
 */
export function generateToken() {
  const d0 = (Math.random() * 0xffffffff) | 0;
  const d1 = (Math.random() * 0xffffffff) | 0;
  const d2 = (Math.random() * 0xffffffff) | 0;
  const d3 = (Math.random() * 0xffffffff) | 0;
  return (
    lut[d0 & 0xff] +
    lut[(d0 >> 8) & 0xff] +
    lut[(d0 >> 16) & 0xff] +
    lut[(d0 >> 24) & 0xff] +
    '-' +
    lut[d1 & 0xff] +
    lut[(d1 >> 8) & 0xff] +
    '-' +
    lut[((d1 >> 16) & 0x0f) | 0x40] +
    lut[(d1 >> 24) & 0xff] +
    '-' +
    lut[(d2 & 0x3f) | 0x80] +
    lut[(d2 >> 8) & 0xff] +
    '-' +
    lut[(d2 >> 16) & 0xff] +
    lut[(d2 >> 24) & 0xff] +
    lut[d3 & 0xff] +
    lut[(d3 >> 8) & 0xff] +
    lut[(d3 >> 16) & 0xff] +
    lut[(d3 >> 24) & 0xff]
  );
}

/**
 * 补充Promise的方法
 */
export function polyfillPromise(P: any) {
  if (!isFunction(P.method)) {
    P.method = function (fn: Function) {
      return () => {
        try {
          const val = fn.apply(this, arguments);
          return P.resolve(val);
        } catch (error) {
          return P.reject(error);
        }
      };
    };
  }

  if (!isFunction(P.delay)) {
    P.delay = function (ms: number) {
      return new P((resolve: any) => setTimeout(resolve, ms));
    };

    P.prototype.delay = function (ms: number) {
      return this.then((res: any) => P.delay(ms).then(() => res));
    };
  }

  if (!isFunction(P.prototype.timeout)) {
    P.TimeoutError = TimeoutError;

    P.prototype.timeout = function (ms: number, message: string) {
      let timer: any = null;
      const timeout = new P((resolve, reject) => {
        timer = setTimeout(() => reject(new P.TimeoutError(message)), +ms);
      });

      return P.race([timeout, this])
        .then((value) => {
          clearTimeout(timer);
          return value;
        })
        .catch((err) => {
          clearTimeout(timer);
          throw err;
        });
    };
  }

  if (!isFunction(P.mapSeries)) {
    P.mapSeries = function (arr, fn) {
      const promFn = P.method(fn);
      const res: Array<any> = [];

      return arr
        .reduce((p, item, i) => {
          return p.then((r) => {
            res[i] = r;
            return promFn(item, i);
          });
        }, P.resolve())
        .then((r) => {
          res[arr.length] = r;
          return res.slice(1);
        });
    };
  }
}
