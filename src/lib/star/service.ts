import { ServiceDependency, ServiceSchema, ServiceSettingSchema } from '@/typings/service';
import { Star } from '.';
import { deprecate, isFunction, isObject, wrapToArray, wrapToHandler } from '@/utils';
import { ServiceSchemaError } from '../error';
import { GenericObject } from '@/typings';
import { LoggerInstance } from '@/typings/logger';
import { ServiceActions } from '@/typings/star/service';
import _, { flatten } from 'lodash';

export default class Service<S = ServiceSettingSchema> {
  public star: Star;
  public fullName: string = '';
  public name: string = '';
  public version: string | number = '';
  public settings?: S | object;
  public schema?: ServiceSchema<S>; // 协议
  public metadata: GenericObject = {};
  public logger: LoggerInstance | null = null;
  public actions: ServiceActions | null = null; // 动作
  public events: any; // 事件
  public originalSchema: ServiceSchema<S> | null = null;
  public dependencies: string | ServiceDependency | (string | ServiceDependency)[] | null = null;

  constructor(star: Star, schema?: ServiceSchema<S>, schemaMods?: any) {
    if (!isObject(star)) throw new ServiceSchemaError('Must set a Star instance!');

    this.star = star;

    if (schemaMods) {
      deprecate(
        'schemaMods',
        "Using 'schemaMods' parameter in 'star.createService' is deprecated. Use 'mixins' instead."
      );
      schema = this.mergeSchemas(schema, schemaMods);
    }

    if (schema) this.parseServiceSchema(schema);
  }

  /**
   * 解析服务协议，并注册本地服务
   * @param schema
   */
  protected parseServiceSchema(schema: any) {
    if (!isObject(schema))
      throw new ServiceSchemaError("The service schema can't be null. Maybe is it not a service schema?");

    this.originalSchema = _.cloneDeep(schema);

    if (schema.mixins) {
      schema = this.applyMixins(schema);
    }

    if (isFunction(schema.merged)) {
      schema.merged.call(this, schema);
    } else if (Array.isArray(schema.merged)) {
      schema.merged.forEach((fn) => fn.call(this, schema));
    }

    this.star.callMiddlewareHookSync('serviceCreateing', [this, schema]);

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
    this.fullName = Service.getVersionedFullName(this.name, this.version);

    // 引入日志实例
    this.logger = this.star.getLogger(this.fullName, { svc: this.name, version: this.version });

    this.actions = {};
    this.events = {};

    const serviceSpecification = {
      name: this.name,
      version: this.version,
      fullName: this.fullName,
      settings: this.settings,
      metadata: this.metadata,
      actions: {},
      events: {}
    };

    // 注册方法
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
          throw new ServiceSchemaError(`Invalid method name '${name}' in '${this.name}' service!`);
        }

        this._createMethod(method, name);
      });
    }

    // 注册动作
    if (isObject(schema.actions)) {
    }
  }

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
   * 初始化服务
   */
  public _init() {
    this.logger?.debug(`Service '${this.fullName}' is creating...`);
    if (isFunction(this.schema?.created)) {
      this.schema?.created && (this.schema?.created as any).call(this);
    } else if (Array.isArray(this.schema?.created)) {
      this.schema?.created.forEach((fn) => fn.call(this));
    }
    this.star.addLocalService(this as any);
    this.star.callMiddlewareHookSync('serviceCreated', [this]);
    this.logger?.debug(`Service '${this.fullName}' created.`);
  }

  /**
   * 开始服务
   */
  public _start() {
    this.logger?.debug(`Service '${this.fullName}' is starting...`);
    return Promise.resolve().then(() => {});
  }

  /**
   * 创建方法
   */
  public _createMethod(methodDef: any, name: string) {
    let method: any;
    if (isFunction(methodDef)) {
      method = { handler: methodDef };
    } else if (isObject(methodDef)) {
      method = methodDef;
    } else {
      throw new ServiceSchemaError(`Invalid method definition in '${name}' method in '${this.fullName}' service!`);
    }

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
      }
    });
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
  public mergeSchemeUniqArray(src: GenericObject, target: GenericObject) {
    return _.uniqWith(_.compact(flatten([src, target])), _.isEqual);
  }

  /**
   * 合并服务协议中的dependencies属性
   */
  public mergeSchemaDependencies(src: GenericObject, target: GenericObject) {
    return this.mergeSchemeUniqArray(src, target);
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
}
