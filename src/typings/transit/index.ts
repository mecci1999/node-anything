import Context from '@/lib/context';

export interface TransitRequest {
  action?: any;
  nodeID?: string;
  ctx?: Context;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  stream?: boolean; // 是否使用流
}

export interface StarTransitOptions {
  maxQueueSize?: number;
  disableReconnect?: boolean;
  disableVersionCheck?: boolean;
  maxChunkSize?: number;
}
