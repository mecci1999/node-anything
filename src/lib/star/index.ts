import { GenericObject } from '@/typings';
import { LoggerBindings, LoggerInstance } from '@/typings/logger';
import { StarOptions } from '@/typings/star';
import {
  generateToken,
  getConstructorName,
  getNodeID,
  humanize,
  isFunction,
  isPlainObject,
  isString,
  polyfillPromise
} from '@/utils';
import _, { isObject } from 'lodash';
import { LoggerFactory } from '../logger/factory';
import EventEmitter2 from 'eventemitter2';
import { version } from 'package.json';
import Transit from '../transit';
import Serializers from '../serializers';
import { Serialize } from '@/typings/serializers';
import { Regenerator, ServiceNotFoundError, resolveRengerator } from '../error';
import Context from '../context';
import { Registry } from '../registry';
import Transporters from '../transporters';
import { Transporter } from '@/typings/transit/transporters';
import { getCpuUsage } from './cpu-usage';
import MiddlewareHandler from '../middleware/handler';
import { Middleware } from '@/typings/middleware';
import Service from './service';
import C from './constants';
import H from './health';
import { ServiceSchema, ServiceSettingSchema } from '@/typings/service';
import { ServiceNotAvailableError } from '../error/custom';
import getInternalSchema from './internals';

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

  maxSafeObjectSize: null,
  ServiceFactory: null,
  ContextFactory: null
  // Promise: null
};

// 内置的中间件
const INTERNAL_MIDDLEWARES = [
  'ActionHook',
  'Validator',
  'Bulkhead',
  'Cacher',
  'ContextTracker',
  'CircuitBreaker',
  'Timeout',
  'Retry',
  'Fallback',
  'ErrorHandler',
  'Tracing',
  'Metrics',
  'Debounce',
  'Throttle'
];

export class Star {
  public static UNIVERSE_VERSION: string = version; // 版本号
  public static PROTOCOL_VERSION: string = '0'; // 协议版本

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
  public transit: Transit | null = null;
  public serializer: Serialize | null = null;
  public errorRegenerator: Regenerator | null = null;
  public ContextFactory: Context | null = null;
  public ServiceFactory: Service | null = null;

  public registry: Registry | null = null;
  public middlewares: MiddlewareHandler | null = null;
  public services: Service[] = [];

  public __closeFn: any;
  // public createService: Function | null = null;

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

      this.ServiceFactory = this.options.ServiceFactory || null;
      this.ContextFactory = this.options.ContextFactory || null;

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
      this.middlewares = new MiddlewareHandler(this);

      // 服务注册模块
      this.registry = new Registry(this);

      // 缓存模块

      // 序列化处理模块
      if (this.options.serializer) this.serializer = Serializers.resolve(this.options.serializer);
      if (this.serializer) (this.serializer as any).init(this);
      const serializerName = getConstructorName(this.serializer);
      this.logger?.info(`Serializer: ${serializerName}`);

      // 错误处理机制模块
      this.errorRegenerator = resolveRengerator(this.options.errorRegenerator);
      this.errorRegenerator.init(this);

      // 验证模块

      // 记录、跟踪服务模块

      // 注册中间件

      // 通信传输模块
      if (this.options.transporter) {
        // 获取通信方式
        const transporter: Transporter = Transporters.resolve(this.options.transporter);
        this.transit = new Transit(this, transporter, this.options.transit);
        const transitName = getConstructorName(this.transit);
        this.logger?.info(`Transporter: ${transitName}`);

        if (this.options.disableBalancer) {
          // 禁用负载均衡
          if (transporter.hasBuiltInBalancer) {
            this.logger?.info('The Star built-in balancer is DISABLED');
          } else {
            this.logger?.warn(`The ${transitName} has no built-in balancer. Star balancer is ENABLED.`);
            this.options.disableBalancer = false;
          }
        }
      }

      // 是否禁用负载均衡
      if (this.options.disableBalancer) {
        // 禁用
        this.call = this.callWithoutBalancer;
      }
      // 防抖处理更新服务数据
      const origLocalServiceChanged = this.localServiceChanged;
      this.localServiceChanged = _.debounce(() => origLocalServiceChanged.call(this), 1000);
      // 服务注册发现模块初始化
      this.registry.init();
      // 注册内部动作
      if (this.options.internalServices) {
        this.registerInternalServices(this.options.internalServices);
      }

      // 调用created中间件
      this.callMiddlewareHookSync('created', [this]);

      // 调用options中的created方法
      if (this.options.created && isFunction(this.options.created)) this.options.created(this);

      this.__closeFn = () => {
        this.stop();
      };

      process.setMaxListeners(0);
      if (this.options.skipProcessEventRegistration === false) {
        process.on('beforeExit', this.__closeFn);
      }
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
   * 启动星星，如果通信模块创建了，将会触发通信模块的链接事件
   */
  public start() {
    const startTime = Date.now();

    return Promise.resolve()
      .then(() => {
        return this.callMiddlewareHook('starting', [this]);
      })
      .then(() => {
        if (this.transit) return this.transit.connect();
      })
      .then(() => {
        // 启动所有的服务
        return Promise.all(this.services.map((serivce) => serivce._start.call(serivce))).catch((error) => {
          this.logger?.error('Unable to start all services.', error);
          throw error;
        });
      })
      .then(() => {
        this.started = true;
        // 性能事件
        // 广播
        this.broadcastLocal('$star.started');
      })
      .then(() => {
        if (this.transit) return this.transit.ready();
      })
      .then(() => {
        return this.callMiddlewareHook('started', [this]);
      })
      .then(() => {
        if (this.options.started && isFunction(this.options.started)) return this.options.started(this);
      })
      .then(() => {
        // 启动过程所花费的时间
        const duration = Date.now() - startTime;
        this.logger?.info(
          `✔ Star with ${this.services.length} service(s) started successfully in ${humanize(duration)}`
        );
      });
  }

  /**
   * 停止
   */
  public stop() {
    this.started = false;
    return Promise.resolve()
      .then(() => {
        if (this.transit) {
          this.registry?.regenerateLocalRawInfo(true, true);
          return this.registry?.discoverer.sendLocalNodeInfo();
        }
      })
      .then(() => {
        this.stopping = true;

        return this.callMiddlewareHook('stopping', [this], { reverse: true });
      })
      .then(() => {
        return Promise.all(this.services.map((service) => service._stop.call(service))).catch((error) => {});
      });
  }

  /**
   * 出现致命错误，抛出错误信息并打印，可以主动选择是否结束程序
   */
  public fatal(message: string, error?: any, needQuit?: boolean) {
    if (this.logger) this.logger.fatal(message, error);
    else console.error(message, error);

    if (needQuit) process.exit(1);
  }

  /**
   * 获取一个自定义的日志模块
   */
  public getLogger(mod: string, props?: any) {
    let bindings = Object.assign({ nodeID: this.nodeID, namespace: this.namespace, mod }, props) as LoggerBindings;

    return this.loggerFactory && this.loggerFactory.getLogger(bindings);
  }

  /**
   * 全局错误处理器
   */
  public errorHandler(error: Error, info: any) {
    if (this.options.errorHandler) {
      return this.options.errorHandler.call(this, error, info);
    }

    throw error;
  }

  /**
   * 生成uuid
   */
  public generateUid(): string {
    if (this.options.uidGenerator) return this.options.uidGenerator.call(this);

    return generateToken();
  }

  /**
   * 找到下一个动作的可用端点
   */
  public findNextActionEndpoint(actionName: string, options: GenericObject, context: Context) {
    if (typeof actionName !== 'string') {
      return actionName;
    } else {
      if (options && options.nodeID) {
        const nodeID = options.nodeID;
        // 找到端点
        const endpoint = this.registry?.getActionEndpointByNodeId(actionName, nodeID);
        if (!endpoint) {
          this.logger?.warn(`Service '${actionName}' is not found on '${nodeID}' node.`);
          return new ServiceNotFoundError({ action: actionName, nodeID });
        }
        return endpoint;
      } else {
        const epList = this.registry?.getActionEndpoints(actionName);
        if (!epList) {
          this.logger?.warn(`Service '${actionName}' is not registered.`);
          return new ServiceNotFoundError({ action: actionName });
        }
        // 得到下一个端点
        const endpoint = epList.next(context);
        if (!endpoint) {
          const errMsg = `Service '${actionName}' is not available.`;
          this.logger?.warn(errMsg);
          return new ServiceNotFoundError({ action: actionName });
        }
        return endpoint;
      }
    }
  }

  /**
   * 动作通信
   */
  public call(actionName: string, params?: GenericObject, options?: GenericObject) {
    if (params === undefined) params = {};

    // 创建上下文
    let ctx: Context;
    if (options && options.ctx !== null) {
      // 找到动作的下一个端点
      const endpoint = this.findNextActionEndpoint(actionName, options, options.ctx);
      if (endpoint instanceof Error) {
        return Promise.reject(endpoint).catch((error) => this.errorHandler(error, { actionName, params, options }));
      }
      ctx = options.ctx;
      ctx.endpoint = endpoint;
      ctx.nodeID = endpoint.id;
      ctx.action = endpoint.action;
      ctx.service = endpoint.action?.service || null;
    } else {
      // 创建新根上下文
      ctx = this.ContextFactory?.create(this, null, params, options) as Context;
      // 找到下一个端点
      const endpoint = this.findNextActionEndpoint(actionName, options || {}, ctx);
      if (endpoint instanceof Error) {
        return Promise.reject(endpoint).catch((error) => this.errorHandler(error, { actionName, params, options }));
      }
      // 设置上下文的端口
      ctx.setEndpoint(endpoint);
    }
    // 上下文的端口是否为本地
    if (ctx.endpoint?.local) {
      this.logger?.debug('Call action locally.', {
        action: ctx.action?.name,
        requestID: ctx.requestID
      });
    } else {
      this.logger?.debug('Call action on remote node.', {
        action: ctx.action?.name,
        nodeID: ctx.nodeID,
        requestID: ctx.requestID
      });
    }
    if (!ctx.endpoint?.action?.handler) return Promise.reject();
    // 端口处理的结果
    let p = ctx.endpoint.action.handler(ctx);
    p.ctx = ctx;

    return p;
  }

  public getConstructorName(obj: any) {
    return getConstructorName(obj);
  }

  /**
   * 获取节点cpu数据
   */
  public getCpuUsage() {
    return getCpuUsage();
  }

  /**
   * 本地节点广播通知
   */
  public broadcastLocal(eventName: string, payload?: any, options?: GenericObject): Promise<void> {
    if (Array.isArray(options) || isString(options)) options = { groups: options };
    else if (options == null) options = {};

    if (options.groups && !Array.isArray(options.groups)) options.groups = [options.groups];

    this.logger?.debug(
      `Broadcast '${eventName}' local event` + (options.groups ? ` to ${options.groups.join(',')} group(s)` : '') + '.'
    );

    if (/^\$/.test(eventName)) this.localBus?.emit(eventName, payload);
    //  创建上下文
    const ctx = this.ContextFactory && this.ContextFactory.create(this, null, payload, options);
    ctx?.setContextEventData({ eventName, eventType: 'broadcastLocal', eventGroups: options.groups });

    if (!ctx) return Promise.reject();
    return this.emitLocalServices(ctx);
  }

  /**
   * 广播至所有的节点
   */
  public broadcast(eventName: string, payload?: any, options?: GenericObject) {
    if (Array.isArray(options) || isString(options)) options = { groups: options };
    else if (options == null) options = {};

    if (options.groups && !Array.isArray(options.groups)) {
      options.groups = [options.groups];
    }

    const promises: Promise<any>[] = [];

    this.logger?.debug(
      `Boardcast '${eventName}' event` + (options.groups ? ` to '${options.groups.join(', ')}' group(s)` : '') + '.'
    );

    if (this.transit) {
      // 创建上下文
      const ctx = this.ContextFactory?.create(this, null, payload, options);
      ctx?.setContextEventData({ eventName, eventType: 'boardcast', eventGroups: options.groups });

      // 是否开启负载均衡
      if (!this.options.disableBalancer) {
        // 开启了负载均衡
        const endpoints = this.registry?.events.getAllEndpoints(eventName, options.groups);
        endpoints?.forEach((ep) => {
          if (ep.id !== this.nodeID) {
            const newCtx = ctx?.copy(ep);
            if (!newCtx) return;
            this.transit && promises.push(this.transit?.sendEvent(newCtx));
          }
        });
      } else {
        // 没有使用负载均衡
        let groups = options.groups;
        if (!groups || groups.length === 0) {
          groups = this.getEventGroups(eventName);
        }
        if (groups.length === 0) return;
        const endpoints = this.registry?.events.getAllEndpoints(eventName);
        if (!endpoints || endpoints.length === 0) return;
        return Promise.all(
          endpoints?.map((ep) => {
            const newCtx = ctx?.copy(ep);
            newCtx?.setContextEventData({ eventGroups: groups });
            if (!newCtx) return;
            return this.transit?.sendEvent(newCtx);
          })
        );
      }
    }

    // 没有通信服务，则发送给本地的服务
    promises.push(this.broadcastLocal(eventName, payload, options));

    return Promise.all(promises);
  }

  /**
   * emit动作
   */
  public emit(eventName: string, payload?: any, options?: GenericObject) {
    if (Array.isArray(options) || isString(options)) options = { groups: options };
    else if (options == null) options = {};

    if (options.groups && !Array.isArray(options.groups)) options.groups = [options.groups];

    const promises: Promise<any>[] = [];
    const ctx = this.ContextFactory?.create(this, null, payload, options);
    ctx?.setContextEventData({ eventName, eventType: 'emit', eventGroups: options.groups });
    this.logger?.debug(
      `Emit '${eventName}' event` + (options.groups ? ` to '${options.groups.join(', ')}' group(s)` : '')
    ) + '.';
    if (/^\$/.test(eventName)) this.localBus?.emit(eventName, payload);
    if (!this.options.disableBalancer && ctx) {
      // 负载均衡
      const endpoints = this.registry?.events.getBalancedEndpoints(eventName, options.groups, ctx);
      const groupedEP = {};
      endpoints?.forEach(([ep, group]) => {
        if (ep.id === this.nodeID) {
          // 本地服务
          const newCtx = ctx.copy(ep);
          promises.push(this.registry?.events.callEventHandler(newCtx));
        } else {
          // 远程服务
          const e = groupedEP[ep.id];
          if (e) e.groups.push(group);
          else groupedEP[ep.id] = { ep, groups: [group] };
        }
      });

      if (this.transit) {
        _.forIn(groupedEP, (item: any) => {
          const newCtx = ctx.copy(item.ep);
          newCtx.setContextEventData({ eventGroups: item.groups });
          this.transit && promises.push(this.transit?.sendEvent(newCtx));
        });
      }

      return Promise.all(promises);
    } else if (this.transit) {
      // 禁用负载均衡
      let groups = options.groups;
      if (!groups || groups.length === 0) {
        groups = this.getEventGroups(eventName);
      }
      if (groups.length === 0) return Promise.resolve();
      ctx?.setContextEventData({ eventGroups: groups });
      if (!ctx) Promise.reject();
      return this.transit.sendEvent(ctx as Context);
    }
  }

  /**
   * 触发事件到本地的节点，主要是用来远程通信一个事件
   */
  public emitLocalServices(ctx: Context): Promise<any> {
    if (!this.registry) return Promise.reject();

    return this.registry?.events.emitLocalServices(ctx);
  }

  /**
   * 注册中间件
   */
  public registerMiddlewares(userMiddlewares: any) {
    if (Array.isArray(userMiddlewares) && userMiddlewares.length > 0) {
      _.compact(userMiddlewares).forEach((middleware) => this.middlewares?.add(middleware));
    }

    if (this.options.internalMiddlewares) {
      INTERNAL_MIDDLEWARES.forEach((midlleware) => this.middlewares?.add(midlleware));
      if (this.options.hotReload) {
        this.middlewares?.add('HotReload');
      }
    }

    this.logger?.info(`Registered ${this.middlewares?.count()} middleware(s).`);
    this.createService = this.wrapMethod('createService', this.createService) as any;
  }

  /**
   * 封装方法
   */
  public wrapMethod(name: string, handler: Function, bindTo?: any, options?: Object) {
    return this.middlewares?.wrapMethod(name, handler, bindTo, options);
  }

  /**
   * 在所有的中间件中使用异步通信处理器
   */
  public callMiddlewareHook(name: string, args: Array<any>, options?: any) {
    return this.middlewares?.callHandles(name, args, options);
  }

  /**
   * 所用的中间件同步通信处理器
   */
  public callMiddlewareHookSync(name: string, args: Array<any>, options?: any) {
    return this.middlewares?.callSyncHandles(name, args, options);
  }

  /**
   * 根据协议创建一个服务
   */
  public createService(schema: any, schemaMods?: any) {
    let service;

    schema = this.normalizeSchemaConstructor(schema);
    if (Object.prototype.isPrototypeOf.call(this.ServiceFactory, schema)) {
      service = new schema(this, schemaMods);
    } else {
      service = new schema(this, schema, schemaMods);
    }

    if (this.started) this._restarService(service);

    return service;
  }

  /**
   * 重新启动服务
   * @param service
   * @returns
   */
  public _restarService(service: Service) {
    return service._start.call(service).catch((error) => {
      this.logger?.error('Unable to start service.', error);
      this.broadcastLocal('$star.error', {
        error,
        module: 'star',
        type: C.FAILED_RESTART_SERVICE
      });
    });
  }

  public normalizeSchemaConstructor(schema: any) {
    if (Object.prototype.isPrototypeOf.call(this.ServiceFactory, schema)) {
      return schema;
    }
    let serviceName = getConstructorName(this.ServiceFactory);
    let target = getConstructorName(schema);
    if (serviceName === target) {
      Object.setPrototypeOf(schema, this.ServiceFactory);
      return schema;
    }

    target = getConstructorName(Object.getPrototypeOf(schema.prototype));
    if (serviceName === target) {
      Object.setPrototypeOf(Object.getPrototypeOf(schema), this.ServiceFactory);
      return schema;
    }
    if (schema._isMockFunction) {
      target = getConstructorName(Object.getPrototypeOf(schema.prototype));
      if (serviceName === target) {
        Object.setPrototypeOf(schema, this.ServiceFactory);
        return schema;
      }
    }

    return schema;
  }

  public getEventGroups(eventName: string) {
    return this.registry?.events.getGroups(eventName);
  }

  /**
   * 添加本地服务
   */
  public addLocalService(service: Service<ServiceSettingSchema>) {
    this.services.push(service);
    // 注册性能指标
  }

  /**
   * 当有新增的本地服务或者远程服务时，需要调用该方法
   * @param localService 是否是本地服务
   */
  public servicesChanged(localService: boolean) {
    this.broadcastLocal('$services.changed', { localService });
    if (localService && this.transit) {
      this.localServiceChanged();
    }
  }

  /**
   * 发送一个信息包给远程的节点
   */
  public localServiceChanged() {
    if (!this.stopping) {
      this.registry?.discoverer.sendLocalNodeInfo();
    }
  }

  /**
   * 获得本地节点信息
   */
  public getLocalNodeInfo() {
    return this.registry?.getLocalNodeInfo();
  }

  /**
   * 不使用负载均衡的通信
   */
  public callWithoutBalancer(actionName: string, params?: GenericObject, options: GenericObject = {}) {
    if (params === undefined) params = {};

    let nodeID: string | null = null;
    let endpoint: any = null;
    if (typeof actionName !== 'string') {
      endpoint = actionName;
      actionName = endpoint.action.name;
      nodeID = endpoint.id;
    } else {
      if (options.nodeID) {
        nodeID = options.nodeID;
        endpoint = this.registry?.getActionEndpointByNodeId(actionName, nodeID as string);
        if (!endpoint) {
          // 没有找到端口
          this.logger?.warn(`Service '${actionName}' is not found on '${nodeID}' node.`);
          return Promise.reject(new ServiceNotFoundError({ action: actionName, nodeID: nodeID || '' })).catch(
            (error) => {
              this.errorHandler(error, { nodeID, actionName, params, options });
            }
          );
        } else {
          // 找到了端口
          // 通过动作名获取端口列表
          const endpointList = this.registry?.getActionEndpoints(actionName);
          if (endpointList == null) {
            // 没有获取到端口
            this.logger?.warn(`Service '${actionName}' is not registered.`);
            // 报错
            Promise.reject(new ServiceNotFoundError({ action: actionName })).catch((error) => {
              this.errorHandler(error, { actionName, params, options });
            });
          }
          endpoint = endpointList?.getFirst();
          if (endpoint == null) {
            // 没有拿到第一个端口
            const errorMsg = `Service '${actionName}' is not available.`;
            this.logger?.warn(errorMsg);
            return Promise.reject(new ServiceNotAvailableError({ action: actionName })).catch((error) => {
              this.errorHandler(error, { actionName, params, options });
            });
          }
        }

        // 得到了端口，创建需要通信的上下文实例
        let ctx: Context;
        if (options.ctx != null) {
          // 重复使用之前的上下文
          ctx = options.ctx;
          if (endpoint) {
            ctx.endpoint = endpoint;
            ctx.action = endpoint.action;
          }
        } else {
          // 没有可以重复使用的上下文
          ctx = this.ContextFactory?.create(this, endpoint, params, options) as Context;
        }
        ctx.nodeID = nodeID;
        // 日志
        this.logger?.debug('Call action on a node.', {
          action: ctx?.action?.name,
          nodeID: ctx.nodeID,
          requestID: ctx.requestID
        });
        // 端口动作中的远程处理器
        let p = endpoint.action.remoteHandler(ctx);
        p.ctx = ctx;

        return p as Promise<any>;
      }
    }
  }

  /**
   * 获取健康状态
   */
  public getHealthStatus() {
    return H.getHealthStatus();
  }

  /**
   * 注册内部服务
   */
  public registerInternalServices(
    options:
      | boolean
      | {
          [key: string]: Partial<ServiceSchema>;
        }
  ) {
    options = isObject(options) ? options : {};

    const internalsSchema = getInternalSchema(this);
    let definitiveSchema: any = {};
    if (options['$node']) {
      definitiveSchema = options['$node'];
      if (!definitiveSchema.mixins) definitiveSchema.mixins = [];
      definitiveSchema.mixins.push(internalsSchema);
    } else {
      definitiveSchema = internalsSchema;
    }

    this.createService(definitiveSchema);
  }

  /**
   * 等待其他的服务
   */
  public waitForServices(
    serviceNames: any | any[],
    timeout: number | undefined = this.options.dependencyTimeout,
    interval: number | undefined = this.options.dependencyInterval,
    logger: LoggerInstance | null = this.logger
  ) {
    if (!Array.isArray(serviceNames)) serviceNames = [serviceNames];

    serviceNames = _.uniq(
      _.compact(
        serviceNames.map((item) => {
          if (isPlainObject(item) && item?.name) {
            if (item?.version && Array.isArray(item.version)) {
              return item.version.map((version) => Service.getVersionedFullName(item.name, version));
            } else {
              return Service.getVersionedFullName(item.name, item.version);
            }
          } else if (isString(item)) {
            return item;
          }
        })
      )
    );

    if (serviceNames?.length === 0) return Promise.resolve({ services: [], statuses: [] });
  
    logger?.info(`Waiting `)
  }
}
