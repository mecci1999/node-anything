import { Star } from '@/lib/star';
import { DiscovererOptions } from '@/typings/registry/discoverers';
import _ from 'lodash';
import { Registry } from '../registry';
import { LoggerInstance } from '@/typings/logger';
import Transit from '@/lib/transit';
import Node from '../node';

/**
 * 服务发现基础类
 */
export default class BaseDiscoverer {
  public options: DiscovererOptions;
  public heartbeatTimer: NodeJS.Timeout | null; // 心跳定时器
  public checkNodesTimer: NodeJS.Timeout | null;
  public offlineTimer: NodeJS.Timeout | null;
  public localNode: Node | null; // 本地节点
  public star: Star | null = null;
  public registry: Registry | null = null;
  public logger: LoggerInstance | null = null;
  public transit: Transit | null = null;

  constructor(options?: DiscovererOptions) {
    this.options = _.defaultsDeep({}, options, {
      heartbeatInterval: null,
      heartbeatTimeout: null,
      disableHeartbeatChecks: false, // 默认开启心跳检查
      disableOfflineNodeRemoving: false, // 默认清除断开连接的节点
      cleanOfflineNodesTimeout: 10 * 60 // 默认每隔10分钟清除一遍断线的节点
    });

    // 定时器初始化
    this.heartbeatTimer = null; // 心跳定时器
    this.checkNodesTimer = null; // 检查节点定时器
    this.offlineTimer = null; // 断线检查定时器

    this.localNode = null;
  }

  // 初始化
  public init(registry: Registry) {
    this.registry = registry;
    this.star = registry.star;

    if (this.star) {
      this.logger = this.star.getLogger('Discovery');
      if (this.star.transit) this.transit = this.star.transit;

      if (this.options.heartbeatInverval === null) {
        this.options.heartbeatInverval = this.star.options.heartbeatInterval;
      }
      if (this.options.heartbeatTimeout === null) {
        this.options.heartbeatTimeout = this.star.options.heartbeatTimeout;
      }
    }

    if (this.transit) {
      this.star.localBus?.on('$transporter.connected', () => this.startHeartbeatTimers());
      this.star.localBus?.on('$transporter.disconnected', () => this.stopHeartbeatTimers());
    }
  }

  /**
   * 开始心跳
   */
  public startHeartbeatTimers() {
    // 停止当前的所有心跳
    this.stopHeartbeatTimers();

    if (this.options.heartbeatInverval && this.options.heartbeatInverval > 0) {
      // 心跳触发时间，random +/- 500ms
      const time = this.options.heartbeatInverval * 1000 + (Math.round(Math.random() * 1000) - 500);
      this.heartbeatTimer = setInterval(() => this.beat(), time);
      this.heartbeatTimer.unref();
      // 检查节点定时器
      this.checkNodesTimer = setInterval(() => this.checkRemoteNodes());
    }
  }

  /**
   * 停止心跳
   */
  public stopHeartbeatTimers() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.checkNodesTimer) {
      clearInterval(this.checkNodesTimer);
      this.checkNodesTimer = null;
    }

    if (this.offlineTimer) {
      clearInterval(this.offlineTimer);
      this.offlineTimer = null;
    }
  }

  /**
   * 停止动作
   */
  public stop() {
    this.stopHeartbeatTimers();

    return Promise.resolve();
  }

  /**
   * 心跳方法
   */
  public beat() {
    if (this.localNode) {
      // 检查节点cpu使用状态
      return this.localNode.updateLocalInfo(this.star?.getCpuUsage()).then(() => {
        this.sendHeartbeat();
      });
    }
  }

  /**
   * 检查服务节点是否移除
   */
  public checkRemoteNodes() {
    if (this.options.disableHeartbeatChecks) return;

    const now = Math.round(process.uptime());
    // this.registry;
  }

  /**
   * 发送一个心跳给节点
   */
  public sendHeartbeat() {
    if (!this.transit || !this.localNode) return Promise.resolve();
    return this.transit.sendHeartbeat(this.localNode);
  }
}
