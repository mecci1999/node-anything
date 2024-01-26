import { MetricReporterOptions } from '@/typings/metric';
import BaseReporter from './base';
import _ from 'lodash';
import MetricRegistry from '../registry';
import path from 'path';
import { makeDirs } from '@/utils';

const MODE_METRIC = 'metric';
const MODE_LABEL = 'label';

export default class CSVReporter extends BaseReporter {
  public lastChanges: Set<any>;
  public timer: NodeJS.Timer | null = null;
  public folder: string = '';

  constructor(options: MetricReporterOptions) {
    super(options);

    this.options = _.defaultsDeep(this.options, {
      folder: './reports/metrics',
      delimiter: ',',
      rowDelmiter: '\n',
      mode: MODE_METRIC,
      types: null,
      interval: 5,
      filenameFormatter: null,
      rowFormatter: null
    });

    this.lastChanges = new Set();
  }

  public init(registry: MetricRegistry): void {
    super.init(registry);

    if (this.options.interval > 0) {
      this.timer = setInterval(() => this.flush(), this.options.interval * 1000);
      this.timer.unref();
    }

    this.folder = path.resolve(this.options.folder);
    makeDirs(this.folder);
  }

  public flush() {}
}
