import { GenericObject } from '@/typings';
import Star from '../star';
import { LoggerInstance } from '@/typings/logger';
import _ from 'lodash';
import RateLimiter from './rate-limiter';
import { isFunction } from '@/utils';
import { TraceExporter, TracerOptions } from '@/typings/tracing';
import Expoters from './exporters/index';

export default class Tracer {
  public star: Star;
  public logger: LoggerInstance;
  public options: GenericObject;
  public sampleCounter: number;
  public rateLimiter: RateLimiter | null = null;
  public defaultTags: GenericObject | Function | null = null;
  public exporter: TraceExporter[] | null = null;

  constructor(star: Star, options: TracerOptions | boolean) {
    this.star = star;
    this.logger = star.getLogger('tracer');

    if (options === true || options === false) {
      options = { enabled: options };
    }

    this.options = _.defaultsDeep({}, options, {
      enabled: true,
      exporter: null,
      sampling: {
        rate: 1.0,
        tracesPerSecond: null,
        minPriority: null
      },
      actions: true,
      events: false,
      errorFields: ['name', 'message', 'code', 'type', 'data'],
      stackTrace: false,
      defaultTags: null,
      tags: {
        action: null,
        event: null
      }
    });

    if (this.options.stackTrace && this.options.errorFields.indexOf('stack') === -1) {
      this.options.errorFields.push('stack');
    }

    this.sampleCounter = 0;

    if (this.options.sampling.tracesPerSecond != null && this.options.sampling.tracesPerSecond > 0) {
      this.rateLimiter = new RateLimiter({
        tracesPerSecond: this.options.sampling.tracesPerSecond
      });
    }

    if (this.options.enabled) {
      this.logger.info(`Tracing: Enabled`);
    }
  }

  public init() {
    if (this.options.enabled) {
      this.defaultTags = isFunction(this.options.defaultTags)
        ? this.options.defaultTags.call(this, this)
        : this.options.defaultTags;
    }

    if (this.options.exporter) {
      const exporters = Array.isArray(this.options.exporter) ? this.options.exporter : [this.options.exporter];

      this.exporter = _.compact(exporters).map((r) => {
        const exporter = Expoters.resolve(r);
        exporter.init(this);

        return exporter as TraceExporter;
      });

      const exporterNames = this.exporter.map((exporter) => this.star.getConstructorName(exporter));

      this.logger.info(`Tracing exporter${exporterNames.length > 1 ? 's' : ''}: ${exporterNames.join(', ')}`);
    }
  }

  public stop() {}
}
