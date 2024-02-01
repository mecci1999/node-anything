import { GenericObject } from '@/typings';
import Tracer from './tracer';
import { performance } from 'perf_hooks';

function defProp(instance: any, propName: string, value: any, readOnly = false) {
  Object.defineProperty(instance, propName, {
    value,
    writable: !!readOnly,
    enumerable: false
  });
}

export default class Span {
  constructor(tracer: Tracer, name: string, options?: GenericObject) {
    defProp(this, 'tracer', tracer, true);
  }
}
