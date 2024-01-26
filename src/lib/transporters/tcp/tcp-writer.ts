import EventEmitter from 'events';
import net, { Socket } from 'net';
import C from './constants';
import { UniverseError } from '@/lib/error';

const HEADER_SIZE = 6;

/**
 * TCP写操作模块
 */
export default class TcpWriter extends EventEmitter {
  public options: any;
  public transporter: any;
  public logger: any;
  public sockets: Map<string, Socket>;

  constructor(transporter: any, options: any) {
    super();

    this.sockets = new Map();
    this.options = options;
    this.transporter = transporter;
    this.logger = transporter.logger;
  }

  /**
   * 连接
   */
  public connect(nodeID: string): Promise<Socket> {
    // 获取节点
    const node = this.transporter.getNode(nodeID);
    if (!node) return Promise.reject(new UniverseError(`Missing node info for '${nodeID}'!`));

    // 从节点注册表中获取到节点的ip地址
    const host = this.transporter.getNodeAddress(node);
    // 端口号
    const port = node.port;
    this.logger.debug(`Connecting to '${nodeID}' via ${host}:${port}`);

    return new Promise((resolve, reject) => {
      try {
        const socket = net.connect({ host, port }, () => {
          (socket as any).nodeID = nodeID;
          (socket as any).lastUsed = Date.now();
          socket.setNoDelay(true);
          // 添加socket
          this.addSocket(nodeID, socket, true);
          // 日志
          this.logger.debug(`Connected successfully to '${nodeID}'`);

          this.transporter
            .sendHello(nodeID)
            .then(() => resolve(socket))
            .catch((error) => reject(error));

          if (this.sockets.size > this.options.maxConnections) this.manageConnections();
        });

        // 监听socket事件
        socket.on('error', (error) => {
          this.removeSocket(nodeID);
          this.emit('error', error, nodeID);

          if (reject) reject(error);
        });

        socket.on('end', () => {
          this.removeSocket(nodeID);
          this.emit('end', nodeID);

          if (reject) reject(new Error('Connection closed.'));
        });

        socket.unref();
      } catch (error) {
        if (reject) reject(error);
      }
    });
  }

  /**
   * 发送动作
   */
  public send(nodeID: string, type: number, data: Buffer): Promise<any> {
    return Promise.resolve()
      .then(() => {
        // 获取socket
        let socket = this.sockets.get(nodeID);
        if (socket && !socket.destroyed) return socket;

        // 不存在，则进行连接
        return this.connect(nodeID);
      })
      .then((socket: Socket) => {
        if ([C.PACKET_GOSSIP_REQ_ID, C.PACKET_GOSSIP_RES_ID, C.PACKET_GOSSIP_HELLO_ID].indexOf(type) === -1) {
          (socket as any).lastUsed = Date.now();
        }

        return new Promise((resolve, reject) => {
          const header = Buffer.alloc(HEADER_SIZE);
          header.writeInt32BE(data.length + HEADER_SIZE, 1);
          header.writeInt8(type, 5);
          const crc = header[1] ^ header[2] ^ header[3] ^ header[4] ^ header[5];
          header[0] = crc;

          const payload = Buffer.concat([header, data]);

          try {
            socket.write(payload, () => {
              resolve(true);
            });
          } catch (error) {
            this.removeSocket(nodeID);
            reject(error);
          }
        });
      });
  }

  /**
   * 添加socket
   */
  public addSocket(nodeID: string, socket: Socket, force: boolean) {
    const s = this.sockets.get(nodeID);
    if (!force && s && !s.destroyed) return;

    this.sockets.set(nodeID, socket);
  }

  /**
   * 管理连接
   */
  private manageConnections() {
    let count = this.sockets.size - this.options.maxConnections;
    // 没有超出限制
    if (count <= 0) return;
    // 超出限制处理
    const list: any[] = [];
    this.sockets.forEach((socket, nodeID) => list.push({ nodeID, lastUsed: (socket as any).lastUsed }));
    list.sort((a, b) => a.lastUsed - b.lastUsed);

    // 去最小值
    count = Math.min(count, list.length - 1);
    const removeable = list.slice(0, count);

    this.logger.debug(`Close ${count} old sockets.`, removeable);

    removeable.forEach(({ nodeID }) => this.removeSocket(nodeID));
  }

  /**
   * 关闭移除socket连接
   */
  public removeSocket(nodeID: string) {
    const socket = this.sockets.get(nodeID);
    if (socket && !socket.destroyed) socket.destroy();

    this.sockets.delete(nodeID);
  }

  /**
   * 关闭TCP连接
   */
  public close() {
    this.sockets.forEach((socket) => {
      if (!socket.destroyed) socket.end();
    });
    // 清空
    this.sockets.clear();
  }
}
