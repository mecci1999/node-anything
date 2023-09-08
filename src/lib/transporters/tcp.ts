import { GenericObject } from '@/typings';
import BaseTransporter from './base';
import { isString } from '@/utils';

export default class TcpTransporter extends BaseTransporter {
  constructor(options: GenericObject) {
    if (isString(options)) options = { urls: options };

    super(options);

    this.options = Object.assign(
      {
        // UDP 相关的选项
        udpDiscovery: true,
        udpPort: 4445,
        udpBindAddress: null,
        udpPeriod: 30,
        udpReuseAddr: true,
        udpMaxDiscovery: 0, // 0 - No limit

        // Multicast settings
        udpMulticast: '239.0.0.0',
        udpMulticastTTL: 1,

        // Broadcast settings
        udpBroadcast: false,

        // TCP options
        port: null, // random port,
        urls: null, // Remote node addresses (when UDP discovery is not available)
        useHostname: true,

        gossipPeriod: 2, // seconds
        maxConnections: 32, // Max live outgoing TCP connections
        maxPacketSize: 1 * 1024 * 1024
      },
      options
    );
  }
}
