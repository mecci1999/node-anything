/**
 * 用来封装成各个服务之间通信数据的包
 */
import { GenericObject } from '@/typings';
import { PacketPayload, PacketTypes } from '@/typings/packets';

export default class Packet {
  public type: PacketTypes;
  public target: any;
  public payload: GenericObject | PacketPayload;
  public services: any;
  public config: any;
  public metadata: any;
  public meta: any;
  public error: any;
  public online: any;
  public offline: any;
  public dataType: any;
  public params: any;
  public paramsType: any;

  constructor(type: PacketTypes, target?: any, payload?: GenericObject | PacketPayload) {
    this.type = type || PacketTypes.PACKET_UNKNOWN;
    this.target = target;
    this.payload = payload || {};
  }
}
