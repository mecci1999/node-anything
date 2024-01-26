import { GenericObject } from '@/typings';
import { Registry } from '../registry';
import Star from '../star';
import BaseStrategy from './base';
import Context from '../context';
import Endpoint from '../registry/endpoint/item';

/**
 * 轮询策略模式
 * 用于实现请求的负载均衡，根据分发的顺序，保持每个节点的请求量达到平均
 */
export default class RoundRobinStrategy extends BaseStrategy {
  public counter: number;

  constructor(registry: Registry, star: Star, options?: GenericObject) {
    super(registry, star, options);

    this.counter = 0;
  }

  /**
   * 请求选择服务节点
   * @param list Endpoint[] 服务集群
   * @param ctx Context | undefined
   * @returns Endpoint 服务节点
   */
  public select(list: Endpoint[], ctx?: Context | undefined): Endpoint {
    if (this.counter >= list.length) {
      // 超出节点范围，重置轮询，保证顺序一致
      this.counter = 0;
    }

    return list[this.counter++];
  }
}
