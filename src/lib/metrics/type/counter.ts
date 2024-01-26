import { BaseMetricOptions } from '@/typings/metric';
import METRIC from '../constants';
import GaugeMetric from './gauge';
import MetricRegistry from '../registry';
import { GenericObject } from '@/typings';

export default class CounterMetric extends GaugeMetric {
  constructor(options: BaseMetricOptions, registry: MetricRegistry) {
    super(options, registry);
    this.type = METRIC.TYPE_COUNTER;
  }

  /**
   * 禁止用增加方法
   */
  public decrement(labels: GenericObject, value?: number | undefined, timestamp?: number | undefined): any {
    throw new Error(`Counter can't be decreased.`);
  }
}
