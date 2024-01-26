import { MetricReporterOptions } from '@/typings/metric';
import { isString, match } from '@/utils';
import _ from 'lodash';
import MetricRegistry from '../registry';
import Star from '@/lib/star';
import { LoggerInstance } from '@/typings/logger';
import BaseMetric from '../type/base';
import { GenericObject } from '@/typings';

export default class BaseReporter {
  public options: MetricReporterOptions;
  public registry: MetricRegistry | null = null;
  public star: Star | null = null;
  public logger: LoggerInstance | null = null;

  constructor(options: MetricReporterOptions) {
    this.options = _.defaultsDeep(options, {
      includes: null,
      excludes: null,
      metricNamePrefix: null,
      metricNameSuffix: null,
      metricNameFormatter: null,
      labelNameFormatter: null
    });

    if (isString(this.options.includes)) this.options.includes = [this.options.includes as string];

    if (isString(this.options.excludes)) this.options.excludes = [this.options.excludes as string];
  }

  /**
   * 初始化
   */
  public init(registry: MetricRegistry) {
    this.registry = registry;
    this.star = this.registry.star;
    this.logger = this.registry.logger;
  }

  /**
   * 暂停支持
   */
  public stop() {
    return Promise.resolve();
  }

  /**
   * 比较指标名，过滤掉不符合规则命名的指标
   */
  public matchMetricName(name: string) {
    if (Array.isArray(this.options.includes)) {
      if (!this.options.includes.some((pattern) => match(name, pattern))) return false;
    }

    if (Array.isArray(this.options.excludes)) {
      if (!this.options.excludes.every((pattern) => !match(name, pattern))) return false;
    }

    return true;
  }

  /**
   * 格式化指标名，统一标准化指标名
   */
  public formatMetricName(name: string) {
    name =
      (this.options.metricNamePrefix ? this.options.metricNamePrefix : '') +
      name +
      (this.options.metricNameSuffix ? this.options.metricNameSuffix : '');

    if (this.options.metricNameFormatter) return this.options.metricNameFormatter(name);

    return name;
  }

  /**
   * 格式化标签名，允许使用自定义的配置名
   */
  public formatLabelName(name: string) {
    if (this.options.labelNameFormatter) return this.options.labelNameFormatter(name);

    return name;
  }

  /**
   * 改变指标数据
   */
  public metricChanged(metric: BaseMetric, value: any, labels?: GenericObject, timestamp?: number) {}
}
