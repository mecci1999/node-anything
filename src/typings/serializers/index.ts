import { Star } from '@/lib/star';
import { GenericObject } from '..';

export class Serialize {
  constructor(options: any) {}
  init(star: Star): void {}
  serialize(obj: GenericObject, type?: string): Buffer | void {}
  deserialize(buf: Buffer, type?: string): GenericObject | void {}
}
