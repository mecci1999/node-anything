import Packet from '../packets';
import { Transform } from 'stream';
import { Star } from '../star';
import { LoggerInstance } from '@/typings/logger';
import { GenericObject } from '@/typings';
import { ProtocolVersionMismatchError, Regenerator, StarServerError } from '../error';
import { StarTransitOptions, TransitRequest } from '@/typings/transit';
import { Transporter } from '@/typings/transit/transporters';
import { UniverseErrorCode, UniverseErrorOptionsType } from '@/typings/error';
import { PacketTypes } from '@/typings/packets';
import { Discoverer } from '@/typings/registry/discoverers';
import { Registry } from '../registry';
import Node from '../registry/node';
import C from '../star/constants';
import Context from '../context';

export default class Transit {
  public star: Star;
  public Promise: PromiseConstructorLike | null = null;
  public logger: LoggerInstance;
  public nodeID: string;
  public instanceID: string;
  public transporter: Transporter;
  public options: StarTransitOptions | undefined;
  public discoverer: Discoverer | null;
  public errorRegenerator: Regenerator | null;
  public pendingRequests: Map<string, TransitRequest>;
  public pendingReqStreams: Map<string, any>;
  public pendingResStreams: Map<string, any>;

  public connected: boolean;
  public disconnecting: boolean;
  public isReady: boolean;
  public stat: GenericObject;
  public subscribing: Promise<any> | null = null;

  constructor(star: Star, transporter: Transporter, options?: StarTransitOptions) {
    this.star = star;
    if (star.Promise) this.Promise = Promise;
    this.logger = star.getLogger('transit');
    this.nodeID = star.nodeID || '';
    // this.metrics = star.metrics;  // 性能指标
    this.instanceID = star.instanceID;
    this.transporter = transporter;
    this.options = options;
    this.discoverer = (star.registry as Registry).discoverer;
    this.errorRegenerator = star.errorRegenerator;

    this.pendingReqStreams = new Map();
    this.pendingRequests = new Map();
    this.pendingResStreams = new Map();

    /* deprecated */
    this.stat = {
      packets: {
        sent: {
          count: 0,
          bytes: 0
        },
        received: {
          count: 0,
          bytes: 0
        }
      }
    };

    this.connected = false;
    this.disconnecting = false;
    this.isReady = false;

    const wrappedMessageHandler = (cmd: string, packet: GenericObject) => this.messageHandler(cmd, packet);
  }

  /**
   * 消息处理器
   */
  public messageHandler(cmd: string, msg: GenericObject) {
    try {
      const payload = msg?.payload;
      if (!payload) {
        throw new StarServerError(
          'Missing response payload.',
          UniverseErrorCode.SERVICE_ERROR,
          UniverseErrorOptionsType.MISSING_PAYLOAD
        );
      }

      // 检查协议版本号
      if (payload.version !== Star.PROTOCOL_VERSION && !this.options?.disableVersionCheck) {
        throw new ProtocolVersionMismatchError({
          nodeID: payload.sender,
          actual: Star.PROTOCOL_VERSION,
          received: payload.version
        });
      }

      if (payload.sender === this.nodeID) {
        if (cmd === PacketTypes.PACKET_INFO && payload.instanceID !== this.instanceID) {
          this.star.fatal('Star has detected a nodeID conflict, use unique nodeIDs. Star Stopped.');

          return Promise.resolve(false);
        }

        if (
          cmd !== PacketTypes.PACKET_EVENT &&
          cmd !== PacketTypes.PACKET_REQUEST &&
          cmd !== PacketTypes.PACKET_RESPONSE
        ) {
          return Promise.resolve(false);
        }
      }

      if (cmd === PacketTypes.PACKET_REQUEST) {
        return;
      }
    } catch (error) {}
  }

  /**
   * 向节点发送ping请求，不传nodeID则向所有的node节点发送ping请求
   */
  public sendPing(nodeID?: string, id?: string) {
    const packet = new Packet(PacketTypes.PACKET_PING, nodeID, {
      time: Date.now(),
      id: id || this.star.generateUid()
    });

    return this.publish(packet);
  }

  /**
   * 发送pong响应结果
   */
  public sendPong(payload: GenericObject) {
    const packet = new Packet(PacketTypes.PACKET_PONG, payload.sender, {
      time: payload.time,
      id: payload.id,
      arrived: Date.now()
    });

    return this.publish(packet).catch((error) => {
      this.logger.error(`Unable to send PONG packet to '${payload.sender}' node.`, error);

      // 广播错误
    });
  }

  /**
   * 订阅动作
   */
  public subscribe(topic: string, nodeID: string) {
    return this.transporter.subscribe(topic, nodeID);
  }

  /**
   * 发布动作
   */
  public publish(packet: Packet) {
    if (this.subscribing) {
      // 订阅所有的通信动作
      return this.subscribing.then(() => {
        return this.transporter.prepublish(packet);
      });
    }

    return this.transporter.prepublish(packet);
  }

  /**
   * 发送一个节点的心跳
   */
  public sendHeartbeat(localNode: Node) {
    const packet = new Packet(PacketTypes.PACKET_HEARTBEAT, null, { cpu: localNode.cpu });

    if (!packet) return Promise.reject();

    return this.publish(packet).catch((error) => {
      // 日志
      this.logger.error('Unable to send HEARTBEAT packet.', error);
      // 广播
      this.star.broadcastLocal('$transit.error', {
        error,
        module: 'transit',
        type: C.FAILED_SEND_HEARTBEAT_PACKET
      });
    });
  }

  /**
   * 发送一个事件给远程的节点
   */
  public sendEvent(ctx: Context) {
    const groups = ctx.eventGroups;
    const requestID = ctx.requestID ? "with requestID '" + ctx.requestID + "' " : '';
    if (ctx.endpoint) {
      this.logger.debug(
        `=> Send '${ctx.eventName}' event ${requestID}to ${ctx.nodeID}' node` +
          (groups ? ` in '${groups.join(', ')}' group(s)` : '') +
          '.'
      );
    } else {
      this.logger.debug(`=> Send '${ctx.eventName}' event ${requestID}to '${groups?.join(', ')}' group(s).`);
    }

    const packet = new Packet(PacketTypes.PACKET_EVENT, ctx.endpoint ? ctx.nodeID : null, {
      id: ctx.id,
      event: ctx.eventName,
      data: ctx.params,
      groups,
      broadcast: ctx.eventType == 'broadcast',
      meta: ctx.meta,
      level: ctx.level,
      tracing: ctx.tracing,
      parentID: ctx.parentID,
      requestID: ctx.requestID,
      caller: ctx.caller,
      needAck: ctx.needAck
    });

    return this.publish(packet).catch((error) => {
      this.logger.error(`Unable to send '${ctx.eventName}' event ${requestID}to groups.`, error);
      this.star.broadcastLocal('$transit.error', {
        error,
        module: 'transit',
        type: C.FAILED_SEND_EVENT_PACKET
      });
    });
  }
}
