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
    if (isString(options)) options = { urls: options };

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
        maxPacketSize: 1 * 1024 * 1024
      },
      options
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
      this.nodes = this.registry?.nodes || null;

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
      .then(() => this.startTcpServer())
      .then(() => this.startUdpServer());
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

    this.udpServer.on('message', (nodeID, address, port) => {
      if (nodeID && nodeID !== this.nodeID) {
        this.logger?.info(`UDP discovery received from ${address} on ${nodeID}`);
        // 获取节点
        let node = this.nodes?.get(nodeID);
        if (!node) {
          // 未知节点
          node = this.addOfflineNode(nodeID, address, port);
        } else if (!node.available) {
          // 更新连接数据
          node.port = port;
          node.hostname = address;

          if (node.ipList.indexOf(address) == -1) node.ipList.unshift(address);
        }

        return this.udpServer?.bind();
      }
    });
  }

  /**
   * 根据url连接
   */
  private loadUrls() {
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
   * 处理消息接收
   */
  public onIncomingMessage(type:string, message: any, socket:Socket) {
    return this.receive()
  }

  /**
   * 添加掉线节点
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

    this.nodes?.add(node.id, node);

    return node;
  }

  /**
   * 获取节点
   */
  public getNode(nodeID: string) {
    return this.nodes?.get(nodeID);
  }
}
