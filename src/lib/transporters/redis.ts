// import { GenericObject } from '@/typings';
// import BaseTransporter from './base';
// import Redis, { Cluster } from 'ioredis';
// import { StarOptionsError, UniverseError } from '../error';
// import { PacketTypes } from '@/typings/packets';

// export default class RedisTransporter extends BaseTransporter {
//   public clientPub: Redis | Cluster | null;
//   public clientSub: Redis | Cluster | null;

//   constructor(options: GenericObject) {
//     super(options);

//     this.clientPub = null;
//     this.clientSub = null;
//   }

//   /**
//    * Redis客户端初始化
//    */
//   public getRedisClient(options: GenericObject) {
//     let client: Redis | Cluster;
//     let redis: Redis;

//     try {
//       redis = require('ioredis');
//     } catch (error) {
//       this.star?.fatal('The ioredis package is missing.Please install it with npm install ioredis --save command.');
//     }

//     if (options && options.cluster) {
//       if (!options.cluster.nodes || options.cluster.nodes.length === 0) {
//         throw new StarOptionsError('No nodes defined for cluster.');
//       }
//       this.logger?.info('Setting Redis.Cluster transporter.');
//       client = new Redis.Cluster(options.cluster.nodes, options.cluster.clusterOptions);
//     } else {
//       this.logger?.info('Setting Redis transporter.');
//       client = new Redis(options);
//     }

//     return client;
//   }

//   /**
//    * 连接
//    */
//   public connect(): Promise<void> {
//     return new Promise((resolve, reject) => {
//       let clientSub = this.getRedisClient(this.options);

//       clientSub.on('connect', () => {
//         this.logger?.info('Redis-sub client is connected.');

//         let clientPub = this.getRedisClient(this.options);

//         clientPub.on('connect', () => {
//           this.clientPub = clientPub;
//           this.clientSub = clientSub;
//           this.logger?.info('Redis-pub client is connected.');
//           this.onConnected().then(resolve);
//         });

//         clientPub.on('error', (error) => {
//           this.logger?.error('Redis-pub error', error.message);
//           this.logger?.debug('Redis-pub error', error);
//           // 广播该错误，后续开发

//           if (!this.connected) reject(error);
//         });

//         clientPub.on('close', () => {
//           this.connected = false;
//           this.logger?.warn('Redis-pub client is disconnected.');
//         });
//       });

//       clientSub.on('messageBuffer', (rawTopic: string, buf: Buffer) => {
//         const topic = rawTopic.toString().substring(this.prefix.length + 1);
//         const cmd = topic.split('.')[0] as PacketTypes;
//         this.receive(cmd, buf);
//       });

//       clientSub.on('error', (e) => {
//         this.logger?.error('Redis-sub error', e.message);
//         this.logger?.debug(e);

//         // 广播该错误
//       });

//       clientSub.on('close', () => {
//         this.connected = false;
//         this.logger?.warn('Redis-sub client is disconnected.');
//       });
//     });
//   }

//   /**
//    * 断开连接
//    */
//   public disconnect(): void {
//     if (this.clientPub) {
//       this.clientPub.disconnect();
//       this.clientPub = null;
//     }

//     if (this.clientSub) {
//       this.clientSub.disconnect();
//       this.clientSub = null;
//     }
//   }

//   /**
//    * 订阅动作
//    */
//   public subscribe(cmd: PacketTypes, nodeID: string): Promise<void> {
//     return new Promise((resolve, reject) => {
//       this.clientSub
//         ?.subscribe(this.getTopicName(cmd, nodeID))
//         .then(() => {
//           return resolve();
//         })
//         .catch((error) => {
//           return reject(error);
//         });
//     });
//   }

//   /**
//    * 发送
//    */
//   public send(topic: string, data: Buffer, meta: object): Promise<void> {
//     if (!this.clientPub) return Promise.reject(new UniverseError('Redis Client is not available'));

//     this.clientPub.publish(topic, data);
//     return Promise.resolve();
//   }
// }
