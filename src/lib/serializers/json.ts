import { GenericObject } from '@/typings';
import BaseSerializer from './base';

export default class JSONSerializer extends BaseSerializer {
  constructor() {
    super();
  }

  public serialize(obj: GenericObject, type: string): Buffer {
    return Buffer.from(JSON.stringify(obj));
  }

  public deserialize(buf: Buffer, type: string): GenericObject {
    return JSON.parse(buf.toString());
  }
}
