import { LRUCache } from 'lru-cache';
import _ from 'lodash';
import BaseCacher from './base';
import Lock from './lock';
import { CacherOptions } from '@/typings/cachers';
import Star from '../star';
import { METRIC } from '../metrics';
import { match as matchByReg } from '@/utils';

export default class MemoryLRUCacher extends BaseCacher {
  public cache: LRUCache<string, any>;
  public _lock: Lock;
  public timer: any;
  public clone: (value: any) => any;

  constructor(options: CacherOptions) {
    super(options);

    this.cache = new LRUCache({
      max: this.options.max,
      maxSize: this.options.cacheSize,
      updateAgeOnGet: !!this.options.ttl
    });
    this._lock = new Lock();
    this.timer = setInterval(() => {
      this.checkTTL();
    });
    this.timer.unref();
    this.clone = this.options.clone === true ? _.cloneDeep : this.options.clone;
  }

  public init(star: Star): void {
    super.init(star);

    this.connected = true;

    star.localBus?.on('$transporter.connected', () => {
      return this.clean();
    });

    if (this.options.lock && this.options.lock.enabled !== false && this.options.lock.staleTime) {
      this.logger?.warn('setting lock.staleTime with MemoryLRUCacher is not supported.');
    }
  }

  /**
   * 关闭缓存
   * @returns
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
      const res = this.clone ? this.clone(item) : item;
      if (timeEnd) {
        timeEnd();
      }

      return Promise.resolve(res);
    } else {
      if (timeEnd) {
        timeEnd();
      }
    }

    return Promise.resolve(null);
  }

  /**
   * 删除缓存
   * @param key
   */
  public delete(key: string | string[]): Promise<any> {
    this.metrics?.increment(METRIC.UNIVERSE_CACHER_DEL_TOTAL);
    const timeEnd = this.metrics?.timer(METRIC.UNIVERSE_CACHER_DEL_TIME);

    const keys = Array.isArray(key) ? key : [key];

    keys.forEach((item) => {
      this.cache.delete(item);
      this.logger?.debug(`REMOVE ${key}`);
    });

    if (timeEnd) {
      timeEnd();
    }

    return Promise.resolve();
  }

  /**
   * 获取缓存
   * @param key
   * @param data
   * @param ttl
   * @returns
   */
  public set(key: string, data: any, ttl?: number | undefined): Promise<any> {
    this.metrics?.increment(METRIC.UNIVERSE_CACHER_SET_TOTAL);
    const timeEnd = this.metrics?.timer(METRIC.UNIVERSE_CACHER_SET_TIME);

    if (ttl == null) {
      ttl = this.options.ttl;
    }

    data = this.clone ? this.clone(data) : data;

    this.cache.set(key, data, { ttl: ttl ? ttl * 1000 : undefined });

    if (timeEnd) {
      timeEnd();
    }

    this.logger?.debug(`SET ${key}`);

    return Promise.resolve(data);
  }

  /**
   * 清除所有的缓存
   * @param match
   */
  public clean(match: string | string[] = '**'): Promise<any> {
    this.metrics?.increment(METRIC.UNIVERSE_CACHER_CLEAN_TOTAL);
    const timeEnd = this.metrics?.timer(METRIC.UNIVERSE_CACHER_CLEAN_TIME);

    const matches = Array.isArray(match) ? match : [match];
    this.logger?.debug(`CLEAN ${matches.join(', ')}`);

    Array.from(this.cache.keys()).forEach((key) => {
      if (matches.some((match) => matchByReg(key, match))) {
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
  public checkTTL() {
    this.cache.purgeStale();
  }

  /**
   * 通过ttl获取缓存
   */
  public getWithTTL(key: string): Promise<any> {
    return this.get(key).then((data) => {
      return { data, ttl: null };
    });
  }

  /**
   * 进程锁住缓存key
   * @param key
   * @param ttl
   * @returns
   */
  public lock(key: string, ttl?: number | undefined): Promise<any> {
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
      return Promise.reject(new Error('Locked.'));
    }

    return this._lock.acquire(key, ttl).then(() => {
      return () => this._lock.release(key);
    });
  }

  /**
   * 获取所有的缓存key
   */
  public getCacheKeys(): Promise<any> {
    return Promise.resolve(
      Array.from(this.cache.keys()).map((key) => {
        return { key };
      })
    );
  }
}
