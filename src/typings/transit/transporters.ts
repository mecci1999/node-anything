import Transit from '@/lib/transit';
import { GenericObject } from '..';
import Packet from '@/lib/packets';

export class Transporter {
  public hasBuiltInBalancer: boolean = false;
  constructor(opts?: GenericObject) {}

  init(
    transit: Transit,
    messageHandler: (cmd: string, msg: string) => void,
    afterConnect: (wasReconnect: boolean) => void
  ): void {}

  connect(): Promise<any> {
    return Promise.resolve();
  }
  disconnect(): Promise<any> {
    return Promise.resolve();
  }
  onConnected(wasReconnect?: boolean): Promise<any> {
    return Promise.resolve();
  }

  makeSubscriptions(topics: GenericObject[]): Promise<void> {
    return Promise.resolve();
  }

  subscribe(cmd: string, nodeID?: string): Promise<void> {
    return Promise.resolve();
  }
  subscribeBalancedRequest(action: string): Promise<void> {
    return Promise.resolve();
  }
  subscribeBalancedEvent(event: string, group: string): Promise<void> {
    return Promise.resolve();
  }
  unsubscribeFromBalancedCommands(): Promise<void> {
    return Promise.resolve();
  }

  incomingMessage(cmd: string, msg: Buffer): Promise<void> {
    return Promise.resolve();
  }

  receive(cmd: string, data: Buffer): Promise<void> {
    return Promise.resolve();
  }

  prepublish(packet: Packet): Promise<void> {
    return Promise.resolve();
  }
  publish(packet: Packet): Promise<void> {
    return Promise.resolve();
  }
  publishBalancedEvent(packet: Packet, group: string): Promise<void> {
    return Promise.resolve();
  }
  publishBalancedRequest(packet: Packet): Promise<void> {
    return Promise.resolve();
  }
  send(topic: string, data: Buffer, meta: GenericObject): Promise<void> {
    return Promise.resolve();
  }

  getTopicName(cmd: string, nodeID?: string): string {
    return '';
  }

  makeBalancedSubscriptions(): Promise<void> {
    return Promise.resolve();
  }

  serialize(packet: Packet): Buffer | null {
    return null;
  }

  deserialize(type: string, data: Buffer): Packet | null {
    return null;
  }
}
