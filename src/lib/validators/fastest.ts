import { GenericObject } from '@/typings';
import BaseValidator from './base';
import _ from 'lodash';
import Validator from 'fastest-validator';
import { ValidationError } from '../error';

export default class FastestValidator extends BaseValidator {
  public validator: Validator;

  constructor(options: GenericObject) {
    super(options);

    this.validator = new Validator(this.options);
  }

  public compile(schema: any) {
    return this.validator.compile(_.cloneDeep(schema));
  }

  public validate(params: any, schema: any) {
    const res = this.validator.validate(params, _.cloneDeep(schema));

    if (res !== true) {
      throw new ValidationError('Parameters validation error!', undefined, res as any);
    }

    return true;
  }

  public convertSchemaToUniverse(schema: any) {
    return schema;
  }
}
