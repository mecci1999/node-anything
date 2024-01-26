import { CacherOptions } from '@/typings/cachers';
import BaseCacher from './base';
import Lock from './lock';
import { METRIC } from '../metrics';
import _, { set } from 'lodash';
import Star from '../star';
import { match as matchByReg } from '@/utils';
import { GenericObject } from '@/typings';

/**
 * 使用内存进行缓存
 */
export default class MemoryCacher extends BaseCacher {
  public cache: Map<string, any>;
  public _lock: Lock;
  public timer: any;
  public clone: (value: any) => any;

  constructor(options: CacherOptions) {
    super(options);

    this.cache = new Map();
    this._lock = new Lock();
    this.timer = setInterval(() => {
      // 每隔30s检查一次ttl连接
      this.checkTTL();
    }, 30 * 1000);
    this.timer.unref();

    // 设置克隆
    this.clone = this.options.clone === true ? _.cloneDeep : this.options.clone;
  }

  public init(star: Star): void {
    super.init(star);

    this.connected = true;

    star.localBus?.on('$transporter.connected', () => {
      return this.clean();
    });
  }

  /**
   * 关闭缓存
   */
  public close(): Promise<any> {
    clearInterval(this.timer);

    return Promise.resolve();
  }

  /**
   * 获取缓存
   * @param key
   */
  public get(key: string): Promise<any> {
    this.logger?.debug(`GET ${key}`);
    this.metrics?.increment(METRIC.UNIVERSE_CACHER_GET_TOTAL);
    const timeEnd = this.metrics?.timer(METRIC.UNIVERSE_CACHER_GET_TIME);

    if (this.cache.has(key)) {
      this.logger?.debug(`FOUND ${key}`);
      this.metrics?.increment(METRIC.UNIVERSE_CACHER_FOUND_TOTAL);

      let item = this.cache.get(key);
      if (item && item.expire && item.expire < Date.now()) {
        // 缓存过期
        this.logger?.debug(`EXPIRED ${key}`);
        this.metrics?.increment(METRIC.UNIVERSE_CACHER_EXPIRED_TOTAL);
        this.cache.delete(key);
        if (timeEnd) {
          timeEnd();
        }

        return Promise.resolve(null);
      }

      const res = this.clone ? this.clone(item.data) : item.data;
      if (timeEnd) {
        timeEnd();
      }

      return Promise.resolve(res);
    } else {
      if (timeEnd) {
        timeEnd();
      }

      return Promise.resolve(null);
    }
  }

  /**
   * 存储缓存
   */
  public set(key: string, data: any, ttl?: number | undefined): Promise<any> {
    this.metrics?.increment(METRIC.UNIVERSE_CACHER_SET_TOTAL);
    const timeEnd = this.metrics?.timer(METRIC.UNIVERSE_CACHER_SET_TIME);

    if (ttl == null) ttl = this.options.ttl;

    data = this.clone ? this.clone(data) : data;

    // 存储缓存
    this.cache.set(key, {
      data,
      expire: ttl ? Date.now() + ttl * 1000 : null
    });

    if (timeEnd) {
      timeEnd();
    }

    this.logger?.debug(`SET ${key}`);

    return Promise.resolve(data);
  }

  /**
   * 删除缓存
   * @param key
   */
  public delete(key: string | string[]): Promise<any> {
    this.metrics?.increment(METRIC.UNIVERSE_CACHER_DEL_TOTAL);
    const timeEnd = this.metrics?.timer(METRIC.UNIVERSE_CACHER_DEL_TIME);

    const keys = Array.isArray(key) ? key : [key];

    keys.forEach((key) => {
      this.cache.delete(key);
      this.logger?.debug(`REMOVE ${key}`);
    });

    if (timeEnd) {
      timeEnd();
    }

    return Promise.resolve();
  }

  /**
   * 根据匹配条件清除缓存
   */
  public clean(match: string | string[] | undefined = '**'): Promise<any> {
    this.metrics?.increment(METRIC.UNIVERSE_CACHER_CLEAN_TOTAL);
    const timeEnd = this.metrics?.timer(METRIC.UNIVERSE_CACHER_CLEAN_TIME);

    const matches = Array.isArray(match) ? match : [match];
    this.logger?.debug(`CLEAN ${matches.join(', ')}`);

    this.cache.forEach((value, key) => {
      if (matches.some((item) => matchByReg(key, item))) {
        this.logger?.debug(`REMOVE ${key}`);
        this.cache.delete(key);
      }
    });

    if (timeEnd) {
      timeEnd();
    }

    return Promise.resolve();
  }

  /**
   * 检查TTL连接情况，移除过期的缓存
   */
  private checkTTL() {
    let now = Date.now();
    this.cache.forEach((value, key) => {
      let item = this.cache.get(key);

      // 缓存过期
      if (item && item.expire && item.expire < now) {
        // 日志
        this.logger?.debug(`EXPIRED ${key}`);
        // 指标数据
        this.metrics?.increment(METRIC.UNIVERSE_CACHER_EXPIRED_TOTAL);
        // 删除缓存
        this.cache.delete(key);
      }
    });
  }

  /**
   * ttl方式获取缓存
   * @param key
   * @returns
   */
  public getWithTTL(key: string): Promise<any> {
    this.logger?.debug(`GET ${key}`);
    let data = null;
    let ttl: any = null;

    // 缓存中已经存在该值
    if (this.cache.has(key)) {
      this.logger?.debug(`FOUND ${key}`);
      let item = this.cache.get(key);
      let now = Date.now();
      ttl = (item.expire - now) / 1000;
      ttl = ttl > 0 ? ttl : null;
      if (this.options.ttl) {
        item.expire = now + this.options.ttl * 1000;
      }
      data = this.clone ? this.clone(item.data) : item.data;
    }

    return Promise.resolve({ data, ttl });
  }

  /**
   * 锁住缓存，避免被其他地方修改
   * @param key
   * @param ttl
   */
  public lock(key: string, ttl?: number | undefined) {
    return this._lock.acquire(key, ttl).then(() => {
      return () => this._lock.release(key);
    });
  }

  /**
   * 尝试锁住缓存key
   * @param key
   * @param ttl
   * @returns
   */
  public tryLock(key: string, ttl?: number | undefined): Promise<any> {
    if (this._lock.isLocked(key)) {
      // 该key已经锁住了
      return Promise.reject(new Error('Locked.'));
    }

    return this.lock(key, ttl);
  }

  /**
   * 获取所有的缓存key
   */
  public getCacheKeys(): Promise<Array<GenericObject>> {
    return Promise.resolve(
      Array.from(this.cache.entries()).map(([key, item]) => {
        return {
          key,
          expiresAt: item.expire
        };
      })
    );
  }
}
