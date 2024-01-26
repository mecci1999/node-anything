import { GenericObject } from '@/typings';
import { Registry } from '../registry';
import Star from '../star';
import BaseStrategy from './base';
import _, { random } from 'lodash';
import Node from '../registry/node';
import Context from '../context';
import Endpoint from '../registry/endpoint/item';

/**
 * 延迟策略
 * 选择延迟最低的服务节点用作处理请求，从而达到快速响应的目的
 */
export default class LatencyStrategy extends BaseStrategy {
  public starStopped: boolean;
  public hostAvgLatency: Map<any, any>; // 每个主机的平均延迟
  public hostMap: Map<any, any>; // 主机

  constructor(registry: Registry, star: Star, options?: GenericObject) {
    super(registry, star, options);

    this.options = _.defaultsDeep(options, {
      sampleCount: 5,
      lowLatency: 10,
      collectCount: 5,
      pingInterval: 10
    });
    this.starStopped = false;
    this.hostAvgLatency = new Map();
    this.hostMap = new Map();

    if (!this.star.transit) return;

    if (this.star.localBus?.listenerCount('$node.latencyMaster') === 0) {
      // 第一次
      this.star.localBus?.on('$node.latencyMaster', () => {});
      this.star.localBus?.on('$node.pong', this.processPong.bind(this));
      this.star.localBus?.on('$node.connected', this.addNode.bind(this));
      this.star.localBus?.on('$node.disconnected', this.removeHostMap.bind(this));
      this.star.localBus?.on('$star.started', this.discovery.bind(this));
      this.star.localBus?.on('$star.stopped', () => (this.starStopped = true));
    } else {
      this.star.localBus?.on('$node.latencySlave.removeHost', this.removeHostLatecy.bind(this));
    }

    this.star.localBus?.on('$node.latencySlave', this.updateLatency.bind(this));
  }

  /**
   * 发现节点
   */
  private discovery() {
    return (
      this.star.transit &&
      this.star.transit.sendPing().then(() => {
        const timer = setTimeout(() => this.pingHosts(), 1000 * this.options.pingInterval);
        timer.unref();
      })
    );
  }

  /**
   * ping主机动作
   */
  private pingHosts() {
    if (this.starStopped) return;

    const hosts = Array.from(this.hostMap.values());

    return Promise.all(
      hosts.map((host) => {
        // 从主机中随机挑选一个节点，发送ping请求
        const nodeID = host.nodeList[random(0, host.nodeList.length - 1)];

        return this.star.transit?.sendPing(nodeID);
      })
    );
  }

  /**
   * 获取节点信息
   */
  private getHostLatency(node: Node) {
    let info = this.hostMap.get(node.hostname);
    if (typeof info === 'undefined') {
      info = {
        historicLatency: [], // 记录每个节点的延迟时间
        nodeList: [node.id]
      };
      // 设置主机
      this.hostMap.set(node.hostname, info);
    }

    return info;
  }

  /**
   * 处理ping节点
   * @param payload
   * @returns
   */
  private processPong(payload: any) {
    let node = this.registry.nodes?.get(payload.nodeID);
    if (!node) return;

    // 获取节点信息
    let info = this.getHostLatency(node);
    // 判断是否超出限制
    if (info.historicLatency && info.historicLatency?.length > this.options.collectCount - 1) {
      (info.historicLatency as Array<any>).shift();
    }
    (info.historicLatency as Array<any>).push(payload.elapsedTime);
    // 平均延迟时间
    const avgLatency =
      (info.historicLatency as Array<any>).reduce((sum, latency) => sum + latency, 0) / info.historicLatency.length;
    // 事件通知，保存节点数据
    this.star.localBus?.emit('$node.latencySlave', {
      hostname: node.hostname,
      avgLatency: avgLatency
    });
  }

  /**
   * 添加节点
   */
  public addNode(payload: any) {
    let node = payload.node;
    if (!node) return;
    let info = this.getHostLatency(node);
    if (info?.nodeList && info.nodeList.indexOf(node.id) === -1) {
      info.nodeList.push(node.id);
    }
  }

  /**
   * 移除节点
   */
  public removeHostMap(payload: any) {
    let node = payload.node;
    let info = this.hostMap.get(node.hostname);
    if (!info) return;
    info.nodeList = info.nodeList.filter((id: string) => id !== node.id);
    if (info.nodeList.length === 0) {
      this.star.localBus?.emit('$node.latencySlave.removeHost', node.hostname);
      this.hostMap.delete(node.hostname);
    }
  }

  private removeHostLatecy(hostname: string) {
    this.hostAvgLatency.delete(hostname);
  }

  /**
   * 更新延迟时间
   */
  private updateLatency(payload: any) {
    this.hostAvgLatency.set(payload.hostname, payload.avgLatency);
  }

  /**
   * 通过网络延迟选择一个端点
   */
  public select(list: Endpoint[], ctx?: Context | undefined): Endpoint {
    let minEndpoint: Endpoint | null = null;
    let minLatency: number | null = null;
    const sampleCount = this.options.sampleCount;
    const count = sampleCount <= 0 || sampleCount > list.length ? list.length : sampleCount;

    for (let i = 0; i < count; i++) {
      let endpoint: Endpoint;
      if (count === list.length) {
        endpoint = list[i];
      } else {
        endpoint = list[random(0, list.length - 1)];
      }
      // 获得该节点的延迟时间
      const endpointLatency = this.hostAvgLatency.get(endpoint.node.hostname);
      if (typeof endpointLatency !== 'undefined') {
        // 如果延迟低于设置的最低延迟时间，直接返回该节点
        if (endpointLatency < this.options.lowLatency) return endpoint;

        if (!minEndpoint || !minLatency || endpointLatency < minLatency) {
          minLatency = endpointLatency;
          minEndpoint = endpoint;
        }
      }
    }

    if (minEndpoint) return minEndpoint;

    // 没有找到最低延迟的节点，则兜底随机选择一个节点
    return list[random(0, list.length - 1)];
  }
}
