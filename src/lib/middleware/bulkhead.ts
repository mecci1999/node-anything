import Context from '../context';
import { QueueIsFullError } from '../error';
import { METRIC } from '../metrics';
import Star from '../star';

const bulkheadMiddleware = (star: Star) => {
  const wrapActionBulkheadMiddleware = (handler: any, action: any) => {
    const service = action.service;
    const options = Object.assign({}, (this as any).options.bulkhead || {}, action.bulkhead || {});

    if (options.enabled) {
      const queue: any[] = [];
      let currentInFlight = 0;

      // 使用递归，完成队列中的请求
      const callNext = () => {
        if (queue.length === 0) return;

        if (currentInFlight >= options?.concurrency) return;

        // 拿到队列的第一个元素
        const item = queue.shift();
        currentInFlight++;
        star.metrics?.set(METRIC.UNIVERSE_REQUEST_BULKHEAD_INFLIGHT, currentInFlight, {
          action: action.name,
          service: service?.fullName || 'Unknown'
        });
        star.metrics?.set(METRIC.UNIVERSE_REQUEST_BULKHEAD_QUEUE_SIZE, queue.length, {
          action: action.name,
          service: service?.fullName || 'Unknown'
        });

        handler(item.ctx)
          .then((res) => {
            currentInFlight--;
            star.metrics?.set(METRIC.UNIVERSE_REQUEST_BULKHEAD_INFLIGHT, currentInFlight, {
              action: action.name,
              service: service?.fullName || 'Unknown'
            });
            star.metrics?.set(METRIC.UNIVERSE_REQUEST_BULKHEAD_QUEUE_SIZE, queue.length, {
              action: action.name,
              service: service?.fullName || 'Unknown'
            });
            item.resolve(res);
            callNext();
          })
          .catch((err) => {
            currentInFlight--;
            star.metrics?.set(METRIC.UNIVERSE_REQUEST_BULKHEAD_INFLIGHT, currentInFlight, {
              action: action.name,
              service: service?.fullName || 'Unknown'
            });
            star.metrics?.set(METRIC.UNIVERSE_REQUEST_BULKHEAD_QUEUE_SIZE, queue.length, {
              action: action.name,
              service: service?.fullName || 'Unknown'
            });
            item.reject(err);
            callNext();
          });
      };

      return function bulkheadMiddleware(ctx: Context) {
        if (currentInFlight < options.concurrency) {
          currentInFlight++;
          star.metrics?.set(METRIC.UNIVERSE_REQUEST_BULKHEAD_INFLIGHT, currentInFlight, {
            action: action.name,
            service: service?.fullName || 'Unknown'
          });
          star.metrics?.set(METRIC.UNIVERSE_REQUEST_BULKHEAD_QUEUE_SIZE, queue.length, {
            action: action.name,
            service: service?.fullName || 'Unknown'
          });

          return handler(ctx)
            .then((res) => {
              currentInFlight--;
              star.metrics?.set(METRIC.UNIVERSE_REQUEST_BULKHEAD_INFLIGHT, currentInFlight, {
                action: action.name,
                service: service?.fullName || 'Unknown'
              });
              star.metrics?.set(METRIC.UNIVERSE_REQUEST_BULKHEAD_QUEUE_SIZE, queue.length, {
                action: action.name,
                service: service?.fullName || 'Unknown'
              });
              callNext();
              return res;
            })
            .catch((err) => {
              currentInFlight--;
              star.metrics?.set(METRIC.UNIVERSE_REQUEST_BULKHEAD_INFLIGHT, currentInFlight, {
                action: action.name,
                service: service?.fullName || 'Unknown'
              });
              star.metrics?.set(METRIC.UNIVERSE_REQUEST_BULKHEAD_QUEUE_SIZE, queue.length, {
                action: action.name,
                service: service?.fullName || 'Unknown'
              });
              callNext();
              return Promise.reject(err);
            });
        }

        // 队列已满
        if (options.maxQueueSize && queue.length >= options.maxQueueSize) {
          return Promise.reject(new QueueIsFullError({ action: ctx.action?.name, nodeID: ctx.nodeID || 'Unknown' }));
        }

        const p = new Promise((resolve, rejcet) => {
          return queue.push({ resolve, rejcet, ctx });
        });

        star.metrics?.set(METRIC.UNIVERSE_REQUEST_BULKHEAD_QUEUE_SIZE, queue.length, {
          action: action.name,
          service: service?.fullName || 'Unknown'
        });

        return p;
      }.bind(this);
    }

    return handler;
  };

  const wrapEventBulkheadMiddleware = (handler: any, event: any) => {
    const service = event.service;
    const options = Object.assign({}, (this as any).options.bulkhead || {}, event.bulkhead || {});

    if (options.enabled) {
      const queue: any[] = [];
      let currentInFlight = 0;

      // 使用递归，完成队列中的请求
      const callNext = () => {
        if (queue.length === 0) return;

        if (currentInFlight >= options?.concurrency) return;

        // 拿到队列的第一个元素
        const item = queue.shift();
        currentInFlight++;
        star.metrics?.set(METRIC.UNIVERSE_EVENT_BULKHEAD_INFLIGHT, currentInFlight, {
          action: event.name,
          service: service?.fullName || 'Unknown'
        });
        star.metrics?.set(METRIC.UNIVERSE_EVENT_BULKHEAD_QUEUE_SIZE, queue.length, {
          action: event.name,
          service: service?.fullName || 'Unknown'
        });

        handler(item.ctx)
          .then((res) => {
            currentInFlight--;
            star.metrics?.set(METRIC.UNIVERSE_EVENT_BULKHEAD_INFLIGHT, currentInFlight, {
              action: event.name,
              service: service?.fullName || 'Unknown'
            });
            star.metrics?.set(METRIC.UNIVERSE_EVENT_BULKHEAD_QUEUE_SIZE, queue.length, {
              action: event.name,
              service: service?.fullName || 'Unknown'
            });
            item.resolve(res);
            callNext();
          })
          .catch((err) => {
            currentInFlight--;
            star.metrics?.set(METRIC.UNIVERSE_EVENT_BULKHEAD_INFLIGHT, currentInFlight, {
              action: event.name,
              service: service?.fullName || 'Unknown'
            });
            star.metrics?.set(METRIC.UNIVERSE_EVENT_BULKHEAD_QUEUE_SIZE, queue.length, {
              action: event.name,
              service: service?.fullName || 'Unknown'
            });
            item.reject(err);
            callNext();
          });
      };

      return function bulkheadMiddleware(ctx: Context) {
        if (currentInFlight < options.concurrency) {
          currentInFlight++;
          star.metrics?.set(METRIC.UNIVERSE_EVENT_BULKHEAD_INFLIGHT, currentInFlight, {
            action: event.name,
            service: service?.fullName || 'Unknown'
          });
          star.metrics?.set(METRIC.UNIVERSE_EVENT_BULKHEAD_QUEUE_SIZE, queue.length, {
            action: event.name,
            service: service?.fullName || 'Unknown'
          });

          return handler(ctx)
            .then((res) => {
              currentInFlight--;
              star.metrics?.set(METRIC.UNIVERSE_EVENT_BULKHEAD_INFLIGHT, currentInFlight, {
                action: event.name,
                service: service?.fullName || 'Unknown'
              });
              star.metrics?.set(METRIC.UNIVERSE_EVENT_BULKHEAD_QUEUE_SIZE, queue.length, {
                action: event.name,
                service: service?.fullName || 'Unknown'
              });
              callNext();
              return res;
            })
            .catch((err) => {
              currentInFlight--;
              star.metrics?.set(METRIC.UNIVERSE_EVENT_BULKHEAD_INFLIGHT, currentInFlight, {
                action: event.name,
                service: service?.fullName || 'Unknown'
              });
              star.metrics?.set(METRIC.UNIVERSE_EVENT_BULKHEAD_QUEUE_SIZE, queue.length, {
                action: event.name,
                service: service?.fullName || 'Unknown'
              });
              callNext();
              return Promise.reject(err);
            });
        }

        // 队列已满
        if (options.maxQueueSize && queue.length >= options.maxQueueSize) {
          return Promise.reject(new QueueIsFullError({ action: ctx.action?.name, nodeID: ctx.nodeID || 'Unknown' }));
        }

        const p = new Promise((resolve, rejcet) => {
          return queue.push({ resolve, rejcet, ctx });
        });

        star.metrics?.set(METRIC.UNIVERSE_EVENT_BULKHEAD_QUEUE_SIZE, queue.length, {
          action: event.name,
          service: service?.fullName || 'Unknown'
        });

        return p;
      }.bind(this);
    }

    return handler;
  };

  return {
    name: 'Bulkhead',
    created() {
      if (star.isMetricsEnabled()) {
        star.metrics?.register({
          name: METRIC.UNIVERSE_REQUEST_BULKHEAD_INFLIGHT,
          type: METRIC.TYPE_GAUGE,
          labelNames: ['action', 'service']
        });
        star.metrics?.register({
          name: METRIC.UNIVERSE_REQUEST_BULKHEAD_QUEUE_SIZE,
          type: METRIC.TYPE_GAUGE,
          labelNames: ['action', 'service']
        });
        star.metrics?.register({
          name: METRIC.UNIVERSE_EVENT_BULKHEAD_INFLIGHT,
          type: METRIC.TYPE_GAUGE,
          labelNames: ['action', 'service']
        });
        star.metrics?.register({
          name: METRIC.UNIVERSE_EVENT_BULKHEAD_QUEUE_SIZE,
          type: METRIC.TYPE_GAUGE,
          labelNames: ['action', 'service']
        });
      }
    },
    localAction: wrapActionBulkheadMiddleware,
    localEvent: wrapEventBulkheadMiddleware
  };
};

export default bulkheadMiddleware;
