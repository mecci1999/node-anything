/**
 * TCP读操作模块
 */

import EventEmitter from 'events';
import net, { Server, Socket } from 'net';
import Parser from './parser';
import { isString } from '@/utils';

export default class TcpReader extends EventEmitter {
  public server: Server | null;
  public options: any;
  public transporter: any;
  public logger: any;
  public sockets: Array<Socket>;
  public connected: boolean = false;

  constructor(transporter: any, options: any) {
    super();

    this.server = null;
    this.options = options;
    this.transporter = transporter;
    this.logger = transporter.logger;
    this.sockets = [];
  }

  /**
   * 监听TCP端口
   */
  public listen() {
    return new Promise((resolve, reject) => {
      // 创建一个tcp服务
      const server = net.createServer((socket) => this.onTcpClientConnected(socket));

      server.on('error', (error) => {
        this.logger?.error('TCP Server error.', error);

        if (reject) reject(error);
      });

      let h = this.options?.port; // 端口号
      // 如果node版本大于8.x
      if (parseInt(process.versions.node.split('.')[0], 10) >= 8) {
        h = { port: this.options?.port, exclusive: true };
      }

      // 启动监听
      server.listen(h, () => {
        if (isString(this.server?.address())) {
          this.options.port = this.server?.address();
        } else {
          this.options.port = (this.server?.address() as net.AddressInfo)?.port;
        }
        this.logger?.info(`TCP server is listening on port ${this.options.port}`);
        // TCP服务是否连接
        this.connected = true;
        resolve(this.options.port);
      });

      this.server = server;
    });
  }

  /**
   * 接收到新的TCP socket
   */
  public onTcpClientConnected(socket: Socket) {
    this.sockets.push(socket);
    // 不设置延迟
    socket.setNoDelay(true);

    const address = socket.remoteAddress;
    this.logger.debug(`New TCP client connected from '${address}'`);

    const parser = new Parser(undefined, this.options.maxPacketSize);
    socket.pipe(parser);

    parser.on('data', (type, message) => {
      // 接收消息
      this.transporter.onIncomingMessage(type, message, socket);
    });

    parser.on('error', (error) => {
      this.logger?.warn('Packet parser error!', error);
      this.closeSocket(socket, error);
    });

    socket.on('error', (error) => {
      this.logger?.warn(`TCP client '${address}' error!`, error);
      this.closeSocket(socket, error);
    });

    socket.on('close', (hadError) => {
      this.logger?.debug(`TCP client disconnected from '${address}'! Had error:`, !!hadError);
      this.closeSocket(socket);
    });

    this.emit('connect', socket);
  }

  /**
   * 关闭socket
   * @param socket
   * @param error
   */
  private closeSocket(socket: Socket, error?: Error) {
    socket.destroy();

    this.sockets.splice(this.sockets.indexOf(socket), 1);
  }

  /**
   * 关闭TCP服务
   */
  public close() {
    if (this.server && this.server.listening) {
      this.server.close();

      // 关闭所有的socket
      this.sockets.forEach((socket) => socket.destroy());
      this.sockets = [];
    }
  }
}
