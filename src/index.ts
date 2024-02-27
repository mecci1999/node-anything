import C from './lib/star/constants';
import Star from './lib/star';
import Loggers from './lib/logger';
import Service from './lib/star/service';
import Context from './lib/context';
import Cachers from './lib/cachers';
import Transporters from './lib/transporters';
import Serializers from './lib/serializers';
import Strategies from './lib/strategies';
import { MetricRegistry, METRIC, Reporters } from './lib/metrics';
import Transit from './lib/transit';
import { Registry } from './lib/registry';
import Discoverers from './lib/registry/discoverers';
import Middleware from './lib/middleware';
import Errors from './lib/error/error';
import Validators from './lib/validators';
import TracerExporters from './lib/tracing/exporters';

export default {
  Star,
  Loggers,
  Service,
  Context,
  Cachers,
  Transporters,
  Serializers,
  Strategies,
  Validators,
  TracerExporters,
  MetricRegistry,
  METRIC,
  Reporters,
  Transit,
  Registry,
  Discoverers,
  Middleware,
  Errors,

  CIRCUIT_CLOSE: C.CIRCUIT_CLOSE,
  CIRCUIT_HALF_OPEN: C.CIRCUIT_HALF_OPEN,
  CIRCUIT_HALF_OPEN_WAIT: C.CIRCUIT_HALF_OPEN_WAIT,
  CIRCUIT_OPEN: C.CIRCUIT_OPEN,

  MOLECULER_VERSION: Star.UNIVERSE_VERSION,
  PROTOCOL_VERSION: Star.PROTOCOL_VERSION,
  INTERNAL_MIDDLEWARES: Star.INTERNAL_MIDDLEWARES
};
