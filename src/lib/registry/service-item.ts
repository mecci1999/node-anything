import { GenericObject } from '@/typings';
import Service from '../star/service';
import Node from './node';
import { ServiceSettingSchema } from '@/typings/service';

export default class ServiceItem {
  public node: Node;
  public name: string;
  public fullName: string;
  public version: string | number;
  public settings?: ServiceSettingSchema;
  public metadata: GenericObject = {};
  public local: boolean;
  public actions: any;
  public events: any;
  public dependencies: any;

  constructor(node: Node, service: Service, local: boolean) {
    this.node = node;
    this.name = service.name;
    this.fullName = service.fullName;
    this.version = service.version;
    this.settings = service.settings;
    this.metadata = service.metadata;
    this.local = !!local;
    this.actions = {};
    this.events = {};
  }

  /**
   * 检查某服务是否具有相等的属性
   */
  public equals(fullName: string, nodeID?: string) {
    return this.fullName === fullName && (nodeID == null || this.node.id === nodeID);
  }

  /**
   * 更新服务的属性
   */
  public update(service: Service) {
    this.fullName = service.fullName;
    this.version = service.version;
    this.settings = service.settings;
    this.metadata = service.metadata;
  }

  /**
   * 添加一个服务动作
   */
  public addAction(action: any) {
    this.actions[action.name] = action;
  }

  /**
   * 添加一个服务事件
   */
  public addEvent(event: any) {
    this.events[event.name] = event;
  }
}
