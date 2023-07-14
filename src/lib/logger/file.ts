/**
 * 生成日志文件
 */
import FormattedLogger from './formatted';
import _ from 'lodash';
import fs from 'fs';
import path from 'path';
import os from 'os';
import util from 'util';
import { makeDirs } from '@/utils';
import { GenericObject } from '@/typings';
import { BaseLoggerLevels } from '@/typings/logger';
import { LoggerFactory } from './factory';
import { LEVELS } from './base';

/**
 * 将fs.appendFile方法转换为异步方法
 */
const appendFile = util.promisify(fs.appendFile);

/**
 * 文件日志模块
 */
export class FileLogger extends FormattedLogger {
  public queue: Array<any>;
  public timer: any;
  public currentFileName: string | null;
  public fs: any;
  public logFolder: string = ''; // 日志文件的绝对路径

  constructor(options: GenericObject) {
    super(options);

    this.options = _.defaultsDeep(this.options, {
      folder: './logs',
      filename: 'universer-{date}.log',
      eol: os.EOL,
      interval: 1 * 1000
    });

    this.options.colors = false;
    this.queue = [];
    this.timer = null;
    this.currentFileName = null;
    this.fs = null;
  }

  /**
   * init
   * 初始化
   */
  public init(loggerFactory: LoggerFactory) {
    super.init(loggerFactory);

    this.logFolder = path.resolve(
      this.render(this.options.folder, {
        nodeID: this.star.nodeID,
        namespace: this.star.namespace
      })
    );

    // 根据日志文件绝对路径创建目录
    makeDirs(this.logFolder);

    if (this.options.interval) {
      // 计时器
      this.timer = setInterval(() => this.flush(), this.options.interval);
      (this.timer as NodeJS.Timer).unref();
    }
  }

  /**
   * 停止写入日志
   */
  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    // 把队列中剩余的排队日志写入文件中
    return this.flush();
  }

  /**
   * 获取当前文件夹名
   */
  public getFileName(): string {
    const now = new Date();
    const date = now.toISOString().substring(0, 10);

    return path.join(
      this.logFolder,
      this.render(this.options.filename, { date, nodeID: this.star.nodeID, namespace: this.star.namespace })
    );
  }

  /**
   * 将排队队列中的日志写入到文件日志中
   */
  public async flush(): Promise<any> {
    if (this.queue.length > 0) {
      // 文件夹名
      const filename = this.getFileName();
      const rows = Array.from(this.queue);
      this.queue.length = 0;
      const buf = rows.join(this.options.eol) + this.options.eol; //BUFFER文件

      return appendFile(filename, buf).catch((err) => {
        console.debug('Unable to write log file:', filename, err);
      });
    }

    return Promise.resolve();
  }

  /**
   * 日志文件处理方法
   */
  public getLogHandler(bindings: GenericObject): any {
    const level = bindings ? this.getLogLevel(bindings.mod) : null;
    if (!level) return null;

    const levelIndex = LEVELS.indexOf(level);
    const formatter = this.getFormatter(bindings);

    return (type: BaseLoggerLevels, args: any) => {
      const typeIndex = LEVELS.indexOf(type);
      if (typeIndex > levelIndex) return;

      const pargs = formatter(type, args);
      const msg = pargs.join(' ').replace(/\u001b\[.*?m/g, '');
      // 将日志推入等待队列中
      this.queue.push(msg);
      if (!this.options.interval) return this.flush();
    };
  }
}
