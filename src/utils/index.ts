/**
 * 辅助方法模块
 */

const RegexCache = new Map();

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
