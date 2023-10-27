import Packet from '../packets';
import { Stream, Transform } from 'stream';
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
import { QueueIsFullError, RequestRejectedError } from '../error/custom';
import _ from 'lodash';

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
  public __connectResolve: any;

  constructor(star: Star, transporter: Transporter, options?: StarTransitOptions) {
    this.star = star;
    if (star.Promise) this.Promise = Promise;
    this.logger = star.getLogger('transit');
    this.nodeID = star.nodeID || '';
    // this.metrics = star.metrics;  // 性能指标
    this.instanceID = star.instanceID;
    this.transporter = transporter;
    this.options = _.defaultsDeep(
      {
        maxQueueSize: 50000 // 请求最大数量为50000
      },
      options
    );
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

    const wrappedMessageHandler = (cmd: string, packet: any) => this.messageHandler(cmd, packet);

    this.publish = this.star.wrapMethod('transitPublish', this.publish, this) as any;
    this.messageHandler = this.star.wrapMethod('transitMessageHandler', this.messageHandler, this) as any;

    if (this.transporter) {
      // 初始化
      this.transporter.init(this, wrappedMessageHandler, this.afterConnect.bind(this));
    }

    this.__connectResolve = null;
  }

  /**
   * tranporter模块连接成功之后
   */
  public afterConnect(wasReconnect: boolean) {
    let timer: any = null;

    return Promise.resolve()
      .then(() => {
        if (wasReconnect) {
          // 重新连接后，更新该节点的信息
          return this.discoverer?.sendLocalNodeInfo();
        } else {
          // 首次连接，完成订阅动作
          return this.makeSubscriptions();
        }
      })
      .then(() => this.discoverer?.discoverAllNodes())
      .then(() => {
        // 等待500ms时间，等待接收数据包
        timer = setTimeout(() => {
          this.connected = true;
          // 性能注册
          // 广播
          this.star.broadcastLocal('$transporter.connected', {
            wasReconnect: !!wasReconnect
          });

          if (this.__connectResolve) {
            this.isReady = true;
            this.__connectResolve();
            this.__connectResolve = null;
          }

          return null;
        }, 500);
      })
      .finally(() => {
        clearTimeout(timer);
        timer = null;
      });
  }

  /**
   * 连接到tansporter模块，如果失败，每次间隔5s后会重试
   */
  public connect() {
    this.logger.info('Connecting to the transporter...');
    return new Promise((resolve, reject) => {
      this.__connectResolve = resolve;
      const doConnect = () => {
        let reconnectStarted = false;

        const errorHandler = (error) => {
          if (this.disconnecting) return;
          if (reconnectStarted) return;

          this.logger.warn('Connection is failed.', (error && error.message) || 'Unknown error');
          this.logger.debug(error);
          if (this.options?.disableReconnect) {
            // 禁止重新连接
            return;
          }

          reconnectStarted = true;

          setTimeout(() => {
            this.logger.info('Reconnecting...');
            doConnect();
          }, 5 * 1000);
        };
        // 连接transporter模块
        this.transporter.connect().catch(errorHandler);
      };

      doConnect();
    });
  }

  /**
   * 断开链接
   */
  public disconnect() {
    this.connected = false;
    this.isReady = false;
    this.disconnecting = true;

    this.star.broadcastLocal('$transporter.disconnected', { graceFul: true });

    return Promise.resolve()
      .then(() => {
        if (this.transporter.connected) {
          return this.discoverer?.localNodeDisconnected().then(() => this.transporter.disconnect());
        }
      })
      .then(() => {
        this.disconnecting = false;
      });
  }

  /**
   * 本地节点准备好了，所有的服务加载完毕
   */
  public ready() {
    if (this.connected) {
      // 性能参数注册
      return;
    }
  }

  /**
   * 发送一个断开链接的包给远程的节点
   */
  public sendDisconnectPacket() {
    return this.publish(new Packet(PacketTypes.PACKET_DISCONNECT, null, {})).catch((error) => {
      this.logger.error('Unable to send DISCONNECT packet.', error);
    });
  }

  /**
   * 订阅通信过程中所有的动作
   */
  public makeSubscriptions() {
    this.subscribing = this.transporter
      .makeSubscriptions([
        // 订阅广播事件
        { cmd: PacketTypes.PACKET_EVENT, nodeID: this.nodeID },

        // 订阅请求事件
        { cmd: PacketTypes.PACKET_REQUEST, nodeID: this.nodeID },

        // 订阅节点对请求的响应事件
        { cmd: PacketTypes.PACKET_RESPONSE, nodeID: this.nodeID },

        // 订阅服务发现处理事件
        { cmd: PacketTypes.PACKET_DISCOVER },
        { cmd: PacketTypes.PACKET_DISCOVER, nodeID: this.nodeID },

        // 订阅节点信息处理事件
        { cmd: PacketTypes.PACKET_INFO }, // 广播信息，如果一个新的节点进行连接动作
        { cmd: PacketTypes.PACKET_INFO, nodeID: this.nodeID },

        // 订阅断开链接事件
        { cmd: PacketTypes.PACKET_DISCONNECT },

        // 订阅心跳处理事件
        { cmd: PacketTypes.PACKET_HEARTBEAT },

        // 订阅ping请求事件
        { cmd: PacketTypes.PACKET_PING },
        { cmd: PacketTypes.PACKET_PING, nodeID: this.nodeID },

        //订阅pong响应事件
        { cmd: PacketTypes.PACKET_PONG, nodeID: this.nodeID }
      ])
      .then(() => {
        this.subscribing = null;
      });

    return this.subscribing;
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

  /**
   * 根据nodeID移除一个正在审核的请求或流
   * @param nodeID
   */
  public removePendingRequestByNodeID(nodeID: string) {
    this.logger.debug(`Remove pending requests of '${nodeID}' node.`);
    this.pendingRequests.forEach((req, id) => {
      if (req.nodeID === nodeID) {
        this.pendingRequests.delete(id);
        req.reject(new RequestRejectedError({ action: req.action?.name || req.action, nodeID: req.nodeID }));
        this.pendingReqStreams.delete(id);
        this.pendingResStreams.delete(id);
      }
    });
  }

  /**
   * 发送一个请求给一个远程的服务
   */
  public request(ctx: Context) {
    if (this.options?.maxQueueSize && this.pendingRequests.size >= this.options.maxQueueSize) {
      // 待发送的请求数量超出设置的最大数量
      return Promise.reject(
        new QueueIsFullError({
          action: ctx?.action?.name || '',
          nodeID: this.nodeID,
          size: this.pendingRequests.size,
          limit: this.options.maxQueueSize
        })
      );
    }

    return new Promise((resolve, reject) => this._sendRequest(ctx, resolve, reject));
  }

  /**
   * 发送一个远程请求
   */
  public _sendRequest(ctx: Context, resolve: any, reject: any) {
    // 是否为流
    const isStream =
      ctx.params &&
      ctx.params.readable === true &&
      typeof ctx.params.on === 'function' &&
      typeof ctx.params.pipe === 'function';

    const request: TransitRequest = {
      action: ctx.action,
      nodeID: ctx.nodeID || '',
      ctx,
      resolve,
      reject,
      stream: isStream
    };

    const payload: any = {
      id: ctx.id,
      action: ctx.action?.name || '',
      params: isStream ? null : ctx.params,
      meta: ctx.meta,
      timeout: ctx.options.timeout,
      level: ctx.level,
      tracing: ctx.tracing,
      parentID: ctx.parentID,
      requestID: ctx.requestID,
      caller: ctx.caller,
      stream: isStream
    };

    if (payload.stream) {
      // 使用流
      if (
        ctx.params.readableObjectMode === true ||
        (ctx.params._readableState && ctx.params._readableState.objectMode === true)
      ) {
        payload.meta = payload.meta || {};
        payload.meta['$streamObjectMode'] = true;
      }
      payload.seq = 0;
    }

    const packet = new Packet(PacketTypes.PACKET_REQUEST, ctx.nodeID, payload);
    const nodeName = ctx.nodeID ? `'${ctx.nodeID}'` : 'someone';
    const requestID = ctx.requestID ? "with requestID '" + ctx.requestID + "' " : '';
    this.logger.debug(`=> Send '${ctx.action?.name}' request ${requestID} to ${nodeName} node.`);

    const publishCatch = (error) => {
      this.logger.error(`Unable to send '${ctx.action?.name}' request ${requestID} to ${nodeName} node.`);
      // 广播
      this.star.broadcastLocal('$transit.error', {
        error,
        module: 'transit',
        type: C.FAILED_SEND_REQUEST_PACKET
      });
    };

    // 添加到审核队列中
    this.pendingRequests.set(ctx.id, request);

    // 发布请求
    return this.publish(packet)
      .then(() => {
        if (isStream) {
          // 使用流发送请求
          payload.meta = {};
          if (
            ctx.params.readableObjectMode === true ||
            (ctx.params._readableState && ctx.params._readableState.objectMode === true)
          ) {
            payload.meta['$streamObjectMode'] = true;
          }

          const stream = ctx.params; // 可读流
          stream.on('data', (chunk) => {
            // 暂停流
            stream.pause();
            const chunks: Buffer[] = [];
            if (
              chunk instanceof Buffer &&
              this.options?.maxChunkSize &&
              this.options?.maxChunkSize > 0 &&
              chunk.length > this.options.maxChunkSize
            ) {
              // 请求流的长度超出了最大的大小限制
              let len = chunk.length;
              let i = 0;
              while (i < len) {
                chunks.push(chunk.slice(i, (i += this.options.maxChunkSize)));
              }
            } else {
              chunks.push(chunk);
            }
            for (const ch of chunks) {
              const copy = Object.assign({}, payload);
              copy.seq = ++payload.seq;
              copy.stream = true;
              copy.params = ch;

              this.logger.debug(`=> Send steam chunk ${requestID} to ${nodeName} node. Seq: ${copy.seq}`);
              this.publish(new Packet(PacketTypes.PACKET_REQUEST, ctx.nodeID, copy)).catch(publishCatch);
            }
            // 继续
            stream.resume();
            return;
          });

          stream.on('end', () => {
            const copy = Object.assign({}, payload);
            copy.seq = ++payload.seq;
            copy.params = null;
            copy.stream = false;

            this.logger.debug(`=> Send stream closing ${requestID} to ${nodeName} node. Seq: ${copy.seq}`);

            return this.publish(new Packet(PacketTypes.PACKET_REQUEST, ctx.nodeID, copy)).catch(publishCatch);
          });

          stream.on('error', (error) => {
            const copy = Object.assign({}, payload);
            copy.seq = ++payload.seq;
            copy.params = null;
            copy.stream = false;
            copy.meta['$streamError'] = this._createPayloadErrorField(error, payload);

            this.logger.debug(`=> Send stream error ${requestID} to ${nodeName} node.`, copy.meta['$streamError']);

            return this.publish(new Packet(PacketTypes.PACKET_REQUEST, ctx.nodeID, copy)).catch(publishCatch);
          });
        }
      })
      .catch((error) => {
        publishCatch(error);
        reject(error);
      });
  }

  /**
   * 创建一个错误的字段
   */
  public _createPayloadErrorField(error: any, payload: any) {
    return this.errorRegenerator?.extracPlainError(error, payload);
  }

  /**
   * 发现节点
   */
  public discoverNode(nodeID: string) {
    return this.publish(new Packet(PacketTypes.PACKET_DISCOVER, nodeID, {})).catch((error) => {
      this.logger.error(`Unable to send DISCOVER packet to '${nodeID}' node.`, error);
      // 广播
      this.star.broadcastLocal('$transit.error', {
        error,
        module: 'transit',
        type: C.FAILED_NODE_DISCOVERY
      });
    });
  }

  /**
   * 发现所有的节点
   */
  public discoverNodes() {
    return this.publish(new Packet(PacketTypes.PACKET_DISCOVER, null, {})).catch((error) => {
      this.logger.error(`Unable to send DISCOVER packet.`, error);
      this.star.broadcastLocal('$transit.error', {
        error,
        module: 'transit',
        type: C.FAILED_NODES_DISCOVERY
      });
    });
  }

  /**
   * 发送节点信息
   */
  public sendNodeInfo(info: any, nodeID: string) {
    if (!this.connected || !this.isReady) return Promise.resolve();

    return this.publish(
      new Packet(PacketTypes.PACKET_INFO, nodeID, {
        services: info.services,
        ipList: info.ipList,
        hostname: info.hostname,
        client: info.client,
        config: info.config,
        instanceID: this.star.instanceID,
        metadata: info.metadata,
        seq: info.seq
      })
    ).catch((error) => {
      this.logger.error(`Unable to send INFO packet to '${nodeID}' node.`, error);
      this.star.broadcastLocal('$transit.error', {
        error,
        module: 'transit',
        type: C.FAILED_SEND_INFO_PACKET
      });
    });
  }
}
