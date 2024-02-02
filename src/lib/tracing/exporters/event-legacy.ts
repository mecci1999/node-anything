import { GenericObject } from '@/typings';
import BaseTraceExporter from './base';
import _ from 'lodash';
import Tracer from '../tracer';
import Span from '../span';
import Context from '@/lib/context';
import { isFunction, isObject } from '@/utils';

export default class EventLegacyTraceExporter extends BaseTraceExporter {
  constructor(options: GenericObject) {
    super(options);

    this.options = _.defaultsDeep(this.options, {});
  }

  public init(tracer: Tracer) {
    super.init(tracer);
    this.star = tracer.star;
  }

  public spanStarted(span: Span) {
    if (span.tags.eventName == 'metrics.trace.span.start' || span.tags.eventName == 'metrics.trace.span.finish') {
      return;
    }

    const payload = this.generateMetricPayload(span);
    this.star?.emit('metrics.trace.span.start', payload);
  }

  public spanFinished(span: Span) {
    if (span.tags.eventName == 'metrics.trace.span.start' || span.tags.eventName == 'metrics.trace.span.finish') {
      return;
    }

    const payload = this.generateMetricPayload(span);
    this.star?.emit('metrics.trace.span.finish', payload);
  }

  /**
   * 生成指标数据
   * @param span
   * @returns
   */
  public generateMetricPayload(span: Span) {
    let payload: GenericObject = {
      id: span.id,
      requestID: span.traceID,
      level: span.tags.callingLevel,
      startTime: span.startTime,
      remoteCall: span.tags.remoteCall
    };

    if (span.options.ctx) {
      this.processExtraMetrics(span.options.ctx, payload);
    }

    payload.action = span.tags.action;
    payload.service = span.service;

    if (span.parentID) {
      payload.parent = span.parentID;
    }

    payload.nodeID = this.star?.nodeID;

    if (payload.remoteCall) {
      payload.callerNodeID = span.tags.callerNodeID;
    }

    if (span.finishTime) {
      payload.endTime = span.finishTime;
      payload.duration = span.duration;
      payload.fromCache = span.tags.fromCache;

      if (span.error) {
        payload.error = this.errorToObject(span.error);
      }
    }

    return payload;
  }

  private processExtraMetrics(ctx: Context, payload: GenericObject) {
    if (isObject(ctx.action?.metrics)) {
      this.assignExtraMetrics(ctx, 'params', payload);
      this.assignExtraMetrics(ctx, 'meta', payload);
    }
  }

  private assignExtraMetrics(ctx: Context, name: string, payload: any) {
    let def = ctx.action?.metric[name];
    if (def === true) {
      payload[name] = ctx[name];
    } else if (Array.isArray(def)) {
      payload[name] = _.pick(ctx[name], def);
    } else if (isFunction(def)) {
      payload[name] = def(ctx[name]);
    }
  }
}
