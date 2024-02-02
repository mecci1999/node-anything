import { GenericObject } from '@/typings';
import BaseTraceExporter from './base';
import _ from 'lodash';
import Span from '../span';
import Tracer from '../tracer';
import { isFunction } from '@/utils';

export default class EventTraceExporter extends BaseTraceExporter {
  public queue: Span[];
  public timer: any;
  public defaultTags: any;

  constructor(options: GenericObject) {
    super(options);

    this.options = _.defaultsDeep(this.options, {
      eventName: '$tracing.spans',
      sendStartSpan: false,
      sendFinishSpan: true,
      broadcast: false,
      groups: null,
      interval: 5,
      spanConverter: null,
      defaultTags: null
    });

    this.queue = [];
  }

  public init(tracer: Tracer) {
    super.init(tracer);

    if (this.options.interval > 0) {
      this.timer = setInterval(() => this.flush(), this.options.interval * 1000);
      this.timer.unref();
    }

    this.defaultTags = isFunction(this.options.defaultTags)
      ? this.options.defaultTags.call(this, tracer)
      : this.options.defaultTags;
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    return Promise.resolve();
  }

  /**
   * 开始追踪
   * @param span
   * @returns
   */
  public spanStarted(span: Span) {
    if (this.options.sendStartSpan) {
      if (span.tags.eventName == this.options.eventName) return;

      this.queue.push(span);

      if (!this.timer) this.flush();
    }
  }

  /**
   * 结束追踪
   * @param span
   */
  public spanFinished(span: Span) {
    if (this.options.sendFinishSpan) {
      if (span.tags.eventName == this.options.eventName) return;

      this.queue.push(span);

      if (!this.timer) this.flush();
    }
  }

  /**
   * 上传数据
   */
  public flush() {
    if (this.queue.length == 0) return;

    const data = this.generateTracingData();
    this.queue.length = 0;

    if (this.options.broadcast) {
      this.logger?.debug(`Send tracing spans (${data.length} spans) broadcast events.`);
      this.star?.broadcast(this.options.eventName, data, { groups: this.options.groups });
    } else {
      this.logger?.debug(`Send tracing spans (${data.length} spans) events.`);
      this.star?.emit(this.options.eventName, data, { groups: this.options.groups });
    }
  }

  /**
   * 生成链路数据
   */
  public generateTracingData() {
    if (isFunction(this.options.spanConverter)) {
      return this.queue.map((span) => this.options.spanConverter.call(this, span));
    }

    return Array.from(this.queue).map((span) => {
      const newSpan = Object.assign({}, span);
      if (newSpan.error && span.error) {
        newSpan.error = this.errorToObject(span.error) as any;
      }

      return newSpan;
    });
  }
}
