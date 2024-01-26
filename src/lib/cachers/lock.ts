/**
 * 进程锁
 */
export default class Lock {
  public locked: Map<string, any>;

  constructor() {
    this.locked = new Map();
  }

  /**
   * 锁
   */
  public acquire(key: string, ttl?: number) {
    let locked = this.locked.get(key);
    if (!locked) {
      // 没有获取到进程锁
      locked = [];
      this.locked.set(key, locked);
      return Promise.resolve();
    } else {
      return new Promise((resolve) => locked.push(resolve));
    }
  }

  /**
   * 是否锁住
   */
  public isLocked(key: string) {
    return !!this.locked.get(key);
  }

  /**
   * 解锁
   */
  public release(key: string) {
    let locked = this.locked.get(key);
    if (locked) {
      if (locked.length > 0) {
        // 释放进程锁
        locked.shift()();
      } else {
        this.locked.delete(key);
      }
    }
    return Promise.resolve();
  }
}
