// import { GenericObject } from '@/typings';
// import BaseTransporter from './base';
// import { isObject } from '@/utils';
// import Mqtt from 'mqtt';
// import { PacketTypes } from '@/typings/packets';

// type QoS = 0 | 1 | 2;

// export default class MqttTransporter extends BaseTransporter {
//   public qos: QoS;
//   public topicSeparator: string; // 分隔符
//   public client: Mqtt.MqttClient | null;

//   constructor(options: GenericObject) {
//     super(options);
//     this.qos = 0;
//     this.topicSeparator = '.';

//     if (isObject(this.options)) {
//       if (this.options.qos !== undefined) {
//         this.qos = this.options.qos;
//         delete this.options.ops;
//       }
//       if (this.options.topicSeparator !== undefined) {
//         this.topicSeparator = this.options.topicSeparator;
//         delete this.options.topicSeparator;
//       }
//     }

//     this.client = null;
//   }

//   public connect() {
//     return new Promise((resolve, reject) => {
//       let mqtt;
//       try {
//         mqtt = Mqtt;
//       } catch (error) {
//         this.star?.fatal(
//           'The mqtt package is missing. Please install it with npm install mqtt --save command.',
//           error,
//           true
//         );
//       }

//       const client = Mqtt.connect(this.options);

//       // 连接
//       client.on('connect', () => {
//         this.client = client;
//         this.logger?.info('MQTT client is connnected.');
//         this.onConnected().then(resolve);
//       });

//       // 报错
//       client.on('error', (error) => {
//         this.logger?.error('MQTT error.', error.message);
//         this.logger?.debug(error);
//         // 广播报错，后续增加

//         if (!client.connected) reject(error);
//       });

//       // 重新连接
//       client.on('reconnect', () => {
//         this.logger?.warn('MQTT client is reconnecting...');
//       });

//       // 消息通知
//       client.on('message', (rawTopic, buf) => {
//         const topic = rawTopic.substring(this.prefix.length + this.topicSeparator.length);
//         const cmd = topic.split(this.topicSeparator)[0] as PacketTypes;
//         this.receive(cmd, buf);
//       });

//       // 断开连接
//       client.on('close', () => {
//         this.connected = false;
//         this.logger?.warn('MQTT client is disconnected.');
//       });
//     });
//   }

//   /**
//    * 断开连接
//    */
//   public disconnect() {
//     if (this.client) {
//       return new Promise((resolve) => {
//         this.client?.end(false, resolve);
//         this.client = null;
//       });
//     }
//   }

//   /**
//    * 获取事件名称
//    */
//   public getTopicName(cmd: string, nodeID: string): string {
//     return this.prefix + this.topicSeparator + cmd + (nodeID ? this.topicSeparator + nodeID : '');
//   }

//   /**
//    * 订阅动作
//    */
//   public subscribe(cmd: PacketTypes, nodeID: string): Promise<void> {
//     return new Promise((resolve, reject) => {
//       const topic = this.getTopicName(cmd, nodeID);
//       this.client?.subscribe(topic, { qos: this.qos }, (error, granted) => {
//         if (error) return reject(error);

//         this.logger?.debug('MQTT server granted', granted);
//         resolve();
//       });
//     });
//   }

//   /**
//    * 发送动作
//    */
//   public send(topic: string, data: Buffer, meta: object): Promise<void> | void {
//     if (!this.client) return;

//     return new Promise((resolve, reject) => {
//       this.client?.publish(topic, data, { qos: this.qos }, (error) => {
//         if (error) return reject(error);

//         resolve();
//       });
//     });
//   }
// }
