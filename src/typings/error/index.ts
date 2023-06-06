/**
 * 错误类型枚举
 */
export enum UniverseErrorType {
  BAD_GETWAY = 'BAD_GETWAY', // 网关错误
  SERVICE_NOT_FOUND = 'SERVICE_NOT_FOUND', // 未发现对应服务错误
  SERVICE_NOT_AVAILABLE = 'SERVICE_NOT_AVAILABLE' // 服务不可用错误
}

/**
 * 错误码
 */
export enum UniverseErrorCode {
  RESPONSE_ERROR = 400,
  SERVICE_NOT_FOUND = 404,
  BAD_GETWAY = 502
}
