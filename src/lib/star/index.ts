import { GenericObject } from '@/typings';
import { LoggerBindings, LoggerInstance } from '@/typings/logger';
import { StarOptions } from '@/typings/star';
import { generateToken, getNodeID, polyfillPromise } from '@/utils';
import _ from 'lodash';
import { LoggerFactory } from '../logger/factory';
import EventEmitter2 from 'eventemitter2';
import { version } from 'package.json';

// 默认选项
const defaultOptions = {
  namespace: '',
  nodeID: null,

  logger: true,
  logLevel: null,

  transporter: null, // 默认TCP协议,

  errorRegenerator: null,

  requestTimeout: 0 * 1000,
  retryPolicy: {
    enabled: false,
    retries: 5,
    delay: 100,
    maxDelay: 1000,
    factor: 2,
    check: (err) => err && !!err.retryable
  },

  contextParamsCloning: false,
  maxCallLevel: 0,
  heartbeatInterval: 10,
  heartbeatTimeout: 30,

  tracking: {
    enabled: false,
    shutdownTimeout: 5000
  },

  disableBalancer: false,

  registry: {
    strategy: 'RoundRobin',
    preferLocal: true,
    stopDelay: 100
  },

  circuitBreaker: {
    enabled: false,
    threshold: 0.5,
    windowTime: 60,
    minRequestCount: 20,
    halfOpenTime: 10 * 1000,
    check: (err) => err && err.code >= 500
  },

  bulkhead: {
    enabled: false,
    concurrency: 10,
    maxQueueSize: 100
  },

  transit: {
    maxQueueSize: 50 * 1000, // 50k ~ 400MB,
    maxChunkSize: 256 * 1024, // 256KB
    disableReconnect: false,
    disableVersionCheck: false
  },

  uidGenerator: null,

  errorHandler: null,

  cacher: null,
  serializer: null,

  validator: true,

  metrics: { enabled: false },
  tracing: { enabled: false },

  internalServices: true,
  internalMiddlewares: true,

  dependencyInterval: 1000,
  dependencyTimeout: 0,

  hotReload: false,

  middlewares: null,

  replCommands: null,
  replDelimiter: null,

  metadata: {},

  skipProcessEventRegistration: false,

  maxSafeObjectSize: null
  // ServiceFactory: null,
  // ContextFactory: null
  // Promise: null
};
export class Star {
  public static UNIVERSE_VERSION: string = version; // 版本号

  public options: StarOptions = {};
  public namespace: string | null = '';
  public nodeID: string | null = '';
  public metadata: GenericObject = {};
  public instanceID: string = '';
  public started: boolean = false; // 是否运行
  public stopping: boolean = false; // 是否结束
  public logger: LoggerInstance | null = null;
  public loggerFactory: LoggerFactory | null = null;
  public localBus: EventEmitter2 | null = null;

  public Promise: PromiseConstructorLike | null = null;

  constructor(options: StarOptions) {
    try {
      this.options = _.defaultsDeep(options, defaultOptions);

      if (this.options.Promise) {
        this.Promise = this.options.Promise;
      } else {
        this.Promise = Promise;
      }
      // 补充 Promise 方法
      polyfillPromise(this.Promise);
      // Star.Promise = this.Promise;

      this.namespace = this.options.namespace || '';
      this.metadata = this.options.metadata || {};
      this.nodeID = this.options.nodeID || getNodeID();
      this.instanceID = generateToken();

      this.started = false;
      this.stopping = false;

      // 事件处理器
      this.localBus = new EventEmitter2({ wildcard: true, maxListeners: 100 });

      // 日志模块
      this.loggerFactory = new LoggerFactory(this);
      this.loggerFactory.init(this.options.logger || {});
      this.logger = this.getLogger('star');
      // 启动相关日志
      if (this.logger) {
        this.logger.info(`Universe V${Star.UNIVERSE_VERSION} is starting...`);
        this.logger.info(`Star's namespace: ${this.namespace || '<not defined>'}`);
        this.logger.info(`Star's node ID: ${this.nodeID}`);
      }

      // 性能指标模块

      // 中间件处理模块

      // 服务注册模块
      

      // 缓存模块

      // 序列化处理模块

      // 错误处理机制模块

      // 验证模块

      // 记录、跟踪服务模块

      // 注册中间件

      // 通信传输模块
    } catch (error) {
      // 输出错误日志，并结束程序
      if (this.logger) this.fatal('Unable to create Star.', error, true);
      else {
        console.error('Unable to create Star.', error);
        process.exit(1);
      }
    }
  }

  /**
   * 出现致命错误，抛出错误信息并打印，可以主动选择是否结束程序
   */
  public fatal(message: string, error: any, needQuit?: boolean) {
    if (this.logger) this.logger.fatal(message, error);
    else console.error(message, error);

    if (needQuit) process.exit(1);
  }

  /**
   * 获取一个自定义的日志模块
   */
  private getLogger(mod: string, props?: any) {
    let bindings = Object.assign({ nodeID: this.nodeID, namespace: this.namespace, mod }, props) as LoggerBindings;

    return this.loggerFactory && this.loggerFactory.getLogger(bindings);
  }
}
