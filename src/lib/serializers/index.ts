import { isObject, isString, isInheritedClass } from '@/utils';
import BaseSerializer from './base';
import { StarOptionsError } from '../error';
import JSONSerializer from './json';
import CborSerializer from './cbor';
import NotePackSerializer from './notepack';

const Serializers = {
  Base: BaseSerializer,
  JSON: JSONSerializer,
  Cbor: CborSerializer,
  NotePack: NotePackSerializer
};

/**
 * 根据名称获取对应的类型实例
 * @param name 选择模块的名称
 */
function getByName(name: string) {
  if (!name) return null;

  let instanceName = Object.keys(Serializers).find((item) => item.toLocaleLowerCase() === name.toLocaleLowerCase());
  if (instanceName) return Serializers[instanceName];
}

function resolve(options: object | string) {
  if (isObject(options) && isInheritedClass(options as object, Serializers.Base)) {
    return options;
  } else if (isString(options)) {
    let SerializerClass = getByName(options as string);
    if (SerializerClass) return new SerializerClass();
  } else if (isObject(options)) {
    let SerializerClass = getByName((options as any).type || 'JSON');
    if (SerializerClass) {
      return new SerializerClass((options as any).options);
    } else {
      throw new StarOptionsError(`Invalid serializer type ${(options as any).type}.`, { type: (options as any).type });
    }
  }

  return new Serializers.JSON();
}

function register(name: string, value: any) {
  Serializers[name] = value;
}

export default Object.assign(Serializers, { resolve, register });
