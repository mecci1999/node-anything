import { PacketTypes } from '@/typings/packets';

const PacketTypeId = {
  PACKET_EVENT_ID: 1,
  PACKET_REQUEST_ID: 2,
  PACKET_RESPONSE_ID: 3,
  PACKET_PING_ID: 4,
  PACKET_PONG_ID: 5,
  PACKET_GOSSIP_REQ_ID: 6,
  PACKET_GOSSIP_RES_ID: 7,
  PACKET_GOSSIP_HELLO_ID: 8
};

const IGNORABLE_ERRORS = [
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNRECH',
  'ENETDOWN',
  'EPIPE',
  'ENOENT'
];

/**
 * 根据包的类型得到ID
 * @param type
 * @returns
 */
function resolvePacketID(type: PacketTypes) {
  switch (type) {
    case PacketTypes.PACKET_EVENT:
      return PacketTypeId.PACKET_EVENT_ID;
    case PacketTypes.PACKET_REQUEST:
      return PacketTypeId.PACKET_REQUEST_ID;
    case PacketTypes.PACKET_RESPONSE:
      return PacketTypeId.PACKET_RESPONSE_ID;
    case PacketTypes.PACKET_PING:
      return PacketTypeId.PACKET_PING_ID;
    case PacketTypes.PACKET_PONG:
      return PacketTypeId.PACKET_PONG_ID;
    case PacketTypes.PACKET_GOSSIP_REQ:
      return PacketTypeId.PACKET_GOSSIP_REQ_ID;
    case PacketTypes.PACKET_GOSSIP_RES:
      return PacketTypeId.PACKET_GOSSIP_RES_ID;
    case PacketTypes.PACKET_GOSSIP_HELLO:
      return PacketTypeId.PACKET_GOSSIP_HELLO_ID;
    default:
      throw new Error('Unsupported packet type (' + type + ')!');
  }
}

/**
 * 根据包的ID得到类型
 */
function resolvePacketType(id: number) {
  switch (id) {
    case PacketTypeId.PACKET_EVENT_ID:
      return PacketTypes.PACKET_EVENT;
    case PacketTypeId.PACKET_REQUEST_ID:
      return PacketTypes.PACKET_REQUEST;
    case PacketTypeId.PACKET_RESPONSE_ID:
      return PacketTypes.PACKET_RESPONSE;
    case PacketTypeId.PACKET_PING_ID:
      return PacketTypes.PACKET_PING;
    case PacketTypeId.PACKET_PONG_ID:
      return PacketTypes.PACKET_PONG;
    case PacketTypeId.PACKET_GOSSIP_REQ_ID:
      return PacketTypes.PACKET_GOSSIP_REQ;
    case PacketTypeId.PACKET_GOSSIP_RES_ID:
      return PacketTypes.PACKET_GOSSIP_RES;
    case PacketTypeId.PACKET_GOSSIP_HELLO_ID:
      return PacketTypes.PACKET_GOSSIP_HELLO;
    default:
      throw new Error('Unsupported packet ID (' + id + ')!');
  }
}

export default { ...PacketTypeId, IGNORABLE_ERRORS, resolvePacketID, resolvePacketType };
