import { GenericObject } from '@/typings';
import BaseTransporter from './base';
import Kafka, { KafkaClient, Producer, ConsumerGroup } from 'kafka-node';
import _ from 'lodash';
import { PacketTypes } from '@/typings/packets';
import C from '../star/constants';

export default class KafkaTransporter extends BaseTransporter {
  public client: KafkaClient | null;
  public producer: Producer | null;
  public consumer: ConsumerGroup | null;

  constructor(options: any) {
    if (typeof options === 'string') {
      options = { host: options.replace('kafka://', '') };
    } else if (options == null) {
      options = {};
    }

    options = _.defaultsDeep(options, {
      client: { kafkaHost: options.host },
      producer: {},
      customPartitioner: undefined,
      consumer: {},
      publish: {
        partition: 0,
        attributes: 0
      }
    });

    super(options);

    this.client = null;
    this.producer = null;
    this.consumer = null;
  }

  /**
   * 连接
   */
  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // 创建kafka实例
      this.client = new Kafka.KafkaClient(this.options.client);

      // 创建生产者
      this.producer = new Kafka.Producer(this.client, this.options.producer, this.options.customPartitioner);

      this.producer.on('ready', () => {
        this.logger?.info('Kafka client is connected.');
        this.onConnected().then(resolve);
      });

      this.producer.on('error', (error) => {
        this.logger?.error('Kafka Producer error', error.message);
        this.logger?.debug('Kafka Producer error', error);
        // 广播错误
        this.star?.broadcastLocal('$transporter.error', {
          error,
          module: 'transporter',
          type: C.FAILED_PUBLISHER_ERROR
        });

        if (!this.connected) reject(error);
      });
    });
  }

  /**
   * 断开连接
   */
  public disconnect(): void {
    if (this.client) {
      this.client.close(() => {
        this.client = null;
        this.producer = null;

        if (this.consumer) {
          this.consumer.close(() => {
            this.consumer = null;
          });
        }
      });
    }
  }

  /**
   * 订阅动作
   */
  public makeSubscriptions(topics: GenericObject[]): Promise<void> {
    const topicsMap = topics.map(({ cmd, nodeID }) => this.getTopicName(cmd, nodeID));

    return new Promise((resolve, reject) => {
      // 生产者创建topic
      this.producer?.createTopics(topicsMap, true, (error) => {
        if (error) {
          this.logger?.error('Unable to create topics!', topics, error);
          // 广播错误
          this.star?.broadcastLocal('$transporter.error', {
            error,
            module: 'transporter',
            type: C.FAILED_TOPIC_CREATION
          });

          return reject(error);
        }

        // 消费者配置
        const consumerOptions = Object.assign(
          {
            id: 'default-kafka-consumer',
            kafkaHost: this.options.host,
            groupId: this.star?.instanceID,
            fromOffset: 'latest',
            encoding: 'buffer'
          },
          this.options.consumer
        );

        // 创建消费者实例
        this.consumer = new Kafka.ConsumerGroup(consumerOptions, topicsMap);

        this.consumer.on('error', (error) => {
          this.logger?.error('Kafka Consumer error', error.message);
          this.logger?.debug('Kafka Consumer error', error);

          // 广播错误
          this.star?.broadcastLocal('$transporter.error', {
            error,
            module: 'transporter',
            type: C.FAILED_CONSUMER_ERROR
          });

          if (!this.connected) reject(error);
        });

        this.consumer.on('message', (message) => {
          const topic = message.topic;
          const cmd = topic.split('.')[1] as PacketTypes;
          this.receive(cmd, message.value as Buffer);
        });

        // 注意：这里如果一直在连接中，会导致进程一直卡在连接kafka中
        this.consumer.on('connect', () => {
          this.logger?.info(`KAFKA Consumer connected is success!`);
          resolve();
        });
      });
    });
  }

  /**
   * 发送动作
   */
  public send(topic: string, data: Buffer, { packet }): Promise<void> {
    if (!this.client) return Promise.resolve();

    return new Promise((resolve, reject) => {
      this.producer?.send(
        [
          {
            topic: this.getTopicName(packet.type, packet.target),
            messages: [data],
            partition: this.options.publish.partition,
            attributes: this.options.publish.attributes
          }
        ],
        (error) => {
          if (error) {
            this.logger?.error('Kafka Server Publish error', error);

            // 广播错误
            this.star?.broadcastLocal('$transporter.error', {
              error,
              module: 'transporter',
              type: C.FAILED_PUBLISHER_ERROR
            });

            reject(error);
          }

          resolve();
        }
      );
    });
  }
}
