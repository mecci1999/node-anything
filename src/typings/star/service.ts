import { GenericObject } from '..';
import { CallingOptions } from '../context';

export type ServiceAction = <T = Promise<any>, P extends GenericObject = GenericObject>(
  params?: P,
  options?: CallingOptions
) => T;

export interface ServiceActions {
  [name: string]: ServiceAction;
}

/**
 * 服务搜索对象
 */
export interface ServiceSearchObj {
  name: string; // 服务名
  version?: string | number; // 服务版本
}
