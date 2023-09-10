import Redis, { Cluster } from 'ioredis';
import _ from 'lodash';
import kleur from 'kleur';
import S from '@/lib/serializers';
import BaseDiscoverer from './base';
import { DiscovererOptions } from '@/typings/registry/discoverers';
import { Registry } from '..';
import { StarOptionsError } from '@/lib/error';
import C from '@/lib/star/constants';
import { isFunction } from '@/utils';
import { Serialize } from '@/typings/serializers';

/**
 * Redis模块目前为测试模块，请勿在生产环境使用
 */
export default class RedisDiscoverer extends BaseDiscoverer {
  public idx: number;
  private client: Redis | Cluster | null;
  private infoUpdateTimer: any; // 信息更新定时器
  private lastInfoSeq: number; // 上次信息更新次序
  private lastBeatSeq: number; // 上次心跳次序
  private instanceHash: string | undefined = ''; // 实例id
  private PREFIX: string = '';
  private BEAT_KEY: string = '';
  private INFO_KEY: string = '';
  private reconnecting: boolean = false; // 是否重新连接
  private serializer: Serialize | undefined;

  constructor(options: DiscovererOptions) {
    if (typeof options === 'string') options = { redis: options };

    super(options);

    this.options = _.defaultsDeep(this.options, {
      redis: null,
      serializer: 'JSON',
      fullCheck: 10,
      scanLength: 100,
      monitor: false
    });

    this.idx = this.options.fullCheck > 1 ? _.random(this.options.fullCheck - 1) : 0;
    this.client = null;
    this.infoUpdateTimer = null;
    this.lastInfoSeq = 0;
    this.lastBeatSeq = 0;
  }

  public init(registry: Registry): void {
    super.init(registry);

    if (!Redis)
      return this.star?.fatal(
        "The 'ioredis' package is missing. Please install it with 'npm install ioredis --save' command."
      );

    this.logger?.warn(kleur.yellow().bold('Redis Discoverer is an EXPERINMENTAL module. DO NOT use it in production!'));

    this.instanceHash = this.star?.instanceID.substring(0, 8);

    this.PREFIX = `UNVS${this.star?.namespace ? '-' + this.star.namespace : ''}-DSCVR`;
    this.BEAT_KEY = `${this.PREFIX}-BEAT:${this.star?.nodeID}|${this.instanceHash}`;
    this.INFO_KEY = `${this.PREFIX}-INFO:${this.star?.nodeID}`;

    // redis实例化
    if (this.options.cluster) {
      if (!this.options.cluster.nodes || this.options.cluster.nodes.length === 0) {
        throw new StarOptionsError('No nodes defined for cluster.');
      }
      this.client = new Redis.Cluster(this.options.cluster.nodes, this.options.cluster.options);
    } else {
      this.client = new Redis(this.options.redis);
    }

    this.client.on('connect', () => {
      // 日志
      this.logger?.info('Redis Discoverer client connected.');
      if (this.reconnecting) {
        this.reconnecting = false;
        // 重新发送本地节点信息
        this.sendLocalNodeInfo();
      }
    });

    this.client.on('error', (error) => {
      this.logger?.error(error);
      // 广播
      this.star?.broadcastLocal('$discoverer.error', {
        error,
        module: 'discoverer',
        type: C.CLIENT_ERROR
      });
    });

    if (this.options.monitor && isFunction((this.client as any).monitor)) {
      (this.client as any).monitor((error, monitor) => {
        this.logger?.debug('Redis Discoverer entering monitoring mode...');
        monitor.on('monitor', (time, args) => {
          this.logger?.debug(args);
        });
      });
    }

    this.serializer = S.resolve(this.options.serializer);
    if (!this.star) return;
    this.serializer?.init(this.star);

    this.logger?.debug('Redis Discoverer created. Prefix:', this.PREFIX);
  }
}
