export function promiseMethod(fn: (this: any, ...args: any[]) => any): any {
  let promiseFunc = function (func: (this: any, ...args: any[]) => any) {
    return function (this: any, ...args: any[]) {
      return new Promise((resolve, reject) => {
        try {
          const val = func.apply(this, args);
          resolve(val);
        } catch (error) {
          reject(error);
        }
      });
    };
  };

  return promiseFunc(fn);
}
