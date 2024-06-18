import { BaseMetricOptions } from '@/typings/metric';
import METRIC from '../constants';
import BaseMetric from './base';
import MetricRegistry from '../registry';
import { GenericObject } from '@/typings';
import { pick } from 'lodash';

export default class InfoMetric extends BaseMetric {
  constructor(options: BaseMetricOptions, registry: MetricRegistry) {
    super(options, registry);
    this.type = METRIC.TYPE_INFO;
  }

  /**
   * 设置值
   */
  public set(value: any, labels: GenericObject, timestamp?: number) {
    const hash = this.hashingLabels(labels);
    let item = this.values.get(hash);
    if (item) {
      if (value !== item.value) {
        item.value = value;
        item.timestamp = timestamp == null ? Date.now() : timestamp;
        this.changed(value, labels, timestamp);
      }
    } else {
      item = {
        value,
        labels: pick(labels, this.labelNames),
        timestamp: timestamp == null ? Date.now() : timestamp
      };
      this.values.set(hash, item);
      this.changed(value, labels, timestamp);
    }

    return item;
  }

  public reset(labels: GenericObject, timestamp: number): GenericObject {
    return this.set(null, labels, timestamp);
  }

  public resetAll(timestamp: number): void {
    this.values.forEach((item) => {
      item.value = null;
      item.timestamp = timestamp == null ? Date.now() : timestamp;
    });

    this.changed(null);
  }

  /**
   * 生成一个快照
   */
  public generateSnapshot() {
    const snapshot = Array.from(this.values.keys()).map((key) => {
      const item = this.values.get(key);

      if (item) {
        return {
          key,
          value: item.value,
          labels: item.labels,
          timestamp: item.timestamp
        };
      }
    });

    return snapshot;
  }
}
