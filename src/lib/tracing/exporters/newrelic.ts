import { GenericObject } from '@/typings';
import BaseTraceExporter from './base';
import Span from '../span';
import _ from 'lodash';
import Tracer from '../tracer';
import { isFunction } from '@/utils';
import fetch from 'node-fetch';

export default class NewRelicTraceExporter extends BaseTraceExporter {
  public queue: Array<Span>;
  public timer: any;
  public defaultTags: GenericObject = {};

  constructor(options: GenericObject) {
    super(options);

    this.options = _.defaultsDeep(this.options, {
      baseURL: 'https://trace-api.newrelic.com',
      interval: 5,
      insertKey: 'NRAK-EC555B8OTTUIXMLXHQ05SB0GEQG', // NewRelic Insert API Key
      payloadOptions: {
        debug: false,
        shared: false
      },
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

    if (this.defaultTags) {
      this.defaultTags = this.flattenTags(this.defaultTags, true) || {};
    }
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    return Promise.resolve();
  }

  public spanFinished(span: Span): void {
    this.queue.push(span);
  }

  /**
   * 上传追踪数据
   */
  public flush() {
    if (this.queue.length == 0) return;

    const data = this.generateTracingData();
    this.queue.length = 0; // 清除队列，避免重复上传

    fetch(`${this.options.baseURL}/trace/v1`, {
      method: 'post',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': this.options.insertKey,
        'Data-Format': 'zipkin',
        'Data-Format-Version': 'z'
      }
    })
      .then((res) => {
        if (res.status >= 400) {
          this.logger?.warn(`Unable to upload tracing spans to NewRelic. Status: ${res.status} ${res.statusText}`);
        } else {
          this.logger?.debug(
            `Tracing spans (${data.length} spans) are uploaded to NewRelic. Status: ${res.statusText}`
          );
        }
      })
      .catch((err) => {
        this.logger?.warn(`Unable tp upload tracing spans to NewRelic.Error:` + err.message, err);
      });
  }

  /**
   * 生成链路追踪数据
   */
  public generateTracingData() {
    return this.queue.map((span) => this.makePayload(span));
  }

  /**
   * 从指标事件创建Zikin v2 版本的参数
   */
  public makePayload(span: Span) {
    const serviceName = span.service ? span.service.fullName : null;
    const payload = {
      name: span.name,
      kind: 'CONSUMER',

      traceId: this.convertID(span.traceID),
      id: this.convertID(span.traceID),
      parentId: this.convertID(span.parentID || 'unknown'),
      localEndpoint: { serviceName },
      remoteEndpoint: { serviceName },
      annotations: [
        { timestamp: this.convertTime(span.startTime || 0), value: 'sr' },
        { timestamp: this.convertTime(span.finishTime || 0), value: 'ss' }
      ] as any[],
      timestamp: this.convertTime(span.startTime || 0),
      duration: this.convertTime(span.duration || 0),

      tags: {
        service: serviceName,
        'span.type': span.type
      },

      debug: this.options.payloadOptions.debug,
      shared: this.options.payloadOptions.shared
    };

    if (span.error) {
      payload.tags['error'] = (span.error as any).message;
      payload.annotations.push({
        value: 'error',
        endpoint: { serviceName: serviceName, ipv4: '', port: 0 },
        timestamp: this.convertTime(span.finishTime || 0)
      });
    }

    Object.assign(
      payload.tags,
      this.defaultTags || {},
      this.flattenTags(span.tags, true),
      this.flattenTags(this.errorToObject(span.error) as any, true, 'error') || {}
    );

    return payload;
  }

  /**
   * 将ID转换为Zipkin格式
   */
  public convertID(id: string) {
    return id ? id.replace(/-/g, '').substring(0, 16) : null;
  }

  /**
   * 将时间戳格式转换为zipkin格式
   */
  public convertTime(ts: number) {
    return ts !== null ? Math.round(ts * 1000) : null;
  }
}
