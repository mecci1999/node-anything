import { ServiceDependency, ServiceSchema, ServiceSettingSchema } from '@/typings/service';
import Star from '.';
import {
  deprecate,
  functionArguments,
  isFunction,
  isNewSignature,
  isObject,
  promiseMethod,
  wrapToArray,
  wrapToHandler
} from '@/utils';
import { ServiceSchemaError, UniverseError } from '../error';
import { GenericObject } from '@/typings';
import { LoggerInstance } from '@/typings/logger';
import { ServiceActions } from '@/typings/star/service';
import _, { flatten } from 'lodash';
import ServiceItem from '../registry/service-item';
import { UniverseErrorCode, UniverseErrorOptionsType } from '@/typings/error';

export default class Service<S = ServiceSettingSchema> {
  public star: Star;
  public fullName: string = '';
  public name: string = '';
  public version: string | number = '';
  public settings?: ServiceSettingSchema | GenericObject;
  public schema?: ServiceSchema<S>; // 协议
  public metadata: GenericObject = {};
  public logger: LoggerInstance | null = null;
  public actions: ServiceActions | null = null; // 动作
  public events: any; // 事件
  public originalSchema: ServiceSchema<S> | null = null;
  public dependencies: string | ServiceDependency | (string | ServiceDependency)[] | null = null;
  public _serviceSpecification: GenericObject = {};

  constructor(star: Star, schema?: ServiceSchema<S>, schemaMods?: any) {
    if (!isObject(star)) throw new ServiceSchemaError('Must create a Star instance!');

    this.star = star;

    if (schemaMods) {
      deprecate(
        'schemaMods',
        "Using 'schemaMods' parameter in 'star.createService' is deprecated. Use 'mixins' instead."
      );
      // 合并服务参数
      schema = this.mergeSchemas(schema, schemaMods);
    }

    if (schema) this.parseServiceSchema(schema);
  }

  /**
   * 获取详细名字
   * @param name
   * @param version
   * @returns
   */
  public static getVersionedFullName(name: string, version?: string | number) {
    if (version !== null) {
      return (typeof version == 'number' ? 'v' + version : version) + '.' + name;
    }

    return name;
  }

  /**
   * 解析服务协议，并注册本地服务
   * @param schema
   */
  protected parseServiceSchema(schema: any) {
    // 抛出异常问题
    if (!isObject(schema))
      throw new ServiceSchemaError("The service schema can't be null. Maybe is it not a service schema?");

    // 原始协议
    this.originalSchema = _.cloneDeep(schema);

    if (schema.mixins) {
      // 服务有引入外部
      schema = this.applyMixins(schema);
    }

    if (isFunction(schema.merged)) {
      schema.merged.call(this, schema);
    } else if (Array.isArray(schema.merged)) {
      schema.merged.forEach((fn) => fn.call(this, schema));
    }

    // 调用服务创建中间件
    this.star.callMiddlewareHookSync('serviceCreating', [this, schema]);

    if (!schema.name) {
      console.error(
        "Service name can't be empty! Maybe it is not a valid Service schema. Maybe is it not a service schema?",
        { schema }
      );
      throw new ServiceSchemaError(
        "Service name can't be empty! Maybe it is not a valid Service schema. Maybe is it not a service schema?",
        { schema }
      );
    }

    this.schema = schema;
    this.name = schema?.name || '';
    this.version = schema?.version || '';
    this.settings = schema?.settings || {};
    this.metadata = schema?.metadata || {};

    this.fullName = Service.getVersionedFullName(
      this.name,
      this.settings?.$noVersionPrefix !== true ? this.version : undefined
    );

    // 引入日志实例
    this.logger = this.star.getLogger(this.fullName, { svc: this.name, version: this.version });

    this.actions = {};
    this.events = {};

    // 服务基础数据
    const serviceSpecification = {
      name: this.name,
      version: this.version,
      fullName: this.fullName,
      settings: this.settings,
      metadata: this.metadata,
      actions: {},
      events: {}
    };

    // 注册服务中的方法
    if (isObject(schema.methods)) {
      _.forIn(schema.methods, (method, name) => {
        if (
          [
            'name',
            'version',
            'settings',
            'metadata',
            'dependencies',
            'schema',
            'broker',
            'star',
            'actions',
            'logger',
            'created',
            'started',
            'stopped',
            '_start',
            '_stop',
            '_init',
            'applyMixins'
          ].indexOf(name) !== -1 ||
          name.startsWith('mergeSchema')
        ) {
          // 注册的服务中的方法名中存在冲突
          throw new ServiceSchemaError(`Invalid method name '${name}' in '${this.name}' service!`);
        }
        // 创建服务的基础方法
        this._createMethod(method, name);
      });
    }

    // 注册服务中的动作
    if (isObject(schema.actions)) {
      _.forIn(schema.actions, (action, name) => {
        if (action === false) return;

        let innerAction = this._createAction(action, name);

        serviceSpecification.actions[innerAction.name] = innerAction;

        const wrappedHandler = this.star.middlewares?.wrapHandler(
          'localAction',
          innerAction.handler,
          innerAction
        ) as Function;

        const ep = this.star.registry?.createPrivateActionEndpoint(innerAction);

        if (this.actions) {
          this.actions[name] = (params, options: any) => {
            let ctx: any;

            if (options && options.ctx) {
              ctx = options.ctx;
            } else {
              ctx = this.star.ContextFactory.create(this.star, ep, params, options || {});
            }

            return wrappedHandler(ctx);
          };
        }
      });
    }

    // 注册事件
    if (isObject(schema.events)) {
      _.forIn(schema.events, (event, name) => {
        // 注册并创建服务中的事件
        const innerEvent = this._createEvent(event, name);
        serviceSpecification.events[innerEvent.name] = innerEvent;

        this.events[innerEvent.name] = (params, options) => {
          let ctx: any;
          if (options && options.ctx) {
            ctx = options.ctx;
          } else {
            const ep = {
              id: this.star.nodeID,
              event: innerEvent
            };
            // 创建上下文
            ctx = this.star.ContextFactory.create(this.star, ep, params, options || {});
          }

          ctx.eventName = name;
          ctx.eventType = 'emit';
          ctx.eventGroups = [innerEvent.group || this.name];

          return innerEvent.handler(ctx);
        };
      });
    }

    this._serviceSpecification = serviceSpecification;

    this._init();
  }

  /**
   * 引入外部插件
   * @param schema
   * @returns
   */
  public applyMixins(schema: ServiceSchema | Partial<ServiceSchema<ServiceSettingSchema>>) {
    if (schema.mixins) {
      const mixins = Array.isArray(schema.mixins) ? schema.mixins : [schema.mixins];
      if (mixins.length > 0) {
        const mixedSchema = Array.from(mixins)
          .reverse()
          .reduce((s, mixin) => {
            if (mixin.mixins) mixin = this.applyMixins(mixin);

            return s ? this.mergeSchemas(s, mixin) : mixin;
          }, null);

        return this.mergeSchemas(mixedSchema, schema);
      }
    }
  }

  /**
   * 初始化服务
   */
  public _init() {
    this.logger?.debug(`Service '${this.fullName}' is creating...`);
    if (isFunction(this.schema?.created)) {
      // 存在初始化钩子
      this.schema?.created && (this.schema?.created as any).call(this);
    } else if (Array.isArray(this.schema?.created)) {
      this.schema?.created.forEach((fn) => fn.call(this));
    }
    // 加载本地服务
    this.star.addLocalService(this as any);
    // 调用中间件
    this.star.callMiddlewareHookSync('serviceCreated', [this]);
    // 日志
    this.logger?.debug(`Service '${this.fullName}' created.`);
  }

  /**
   * 启动服务
   */
  public _start() {
    this.logger?.debug(`Service '${this.fullName}' is starting...`);
    return Promise.resolve()
      .then(() => {
        // 调用中间件
        return this.star.callMiddlewareHook('serviceStarting', [this]);
      })
      .then(() => {
        // 等待依赖的服务
        if (this.schema?.dependencies) {
          return this.waitForServices(
            this.schema.dependencies as string,
            (this.settings as GenericObject)?.$dependencyTimeout || this.star.options.dependencyTimeout,
            (this.settings as GenericObject)?.$dependencyInterval || this.star.options.dependencyInterval
          );
        }
      })
      .then(() => {
        // 执行服务中的start异步方法
        if (isFunction(this.schema?.started)) {
          return promiseMethod(this.schema?.started).call(this);
        }

        if (Array.isArray(this.schema?.started)) {
          return this.schema?.started
            .map((fn) => {
              if (isFunction(fn)) {
                return promiseMethod(fn.bind(this));
              }
            })
            .reduce((p, fn) => {
              return p.then(() => fn());
            }, Promise.resolve());
        }
      })
      .then(() => {
        // 将服务注册到本地节点中注册表中
        return this.star.registerLocalService(this._serviceSpecification as ServiceItem);
      })
      .then(() => {
        return this.star.callMiddlewareHook('serviceStarted', [this]);
      })
      .then(() => {
        return this.logger?.info(`Service '${this.fullName}' started.`);
      });
  }

  /**
   * 停止服务
   */
  public _stop() {
    this.logger?.debug(`Service '${this.fullName}' is stopping...`);

    return Promise.resolve()
      .then(() => {
        return this.star.callMiddlewareHook('serviceStopping', [this], { reverse: true });
      })
      .then(() => {
        if (isFunction(this.schema?.stopped)) {
          return promiseMethod(this.schema?.stopped).call(this);
        }

        if (this.schema?.stopped && Array.isArray(this.schema?.stopped)) {
          const arr = Array.from(this.schema.stopped).reverse();

          return arr
            .map((fn) => {
              if (fn && isFunction(fn)) {
                return promiseMethod(fn.bind(this));
              }
            })
            .reduce((p, fn) => p.then(() => fn()), Promise.resolve());
        }

        return Promise.resolve();
      })
      .then(() => {
        return this.star.callMiddlewareHook('serviceStopped', [this], { reverse: true });
      })
      .then(() => {
        return this.logger?.info(`Service '${this.fullName}' stopped.`);
      });
  }

  /**
   * 创建方法
   * 返回的结果:
   * {
   *    name: 'createServer',
   *    service: ${服务},
   *    handler: ${注册的方法}
   * }
   */
  public _createMethod(methodDef: any, name: string) {
    let method: any;

    if (isFunction(methodDef)) {
      // 如果方法存在
      method = { handler: methodDef };
    } else if (isObject(methodDef)) {
      method = methodDef;
    } else {
      throw new ServiceSchemaError(`Invalid method definition in '${name}' method in '${this.fullName}' service!`);
    }

    // 注册方法不能正常调用
    if (!isFunction(method.handler)) {
      throw new ServiceSchemaError(`Missing method handler on '${name}' method in '${this.fullName}' service!`);
    }

    method.name = name;
    method.service = this;
    method.handler = method.handler.bind(this);
    this[name] = this.star.middlewares?.wrapHandler('localMethod', method.handler, method);

    return method;
  }

  /**
   * 创建动作
   * 返回的结果:
   * {
   *    name: 'createServer',
   *    service: ${服务},
   *    handler: ${注册的动作}
   * }
   */
  public _createAction(actionDef: any, name: string) {
    let action: GenericObject;

    if (isFunction(actionDef)) {
      action = { handler: actionDef };
    } else if (isObject(actionDef)) {
      action = _.cloneDeep(actionDef);
    } else {
      throw new ServiceSchemaError(`Invalid action definition is '${name}' action in '${this.fullName}' service!`);
    }

    let handler = action.handler;

    if (!isFunction(handler)) {
      throw new ServiceSchemaError(`Missing action handler on '${name}' action in '${this.fullName}' service!`);
    }

    action.rawName = action.name || name;
    if (this.settings?.$noServiceNamePrefix !== true) {
      // 重命名
      action.name = this.fullName + '.' + action.rawName;
    } else {
      action.name = action.rawName;
    }

    if (action.cache === undefined && this.settings?.$cache !== undefined) {
      // 使用缓存
      action.cache = this.settings?.$cache;
    }

    action.service = this;
    action.handler = promiseMethod(handler.bind(this));

    return action;
  }

  /**
   * 创建事件
   * {
   *    name: 'createServer',
   *    service: ${服务},
   *    handler: ${注册的事件}
   * }
   */
  public _createEvent(eventDef: any, name: string) {
    let event: GenericObject;

    if (isFunction(eventDef) || Array.isArray(eventDef)) {
      event = {
        handler: eventDef
      };
    } else if (isObject(eventDef)) {
      event = _.cloneDeep(eventDef);
    } else {
      throw new ServiceSchemaError(`Invalid event definition in '${name}' event is '${this.fullName}' service!`);
    }

    if (!isFunction(event.handler) && !Array.isArray(event.handler)) {
      throw new ServiceSchemaError(`Missing event handler on '${name}' event in '${this.fullName}' service!`);
    }

    let handler: any;

    if (isFunction(event.handler)) {
      // 获得参数
      const args = functionArguments(event.handler);
      handler = promiseMethod(event.handler);
      handler.__newSignature = event.context === true || isNewSignature(args);
    } else if (Array.isArray(event.handler)) {
      handler = event.handler.map((h) => {
        const args = functionArguments(h);
        h = promiseMethod(h);
        h.__newSignature = event.context === true || isNewSignature(args);

        return h;
      });
    }

    if (!event.name) event.name = name;

    event.service = this;
    const self = this;

    if (isFunction(handler)) {
      event.handler = function (ctx) {
        return handler.apply(self, handler.__newSignature ? [ctx] : [ctx.params, ctx.nodeID, ctx.eventName, ctx]);
      };
    } else if (Array.isArray(handler)) {
      event.handler = function (ctx) {
        return Promise.all(
          handler.map((fn) => fn.apply(self, fn.__newSignature ? [ctx] : [ctx.params, ctx.nodeID, ctx.eventName, ctx]))
        );
      };
    }

    return event;
  }

  /**
   * 返回一个服务的数据（不包括服务私有的属性）
   */
  public _getPublishSettings(settings?: GenericObject) {
    if (settings && Array.isArray(settings.$secureSettings)) {
      return _.omit(settings, ([] as any[]).concat(settings.$secureSettings as any[], ['$secureSettings']));
    }

    return settings;
  }

  /**
   * 合并两个服务的协议
   */
  public mergeSchemas(mixinSchema: any, serviceSchema: any) {
    const res = _.cloneDeep(mixinSchema);
    if (!serviceSchema) return res;
    const mods = _.cloneDeep(serviceSchema);
    if (!mixinSchema) return mods;

    Object.keys(mods).forEach((key) => {
      if ((key === 'name' || key === 'version') && mods[key] !== undefined) {
        res[key] = mods[key];
      } else if (key === 'settings') {
        res[key] = this.mergeSchemaSettings(mods[key], res[key]);
      } else if (key === 'metadata') {
        res[key] = this.mergeSchemaMetadata(mods[key], res[key]);
      } else if (key === 'hooks') {
        res[key] = this.mergeSchemaHooks(mods[key], res[key] || {});
      } else if (key === 'actions') {
        res[key] = this.mergeSchemaActions(mods[key], res[key] || {});
      } else if (key === 'methods') {
        res[key] = this.mergeSchemaMethods(mods[key], res[key]);
      } else if (key === 'events') {
        res[key] = this.mergeSchemaEvents(mods[key], res[key] || {});
      } else if (['merged', 'created', 'started', 'stopped'].indexOf(key) !== -1) {
        res[key] = this.mergeSchemaLifecycleHandlers(mods[key], res[key]);
      } else if (key === 'mixins') {
        res[key] = this.mergeSchemaUniqArray(mods[key], res[key]);
      } else if (key === 'dependencies') {
        res[key] = this.mergeSchemaDependencies(mods[key], res[key]);
      } else {
        const customFnName = 'mergeSchema' + key.replace(/./, key[0].toUpperCase());

        if (isFunction(this[customFnName])) {
          res[key] = this[customFnName](mods[key], res[key]);
        } else {
          res[key] = this.mergeSchemaUnkown(mods[key], res[key]);
        }
      }
    });

    return res;
  }

  /**
   * 合并服务协议的settings属性
   */
  public mergeSchemaSettings(src: GenericObject, target: GenericObject) {
    if ((target && target.$secureSettings) || (src && src.$secureSettings)) {
      const srcSS = src && src.$secureSettings ? src.$secureSettings : [];
      const targetSS = target && target.$secureSettings ? target.$secureSettings : [];
      if (!target) target = {};
      target.$secureSettings = _.uniq([].concat(srcSS, targetSS));
    }

    return _.defaultsDeep(src, target);
  }

  /**
   * 合并服务协议中的metadata属性
   */
  public mergeSchemaMetadata(src: GenericObject, target: GenericObject) {
    return _.defaultsDeep(src, target);
  }

  /**
   * 合并服务协议中的mixins属性
   */
  public mergeSchemaUniqArray(src: GenericObject, target: GenericObject) {
    return _.uniqWith(_.compact(flatten([src, target])), _.isEqual);
  }

  /**
   * 合并服务协议中的dependencies属性
   */
  public mergeSchemaDependencies(src: GenericObject, target: GenericObject) {
    return this.mergeSchemaUniqArray(src, target);
  }

  /**
   * 合并服务协议中的hooks属性
   */
  public mergeSchemaHooks(src: GenericObject, target: GenericObject) {
    Object.keys(src).forEach((key) => {
      if (target[key] == null) target[key] = {};

      Object.keys(src[key]).forEach((childKey) => {
        const modHook = wrapToArray(src[key][childKey]);
        const resHook = wrapToArray(target[key][childKey]);
        target[key][childKey] = _.compact(flatten(key === 'before' ? [resHook, modHook] : [modHook, resHook]));
      });
    });

    return target;
  }

  /**
   * 合并服务协议中的动作
   */
  public mergeSchemaActions(src: GenericObject, target: GenericObject) {
    Object.keys(src).forEach((key) => {
      if (src[key] === false && target[key]) {
        delete target[key];
        return;
      }
      const srcAction = wrapToHandler(src[key]);
      const targetAction = wrapToHandler(target[key]);
      if (srcAction && srcAction.hooks && targetAction && targetAction.hooks) {
        Object.keys(srcAction.hooks).forEach((childKey) => {
          const modHook = wrapToArray(srcAction.hooks[childKey]);
          const resHook = wrapToArray(targetAction.hooks[childKey]);
          srcAction.hooks[childKey] = _.compact(
            flatten(childKey === 'before' ? [resHook, modHook] : [modHook, resHook])
          );
        });
      }

      target[key] = _.defaultsDeep(srcAction, targetAction);
    });

    return target;
  }

  /**
   * 合并服务协议中的Method属性
   */
  public mergeSchemaMethods(src: GenericObject, target: GenericObject) {
    return Object.assign(target || {}, src || {});
  }

  /**
   * 合并服务协议中的events属性
   */
  public mergeSchemaEvents(src: GenericObject, target: GenericObject) {
    Object.keys(src).forEach((key) => {
      const modEvent = wrapToHandler(src[key]);
      const resEvent = wrapToHandler(target[key]);
      let handler = _.compact(flatten([resEvent ? resEvent.handler : null, modEvent ? modEvent.handler : null]));
      if (handler.length === 1) handler = handler[0];
      target[key] = _.defaultsDeep(modEvent, resEvent);
      target[key].handler = handler;

      return target;
    });
  }

  /**
   * 合并服务协议中的stared、stopped、created、事件处理器等属性
   */
  public mergeSchemaLifecycleHandlers(src: GenericObject, target: GenericObject) {
    return _.compact(flatten([target, src]));
  }

  /**
   * 合并服务协议中的未知的属性
   */
  public mergeSchemaUnkown(src: GenericObject, target: GenericObject) {
    if (src !== undefined) return src;

    return target;
  }

  /**
   * 等待其他的服务
   */
  public waitForServices(serviceNames: string | string[], timeout: number, interval: number) {
    return this.star.waitForServices(serviceNames, timeout, interval, this.logger);
  }

  /**
   * 触发本地节点事件处理方法，一般用作测试
   */
  public emitLocalEventHandler(eventName: string, params?: any, options?: GenericObject) {
    if (!this.events[eventName]) {
      return Promise.reject(
        new UniverseError(
          `No '${eventName}' registered local event handler`,
          UniverseErrorCode.SERVICE_ERROR,
          UniverseErrorOptionsType.NOT_FOUND_EVENT,
          { eventName }
        )
      );
    }

    return this.events[eventName](params, options);
  }
}
