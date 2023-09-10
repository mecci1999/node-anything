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
      heartbeatInterval: null, // 默认5分钟
      heartbeatTimeout: null, // 心跳时间间隔 默认5分钟
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
        this.options.heartbeatInverval = this.star.options.heartbeatInterval || 5 * 60;
      }
      if (this.options.heartbeatTimeout === null) {
        this.options.heartbeatTimeout = this.star.options.heartbeatTimeout || 5 * 60;
      }
    }

    if (this.transit) {
      this.star.localBus?.on('$transporter.connected', () => this.startHeartbeatTimers());
      this.star.localBus?.on('$transporter.disconnected', () => this.stopHeartbeatTimers());
    }
    this.localNode = this.registry.nodes.localNode;

    // 注册性能数据
    this.registerUniverseMetrics();
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
      // 心跳定时器
      this.heartbeatTimer = setInterval(() => this.beat(), time);
      this.heartbeatTimer.unref();
      // 检查节点定时器
      this.checkNodesTimer = setInterval(
        () => this.checkRemoteNodes(),
        (this.options.heartbeatTimeout || 5 * 60) * 1000
      );
      this.checkNodesTimer.unref();
      // 检查节点是否断线定时器
      this.offlineTimer = setInterval(() => this.checkOfflineNodes(), 60 * 1000); // 一分钟一次
      this.offlineTimer.unref();
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
   * 注册性能指标
   */
  public registerUniverseMetrics() {
    // Not implemented
  }

  /**
   * 心跳方法
   */
  public beat() {
    if (this.localNode) {
      // 检查节点cpu使用状态
      return this.localNode.updateLocalInfo(this.star?.getCpuUsage()).then(() => this.sendHeartbeat());
    }
  }

  /**
   * 检查服务节点是否移除
   */
  public checkRemoteNodes() {
    if (this.options.disableHeartbeatChecks) return;
    // 获取现在时间
    const now = Math.round(process.uptime());
    this.registry?.nodes.toArray().forEach((node) => {
      if (node.local || !node.available) return;
      if (!node.lastHeartbeatTime) {
        node.lastHeartbeatTime = now;
        return;
      }
      if (now - node.lastHeartbeatTime > (this.options.heartbeatTimeout as number)) {
        this.logger?.warn(`Heartbeat is not received from '${node.id}' node.`);
        this.registry?.nodes.disconnected(node.id, true);
      }
    });
  }

  /**
   * 检查断线节点
   */
  public checkOfflineNodes() {
    if (this.options.disableOfflineNodeRemoving || !this.options.cleanOfflineNodesTimeout) return;
    // 获取当前时间
    const now = Math.round(process.uptime());
    this.registry?.nodes.toArray().forEach((node) => {
      if (node.local || node.available) return;
      if (!node.lastHeartbeatTime) {
        // 不存在上次心跳的时间
        node.lastHeartbeatTime = now;
        return;
      }
      if (now - node.lastHeartbeatTime > (this.options.cleanOfflineNodesTimeout as number)) {
        // 距离上一次心跳检查的时间超过了配置的最大时间
        this.logger?.warn(
          `Removing offline '${node.id}' node from registry because it hasn't submitted heartbeat signal for ${this.options.cleanOfflineNodesTimeout} minutes.`
        );
        // 清除该节点
        this.registry?.nodes.delete(node.id);
      }
    });
  }

  /**
   * 接收一个远程节点的心跳
   */
  public heartbeatReceived(nodeID: string, payload: any) {
    // 获取注册的节点
    const node = this.registry?.nodes.get(nodeID);
    if (node) {
      // 检查节点是否有效
      if (!node.available) {
        // 重新连接节点，请求一个新的信息
        this.discoverNode(nodeID);
      } else {
        if (payload.seq !== null && node.seq !== payload.seq) {
          // 远程节点的服务发生改变
          this.discoverNode(nodeID);
        } else if (payload.instanceID !== null && !node.instanceID?.startsWith(payload.instanceID)) {
          // 远程节点重启
          this.discoverNode(nodeID);
        } else {
          node.heartbeat(payload);
        }
      }
    } else {
      this.discoverNode(nodeID);
    }
  }

  /**
   * 发送一个心跳给节点
   */
  public sendHeartbeat() {
    if (!this.transit || !this.localNode) return Promise.resolve();
    return this.transit.sendHeartbeat(this.localNode);
  }

  /**
   * 接收一个远程节点的信息
   */
  public processRemoteNodeInfo(nodeID: string, payload: any) {
    return this.star && this.star.registry && this.star.registry.processNodeInfo(payload);
  }

  /**
   * 本地节点断开链接
   */
  public localNodeDisconnected() {
    if (!this.transit) return Promise.resolve();

    return this.transit.sendDisconnectPacket();
  }

  /**
   * 当一个远程节点断开链接，你可以用该方法清除本地注册
   */
  public remoteNodeDisconnected(nodeID: string, isUnexpected: boolean) {
    return this.registry?.nodes.disconnected(nodeID, isUnexpected);
  }

  /**
   * 发现节点的方法
   */
  public discoverNode(nodeID?: string) {
    throw new Error('Not implemented');
  }

  /**
   * 发现所有节点的方法
   */
  public discoverAllNodes() {
    throw new Error('Not implemented');
  }

  /**
   * 本地服务注册发生改变，需要通知远程节点
   */
  public sendLocalNodeInfo(nodeID?: string) {
    throw new Error('Not implemented');
  }
}
