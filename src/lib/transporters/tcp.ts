import { GenericObject } from '@/typings';
import BaseTransporter from './base';
import { isString, isObject } from '@/utils';
import UdpServer from './tcp/udp-broadcaster';
import TcpReader from './tcp/tcp-reader';
import TcpWriter from './tcp/tcp-writer';
import fs from 'fs';
import kleur from 'kleur';
import _ from 'lodash';
import C from './tcp/constants';
import Packet from '../packets';
import Transit from '../transit';
import { Registry } from '../registry';
import { Discoverer } from '@/typings/registry/discoverers';
import NodeCatalog from '../registry/catalogs/node';
import Node from '../registry/node';
import { Socket } from 'net';
import { PacketTypes } from '@/typings/packets';
import { StarServerError } from '../error';

/**
 * TCP通信
 */
export default class TcpTransporter extends BaseTransporter {
  public reader: TcpReader | null;
  public writer: TcpWriter | null;
  public udpServer: UdpServer | null;
  public gossipTimer: any;
  public GOSSIP_DEBUG: boolean;
  public registry: Registry | null = null;
  public discoverer: Discoverer | null = null;
  public nodes: NodeCatalog | null = null;

  constructor(options: GenericObject) {
    if (isString(options)) {
      options = { urls: options };
    }

    super(options);

    this.options = Object.assign(
      {
        // UDP 相关的选项
        udpDiscovery: true,
        udpPort: 4445,
        udpBindAddress: null,
        udpPeriod: 30,
        udpReuseAddr: true,
        udpMaxDiscovery: 0, // 0 - No limit

        // Multicast settings
        udpMulticast: '239.0.0.0',
        udpMulticastTTL: 1,

        // Broadcast settings
        udpBroadcast: false,

        // TCP options
        port: null, // random port,
        urls: null, // Remote node addresses (when UDP discovery is not available)
        useHostname: true,

        gossipPeriod: 2, // seconds
        maxConnections: 32, // Max live outgoing TCP connections
        maxPacketSize: 1 * 1024 * 1024,

        debug: false
      },
      this.options
    );

    this.reader = null;
    this.writer = null;
    this.udpServer = null;
    this.gossipTimer = null;
    this.GOSSIP_DEBUG = !!this.options?.debug;
  }

  /**
   * 初始化
   * @param transit
   * @param messageHandler
   * @param afterConnect
   */
  public init(
    transit: Transit,
    messageHandler: (cmd: string, msg: Packet) => any,
    afterConnect: (wasReconnect: boolean) => any
  ): void {
    super.init(transit, messageHandler, afterConnect);

    if (this.star) {
      this.registry = this.star.registry;
      this.discoverer = this.star.registry?.discoverer || null;
      this.nodes = this.registry?.nodes || null; // 服务节点注册表

      // 禁止使用正常的心跳
      this.discoverer?.disableHeartbeat();
    }
  }

  /**
   * 连接
   */
  public connect() {
    return Promise.resolve()
      .then(() => {
        if (this.options.urls) return this.loadUrls();
      })
      .then(() => {
        // 启动TCP服务
        return this.startTcpServer();
      })
      .then(() => {
        // 启动UDP服务
        return this.startUdpServer();
      })
      .then(() => {
        return this.startTimers();
      })
      .then(() => {
        this.logger?.info('TCP Transporter started.');
        this.connected = true;
        (this.nodes as any).localNode.port = this.options.port;
        this.registry?.regenerateLocalRawInfo(true);
      })
      .then(() => {
        return this.onConnected();
      });
  }

  /**
   * 开始启动一个TCP服务
   */
  private startTcpServer() {
    this.writer = new TcpWriter(this, this.options);
    this.reader = new TcpReader(this, this.options);

    this.writer.on('error', (error, nodeID) => {
      this.logger?.debug(`TCP client error on '${nodeID}'`, error);
      this.nodes?.disconnected(nodeID, false);
    });

    this.writer.on('end', (nodeID) => {
      this.logger?.debug(`TCP connection ended with '${nodeID}'`);
      this.nodes?.disconnected(nodeID, false);
    });

    return this.reader.listen();
  }

  /**
   * 开启UDP服务
   */
  private startUdpServer() {
    this.udpServer = new UdpServer(this, this.options);

    this.udpServer.on('udpMessage', (nodeID, address, port) => {
      // 接受到其他节点的dicovery包，用于发现注册其他节点信息
      if (nodeID && nodeID !== this.nodeID) {
        this.logger?.info(`UDP discovery received from ${address} on ${nodeID}`);
        // 获取节点
        let node = this.nodes?.get(nodeID);
        if (!node) {
          // 添加未知节点
          node = this.addOfflineNode(nodeID, address, port);
        } else if (!node.available) {
          // 更新连接数据
          node.port = port;
          node.hostname = address;

          if (node.ipList.indexOf(address) == -1) node.ipList.unshift(address);
        }

        node.udpAddress = address;
      }
    });

    return this.udpServer?.bind();
  }

  /**
   * 根据url连接
   */
  public loadUrls() {
    if (!this.options?.urls) return Promise.resolve();

    if (Array.isArray(this.options?.urls) && this.options?.urls.length === 0) {
      return Promise.resolve();
    }

    return Promise.resolve(this.options?.urls)
      .then((url) => {
        if (isString(url) && url.startsWith('file://')) {
          // 连接地址
          const fileName = url.replace('file://', '');
          this.logger?.debug(`Load nodes list from file '${fileName}'...`);
          // 获取文件内容流
          let content: string | Buffer = fs.readFileSync(fileName);
          if (content && content.length > 0) {
            content = content.toString().trim();
            if (content.startsWith('{') || content.startsWith('[')) {
              // 解析
              return JSON.parse(content);
            } else {
              return content.split('\n').map((s) => s.trim());
            }
          }
        }

        return url;
      })
      .then((urls) => {
        // 先转换为数组形式
        if (isString(urls)) {
          urls = urls.split(',').map((str: string) => str.trim());
        } else if (isObject(urls) && !Array.isArray(urls)) {
          const list: string[] = [];
          _.forIn(urls, (s, nodeID) => list.push(`${s}/${nodeID}`));
          urls = list;
        }

        if (urls && urls.length > 0) {
          urls
            .map((str: string) => {
              if (!str) return;

              if (str.startsWith('tcp://')) str = str.replace('tcp://', '');

              const p = str.split('/');
              if (p.length !== 2) {
                return this.logger?.warn('Invalid endpoint URL. Missing port. URL:', str);
              }

              const u = p[0].split(':');
              if (u.length < 2) return this.logger?.warn('Invalid endpoint URL. Missing port.URL:', str);

              const nodeID = p[1];
              const port = Number(u.pop());
              const host = u.join(':');

              return {
                nodeID,
                host,
                port
              };
            })
            .forEach((endpoint) => {
              if (!endpoint) return;

              if (endpoint?.nodeID === this.nodeID) {
                if (!this.options.port) this.options.port = endpoint.nodeID;
              } else {
                this.addOfflineNode(endpoint.nodeID, endpoint.host, endpoint.port);
              }
            });
        }
      });
  }

  /**
   * 接受消息
   * @param cmd
   * @param data
   */
  public receive(type: PacketTypes, message: Buffer, socket?: Socket) {
    // 日志
    this.logger?.debug(
      `Star ${this.star?.namespace} nodeID ${this.star?.nodeID} receive a type ${type} message ${message}`
    );

    switch (type) {
      case PacketTypes.PACKET_GOSSIP_HELLO:
        return this.processGossipHello(message, socket);
      case PacketTypes.PACKET_GOSSIP_REQ:
        return this.processGossipRequest(message);
      case PacketTypes.PACKET_GOSSIP_RES:
        return this.processGossipResponse(message);
      default:
        return this.incomingMessage(type, message);
    }
  }

  /**
   * 处理消息接收
   */
  public onIncomingMessage(type: PacketTypes, message: Buffer, socket: Socket) {
    return this.receive(type, message, socket);
  }

  /**
   * 开启一个定时器
   */
  public startTimers() {
    this.gossipTimer = setInterval(() => {
      const node = this.getLocalNodeInfo();
      if (!node) return;

      node.updateLocalInfo(this.star?.getCpuUsage).then(() => this.sendGossipRequest());
    }, Math.max(this.options.gossipPeriod, 1) * 1000);

    this.gossipTimer.unref();
  }

  /**
   * 停止定时器
   */
  public stopTimers() {
    if (this.gossipTimer) {
      clearInterval(this.gossipTimer);
      this.gossipTimer = null;
    }
  }

  /**
   * 处理GOSSIP_REQ类型的消息
   */
  public processGossipRequest(message: Buffer) {
    const response: { online: any; offline: any } = {
      online: {},
      offline: {}
    };

    try {
      // 解析消息，获得数据
      const packet = this.deserialize(PacketTypes.PACKET_GOSSIP_RES, message);
      const payload = packet?.payload;
      if (this.GOSSIP_DEBUG) {
        this.logger?.debug(`------ REQUEST ${this.nodeID} <- ${payload?.sender} ------`, payload);
      }

      const list = this.nodes?.toArray();
      list?.forEach((node: Node) => {
        const online = payload?.online ? payload.online[node.id] : null;
        const offline = payload?.offline ? payload.offline[node.id] : null;
        let seq: any, cpuSeq: any, cpu: any;

        if (offline) seq = offline;
        else if (online) [seq, cpuSeq, cpu] = online;

        if (!seq || seq < node.seq) {
          if (node.available) {
            // 节点信息
            const info = this.registry?.getNodeInfo(node.id);
            response.online[node.id] = [info, node.cpuSeq || 0, node.cpu || 0];
          } else {
            response.offline[node.id] = node.seq;
          }

          return;
        }

        if (offline) {
          // 发送者认为当前节点处于断线状态
          if (!node.available) {
            // 确认该节点属于断线状态
            // 更新我们注册节点的信息
            if (seq > node.seq) node.seq = seq;

            return;
          } else if (!node.local) {
            // 不是本地节点,断开链接
            this.nodes?.disconnected(node.id, false);
            node.seq = seq;
          } else if (node.local) {
            // 本地节点
            node.seq = seq + 1;
            const info = this.registry?.getLocalNodeInfo(true);
            response.online[node.id] = [info, node.cpuSeq || 0, node.cpu || 0];
          }
        } else if (online) {
          // 发送方认为当前节点属于在线状态
          if (node.available) {
            // 节点状态正常
            if (cpuSeq > node.cpuSeq) {
              // 更新节点信息
              node.heartbeat({ cpu, cpuSeq });
            } else if (cpuSeq < node.cpuSeq) {
              // 通知发送方更新数据
              response.online[node.id] = [node.cpuSeq || 0, node.cpu || 0];
            }
          } else {
            // 当前节点状态不正常
            return;
          }
        }
      });

      //
      if (Object.keys(response.offline).length === 0) delete response.offline;
      if (Object.keys(response.online).length === 0) delete response.online;

      if (response.online || response.offline) {
        let sender = this.nodes?.get(payload?.sender);
        // 将响应发送给请求者
        const rspPacket = new Packet(PacketTypes.PACKET_GOSSIP_RES, sender?.id, response);
        (this.publish(rspPacket) as Promise<any>).catch(() => {});

        if (this.GOSSIP_DEBUG) {
          this.logger?.debug(
            kleur.bgMagenta().black(`----- RESPONSE ${this.nodeID} -> ${sender?.id} -----`),
            rspPacket.payload
          );
        }
      } else {
        if (this.GOSSIP_DEBUG) {
          this.logger?.debug(kleur.bgBlue().white(`----- EMPTY RESPONSE ${this.nodeID} -> ${payload?.sender} -----`));
        }
      }
    } catch (error) {
      this.logger?.warn('Invalid incoming GOSSIP_REQ packet.', error);
      this.logger?.debug('Content:', message.toString());
    }
  }

  /**
   * 处理GOSSIP_RES类型的消息
   */
  public processGossipResponse(message: Buffer) {
    try {
      // 解析包
      const packet = this.deserialize(PacketTypes.PACKET_GOSSIP_RES, message);
      const payload = packet?.payload;
      if (this.GOSSIP_DEBUG) {
        this.logger?.debug(`------ RESPONSE ${this.nodeID} <- ${payload?.sender} -----`, payload);
      }

      // 处理在线节点
      if (payload?.online) {
        Object.keys(payload.online).forEach((nodeID) => {
          if (nodeID === this.nodeID) return;

          const row = payload.online[nodeID];
          if (!Array.isArray(row)) return;

          let info: any, cpu: any, cpuSeq: any;
          if (row.length === 1) info = row[0];
          else if (row.length === 2) [cpu, cpuSeq] = row;
          else if (row.length === 3) [info, cpu, cpuSeq] = row;

          // 更新节点信息
          let node = this.nodes?.get(nodeID);
          if (info && (!node || node.seq < info.seq)) {
            info.sender = nodeID;
            node = this.nodes?.processNodeInfo(info);
          }

          if (node && cpuSeq && cpuSeq > node.cpuSeq) {
            node.heartbeat({ cpu, cpuSeq });
          }
        });
      }

      // 处理离线节点
      if (payload?.offline) {
        Object.keys(payload.offline).forEach((nodeID) => {
          if (nodeID === this.nodeID) return;

          const seq = payload.offline[nodeID];
          const node = this.nodes?.get(nodeID);
          if (!node) return;

          if (node.seq < seq) {
            if (node.available) {
              // 断开链接
              this.nodes?.disconnected(node.id, false);
            }

            node.seq = seq;
          }
        });
      }
    } catch (error) {
      this.logger?.warn('Invalid incoming GOSSIP_RES packet.', error);
      this.logger?.debug('Content:', message.toString());
    }
  }

  /**
   * 发送一个Gossip请求
   */
  public sendGossipRequest() {
    const list = this.nodes?.toArray();
    if (!list || list.length <= 1) return;

    let packet: { online: any; offline: any } = {
      online: {},
      offline: {}
    };

    let onlineList: Array<Node> = [];
    let offlineList: Array<Node> = [];

    list.forEach((node) => {
      if (!node.available) {
        if (node.seq > 0) {
          packet.offline[node.id] = node.seq;
        }
        offlineList.push(node);
      } else {
        packet.online[node.id] = [node.seq, node.cpuSeq || 0, node.cpu || 0];

        if (!node.local) onlineList.push(node);
      }
    });

    if (Object.keys(packet.offline).length === 0) delete packet.offline;
    if (Object.keys(packet.online).length === 0) delete packet.online;

    if (onlineList.length > 0) {
      // 发送 gossip 消息给一个正常运行的节点
      this.sendGossipToRandomEndpoint(packet, onlineList);
    }

    if (offlineList.length > 0) {
      // 断线节点
      const ratio = offlineList.length / (onlineList.length + 1);
      if (ratio >= 1 || Math.random() < ratio) {
        this.sendGossipToRandomEndpoint(packet, offlineList);
      }
    }
  }

  /**
   * 随机发送 gossip 消息给一个正常运行的节点
   */
  private sendGossipToRandomEndpoint(data: GenericObject, endpoints: Array<Node>) {
    if (endpoints.length === 0) return;

    const ep = endpoints.length === 1 ? endpoints[0] : endpoints[Math.floor(Math.random() * endpoints.length)];
    if (ep) {
      const packet = new Packet(PacketTypes.PACKET_GOSSIP_REQ, ep.id, data);

      this.publish(packet)?.catch(() => {
        this.logger?.debug(`Unable to send Gossip packet to ${ep.id}`);
      });

      if (this.GOSSIP_DEBUG) {
        this.logger?.debug(kleur.bgYellow().black(`------ REQUEST ${this.nodeID} -> ${ep.id} ------`), packet.payload);
      }
    }
  }

  /**
   * 添加未知节点
   */
  private addOfflineNode(id: string, address: string, port: number) {
    const node = new Node(id);

    node.local = false;
    node.hostname = address;
    node.ipList = [address];
    node.port = port;
    node.available = false;
    node.seq = 0;
    node.offlineSince = Math.round(process.uptime());

    // 添加节点
    this.nodes?.add(node.id, node);

    return node;
  }

  /**
   * 获取节点
   */
  public getNode(nodeID: string) {
    return this.nodes?.get(nodeID);
  }

  /**
   * 获取节点地址
   */
  private getNodeAddress(node: Node) {
    if (node.udpAddress) return node.udpAddress;

    if (this.options.useHostname && node.hostname) return node.hostname;

    if (node.ipList && node.ipList.length > 0) return node.ipList[0];

    this.logger?.warn(`Node ${node.id} has no valid address`, node);

    return null;
  }

  /**
   * 发送消息
   */
  public publish(packet: Packet) {
    if (
      !packet.target ||
      [
        PacketTypes.PACKET_EVENT,
        PacketTypes.PACKET_PING,
        PacketTypes.PACKET_PONG,
        PacketTypes.PACKET_REQUEST,
        PacketTypes.PACKET_RESPONSE,
        PacketTypes.PACKET_GOSSIP_REQ,
        PacketTypes.PACKET_GOSSIP_RES,
        PacketTypes.PACKET_GOSSIP_HELLO
      ].indexOf(packet.type) == -1
    ) {
      // 不符合规范的消息数据
      return Promise.resolve();
    }

    // 序列化
    const data = this.serialize(packet);

    if (!data) return Promise.resolve();
    return this.send(packet.type, data, { packet });
  }

  /**
   * 发送数据包
   */
  public send(type: PacketTypes, data: Buffer, meta: GenericObject) {
    const packetID = C.resolvePacketID(type);
    const { packet } = meta;
    this.logger?.debug(
      `------------- Star ${this.star?.namespace} node ${this.star?.nodeID} send a packetID ${packetID} type ${type} data ${data} meta ${meta} packet ---------> Node ${packet.target}`
    );
    return this.writer
      ?.send(packet.target, packetID, data)
      .then(() => {
        this.logger?.debug(
          `Star ${this.star?.namespace} node ${this.star?.nodeID} send a packetID ${packetID} type ${type} data ${data} meta ${meta} packet ---------> Node ${packet.target}`
        );
      })
      .catch((error) => {
        this.nodes?.disconnected(packet.target, true);
        throw error;
      });
  }

  /**
   * 发送一个Gossip Hello 给远程节点
   */
  public sendHello(nodeID: string) {
    // 获取节点
    const node = this.getNode(nodeID);
    if (!node) {
      return Promise.reject(new StarServerError(`Missing node info for '${nodeID}'`));
    }
    // 获取当前节点信息
    const localNode = this.nodes?.localNode;
    if (!localNode) return Promise.reject(new StarServerError(`Missing localNode info`));

    // 构建发送包
    const packet = new Packet(PacketTypes.PACKET_GOSSIP_HELLO, nodeID, {
      host: this.getNodeAddress(localNode),
      port: localNode.port
    });

    if (this.GOSSIP_DEBUG) {
      this.logger?.debug(kleur.bgCyan().black(`------ HELLO ${this.nodeID} -> ${nodeID} ------`), packet.payload);
    }

    // 发布消息
    return this.publish(packet)?.catch(() => {
      this.logger?.debug(`Unable to send Gossip HELLO packet to ${nodeID}`);
    });
  }

  /**
   * 处理GOSSIP_HELLO类型的消息
   */
  public processGossipHello(msg: Buffer, socket?: Socket) {
    try {
      // 反序列化解析包的数据
      const packet = this.deserialize(PacketTypes.PACKET_GOSSIP_HELLO, msg);
      const payload = packet?.payload;
      const nodeID = payload?.sender; // 发送方
      if (this.GOSSIP_DEBUG) {
        this.logger?.debug(`------ HELLO ${this.nodeID} <- ${payload?.sender} -----`, payload);
        let node = this.nodes?.get(nodeID); // 获取发送的节点信息
        if (!node) {
          // 没有查到该节点，说明该节点为未知节点，则需要注册该节点
          node = this.addOfflineNode(nodeID, payload?.host, payload?.port);
        }
        if (!node.udpAddress) node.udpAddress = socket?.remoteAddress || null;
      }
    } catch (error) {
      this.logger?.warn('Invalid incoming GOSSIP_HELLO packet.', error);
      this.logger?.debug('Content:', msg.toString());
    }
  }

  /**
   * 关闭TCP和UDP服务并且销毁socket
   */
  public disconnect() {
    this.connected = false;
    // 停止定时器
    this.stopTimers();
    // 关闭TCP读服务
    if (this.reader) this.reader.close();
    // 关闭TCP写服务
    if (this.writer) this.writer.close();
    // 关闭UDP服务
    if (this.udpServer) this.udpServer.close();
  }

  /**
   * 获取本地节点信息
   */
  public getLocalNodeInfo() {
    return this.nodes?.localNode;
  }

  /**
   * 通过nodeID获取节点信息
   */
  public getNodeInfo(nodeID: string) {
    return this.nodes?.get(nodeID);
  }

  /**
   * 订阅动作
   */
  public subscribe(cmd: PacketTypes, nodeID: string): any {
    return Promise.resolve();
  }
}
