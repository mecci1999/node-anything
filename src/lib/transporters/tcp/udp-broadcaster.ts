/**
 * UDP发现服务
 */

import EventEmitter from 'events';
import os from 'os';
import dgram, { Socket } from 'dgram';
import ipaddr from 'ipaddr.js';
import { randomInt } from '@/utils';
import { LoggerInstance } from '@/typings/logger';

export default class UdpServer extends EventEmitter {
  public servers: Array<Socket>;
  public discoverTimer: any;
  public options: any;
  public transporter: any;
  public logger: LoggerInstance;
  public nodeID: string;
  public namespace: string;
  public counter: number;

  constructor(transporter: any, options: any) {
    super();

    this.servers = [];
    this.transporter = transporter;
    this.logger = transporter.logger;
    this.nodeID = transporter.nodeID;
    this.namespace = transporter.star.namespace;
    this.counter = 0;
  }

  /**
   * 指向UDP端口
   */
  public bind() {
    if (this.options.udpDiscovery === false) {
      this.logger.info('UDP Discovery is disabled.');
      return Promise.resolve();
    }

    return Promise.resolve()
      .then(() => {
        // 启动多个服务
        if (this.options?.udpMulticast) {
          if (this.options?.udpBindAddress) {
            return this.startServer(
              this.options?.udpBindAddress,
              this.options?.udpPort,
              this.options?.udpMulticast,
              this.options?.udpMulticastTTL
            );
          }

          const ipList = this.getInterfaceAddresses();
          Promise.all(
            ipList.map((ip) =>
              this.startServer(ip, this.options?.udpPort, this.options?.udpMulticast, this.options?.udpMulticastTTL)
            )
          );
        }
      })
      .then(() => {
        // 启动UDP广播服务
        if (this.options?.udpBroadcast) {
          return this.startServer(this.options?.udpBindAddress, this.options?.udpPort);
        }
      })
      .then(() => {
        // 发送第一条发现消息
        setTimeout(() => this.discover(), randomInt(500) + 500);

        this.startDiscovering();
      });
  }

  /**
   * 启动服务
   */
  public startServer(host?: string, port?: number, multicastAddress?: string, ttl?: number): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // 创建UDP服务
        const server = dgram.createSocket({
          type: 'udp4',
          reuseAddr: this.options?.udpReuseAddr || true
        });

        server.on('message', this.onMessage.bind(this));

        server.on('error', (error) => {
          this.logger.warn('UDP server binding error!', error);
          resolve();
        });

        host = host || '0.0.0.0';
        port = port || 4445;

        server.bind({ port, address: host, exclusive: true }, () => {
          try {
            if (multicastAddress) {
              this.logger.info(`UDP Multicast Server is listening on ${host}:${port}. Membership: ${multicastAddress}`);
              server.setMulticastInterface(host as string);
              server.addMembership(multicastAddress, host);
              server.setMulticastTTL(ttl || 1);
              (server as any).destinations = [multicastAddress];
            } else {
              this.logger.info(`UDP Broadcast Server is listening on ${host}:${port}.`);
              server.setBroadcast(true);
              if (typeof this.options?.udpBroadcast === 'string') {
                (server as any).destinations = [this.options.udpBroadcast];
              } else if (Array.isArray(this.options?.udpBroadcast)) {
                (server as any).destinations = this.options?.udpBroadcast;
              } else {
                (server as any).destinations = this.getBroadcastAddresses();
              }

              this.logger.info('Broadcast addresses:', (server as any).destinations.join(', '));
            }
          } catch (error: any) {
            this.logger.debug('UDP multicast membership error. Message:', error?.message);
          }

          this.servers.push(server);

          resolve();
        });
      } catch (error: any) {
        this.logger.warn('Unable to start UDP Discovery Server. Message:', error.message);
      }
    });
  }

  /**
   * 接收消息处理器
   */
  public onMessage(data: Buffer, rinfo: any) {
    const msg = data.toString();
    this.logger.info(`UDP message received from ${rinfo.address}.`, msg);

    try {
      const parts = msg.split('|');
      if (parts.length != 3) {
        this.logger.debug('Malformed UDP packet received', msg);
        return;
      }

      if (parts[0] == this.namespace) {
        this.emit('message', parts[1], rinfo.address, parseInt(parts[2], 10));
      }
    } catch (error) {
      this.logger.debug('UDP packet process error!', error, msg, rinfo);
    }
  }

  /**
   * 获得广播地址
   */
  public getBroadcastAddresses() {
    const list: string[] = [];
    const interfaces = os.networkInterfaces();
    for (let iface in interfaces) {
      for (let i in interfaces[iface]) {
        const f = (interfaces[iface] as os.NetworkInterfaceInfo[])[i] as os.NetworkInterfaceInfo;
        if (f.family === 'IPv4' && f.cidr) {
          list.push(ipaddr.IPv4.broadcastAddressFromCIDR(f.cidr).toString());
        }
      }
    }

    return list;
  }

  /**
   * 获取所有的接口IP地址
   */
  private getInterfaceAddresses() {
    const list: string[] = [];
    const interfaces = os.networkInterfaces();
    for (let iface in interfaces) {
      for (let i in interfaces[iface]) {
        const f = (interfaces[iface] as os.NetworkInterfaceInfo[])[i] as os.NetworkInterfaceInfo;
        if (f.family === 'IPv4') {
          list.push(f.address);
        }
      }
    }

    return list;
  }

  /**
   * 广播一条发现消息给TCP服务端
   */
  public discover() {
    if (this.servers.length === 0) return;

    this.counter++;

    // 生成一条消息
    const message = Buffer.from([this.namespace, this.nodeID, this.options.port].join('|'));
    const port = this.options?.udpPort || 4445;

    this.servers.forEach((server) => {
      if (!(server as any)?.destinations) return;

      (server as any)?.destinations.forEach((host: string) => {
        server.send(message, port, host, (error) => {
          if (error) {
            this.logger.warn(`Discovery packet broadcast error to '${host}:${port}'. Error`, error);
            return;
          }
          this.logger.debug(`Discovery packet send to '${host}:${port}'.`);
        });
      });
    });
  }

  /**
   * 启动自动发送消息
   */
  public startDiscovering() {
    if (!this.discoverTimer) {
      this.discoverTimer = setInterval(() => {
        this.discover();

        if (this.options?.udpMaxDiscovery && this.counter >= this.options.udpMaxDiscovery) this.stopDiscovering();
      }, (this.options?.udpPeriod || 30) * 1000);

      this.discoverTimer.unref();
      this.logger.info('UDP discovery started.');
    }
  }

  /**
   * 停止发送消息
   */
  public stopDiscovering() {
    if (this.discoverTimer) {
      clearInterval(this.discoverTimer);
      this.discoverTimer = null;
      this.logger.info('UDP discovery stopped.');
    }
  }

  /**
   * 关闭服务
   */
  public close() {
    this.stopDiscovering();
    this.servers.forEach((server) => server.close());
    this.servers = [];
  }
}
