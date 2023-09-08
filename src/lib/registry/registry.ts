import { LoggerInstance } from '@/typings/logger';
import { Star } from '../star';
import { GenericObject } from '@/typings';
import Discoverers from './discoverers';
import Node from './node';
import NodeCatalog from './catalogs/node';
import { Discoverer } from '@/typings/registry/discoverers';
import BaseStrategy from '../strategies/base';
import Strategies from '../strategies';
import EventCatalog from './catalogs/event';
import ActionCatalog from './catalogs/action';
import ServiceCatalog from './catalogs/service';
import Service from '../star/service';
import _ from 'lodash';
import ServiceItem from './service-item';

/**
 * 服务注册模块
 */
export class Registry {
  public star: Star;
  public logger: LoggerInstance;
  public StrategyFactory: typeof BaseStrategy;
  public discoverer: Discoverer;
  public options: GenericObject;
  public localNodeInfoInvalidated: boolean;
  public nodes: NodeCatalog;
  public services: ServiceCatalog;
  public actions: ActionCatalog;
  public events: EventCatalog;

  constructor(star: Star) {
    this.star = star;
    this.logger = star.getLogger('registry');

    this.options = Object.assign({}, star.options.registry);

    // 通信策略
    this.StrategyFactory = Strategies.resolve(this.options.strategy);
    this.logger.info(`Strategy: ${this.StrategyFactory.name}`);

    // 服务发现模块
    this.discoverer = Discoverers.resolve(this.options.discoverer);
    this.logger.info(`Discoverer: ${this.star.getConstructorName(this.discoverer)}`);

    this.localNodeInfoInvalidated = true;

    this.nodes = new NodeCatalog(this, star);
    this.services = new ServiceCatalog(this, star);
    this.actions = new ActionCatalog(this, star, this.StrategyFactory);
    this.events = new EventCatalog(this, star, this.StrategyFactory);

    // 注册性能指标服务
  }

  /**
   * 初始化
   */
  public init() {
    this.discoverer.init(this);
  }

  /**
   * 停止
   */
  public stop() {
    return this.discoverer.stop();
  }

  /**
   * 注册本地服务
   */
  public registerLocalService(service: ServiceItem) {
    if (!this.star.nodeID || !this.nodes.localNode) return;

    if (!this.services.has(service.fullName, this.star.nodeID)) {
      const serviceItem = this.services.add(this.nodes.localNode, service, true);

      if (serviceItem.actions) this.registerActions(this.nodes.localNode, serviceItem, service.actions);
    }
  }

  /**
   * 注册动作
   */
  public registerActions(node: Node, service: ServiceItem, actions: any) {
    _.forIn(actions, (action) => {
      if (!this.checkActionVisibility(action, node)) return;

      if (node.local) {
        action.handler = this.star.middlewares;
      }
    });
  }

  /**
   * 检查动作是否可见
   */
  public checkActionVisibility(action: any, node: Node) {
    if (action.visibility == null || action.visibility == 'published' || action.visibility == 'public') return true;

    if (action.visibility == 'protected' && node.local) return true;

    return false;
  }

  /**
   * 通过nodeID找到动作端口
   */
  public getActionEndpointByNodeId(actionName: string, nodeID: string) {
    // 找到该动作的所有端口列表
    const list = this.actions.get(actionName);
    if (list) return list.getEndpointByNodeID(nodeID);
  }

  /**
   * 通过动作名找到所有的端口
   */
  public getActionEndpoints(actionName: string) {
    return this.actions.get(actionName);
  }
}
