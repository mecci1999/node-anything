import { safetyObject } from '@/utils';
import Star from '.';
import Context from '../context';
import { StarClientError } from '../error';
import { UniverseErrorCode, UniverseErrorOptionsType } from '@/typings/error';

export default function (star: Star) {
  const schema = {
    name: '$node',
    actions: {
      list: {
        cache: false,
        trancing: false,
        params: {
          withService: {
            type: 'boolean',
            optional: true,
            convert: true,
            default: false
          },
          onlyAvailable: {
            type: 'boolean',
            optional: true,
            convert: true,
            default: false
          }
        },
        handler(ctx: Context) {
          return star.registry?.getNodeList(ctx.params);
        }
      },
      services: {
        cache: false,
        tracing: false,
        params: {
          onlyLocal: {
            type: 'boolean',
            optional: true,
            convert: true,
            default: false
          },
          skipInternal: {
            type: 'boolean',
            optional: true,
            convert: true,
            default: false
          },
          withActions: {
            type: 'boolean',
            optional: true,
            convert: true,
            default: false
          },
          withEvents: {
            type: 'boolean',
            optional: true,
            convert: true,
            default: false
          },
          onlyAvailable: {
            type: 'boodeflean',
            optional: true,
            convert: true,
            default: false
          },
          grouping: {
            type: 'boolean',
            optional: true,
            convert: true,
            default: true
          }
        },
        handler(ctx: Context) {
          return star.registry?.getServiceList(ctx.params);
        }
      },
      actions: {
        cache: false,
        trancing: false,
        params: {
          onlyLocal: {
            type: 'boolean',
            optional: true,
            convert: true,
            default: false
          },
          skipInternal: {
            type: 'boolean',
            optional: true,
            convert: true,
            default: false
          },
          onlyAvailable: {
            type: 'boolean',
            optional: true,
            convert: true,
            default: false
          }
        },
        handler(ctx: Context) {
          return star.registry?.getActionList(ctx.params);
        }
      },
      events: {
        cache: false,
        tracing: false,
        params: {
          onlyLocal: { type: 'boolean', optional: true, convert: true, default: false },
          skipInternal: {
            type: 'boolean',
            optional: true,
            convert: true,
            default: false
          },
          withEndpoints: {
            type: 'boolean',
            optional: true,
            convert: true,
            default: false
          },
          onlyAvailable: {
            type: 'boolean',
            optional: true,
            convert: true,
            default: false
          }
        },
        handler(ctx: Context) {
          return star.registry?.getEventList(ctx.params);
        }
      },
      health: {
        cache: false,
        tracing: false,
        handler() {
          return star.getHealthStatus();
        }
      },
      options: {
        cache: false,
        tracing: false,
        handler() {
          return safetyObject(star.options, star.options);
        }
      },
      metrics: {
        cache: false,
        tracing: false,
        params: {
          types: {
            type: 'multi',
            optional: true,
            rules: [{ type: 'string' }, { type: 'array' }, { items: 'string' }]
          },
          includes: {
            type: 'multi',
            optional: true,
            rules: [{ type: 'string' }, { type: 'array' }, { items: 'string' }]
          },
          excludes: {
            type: 'multi',
            optional: true,
            rules: [{ type: 'string' }, { type: 'array' }, { items: 'string' }]
          }
        },
        handler(ctx: Context) {
          if (!star.isMetricsEnabled()) {
            return Promise.reject(
              new StarClientError(
                'Metrics feature is disabled',
                UniverseErrorCode.RESPONSE_ERROR,
                UniverseErrorOptionsType.METRICS_DISABLED
              )
            );
          }

          return star.metrics?.list(ctx.params);
        }
      }
    }
  };

  return schema;
}
