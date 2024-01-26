/**
 * 通过参数判断使用allSettled方法还是all方法处理一组Promise
 * @param promises
 * @param settled
 * @param promise
 * @returns
 */
export function promiseAllControl(promises: Array<Promise<any>>, settled: boolean, promise = Promise) {
  return settled ? promise.allSettled(promises) : promise.all(promises);
}
