export function promiseMethod(fn: any) {
  let P: any = {};

  P.method = function (fn: Function) {
    return () => {
      try {
        const val = fn.apply(this, arguments);
        return Promise.resolve(val);
      } catch (error) {
        return Promise.reject(error);
      }
    };
  };

  return P.method(fn);
}
