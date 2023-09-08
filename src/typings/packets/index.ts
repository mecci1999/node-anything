export enum PacketTypes {
  PACKET_UNKNOWN = '???',
  PACKET_EVENT = 'EVENT',
  PACKET_REQUEST = 'REQ',
  PACKET_RESPONSE = 'RES',
  PACKET_DISCOVER = 'DISCOVER',
  PACKET_INFO = 'INFO',
  PACKET_DISCONNECT = 'DISCONNECT',
  PACKET_HEARTBEAT = 'HEARTBEAT',
  PACKET_PING = 'PING',
  PACKET_PONG = 'PONG',

  PACKET_GOSSIP_REQ = 'GOSSIP_REQ',
  PACKET_GOSSIP_RES = 'GOSSIP_RES',
  PACKET_GOSSIP_HELLO = 'GOSSIP_HELLO'
}

export enum PacketDataTypes {
  DATATYPE_UNDEFINED = 0,
  DATATYPE_NULL = 1,
  DATATYPE_JSON = 2,
  DATATYPE_BUFFER = 3
}

export interface PacketPayload {
  version?: string; // 版本号
  sender?: string | null; // 发送者
  event?: any;
  action?: any;
  groups?: any;
}
