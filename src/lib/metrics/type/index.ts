import BaseMetric from './base';
import { StarOptionsError } from '@/lib/error';
import CounterMetric from './counter';
import GaugeMetric from './gauge';
import HistogramMetric from './histogram';
import InfoMetric from './info';

const Types = {
  Base: BaseMetric,
  Counter: CounterMetric,
  Gauge: GaugeMetric,
  Histogram: HistogramMetric,
  Info: InfoMetric
};

function getByName(name: string) {
  /* istanbul ignore next */
  if (!name) return null;

  let n = Object.keys(Types).find((n) => n.toLowerCase() == name.toLowerCase());
  if (n) return Types[n];
}

function resolve(type) {
  const TypeClass = getByName(type);
  if (!TypeClass) throw new StarOptionsError(`Invalid metric type '${type}'.`, { type });

  return TypeClass;
}

function register(name, value) {
  Types[name] = value;
}

export default Object.assign(Types, { resolve, register });
