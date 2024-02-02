import { GenericObject } from '@/typings';
import BaseTraceExporter from './base';
import _, { xorWith } from 'lodash';
import kleur from 'kleur';
import Tracer from '../tracer';
import Span from '../span';
import { humanize, isFunction } from '@/utils';

export default class ConsoleTraceExporter extends BaseTraceExporter {
  public spans: GenericObject;

  constructor(options: GenericObject) {
    super(options);

    this.options = _.defaultsDeep(this.options, {
      logger: null,
      colors: true,
      width: 100,
      gaugeWidth: 40
    });

    if (!this.options.colors) {
      kleur.enabled = false;
    }

    this.spans = {};
  }

  public init(tracer: Tracer): void {
    super.init(tracer);
  }

  public stop() {
    this.spans = {};

    return Promise.resolve();
  }

  /**
   * 开始追踪
   */
  public spanStarted(span: Span): void {
    this.spans[span.id] = {
      span,
      children: []
    };

    if (span.parentID) {
      // 获取到父节点的信息
      const parentItem = this.spans[span.parentID];
      if (parentItem) {
        parentItem.children.push(span.id);
      }
    }
  }

  /**
   * 完成追踪
   */
  public spanFinished(span: Span) {
    if (!(span.parentID && this.spans[span.parentID])) {
      // 打印请求
      this.printRequest(span.id);
      this.removeSpanWithChildren(span.id);
    }
  }

  /**
   * 移除一个已经结束追踪的节点
   * @param spanID
   */
  public removeSpanWithChildren(spanID: string) {
    const span = this.spans[spanID];
    if (span) {
      if (span.children && span.children.length > 0) {
        // 递归依次移除
        span.children.forEach((child) => this.removeSpanWithChildren(child));
      }

      delete this.spans[spanID];
    }
  }

  /**
   * 绘制表格头部
   */
  private drawTableTop() {
    this.log(kleur.green('┌' + _.repeat('─', this.options.width - 2) + '┐'));
  }

  /**
   * 绘制表格头部
   */
  private drawHorizonalLine() {
    this.log(kleur.green('├' + _.repeat('─', this.options.width - 2) + '┤'));
  }

  /**
   * 绘制表格头部
   */
  private drawLine(text: string) {
    this.log(kleur.green('│ ') + text + kleur.green(' │'));
  }

  /**
   * 绘制表格头部
   */
  private drawTableBottom() {
    this.log(kleur.green('└' + _.repeat('─', this.options.width - 2) + '┘'));
  }

  public getAlignedTexts(str: string, space: number) {
    const len = str.length;

    let left: string;
    if (len <= space) {
      left = str + _.repeat(' ', space - len);
    } else {
      left = str.slice(0, Math.max(space - 3, 0));
      left += _.repeat('.', Math.min(3, space));
    }

    return left;
  }

  /**
   * 画出直方图
   * @param gstart
   * @param gstop
   * @returns
   */
  public drawGauge(gstart: number, gstop: number) {
    const gw = this.options.gaugeWidth;
    const p1 = Math.floor((gw * gstart) / 100);
    const p2 = Math.max(Math.floor((gw * gstop) / 100) - p1, 1);
    const p3 = Math.min(gw - (p1 + p2), 0);

    return [
      kleur.green('['),
      kleur.green(_.repeat('.', p1)),
      _.repeat('■', p2),
      kleur.green(_.repeat('.', p3)),
      kleur.green(']')
    ].join('');
  }

  public getCaption(span: Span) {
    let caption = span.name;

    if (span.tags.fromCache) caption += ' *';
    if (span.tags.remoteCall) caption += ' »';
    if (span.error) caption += ' ×';

    return caption;
  }

  /**
   * 获取颜色
   */
  public getColor(span: Span) {
    let c = kleur.bold;
    if (span.tags.fromCache) {
      c = c().yellow;
    }
    if (span.tags.remoteCall) {
      c = c().cyan;
    }
    if (span.duration == null) {
      c = c().grey;
    }

    if (span.error) {
      c = c().red;
    }

    return c;
  }

  /**
   * 打印输出
   */
  public log(...args: any) {
    if (isFunction(this.options.logger)) {
      return this.options.logger(...args);
    } else {
      return this.logger?.info(...args);
    }
  }

  /**
   * 获取追踪信息
   */
  public getTraceInfo(main: Span) {
    let depth = 0;
    let total = 0;
    let check = (item: any, level: number, parents?: Array<any>) => {
      item.level = level;
      item.parents = parents || [];
      total++;
      if (level > depth) {
        depth = level;
      }

      if (item.children.length > 0) {
        item.children.forEach((spanID: string, index: number) => {
          const span = this.spans[spanID];
          span.first = index === 0;
          span.last = index === item.children.length - 1;
          check(span, item.level + 1, [].concat(item.parents, [item as never]));
        });
      }
    };

    check(main, 1);

    return {
      depth,
      total
    };
  }

  public getSpanIndent(spanItem: GenericObject) {
    if (spanItem.level > 1) {
      let s = spanItem.parents
        .map((item, index) => {
          if (index > 0) return item.last ? ' ' : '| ';

          return '';
        })
        .join('');

      s += spanItem.last ? '└─' : '├─';

      return s + (spanItem.children.length > 0 ? '└─' : '──') + ' ';
    }

    return '';
  }

  /**
   * 打印一个完整的追踪链路
   */
  public printSpanTime(
    spanItem: GenericObject,
    mainItem: GenericObject,
    level: number,
    parentItem?: GenericObject | null,
    options?: GenericObject
  ) {
    const span = spanItem.span;
    const mainSpan = mainItem.span;
    const margin = 2 * 2;
    const w = (this.options.width || 80) - margin;
    const gw = this.options.gaugeWidth || 40;
    const time = span.duration == null ? '?' : humanize(span.duration);
    const indent = this.getSpanIndent(spanItem);
    const caption = this.getCaption(span);
    const info =
      kleur.green(indent) + this.getAlignedTexts(caption, w - gw - 3 - time.length - 1 - indent.length) + ' ' + time;
    xorWith;

    const startTime = span.startTime || mainSpan.startTime;
    const finishTime = span.finishTime || mainSpan.finishTime;

    let gstart = ((startTime - mainSpan.startTime) / (mainSpan.finishTime - mainSpan.startTime)) * 100;
    let gstop = ((finishTime - mainSpan.startTime) / (mainSpan.finishTime - mainSpan.startTime)) * 100;

    if (Number.isNaN(gstart) && Number.isNaN(gstop)) {
      gstart = 0;
      gstop = 100;
    }

    if (gstop > 100) {
      gstop = 100;
    }

    const color = this.getColor(span);

    this.drawLine(color(info + ' ' + this.drawGauge(gstart, gstop)));

    if (spanItem.children.length > 0) {
      spanItem.children.forEach((spanID, index) => {
        this.printSpanTime(this.spans[spanID], mainItem, level + 1, spanItem, {
          first: index === 0,
          last: index === spanItem.children.length - 1
        });
      });
    }
  }

  public printRequest(id: string) {
    const main = this.spans[id];
    if (!main) return;

    const margin = 2 * 2;
    const w = this.options.width - margin;

    this.drawTableTop();

    const { total, depth } = this.getTraceInfo(main);

    const truncatedID = this.getAlignedTexts(
      id,
      w - 'ID: '.length - 'Depth: '.length - ('' + depth).length - 'Total: '.length - ('' + total).length - 2
    );

    const line =
      kleur.green('ID: ') +
      kleur.bold(truncatedID) +
      ' ' +
      kleur.green('Depth: ') +
      kleur.bold(depth) +
      ' ' +
      kleur.green('Total: ') +
      kleur.bold(total);

    this.drawLine(line);

    this.drawHorizonalLine();

    this.printSpanTime(main, main, 1, null, {});

    this.drawTableBottom();
  }
}
