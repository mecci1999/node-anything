import { GenericObject } from '..';
import { CallingOptions } from '../context';

export type ServiceAction = <T = Promise<any>, P extends GenericObject = GenericObject>(
  params?: P,
  options?: CallingOptions
) => T;

export interface ServiceActions {
  [name: string]: ServiceAction;
}
