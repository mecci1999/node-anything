import BaseDiscoverer from '@/lib/registry/discoverers/base';
import { GenericObject } from '@/typings';

export interface DiscovererOptions extends GenericObject {
  heartbeatInterval?: number; // 心跳的时间间隔
  heartbeatTimeout?: number; // 心跳超时的时间
  disableHeartbeatChecks?: boolean; // 禁止使用心跳检查
  disableOfflineNodeRemoving?: boolean; // 禁止断开连接的节点移除
  cleanOfflineNodesTimeout?: number; // 清除断开连接节点的时间
}

export class Discoverer extends BaseDiscoverer {}
