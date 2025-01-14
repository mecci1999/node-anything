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
          metrics?.increment(METRIC.UNIVERSE_REQUEST_ERROR_TOTAL, {
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
          description: '微服务请求总数量',
          rate: true
        });
        metrics?.register({
          name: METRIC.UNIVERSE_REQUEST_ACTIVE,
          type: METRIC.TYPE_GAUGE,
          labelNames: ['service', 'action', 'type', 'caller'],
          unit: METRIC.UNIT_REQUEST,
          description: '微服务正在活跃状态的请求数量'
        });
        metrics?.register({
          name: METRIC.UNIVERSE_REQUEST_ERROR_TOTAL,
          type: METRIC.TYPE_COUNTER,
          labelNames: ['srvice', 'action', 'type', 'caller', 'errorName', 'errorCode', 'errorType'],
          unit: METRIC.UNIT_REQUEST,
          description: '返回错误的请求总数量',
          rate: true
        });
        metrics?.register({
          name: METRIC.UNIVERSE_REQUEST_TIME,
          type: METRIC.TYPE_HISTOGRAM,
          labelNames: ['service', 'action', 'type', 'caller'],
          quantiles: true,
          buckets: true,
          unit: METRIC.UNIT_MILLISECONDS,
          description: '请求耗时（毫秒）',
          rate: true
        });
        metrics?.register({
          name: METRIC.UNIVERSE_REQUEST_LEVELS,
          type: METRIC.TYPE_COUNTER,
          labelNames: ['level'],
          unit: METRIC.UNIT_REQUEST,
          description: '按上下文级别统计的请求数量'
        });

        // 事件
        metrics?.register({
          name: METRIC.UNIVERSE_EVENT_EMIT_TOTAL,
          type: METRIC.TYPE_COUNTER,
          labelNames: ['event', 'groups'],
          unit: METRIC.UNIT_EVENT,
          description: '触发的事件数量',
          rate: true
        });
        metrics?.register({
          name: METRIC.UNIVERSE_EVENT_BROADCAST_TOTAL,
          type: METRIC.TYPE_COUNTER,
          labelNames: ['event', 'groups'],
          unit: METRIC.UNIT_EVENT,
          description: '广播事件的数量',
          rate: true
        });
        metrics?.register({
          name: METRIC.UNIVERSE_EVENT_BROADCASTLOCAL_TOTAL,
          type: METRIC.TYPE_COUNTER,
          labelNames: ['event', 'groups'],
          unit: METRIC.UNIT_EVENT,
          description: '本地广播事件的数量',
          rate: true
        });
        metrics?.register({
          name: METRIC.UNIVERSE_EVENT_RECEIVED_TOTAL,
          type: METRIC.TYPE_COUNTER,
          labelNames: ['service', 'group', 'event', 'caller'],
          unit: METRIC.UNIT_EVENT,
          description: '接收到的事件数量',
          rate: true
        });
        metrics?.register({
          name: METRIC.UNIVERSE_EVENT_RECEIVED_ACTIVE,
          type: METRIC.TYPE_GAUGE,
          labelNames: ['service', 'group', 'event', 'caller'],
          unit: METRIC.UNIT_REQUEST,
          description: '活跃事件执行的数量'
        });
        metrics?.register({
          name: METRIC.UNIVERSE_EVENT_RECEIVED_ERROR_TOTAL,
          type: METRIC.TYPE_COUNTER,
          labelNames: ['service', 'group', 'event', 'caller', 'errorName', 'errorCode', 'errorType'],
          unit: METRIC.UNIT_REQUEST,
          description: '事件执行错误的数量',
          rate: true
        });
        metrics?.register({
          name: METRIC.UNIVERSE_EVENT_RECEIVED_TIME,
          type: METRIC.TYPE_HISTOGRAM,
          labelNames: ['services', 'group', 'event', 'caller'],
          quantiles: true,
          buckets: true,
          unit: METRIC.UNIT_MILLISECONDS,
          description: '事件执行时间（毫秒）',
          rate: true
        });

        // 通讯模块
        metrics?.register({
          name: METRIC.UNIVERSE_TRANSIT_PUBLISH_TOTAL,
          type: METRIC.TYPE_COUNTER,
          labelNames: ['type'],
          unit: METRIC.UNIT_PACKET,
          description: '已发布数据包的数量',
          rate: true
        });
        metrics?.register({
          name: METRIC.UNIVERSE_TRANSIT_RECEIVE_TOTAL,
          type: METRIC.TYPE_COUNTER,
          labelNames: ['type'],
          unit: METRIC.UNIT_PACKET,
          description: '接收到的数据包数量',
          rate: true
        });
        metrics?.register({
          name: METRIC.UNIVERSE_TRANSIT_REQUESTS_ACTIVE,
          type: METRIC.TYPE_GAUGE,
          unit: METRIC.UNIT_REQUEST,
          description: '活动请求的数量'
        });
        metrics?.register({
          name: METRIC.UNIVERSE_TRANSIT_STREAMS_SEND_ACTIVE,
          type: METRIC.TYPE_GAUGE,
          unit: METRIC.UNIT_REQUEST,
          description: '活动发送流的数量'
        });

        // 底层传输模块
        metrics?.register({
          name: METRIC.UNIVERSE_TRANSPORTER_PACKETS_SENT_TOTAL,
          type: METRIC.TYPE_COUNTER,
          unit: METRIC.UNIT_PACKET,
          description: '已发送数据包的数量',
          rate: true
        });
        metrics?.register({
          name: METRIC.UNIVERSE_TRANSPORTER_PACKETS_SENT_BYTES,
          type: METRIC.TYPE_COUNTER,
          unit: METRIC.UNIT_BYTE,
          description: '发送的字节数',
          rate: true
        });
        metrics?.register({
          name: METRIC.UNIVERSE_TRANSPORTER_PACKETS_RECEIVED_TOTAL,
          type: METRIC.TYPE_COUNTER,
          unit: METRIC.UNIT_PACKET,
          description: '接收数据包的数量',
          rate: true
        });
        metrics?.register({
          name: METRIC.UNIVERSE_TRANSPORTER_PACKETS_RECEIVED_BYTES,
          type: METRIC.TYPE_COUNTER,
          unit: METRIC.UNIT_BYTE,
          description: '接收字节的数量',
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
      const group = event.group || service;

      const metricsMiddleware = (ctx: Context) => {
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

        return next(ctx)
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
              errorName: err?.name,
              errorCode: err?.code,
              errorType: err?.type
            });
            throw err;
          });
      };

      if (star.isMetricsEnabled()) {
        return metricsMiddleware;
      }

      return next;
    },

    emit(next: any) {
      if (star.isMetricsEnabled()) {
        const metricsMiddleware = (...args: any[]) => {
          metrics?.increment(METRIC.UNIVERSE_EVENT_EMIT_TOTAL, { event: args[0] });
          return next.apply(this, args);
        };

        return metricsMiddleware;
      }

      return next;
    },

    broadcast(next: any) {
      if (star.isMetricsEnabled()) {
        const metricsMiddleware = (...args: any[]) => {
          metrics?.increment(METRIC.UNIVERSE_EVENT_BROADCAST_TOTAL, { event: args[0] });
          return next.apply(this, args);
        };

        return metricsMiddleware;
      }

      return next;
    },

    broadcastLocal(next: any) {
      if (star.isMetricsEnabled()) {
        const metricsMiddleware = (...args: any[]) => {
          metrics?.increment(METRIC.UNIVERSE_EVENT_BROADCASTLOCAL_TOTAL, { event: args[0] });
          return next.apply(this, args);
        };

        return metricsMiddleware;
      }

      return next;
    },

    transitPublish(next: any) {
      const transit = this as any;
      if (star.isMetricsEnabled()) {
        const metricsMiddleware = (...args: any[]) => {
          metrics?.increment(METRIC.UNIVERSE_TRANSIT_PUBLISH_TOTAL, { type: args[0].type });

          const p = next.apply(this, args);
          metrics?.increment(METRIC.UNIVERSE_TRANSIT_REQUESTS_ACTIVE, null, transit.pendingRequests?.size || 0);
          metrics?.increment(
            METRIC.UNIVERSE_TRANSIT_STREAMS_SEND_ACTIVE,
            null,
            (transit.pendingReqStreams?.size || 0) + ((this as any).pendingResStream?.size || 0)
          );

          return p;
        };

        return metricsMiddleware;
      }

      return next;
    },

    transitMessageHandler(next: any) {
      if (star.isMetricsEnabled()) {
        const metricsMiddleware = (...args: any[]) => {
          metrics?.increment(METRIC.UNIVERSE_TRANSIT_RECEIVE_TOTAL, { type: args[0] });
          return next.apply(this, args);
        };

        return metricsMiddleware;
      }

      return next;
    },

    transporterSend(next: any) {
      if (star.isMetricsEnabled()) {
        const metricsMiddleware = (...args: any[]) => {
          const data = args[1];
          metrics?.increment(METRIC.UNIVERSE_TRANSPORTER_PACKETS_SENT_TOTAL);
          metrics?.increment(
            METRIC.UNIVERSE_TRANSPORTER_PACKETS_SENT_BYTES,
            null,
            data && data.length ? data.length : 0
          );

          return next.apply(this, args);
        };

        return metricsMiddleware;
      }

      return next;
    },

    transporterReceive(next: any) {
      if (star.isMetricsEnabled()) {
        const metricsMiddleware = (...args: any[]) => {
          const data = args[1];
          metrics?.increment(METRIC.UNIVERSE_TRANSPORTER_PACKETS_RECEIVED_TOTAL);
          metrics?.increment(
            METRIC.UNIVERSE_TRANSPORTER_PACKETS_RECEIVED_BYTES,
            null,
            data && data.length ? data.length : 0
          );

          return next.apply(this, args);
        };

        return metricsMiddleware;
      }

      return next;
    }
  };
}
