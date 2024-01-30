import { GenericObject } from '@/typings';
import _ from 'lodash';
import { UniverseError } from '../error';

export default class Node {
  public id: string;
  public instanceID: string | null;
  public available: boolean; // 状态是否正常
  public local: boolean;
  public lastHeartbeatTime: number; // 最近一次心跳运行时间
  public config: GenericObject; // 配置项
  public client: GenericObject;
  public metadata: any;
  public ipList: any; // ip
  public port: number | null; // 端口
  public hostname: string | null; // 主域名
  public udpAddress: string | null; // udp地址
  public rawInfo: any;
  public services: Array<any>;
  public cpu: any;
  public cpuSeq: any;
  public seq: number;
  public offlineSince: any;

  constructor(id: string) {
    this.id = id;
    this.instanceID = null;
    this.available = true;
    this.local = false;
    this.lastHeartbeatTime = Math.round(process.uptime());
    this.config = {};
    this.client = {};
    this.ipList = null;
    this.port = null;
    this.hostname = null;
    this.udpAddress = null;
    this.rawInfo = null;
    this.services = [];
    this.cpu = null;
    this.cpuSeq = null;
    this.seq = 0;
    this.offlineSince = null;
  }

  /**
   * 更新节点信息
   */
  public update(payload: GenericObject, isReconnected: boolean) {
    this.metadata = payload.metadata;
    this.ipList = payload.ipList;
    this.hostname = payload.hostname;
    this.port = payload.port;
    this.client = payload.client || {};
    this.config = payload.config || {};
    this.services = _.cloneDeep(payload.services);
    this.rawInfo = payload;

    const newSeq = payload.seq || 1;
    if (newSeq > this.seq || isReconnected || payload.instanceID !== this.instanceID) {
      this.instanceID = payload.instanceID;
      this.seq = newSeq;
      return true;
    }
  }

  /**
   * 更新节点回调
   */
  public updateLocalInfo(cpuUsage: any): Promise<any> {
    if (!cpuUsage) {
      return Promise.reject(new UniverseError('registry module unpdateLocalInfo error, cpuUsage is not function.'));
    }

    return cpuUsage()
      .then((res) => {
        const newVal = Math.round(res.avg);
        if (this.cpu != newVal) {
          this.cpu = newVal;
          this.cpuSeq++;
        }
      })
      .catch((error) => {
        console.error(error);
      });
  }

  /**
   * 心跳
   */
  public heartbeat(payload: GenericObject) {
    // 收到心跳，更新节点状态
    if (!this.available) {
      this.available = true;
      this.offlineSince = null;
    }

    if (payload.cpu != null) {
      this.cpu = payload.cpu;
      this.cpuSeq = payload?.cpuSeq || 1;
    }

    this.lastHeartbeatTime = Math.round(process.uptime());
  }

  /**
   * 断开连接
   */
  public disconnected() {
    if (this.available) {
      this.offlineSince = Math.round(process.uptime());
      this.seq++;
    }

    this.available = false;
  }
}
