import { GenericObject } from '@/typings';
import { Registry } from '../registry';
import { Star } from '../star';
import BaseStrategy from './base';
import Context from '../context';
import Endpoint from '../registry/endpoint/item';
import { random } from 'lodash';

/**
 * 随机策略模式
 */
export default class RandomStrategy extends BaseStrategy {
  constructor(registry: Registry, star: Star, options?: GenericObject) {
    super(registry, star, options);
  }

  /**
   * 随机选择一个服务节点处理请求
   */
  public select(list: Endpoint[], ctx?: Context | undefined): Endpoint {
    return list[random(0, list.length - 1)];
  }
}
