/**
 * 数据校验模块
 */

import { isObject, isString } from '@/utils';
import { StarOptionsError } from '../error';
import BaseValidator from './base';
import FastestValidator from './fastest';
import { GenericObject } from '@/typings';
import { ValidatorNames, ValidatorOptions } from '@/typings/star';

const Validators = {
  Base: BaseValidator,
  Fastest: FastestValidator
};

function getByName(name: string) {
  if (!name) return null;

  let n = Object.keys(Validators).find((n) => n.toLowerCase() === name.toLowerCase());
  if (n) return Validators[n];
}

function resolve(options: boolean | BaseValidator | ValidatorNames | ValidatorOptions) {
  if (Object.prototype.isPrototypeOf.call(Validators.Base, options)) {
    return options;
  } else if (isString(options)) {
    let StrategyClass = getByName(options as string);
    if (StrategyClass) return StrategyClass;
    else throw new StarOptionsError(`Invalid strategy type '${options}'.`, { type: options as any });
  } else if (isObject(options)) {
    let StrategyClass = getByName((options as any)?.type || 'RoundRobin');
    if (StrategyClass) return StrategyClass;
    else
      throw new StarOptionsError(`Invalid strategy type '${(options as any)?.type}'.`, {
        type: (options as any)?.type
      });
  }

  return new Validators.Fastest((options as GenericObject).options || {});
}

function register(name: string, value: any) {
  Validators[name] = value;
}

export default Object.assign(Validators, { resolve, register });
