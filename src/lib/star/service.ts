import { ServiceSchema, ServiceSettingSchema } from '@/typings/service';
import { Star } from '.';
import { isObject } from '@/utils';
import { ServiceSchemaError } from '../error';
import { GenericObject } from '@/typings';
import { LoggerInstance } from '@/typings/logger';

export default class Service<S = ServiceSettingSchema> {
  public star: Star;
  public fullName: string = '';
  public name: string = '';
  public version: string | number = '';
  public settings?: S | object;
  public schema?: ServiceSchema<S>; // 协议
  public metadata: GenericObject;
  public logger: LoggerInstance;

  constructor(star: Star, schema?: ServiceSchema<S>, schemaMods?: any) {
    if (!isObject(star)) throw new ServiceSchemaError('Must set a Star instance!');

    this.star = star;
    this.schema = schema;
    this.name = schema?.name || '';
    this.version = schema?.version || '';
    this.settings = schema?.settings || {};
    this.metadata = schema?.metadata || {};
    this.fullName = Service.getVersionedFullName(this.name, this.version);

    // 引入日志实例
    this.logger = this.star.getLogger(this.fullName, { svc: this.name, version: this.version });
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
   * 开始服务
   */
  public _start() {
    this.logger.debug(`Service '${this.fullName}' is starting...`);
    return Promise.resolve().then(() => {});
  }
}
