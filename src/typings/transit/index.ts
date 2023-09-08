export interface TransitRequest {
  action: string;
  nodeID: string;
  // ctx:
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  stream: boolean; // 是否使用流
}

export interface StarTransitOptions {
  maxQueueSize?: number;
  disableReconnect?: boolean;
  disableVersionCheck?: boolean;
  maxChunkSize?: number;
}
