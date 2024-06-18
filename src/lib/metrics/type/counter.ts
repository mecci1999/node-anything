import { BaseMetricOptions } from '@/typings/metric';
import METRIC from '../constants';
import GaugeMetric from './gauge';
import MetricRegistry from '../registry';
import { GenericObject } from '@/typings';
import { pick } from 'lodash';
import MetricRate from '../rates';

export default class CounterMetric extends GaugeMetric {
  constructor(options: BaseMetricOptions, registry: MetricRegistry) {
    super(options, registry);
    this.type = METRIC.TYPE_COUNTER;
  }

  /**
   * 增加值
   */
  public increment(labels: GenericObject, value?: number, timestamp?: number) {
    if (value == null) value = 1;

    const item = this.get(labels);

    return this.set((item ? item.value : 0) + (value || 1), labels, timestamp);
  }

  /**
   * 禁止用增加方法
   */
  public decrement(labels: GenericObject, value?: number | undefined, timestamp?: number | undefined): any {
    throw new Error(`Counter can't be decreased.`);
  }

  /**
   * 设置值
   */
  public set(value: number, labels?: GenericObject, timestamp?: number) {
    // 过滤掉无效的标签
    const hash = this.hashingLabels(labels);
    // 获取指标
    let item = this.values.get(hash);

    if (item) {
      // 存在该指标，更新数据
      if (item.value !== value) {
        item.value = value;
        // 更新时间戳
        item.timestamp = timestamp == null ? Date.now() : timestamp;

        if (item.rate) item.rate.update(value);

        this.changed(value, labels, timestamp);
      }
    } else {
      // 不存在该指标，新增指标
      item = {
        value,
        labels: pick(labels, this.labelNames),
        timestamp: timestamp == null ? Date.now() : timestamp
      };
      this.values.set(hash, item);

      if (this.rate) {
        // 初始化速率
        item.rate = new MetricRate(this, item, 1);
        // 更新速率
        item.rate.update(value);
      }

      this.changed(value, labels, timestamp);
    }

    return item;
  }

}
