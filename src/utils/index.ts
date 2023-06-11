/**
 * 辅助方法模块
 */

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
