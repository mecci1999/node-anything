import { GenericObject } from '@/typings';
import Star from '../star';
import { LoggerInstance } from '@/typings/logger';
import _ from 'lodash';
import RateLimiter from './rate-limiter';

export default class Tracer {
  public star: Star;
  public logger: LoggerInstance;
  public options: GenericObject;
  public sampleCounter: number;
  public rateLimiter: RateLimiter | null = null;

  constructor(star: Star, options: GenericObject | boolean) {
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
}
