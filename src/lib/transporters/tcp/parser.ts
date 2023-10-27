import { Writable } from 'stream';
import C from './constants';

/**
 * TCP包的编译模块
 */
export default class Parser extends Writable {
  public maxPacketSize: number;
  public buf: Buffer | null;

  constructor(options: any, maxPacketSize: number) {
    super(options);
    this.maxPacketSize = maxPacketSize;
    this.buf = null;
  }

  _write(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null | undefined) => void): void {
    let packet = chunk;

    if (this.buf && this.buf.length > 0) {
      packet = Buffer.concat([this.buf, chunk]);
      this.buf = null;
    }

    // 从块中找到所有的消息
    while (packet.length > 0) {
      if (packet.length < 6) {
        // 太短的情况，等待下一个块
        this.buf = Buffer.from(packet);
        return callback();
      }

      if (this.maxPacketSize && packet.length > this.maxPacketSize) {
        // 超出限制
        return callback(
          new Error(
            `Incoming packet is larger than the 'maxPacketSize' limit (${packet.length}) > ${this.maxPacketSize}!`
          )
        );
      }

      const crc = packet[1] ^ packet[2] ^ packet[3] ^ packet[4] ^ packet[5];
      if (crc !== packet[0]) {
        return callback(new Error('Invalid packet CRC! ' + crc));
      }

      const length = (packet as Buffer).readInt32BE(1);

      if (packet.length >= length) {
        const msg = packet.slice(6, length);
        const type = C.resolvePacketType(packet[5]);
        this.emit('data', type, msg);
        packet = packet.slice(length);
      } else {
        this.buf = Buffer.from(packet);
        return callback();
      }
    }

    callback();
  }
}
