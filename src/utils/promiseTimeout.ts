/**
 * 异步函数返回的结果时间超时判断方法
 * @param handler
 * @param ms
 * @param message
 * @returns
 */

export default function promiseTimeout(handler: Promise<any>, ms: number, message?: string) {
  let timer: any;

  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(message || 'async function access timeout')), +ms);
  });

  return Promise.race([timeout, handler])
    .then((value) => {
      clearTimeout(timer);
      timer = null;
      return value;
    })
    .catch((err) => {
      clearTimeout(timer);
      timer = null;
      throw err;
    });
}
