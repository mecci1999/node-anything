/**
 * 一个简单的请求速率限制器，目的是为了限制请求的次数
 */

import { GenericObject } from '@/typings';
import _ from 'lodash';

export default class RateLimiter {
  public options: GenericObject;
  public lastTime: number;
  public balance: number;
  public maxBalance: number;

  constructor(options: GenericObject) {
    this.options = _.defaultsDeep(options, {
      tracesPerSecond: 1
    });

    this.lastTime = Date.now();
    this.balance = 0;
    this.maxBalance = this.options.tracesPerSecond < 1 ? 1 : this.options.tracesPerSecond;
  }

  /**
   * 检查请求的次数是否超出限制，如果超出，等待下一次窗口
   * @param cost 请求的消耗量，可控制
   * @returns
   */
  public check(cost: number = 1) {
    const now = Date.now(); // 现在的时间
    const elapsedTime = (now - this.lastTime) / 1000; // 距离上一次检查的时间，单位秒
    this.lastTime = now;
    this.balance += elapsedTime * this.options.tracesPerSecond;
    if (this.balance > this.maxBalance) this.balance = this.maxBalance;
    if (this.balance >= cost) {
      this.balance -= cost;

      return true;
    }

    return false;
  }
}
