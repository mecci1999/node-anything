import { PacketDataTypes, PacketTypes } from '@/typings/packets';
import Packet from '../packets';
import Star from '../star';
import { GenericObject } from '@/typings';

export default class BaseSerializer {
  public star: Star | null = null;

  constructor() { }

  /**
   * 初始化序列化
   */
  public init(star: Star) {
    this.star = star;
  }

  /**
   * 将一个json对象序列化为Buffer对象
   */
  public serialize(obj: GenericObject, type: string): Buffer {
    throw new Error('Not implemented!');
  }

  /**
   * 将一个Buffer对象反序列化为json对象
   */
  public deserialize(buf: Buffer, type: string): GenericObject {
    throw new Error('Not implemented!');
  }

  /**
   * 序列化一个自定义的字段
   */
  public serializeCustomFields(type: PacketTypes, obj: Packet): Packet {
    switch (type) {
      case PacketTypes.PACKET_INFO:
        obj.services = JSON.stringify(obj.services);
        if (obj?.config) obj.config = JSON.stringify(obj.config);
        if (obj?.metadata) obj.metadata = JSON.stringify(obj.metadata);
        break;
      case PacketTypes.PACKET_EVENT:
        this.convertDataToTransport(obj, 'data', 'dataType');
        obj.meta = JSON.stringify(obj.meta);
        break;
      case PacketTypes.PACKET_REQUEST:
        this.convertDataToTransport(obj, 'params', 'paramsType');
        obj.meta = JSON.stringify(obj.meta);
        break;
      case PacketTypes.PACKET_RESPONSE:
        this.convertDataToTransport(obj, 'data', 'dataType');
        obj.meta = JSON.stringify(obj.meta);
        if (obj.error) obj.error = JSON.stringify(obj.error);
        break;
      case PacketTypes.PACKET_GOSSIP_REQ:
        if (obj.online) obj.online = JSON.stringify(obj.online);
        if (obj.offline) obj.offline = JSON.stringify(obj.offline);
        break;
      case PacketTypes.PACKET_GOSSIP_RES:
        if (obj.online) obj.online = JSON.stringify(obj.online);
        if (obj.offline) obj.offline = JSON.stringify(obj.offline);
        break;
    }

    return obj;
  }

  /**
   * 反序列化一个自定义的字段
   */
  public deserializeCustomFields(type: PacketTypes, obj: Packet): Packet {
    switch (type) {
      case PacketTypes.PACKET_INFO:
        obj.services = JSON.parse(obj.services);
        if (obj?.config) obj.config = JSON.parse(obj.config);
        if (obj?.metadata) obj.metadata = JSON.parse(obj.metadata);
        break;
      case PacketTypes.PACKET_EVENT:
        this.convertDataFromTransport(obj, 'data', 'dataType');
        obj.meta = JSON.parse(obj.meta);
        break;
      case PacketTypes.PACKET_REQUEST:
        this.convertDataToTransport(obj, 'params', 'paramsType');
        obj.meta = JSON.parse(obj.meta);
        break;
      case PacketTypes.PACKET_RESPONSE:
        this.convertDataToTransport(obj, 'data', 'dataType');
        obj.meta = JSON.parse(obj.meta);
        if (obj.error) obj.error = JSON.parse(obj.error);
        break;
      case PacketTypes.PACKET_GOSSIP_REQ:
        if (obj.online) obj.online = JSON.parse(obj.online);
        if (obj.offline) obj.offline = JSON.parse(obj.offline);
        break;
      case PacketTypes.PACKET_GOSSIP_RES:
        if (obj.online) obj.online = JSON.parse(obj.online);
        if (obj.offline) obj.offline = JSON.parse(obj.offline);
        break;
    }

    return obj;
  }

  /**
   * 将数据转换为对应的传输格式
   */
  public convertDataToTransport(obj: Packet, field: string, fieldType: string) {
    if (obj[field] === undefined) {
      obj[fieldType] = PacketDataTypes.DATATYPE_UNDEFINED;
    } else if (obj[field] === null) {
      obj[fieldType] = PacketDataTypes.DATATYPE_NULL;
    } else if (Buffer.isBuffer(obj[field])) {
      obj[fieldType] = PacketDataTypes.DATATYPE_BUFFER;
    } else {
      // JSON格式
      obj[fieldType] = PacketDataTypes.DATATYPE_JSON;
      obj[field] = Buffer.from(JSON.stringify(obj[field]));
    }
  }

  /**
   * 将传输的数据转换为正常数据
   */
  public convertDataFromTransport(obj: Packet, field: string, fieldType: string) {
    const type = obj[fieldType];
    switch (type) {
      case PacketDataTypes.DATATYPE_UNDEFINED:
        obj[field] = undefined;
        break;
      case PacketDataTypes.DATATYPE_NULL:
        obj[field] = null;
        break;
      case PacketDataTypes.DATATYPE_BUFFER:
        if (!Buffer.isBuffer(obj[field])) obj[field] = Buffer.from(obj[field]);
        break;
      default: {
        // JSON
        obj[field] = JSON.parse(obj[field]);
        break;
      }
    }

    delete obj[fieldType];
  }
}
