/**
 * 睡眠函数
 */

export function sleep(time: number = 1000) {
  let timer: any = null;
  let now = Date.now();

  return new Promise((resolve, reject) => {
    timer = setInterval(() => {
      if (now + time < Date.now()) {
        clearInterval(timer);
        timer = null;
        resolve(true);
      }
    }, 10);
  });
}
