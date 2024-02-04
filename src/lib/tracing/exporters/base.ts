import { GenericObject } from '@/typings';
import _ from 'lodash';
import Tracer from '../tracer';
import { LoggerInstance } from '@/typings/logger';
import Star from '@/lib/star';
import Span from '../span';
import { isObject, safetyObject } from '@/utils';

export default class BaseTraceExporter {
  public options: GenericObject;
  public tracer: Tracer | null = null;
  public logger: LoggerInstance | null = null;
  public star: Star | null = null;

  constructor(options?: GenericObject) {
    this.options = _.defaultsDeep(options, { safetyTags: false });
  }

  public init(tracer: Tracer) {
    this.tracer = tracer;
    this.star = tracer.star;
    this.logger = this.options.logger || this.tracer.logger;
  }

  /**
   * 停止追踪
   */
  public stop() {
    // Not implemented
  }

  public spanStarted(span: Span) {
    // Not implemented
  }

  public spanFinished(span: Span) {
    // Not implemented
  }

  /**
   * 扁平化一个对象为一级对象
   * 举例：
   * ```js
   * 	{
   * 		error: {
   * 			name: "MoleculerError"
   * 		}
   * 	}
   *  ```
   *
   * 	**To:**
   * 	```js
   *  {
   * 		"error.name": "MoleculerError"
   *  }
   */
  public flattenTags(obj: GenericObject | null, convertToString: boolean = false, path: string = '') {
    if (!obj) return null;

    if (this.options.safetyTags) {
      obj = safetyObject(obj);
    }

    return Object.keys(obj as GenericObject).reduce((res, key) => {
      const value = (obj as GenericObject)[key];
      const p = (path ? path + '.' : '') + key;

      if (isObject(value)) {
        Object.assign(res, this.flattenTags(value, convertToString, p));
      } else if (value !== undefined) {
        res[p] = convertToString ? String(value) : value;
      }

      return res;
    }, {});
  }

  public errorToObject(error: Error | boolean | null) {
    if (!error) return null;

    return _.pick(error, this.tracer?.options.errorFields);
  }
}
