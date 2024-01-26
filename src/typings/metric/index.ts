import { GenericObject } from '..';

// 指标注册模块配置项
export interface MetricRegistryOptions {
  enabled?: boolean;
  collectProcessMetrics?: boolean;
  collectInterval?: number;
  reporter?: string | MetricsReporterOptions | (MetricsReporterOptions | string)[] | null;
  defaultBuckets?: number[];
  defaultQuantiles?: number[];
  defaultMaxAgeSeconds?: number;
  defaultAgeBuckets?: number;
  defaultAggregator?: string;
}

// 指标可支持模块配置项
export interface MetricsReporterOptions {
  type: string;
  options?: MetricReporterOptions;
}

export interface MetricReporterOptions {
  includes?: string | string[];
  excludes?: string | string[];

  metricNamePrefix?: string;
  metricNameSuffix?: string;

  metricNameFormatter?: (name: string) => string;
  labelNameFormatter?: (name: string) => string;

  [key: string]: any;
}

/**
 * 指标类型类选项
 */
export interface BaseMetricOptions {
  type: string;
  name: string;
  description?: string;
  labelNames?: string[];
  unit?: string;
  aggregator?: string;
  [key: string]: any;
}

/**
 * gauge类型指标快照
 */
export interface GaugeMetricSnapshot {
  value: number;
  labels: GenericObject;
  timestamp: number;
}

/**
 * info类型指标快照
 */
export interface InfoMetricSnapshot {
  value: number;
  labels: GenericObject;
  timestamp: number;
}

/**
 * histogram类型指标快照
 */
export interface HistogramMetricSnapshot {
  labels: GenericObject;
  count: number;
  sum: number;
  timestamp: number;

  buckets?: {
    [key: string]: number;
  };

  min?: number | null;
  mean?: number | null;
  variance?: number | null;
  stdDev?: number | null;
  max?: number | null;
  quantiles?: {
    [key: string]: number;
  };
}

export type MetricSnapshot = GaugeMetricSnapshot | InfoMetricSnapshot | HistogramMetricSnapshot;

export interface BaseMetricPOJO {
  type: string;
  name: string;
  description?: string;
  labelNames: string[];
  unit?: string;
  values: MetricSnapshot[];
}
