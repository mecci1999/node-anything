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
import { safetyObject } from '@/utils';

/**
 * 服务注册模块
 */
export class Registry {
  public star: Star;
  public logger: LoggerInstance;
  public StrategyFactory: typeof BaseStrategy;
  public discoverer: Discoverer;
  public options: GenericObject;
  public localNodeInfoInvalidated: boolean | string;
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
   * 注册动作
   */
  public registerActions(node: Node, service: ServiceItem, actions: any) {
    _.forIn(actions, (action) => {
      // 检查动作是否可见
      if (!this.checkActionVisibility(action, node)) return;

      if (node.local) {
        // 本地节点
        action.handler = this.star.middlewares?.wrapHandler('localAction', action.handler, action);
      } else if (this.star.transit) {
        // 远程节点
        action.handler = this.star.middlewares?.wrapHandler(
          'remoteAction',
          this.star.transit.request.bind(this.star.transit),
          { ...action, service }
        );
      }

      if (this.star.options.disableBalancer && this.star.transit) {
        action.remoteHandler = this.star.middlewares?.wrapHandler(
          'remoteAction',
          this.star.transit.request.bind(this.star.transit),
          { ...action, service }
        );
      }

      this.actions.add(node, service, action);
      service.addAction(action);
    });
  }

  /**
   * 注册事件
   */
  public registerEvents(node: Node, service: ServiceItem, events: any) {
    _.forIn(events, (event) => {
      if (node.local) {
        // 事件处理器
        event.handler = this.star.middlewares?.wrapHandler('localEvent', event.handler, event);
        this.events.add(node, service, event);
        service.addEvent(event);
      }
    });
  }

  /**
   * 注册本地服务
   */
  public registerLocalService(service: ServiceItem) {
    if (!this.star.nodeID || !this.nodes.localNode) return;

    if (!this.services.has(service.fullName, this.star.nodeID)) {
      const serviceItem = this.services.add(this.nodes.localNode, service, true);

      // 注册动作
      if (service.actions) this.registerActions(this.nodes.localNode, serviceItem, service.actions);
      // 注册事件
      if (service.events) this.registerEvents(this.nodes.localNode, serviceItem, service.events);

      this.nodes.localNode.services.push(serviceItem);
      this.localNodeInfoInvalidated = 'seq';
      this.logger.info(`'${service.name}' service is registered.`);
      this.star.servicesChanged(true);
      // 注册性能数据
    }
  }

  /**
   * 注册服务
   */
  public registerServices(node: Node, serviceList: Array<Service>) {
    serviceList.forEach((item) => {
      if (!item.fullName) {
        // 获取名字
        item.fullName = Service.getVersionedFullName(item.name, item.version);
      }
      let prevActions: any, prevEvents: any;
      // 获取服务
      let service = this.services.get(item.fullName, node.id);
      if (!service) {
        service = this.services.add(node, item, false);
      } else {
        prevActions = Object.assign({}, service.actions);
        prevEvents = Object.assign({}, service.events);
        service.update(item);
      }

      // 注册动作
      if (item.actions) {
        this.registerActions(node, service, item.actions);
      }

      if (prevActions) {
        _.forIn(prevActions, (action, name) => {
          if (!item.actions || !item.actions[name]) {
            // 取消订阅动作
            this.unregisterAction(node, name);
          }
        });
      }

      if (item.events) {
        this.registerEvents(node, service, item.actions);
      }

      if (prevEvents) {
        _.forIn(prevEvents, (event, name) => {
          if (!item.events || item.events[name]) {
            this.unregisterEvent(node, name);
          }
        });
      }
    });
  }

  /**
   * 取消订阅服务通过nodeID
   */
  public unregisterServicesByNode(nodeID: string) {
    this.services.removeAllByNodeID(nodeID);
  }

  /**
   * 取消订阅动作
   */
  public unregisterAction(node: Node, actionName: string) {
    this.actions.remove(actionName, node.id);
  }

  /**
   * 取消订阅事件
   */
  public unregisterEvent(node: Node, eventName: string) {
    this.events.remove(eventName, node.id);
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

  /**
   * 处理一个节点的数据包
   */
  public processNodeInfo(payload: any) {
    return this.nodes.processNodeInfo(payload);
  }

  /**
   * 生成本地本地节点信息
   */
  public regenerateLocalRawInfo(incSeq?: boolean, isStopping?: boolean) {
    let node = this.nodes.localNode;
    if (incSeq && node?.seq) node.seq++;

    const rawInfo = _.pick(node, ['ipList', 'hostname', 'instanceID', 'client', 'config', 'port', 'seq', 'metadata']);
    if (!isStopping && (this.star.started || incSeq)) {
      rawInfo.services = this.services.getLocalNodeServices();
    } else {
      rawInfo.services = [];
    }
    if (!node?.rawInfo) return;
    node.rawInfo = safetyObject(rawInfo, this.star.options);

    return node.rawInfo;
  }

  /**
   * 获得本地节点信息
   */
  public getLocalNodeInfo(force?: boolean) {
    if (force || !this.nodes.localNode?.rawInfo || this.localNodeInfoInvalidated) {
      const res = this.regenerateLocalRawInfo(this.localNodeInfoInvalidated == 'seq');
      this.logger.debug('Local Node info regenerated.');
      this.localNodeInfoInvalidated = false;
      return res;
    }

    return this.nodes.localNode.rawInfo;
  }
}
