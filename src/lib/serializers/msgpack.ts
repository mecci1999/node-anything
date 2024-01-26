// import { GenericObject } from '@/typings';
// import Star from '../star';
// import BaseSerializer from './base';
// import msgpack5 from 'msgpack5';

// export default class MsgPackSerializer extends BaseSerializer {
//   public msgpack: any = null;

//   constructor() {
//     super();
//   }

//   public init(star: Star) {
//     super.init(star);

//     try {
//       this.msgpack = msgpack5();
//     } catch (error) {
//       this.star?.fatal(
//         `The msgpack5 package is missing! Please install it with 'npm install msgpack5 --save' command`,
//         error,
//         true
//       );
//     }
//   }

//   /**
//    * 将对象序列化转换为二进制流
//    * @param obj
//    * @param type
//    * @returns {Buffer}
//    */
//   public serialize(obj: GenericObject, type: string): Buffer {
//     const res = this.msgpack.encode(obj);

//     return res;
//   }

//   /**
//    * 将二进制流反序列化转换为
//    */
//   public deserialize(buf: Buffer, type: string): GenericObject {
//     const res = this.msgpack.decode(buf);

//     return res;
//   }
// }
