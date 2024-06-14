import { MetricReporterOptions } from '@/typings/metric';
import BaseReporter from './base';
import _ from 'lodash';
import MetricRegistry from '../registry';
import http from 'http';
import METRIC from '../constants';
import { GenericObject } from '@/typings';
import { isFunction } from '@/utils';
import zlib from 'zlib';
import { UniverseError } from '@/lib/error';

/**
 * Prometheus reporter for Darwin-Universer.
 *
 * 		https://prometheus.io/
 *
 * Running Prometheus & Grafana in Docker:
 *
 * 		git clone https://github.com/vegasbrianc/prometheus.git
 * 		cd prometheus
 *
 * 	Please note, don't forget add your endpoint to static targets in prometheus/prometheus.yml file.
 *  The default port is 3030.
 *
 *     static_configs:
 *       - targets: ['localhost:9090', 'star-hostname:3030']
 *
 *  Start containers:
 *
 * 		docker-compose up -d
 *
 * Grafana dashboard: http://<docker-ip>:3000
 *
 */

export default class PrometheusReporter extends BaseReporter {
  public server: http.Server | null = null;
  public defaultLabels: GenericObject = {};

  constructor(options: MetricReporterOptions) {
    super(options);

    this.options = _.defaultsDeep(this.options, {
      port: 3000,
      path: '/metrics',
      defaultLabels: (registry: MetricRegistry) => ({
        namespace: registry.star.namespace,
        nodeID: registry.star.nodeID
      })
    });
  }

  public init(registry: MetricRegistry): void {
    super.init(registry);

    // 创建一个http服务
    this.server = http.createServer();
    this.server.on('request', this.handler.bind(this));
    this.server.on('error', error => {
      return this.registry?.star.fatal(
        'Prometheus metric reporter listening error:',
        new UniverseError('Prometheus metric reporter listening error:' + error.message)
      );
    })

    this.server.listen(this.options.port, () => {
      this.logger?.info(
        `Prometheus metric reporter listening on http://0.0.0.0:${this.options.port}${this.options.path} address.`
      );
    });

    this.defaultLabels = isFunction(this.options.defaultLabels)
      ? this.options.defaultLabels.call(this, registry)
      : this.options.defaultLabels;
  }

  /**
   * 处理http请求
   */
  private handler(req: http.IncomingMessage, res: http.ServerResponse) {
    this.logger?.info('Prometheus metric reporter received request: ' + req);
    if (req.url === this.options.path) {
      try {
        const content = this.generatePrometheusResponse();
        const resHeader = {
          'Content-Type': 'text/plain; version=0.0.4; charset=utf-8'
        };
        const compressing = req.headers['accept-encoding'] && req.headers['accept-encoding'].includes('gzip');

        if (compressing) {
          resHeader['Content-Encoding'] = 'gzip';
          zlib.gzip(content, (err, buffer) => {
            if (err) {
              this.logger?.error('Unable to compress response: ' + err.message);
              res.writeHead(500);
              res.end(err.message);
            } else {
              res.writeHead(200, resHeader);
              res.end(content);
            }
          });
        } else {
          res.writeHead(200, resHeader);
          res.end(content);
        }
      } catch (error) {
        this.logger?.error('Unable to generate Prometheus response', error);
        res.writeHead(500, http.STATUS_CODES[500], {});
        res.end();
      }
    } else {
      res.writeHead(404, http.STATUS_CODES[404], {});
      res.end();
    }
  }

  /**
   * 停止上传数据
   */
  public stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server?.close((err) => {
        if (err) reject(err);

        resolve();
      });
    });
  }

  /**
   * 生成Promethemu响应数据
   */
  private generatePrometheusResponse() {
    const content: string[] = [];
    const val = (value: any) => (value === null ? 'NaN' : value);

    this.registry?.store.forEach((metric) => {
      // 过滤脏数据
      if (!this.matchMetricName(metric.name)) return;
      // 去除日期数据，避免生成太多的无效数据
      if (metric.name.startsWith('os.datetime')) return;

      // 格式化指标名
      const metricName = this.formatMetricName(metric.name).replace(/[.-]/g, '_');
      // 指标描述
      const metricDesc = metric.description
        ? metric.description
        : metric.name + (metric.unit ? ` (${metric.unit})` : '');
      // 指标类型
      const metricType = metric.type;
      // 快照数据
      const snapshot = metric.snapshot();

      if (!snapshot || (snapshot && snapshot?.length === 0)) return;

      switch (metric.type) {
        case METRIC.TYPE_COUNTER:
        case METRIC.TYPE_GAUGE: {
          content.push(`# HELP ${metricName} ${metricDesc}`);
          content.push(`# TYPE ${metricName} ${metricType}`);
          snapshot.forEach((item) => {
            const labelStr = this.labelsToStr(item.labels);
            content.push(`${metricName}${labelStr} ${val((item as any).value)}`);

            if ((item as any).rate) {
              content.push(`${metricName}_rate${labelStr} ${val((item as any).rate)}`);
            }
          });

          content.push('');
          break;
        }
        case METRIC.TYPE_INFO: {
          content.push(`# HELP ${metricName} ${metricDesc}`);
          content.push(`# TYPE ${metricName} gauge`);
          snapshot.forEach((item) => {
            const labelStr = this.labelsToStr(item.labels, { value: (item as any).value });
            content.push(`${metricName}${labelStr} 1`);
          });
          content.push('');
          break;
        }
        case METRIC.TYPE_HISTOGRAM: {
          content.push(`# HELP ${metricName} ${metricDesc}`);
          content.push(`# TYPE ${metricName} ${metricType}`);
          snapshot.forEach((item) => {
            if ((item as any).buckets) {
              Object.keys((item as any).buckets).forEach((le) => {
                const labelStr = this.labelsToStr(item.labels, { le });
                content.push(`${metricName}_bucket${labelStr} ${val((item as any).buckets[le])}`);
              });
              const labelStr = this.labelsToStr(item.labels, { le: '+Inf' });
              content.push(`${metricName}_bucket${labelStr} ${val((item as any).count)}`);
            }

            if ((item as any).quantiles) {
              Object.keys((item as any).quantiles).forEach((key) => {
                const labelStr = this.labelsToStr(item.labels, { quantiles: key });
                content.push(`${metricName}${labelStr} ${val((item as any).quantiles[key])}`);
              });

              // 其他数据
              const labelStr = this.labelsToStr(item.labels);
              content.push(`${metricName}_sum${labelStr} ${val((item as any).sum)}`);
              content.push(`${metricName}_count${labelStr} ${val((item as any).count)}`);
              content.push(`${metricName}_min${labelStr} ${val((item as any).min)}`);
              content.push(`${metricName}_mean${labelStr} ${val((item as any).mean)}`);
              content.push(`${metricName}_variance${labelStr} ${val((item as any).variance)}`);
              content.push(`${metricName}_stddev${labelStr} ${val((item as any).stdDev)}`);
              content.push(`${metricName}_max${labelStr} ${val((item as any).max)}`);
            }

            if ((item as any).rate) {
              const labelStr = this.labelsToStr(item.labels);
              content.push(`${metricName}_rate${labelStr} ${val((item as any).rate)}`);
            }
          });

          content.push(``);
          break;
        }
      }
    });

    return content.join('\n');
  }

  /**
   * 转义
   * @param {String} str
   * @returns {String}
   * @memberof PrometheusReporter
   */
  private escapeLabelValue(str) {
    if (typeof str == 'string') return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return str;
  }

  /**
   * 将标签转换为字符串
   */
  private labelsToStr(itemLabels: GenericObject, extraLabels?: GenericObject) {
    const labels = Object.assign({}, this.defaultLabels || {}, itemLabels || {}, extraLabels || {});

    const keys = Object.keys(labels);
    if (keys.length === 0) return '';

    return (
      '{' + keys.map((key) => `${this.formatLabelName(key)}="${this.escapeLabelValue(labels[key])}"`).join(',') + '}'
    );
  }
}
