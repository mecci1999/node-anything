/**
 * 错误类型枚举
 */
export enum UniverseErrorType {
  BAD_GETWAY = 'BAD_GETWAY', // 网关错误
  SERVICE_NOT_FOUND = 'SERVICE_NOT_FOUND', // 未发现对应服务错误
  SERVICE_NOT_AVAILABLE = 'SERVICE_NOT_AVAILABLE', // 服务不可用错误
  REQUEST_TIMEOUT = 'REQUEST_TIMEOUT', // 服务请求超时
  REQUEST_SKIPPED = 'REQUEST_SKIPPED', // 服务请求完成前超时
  REQUEST_REJECTED = 'REQUEST_REJECTED', // 服务请求被拒绝
  QUEUE_FULL = 'QUEUE_FULL' // 当前操作队列已满
}

/**
 * 错误码
 */
export enum UniverseErrorCode {
  RESPONSE_ERROR = 400,
  SERVICE_NOT_FOUND = 404,
  QUEUE_FULL = 429,
  BAD_GETWAY = 502,
  REQUEST_REJECTED = 503,
  REQUEST_TIMEOUT = 504,
  REQUEST_SKIPPED = 514
}

/**
 * 错误数据
 */
export interface UniverseErrorData {
  nodeID?: string;
  action?: any;
  version?: string;
  service?: any;
}
