import { LogLevelConfig } from '@/typings/logger';
import { Star } from '../star';

/**
 * 日志实例工厂模式创建
 */
export class LoggerFactory {
  private star: Star = {};
  private appenders = [];
  private cache: Map<any, any>; // 缓存

  constructor(star: Star) {
    this.star = star;
    this.appenders = [];
    this.cache = new Map();
  }

  // 初始化
  init(options: LogLevelConfig) {}

  // 结束
  stop() {}

  // 获取日志
  getLogger(bindings) {}
}
