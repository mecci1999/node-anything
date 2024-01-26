import Star from '@/lib/star';
import Registry from '../registry';
import Endpoint from './item';
import Node from '../node';
import ServiceItem from '../service-item';

export default class ActionEndpoint extends Endpoint {
  constructor(registry: Registry, star: Star, node: Node, service: ServiceItem, action: any) {
    super(registry, star, node);

    this.service = service;
    this.action = action;
    this.name = `${this.id}:${this.action?.name}`;
  }

  public update(action: any): void {
    this.action = action;
  }
}
