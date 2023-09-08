import BaseStrategy from './base';
import CpuUsageStrategy from './cpu-usage';
import LatencyStrategy from './latency';
import RandomStrategy from './random';
import RoundRobinStrategy from './round-robin';
import ShardStrategy from './shard';
import { isObject, isString } from '@/utils';
import { StarOptionsError } from '../error';

/**
 * 通信策略模块
 */
const Strategies = {
  Base: BaseStrategy,
  RoundRobin: RoundRobinStrategy,
  Random: RandomStrategy,
  CpuUsage: CpuUsageStrategy,
  Latency: LatencyStrategy,
  Shard: ShardStrategy
};

/**
 * 根据名称获取对应的类型实例
 * @param name 选择模块的名称
 */
function getByName(name: string) {
  if (!name) return null;

  let instanceName = Object.keys(Strategies).find((item) => item.toLocaleLowerCase() === name.toLocaleLowerCase());
  if (instanceName) return Strategies[instanceName];
}

function resolve(options: object | string) {
  if (Object.prototype.isPrototypeOf.call(Strategies.Base, options)) {
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

  return Strategies.RoundRobin;
}

function register(name: string, value: any) {
  Strategies[name] = value;
}

export default Object.assign(Strategies, { resolve, register });
