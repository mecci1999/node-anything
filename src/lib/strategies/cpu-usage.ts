import { GenericObject } from '@/typings';
import { Registry } from '../registry';
import Star from '../star';
import BaseStrategy from './base';
import _, { random } from 'lodash';
import Context from '../context';
import Endpoint from '../registry/endpoint/item';

/**
 * CPU使用率策略
 * 根据服务节点的CPU使用率，选择使用率最低的节点处理请求
 */
export default class CpuUsageStrategy extends BaseStrategy {
  public options: GenericObject;

  constructor(registry: Registry, star: Star, options?: GenericObject) {
    super(registry, star, options);

    this.options = _.defaultsDeep(options, {
      sampleCount: 3,
      lowCpuUsage: 10
    });
  }

  /**
   * 选择Cpu使用率最低的服务节点
   * @param list
   * @param ctx
   */
  public select(list: Endpoint[], ctx?: Context | undefined): Endpoint {
    let minEndpoint: Endpoint | null = null;
    const sampleCount = this.options.sampleCount;
    const count = sampleCount <= 0 || sampleCount > list.length ? list.length : sampleCount;

    for (let i = 0; i < count; i++) {
      let endpoint: Endpoint;
      if (count == list.length) {
        endpoint = list[i];
      } else {
        endpoint = list[random(0, list.length - 1)];
      }

      const cpu = endpoint.node.cpu;
      if (cpu !== null) {
        if (cpu < this.options.lowCpuUsage) {
          // 如果cpu的使用率低于最低使用效率，选择该服务节点
          return endpoint;
        }

        // 比较cpu使用率，选择最低的一个服务节点
        if (!minEndpoint || cpu < (minEndpoint as Endpoint).node.cpu) {
          minEndpoint = endpoint;
        }
      }
    }

    // 返回cpu使用率最低的节点
    if (minEndpoint) return minEndpoint;

    // 如果没有Cpu使用率的数据，则随机返回一个服务节点
    return list[random(0, list.length - 1)];
  }
}
