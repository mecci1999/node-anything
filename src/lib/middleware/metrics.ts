import Context from '../context';
import { METRIC } from '../metrics';
import Star from '../star';

export default function metricsHandlerMiddleware(star: Star) {
  const metrics = star.metrics;

  function getActionHandler(type: string, actionDef: any, next: any) {
    const action = actionDef.name;
    const service = actionDef.service ? actionDef.service.fullName : null;

    return function metricsMiddleware(ctx: Context) {
      const caller = ctx.caller;

      metrics?.increment(METRIC.UNIVERSE_REQUEST_TOTAL, { service, action, caller, type });
      metrics?.increment(METRIC.UNIVERSE_REQUEST_ACTIVE, { service, action, caller, type });
      metrics?.increment(METRIC.UNIVERSE_REQUEST_LEVELS, { service, action, caller, level: ctx.level });

      const timeEnd = metrics?.timer(METRIC.UNIVERSE_REQUEST_TIME, { service, action, caller, type });

      return next(ctx)
        .then((res) => {
          if (timeEnd) {
            timeEnd();
          }
          metrics?.decrement(METRIC.UNIVERSE_REQUEST_ACTIVE, { service, action, caller, type });
          return res;
        })
        .catch((err) => {
          if (timeEnd) {
            timeEnd();
          }
          metrics?.decrement(METRIC.UNIVERSE_REQUEST_ACTIVE, { service, action, caller, type });
          metrics?.decrement(METRIC.UNIVERSE_REQUEST_ERROR_TOTAL, {
            service,
            action,
            caller,
            type,
            errorName: err ? err.name : null,
            errorCode: err ? err.code : null,
            errorType: err ? err.type : null
          });
          throw err;
        });
    };
  }

  return {
    name: 'Metrics',
    created() {
      if (star.isMetricsEnabled()) {
        // 请求
        metrics?.register({
          name: METRIC.UNIVERSE_REQUEST_TOTAL,
          type: METRIC.TYPE_COUNTER,
          labelNames: ['service', 'action', 'type', 'caller'],
          unit: METRIC.UNIT_REQUEST,
          description: 'Number of requests',
          rate: true
        });
        metrics?.register({
          name: METRIC.UNIVERSE_REQUEST_ACTIVE,
          type: METRIC.TYPE_GAUGE,
          labelNames: ['service', 'action', 'type', 'caller'],
          unit: METRIC.UNIT_REQUEST,
          description: 'Number of active requests'
        });
        metrics?.register({
          name: METRIC.UNIVERSE_REQUEST_ERROR_TOTAL,
          type: METRIC.TYPE_COUNTER,
          labelNames: ['srvice', 'action', 'type', 'caller', 'errorName', 'errorCode', 'errorType'],
          unit: METRIC.UNIT_REQUEST,
          description: 'Number of request errors',
          rate: true
        });
        metrics?.register({
          name: METRIC.UNIVERSE_REQUEST_TIME,
          type: METRIC.TYPE_HISTOGRAM,
          labelNames: ['service', 'action', 'type', 'caller'],
          quantiles: true,
          buckets: true,
          unit: METRIC.UNIT_MILLISECONDS,
          description: 'Request times in milliseconds',
          rate: true
        });
        metrics?.register({
          name: METRIC.UNIVERSE_REQUEST_LEVELS,
          type: METRIC.TYPE_COUNTER,
          labelNames: ['level'],
          unit: METRIC.UNIT_REQUEST,
          description: 'Number of requests by context level'
        });

        // 事件
        metrics?.register({
          name: METRIC.UNIVERSE_EVENT_EMIT_TOTAL,
          type: METRIC.TYPE_COUNTER,
          labelNames: ['event', 'groups'],
          unit: METRIC.UNIT_EVENT,
          description: 'Number of emitted events',
          rate: true
        });
        metrics?.register({
          name: METRIC.UNIVERSE_EVENT_BROADCAST_TOTAL,
          type: METRIC.TYPE_COUNTER,
          labelNames: ['event', 'groups'],
          unit: METRIC.UNIT_EVENT,
          description: 'Number of broadcast events',
          rate: true
        });
        metrics?.register({
          name: METRIC.UNIVERSE_EVENT_BROADCASTLOCAL_TOTAL,
          type: METRIC.TYPE_COUNTER,
          labelNames: ['event', 'groups'],
          unit: METRIC.UNIT_EVENT,
          description: 'Number of local broadcast events',
          rate: true
        });
        metrics?.register({
          name: METRIC.UNIVERSE_EVENT_RECEIVED_TOTAL,
          type: METRIC.TYPE_COUNTER,
          labelNames: ['service', 'group', 'event', 'caller'],
          unit: METRIC.UNIT_EVENT,
          description: 'Number of received events',
          rate: true
        });
        metrics?.register({
          name: METRIC.UNIVERSE_EVENT_RECEIVED_ACTIVE,
          type: METRIC.TYPE_GAUGE,
          labelNames: ['service', 'group', 'event', 'caller'],
          unit: METRIC.UNIT_REQUEST,
          description: 'Number of active event executions'
        });
        metrics?.register({
          name: METRIC.UNIVERSE_EVENT_RECEIVED_ERROR_TOTAL,
          type: METRIC.TYPE_COUNTER,
          labelNames: ['service', 'group', 'event', 'caller', 'errorName', 'errorCode', 'errorType'],
          unit: METRIC.UNIT_REQUEST,
          description: 'Number of event excution errors',
          rate: true
        });
        metrics?.register({
          name: METRIC.UNIVERSE_EVENT_RECEIVED_TIME,
          type: METRIC.TYPE_HISTOGRAM,
          labelNames: ['services', 'group', 'event', 'caller'],
          quantiles: true,
          buckets: true,
          unit: METRIC.UNIT_MILLISECONDS,
          description: 'Execution time of events in milliseconds',
          rate: true
        });

        // 通讯模块
        metrics?.register({
          name: METRIC.UNIVERSE_TRANSIT_PUBLISH_TOTAL,
          type: METRIC.TYPE_COUNTER,
          labelNames: ['type'],
          unit: METRIC.UNIT_PACKET,
          description: 'Number of published packets',
          rate: true
        });
        metrics?.register({
          name: METRIC.UNIVERSE_TRANSIT_RECEIVE_TOTAL,
          type: METRIC.TYPE_COUNTER,
          labelNames: ['type'],
          unit: METRIC.UNIT_PACKET,
          description: 'Number of received packets',
          rate: true
        });
        metrics?.register({
          name: METRIC.UNIVERSE_TRANSIT_REQUESTS_ACTIVE,
          type: METRIC.TYPE_GAUGE,
          unit: METRIC.UNIT_REQUEST,
          description: 'Number of active requests'
        });
        metrics?.register({
          name: METRIC.UNIVERSE_TRANSIT_STREAMS_SEND_ACTIVE,
          type: METRIC.TYPE_GAUGE,
          unit: METRIC.UNIT_REQUEST,
          description: 'Number of active sent streams'
        });

        // 底层传输模块
        metrics?.register({
          name: METRIC.UNIVERSE_TRANSPORTER_PACKETS_SENT_TOTAL,
          type: METRIC.TYPE_COUNTER,
          unit: METRIC.UNIT_PACKET,
          description: 'Number of sent packets',
          rate: true
        });
        metrics?.register({
          name: METRIC.UNIVERSE_TRANSPORTER_PACKETS_SENT_BYTES,
          type: METRIC.TYPE_COUNTER,
          unit: METRIC.UNIT_BYTE,
          description: 'Number of sent bytes',
          rate: true
        });
        metrics?.register({
          name: METRIC.UNIVERSE_TRANSPORTER_PACKETS_RECEIVED_TOTAL,
          type: METRIC.TYPE_COUNTER,
          unit: METRIC.UNIT_PACKET,
          description: 'Number of received packets',
          rate: true
        });
        metrics?.register({
          name: METRIC.UNIVERSE_TRANSPORTER_PACKETS_RECEIVED_BYTES,
          type: METRIC.TYPE_COUNTER,
          unit: METRIC.UNIT_BYTE,
          description: 'Number of received bytes',
          rate: true
        });
      }
    },

    localAction(next: any, action: any) {
      if (star.isMetricsEnabled()) {
        return getActionHandler('local', action, next);
      }

      return next;
    },

    remoteAction(next: any, action: any) {
      if (star.isMetricsEnabled()) {
        return getActionHandler('remote', action, next);
      }

      return next;
    },

    localEvent(next: any, event: any) {
      const service = event.service ? event.service.name : null;
      if (star.isMetricsEnabled()) {
        const metricsMiddleware = (ctx: Context) => {
          const group = event.group || service;
          metrics?.increment(METRIC.UNIVERSE_EVENT_RECEIVED_TOTAL, {
            service,
            event: ctx.eventName,
            group,
            caller: ctx.caller
          });
          metrics?.increment(METRIC.UNIVERSE_EVENT_RECEIVED_ACTIVE, {
            service,
            event: ctx.eventName,
            group,
            caller: ctx.caller
          });
          const timeEnd = metrics?.timer(METRIC.UNIVERSE_EVENT_RECEIVED_TIME, {
            service,
            event: ctx.eventName,
            group,
            caller: ctx.caller
          });

          return next
            .apply(this, arguments)
            .then((res) => {
              if (timeEnd) {
                timeEnd();
              }
              metrics?.decrement(METRIC.UNIVERSE_EVENT_RECEIVED_ACTIVE, {
                service,
                event: ctx.eventName,
                group,
                caller: ctx.caller
              });

              return res;
            })
            .catch((err) => {
              if (timeEnd) {
                timeEnd();
              }
              metrics?.decrement(METRIC.UNIVERSE_EVENT_RECEIVED_ACTIVE, {
                service,
                event: ctx.eventName,
                group,
                caller: ctx.caller
              });
              metrics?.decrement(METRIC.UNIVERSE_EVENT_RECEIVED_ERROR_TOTAL, {
                service,
                event: ctx.eventName,
                group,
                caller: ctx.caller,
                errorName: err ? err.name : null,
                errorCode: err ? err.code : null,
                errorType: err ? err.type : null
              });

              throw err;
            });
        };

        return metricsMiddleware.bind(this);
      }

      return next;
    },

    emit(next: any) {
      if (star.isMetricsEnabled()) {
        const metricsMiddleware = () => {
          metrics?.increment(METRIC.UNIVERSE_EVENT_EMIT_TOTAL, { event: arguments[0] });
          return next.apply(this, arguments);
        };

        return metricsMiddleware.bind(this);
      }

      return next;
    },

    broadcast(next: any) {
      if (star.isMetricsEnabled()) {
        const metricsMiddleware = () => {
          metrics?.increment(METRIC.UNIVERSE_EVENT_BROADCAST_TOTAL, { event: arguments[0] });
          return next.apply(this, arguments);
        };

        return metricsMiddleware.bind(this);
      }

      return next;
    },

    broadcastLocal(next: any) {
      if (star.isMetricsEnabled()) {
        const metricsMiddleware = () => {
          metrics?.increment(METRIC.UNIVERSE_EVENT_BROADCASTLOCAL_TOTAL, { event: arguments[0] });
          return next.apply(this, arguments);
        };

        return metricsMiddleware.bind(this);
      }

      return next;
    },

    transitPublish(next: any) {
      const transit = this as any;
      if (star.isMetricsEnabled()) {
        const metricsMiddleware = () => {
          metrics?.increment(METRIC.UNIVERSE_TRANSIT_PUBLISH_TOTAL, { type: arguments[0].type });

          const p = next.apply(this, arguments);
          metrics?.increment(METRIC.UNIVERSE_TRANSIT_REQUESTS_ACTIVE, null, transit.pendingRequests.size);
          metrics?.increment(
            METRIC.UNIVERSE_TRANSIT_STREAMS_SEND_ACTIVE,
            null,
            transit.pendingReqStreams.size + (this as any).pendingResStream.size
          );

          return p;
        };

        return metricsMiddleware.bind(this);
      }

      return next;
    },

    transitMessageHandler(next: any) {
      if (star.isMetricsEnabled()) {
        const metricsMiddleware = () => {
          metrics?.increment(METRIC.UNIVERSE_TRANSIT_RECEIVE_TOTAL, { type: arguments[0] });
          return next.apply(this, arguments);
        };

        return metricsMiddleware.bind(this);
      }

      return next;
    },

    transporterSend(next: any) {
      if (star.isMetricsEnabled()) {
        const metricsMiddleware = () => {
          const data = arguments[1];
          metrics?.increment(METRIC.UNIVERSE_TRANSPORTER_PACKETS_SENT_TOTAL);
          metrics?.increment(
            METRIC.UNIVERSE_TRANSPORTER_PACKETS_SENT_BYTES,
            null,
            data && data.length ? data.length : 0
          );

          return next.apply(this, arguments);
        };

        return metricsMiddleware.bind(this);
      }

      return next;
    },

    transporterReceive(next: any) {
      if (star.isMetricsEnabled()) {
        const metricsMiddleware = () => {
          const data = arguments[1];
          metrics?.increment(METRIC.UNIVERSE_TRANSPORTER_PACKETS_RECEIVED_TOTAL);
          metrics?.increment(
            METRIC.UNIVERSE_TRANSPORTER_PACKETS_RECEIVED_BYTES,
            null,
            data && data.length ? data.length : 0
          );

          return next.apply(this, arguments);
        };

        return metricsMiddleware.bind(this);
      }

      return next;
    }
  };
}
