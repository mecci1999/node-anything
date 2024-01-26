import Star from '@/lib/star';
import Registry from '../registry';
import Endpoint from './item';
import Node from '../node';
import ServiceItem from '../service-item';

export default class EventEndpoint extends Endpoint {
  constructor(registry: Registry, star: Star, node: Node, service: ServiceItem, event: any) {
    super(registry, star, node);

    this.service = service;
    this.event = event;
  }

  public update(event: any): void {
    this.event = event;
  }
}
