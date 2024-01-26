import Star from '@/lib/star';
import Registry from '../registry';
import Node from '../node';
import { ActionSchema } from '@/typings/context';
import { EventSchema } from '@/typings/context/event';
import Service from '@/lib/star/service';
import ServiceItem from '../service-item';

export default class Endpoint {
  public registry: Registry;
  public star: Star;
  public id: string;
  public node: Node;
  public local: boolean;
  public state: boolean;
  public action: ActionSchema | null = null;
  public event: EventSchema | null = null;
  public service: ServiceItem | null = null;
  public name: string = '';

  constructor(registry: Registry, star: Star, node: Node, service?: Service, event?: any) {
    this.registry = registry;
    this.star = star;
    this.id = node.id;
    this.node = node;
    this.local = node.id === star.nodeID;
    this.state = true;
  }

  /**
   * 是否运行正常
   */
  public get isAvailable() {
    return this.state;
  }

  /**
   * 销毁
   */
  public destory() {}

  /**
   * 更新
   */
  public update(data: any) {}
}
