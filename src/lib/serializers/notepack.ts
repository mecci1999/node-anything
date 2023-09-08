import { GenericObject } from '@/typings';
import { Star } from '../star';
import BaseSerializer from './base';
import notepack from 'notepack.io';

export default class NotePackSerializer extends BaseSerializer {
  public notepack: any;

  constructor() {
    super();
  }

  public init(star: Star): void {
    super.init(star);

    try {
      this.notepack = notepack;
    } catch (error) {
      this.star?.fatal(
        "The 'notepack.io' package is missing! Please install it with 'npm install notepack.io --save' command!",
        error,
        true
      );
    }
  }

  public serialize(obj: GenericObject, type: string): Buffer {
    const res = this.notepack.encode(obj);

    return res;
  }

  public deserialize(buf: Buffer, type: string): GenericObject {
    const res = this.notepack.decode(buf);

    return res;
  }
}
