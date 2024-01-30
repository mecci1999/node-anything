// import { NatsConnection, connect } from 'nats';

// const nat1 = connect({ name: 'nats1', port: 4222 });
// const nat2 = connect({ name: 'nats2', port: 4222 });

// ///////////////////////////////////////
// // Publish/Subscribe Performance
// ///////////////////////////////////////

// let loop: number = 50000;
// let hash: number = 2500;

// console.log('Publish/Subscribe Performance Test');

// nat1.then((nc1: NatsConnection) => {
//   // 发布-订阅模式 单向
//   const work1 = () => {
//     let received = 0; // 接收次数
//     let start = new Date().getTime(); // 开始时间

//     // 订阅
//     let sid = nc1.subscribe('test', {
//       callback: () => {
//         received += 1;
//         if (received === loop) {
//           let stop = new Date().getTime();
//           let mps = parseInt(`${loop / ((stop - start) / 1000)}`);
//           console.log('\nPublished/Subscribe at ' + mps + ' msgs/sec', `消耗总时间：${(stop - start) / 1000}s`);
//           console.log('Received ' + received + ' messages');
//           // 取消订阅
//           sid.unsubscribe();
//           // setImmediate(work1);
//         }
//       }
//     });

//     nc1.flush().then(() => {
//       for (let i = 0; i < loop; i++) {
//         nat2.then((nc2) => {
//           nc2.publish('test', undefined, { reply: 'ok' });
//           if (i % hash === 0) {
//             process.stdout.write('+');
//           }
//         });
//       }
//     });
//   };

//   // 发布-订阅模式 双向
//   const work2 = () => {
//     let received = 0; // 接收次数
//     let start = new Date().getTime(); // 开始时间

//     nc1.subscribe('ping', {
//       callback: () => {
//         console.log(`我是nat2发的第${received}条消息`);
//         nc1.publish('pong', undefined, { reply: `ok` });
//       }
//     });

//     nc1.flush().then(() => {
//       nat2.then((nc2) => {
//         const doWork = () => {
//           nc2.publish('ping', undefined, { reply: `ok` });
//         };

//         nc2.subscribe('pong', {
//           callback: () => {
//             received += 1;
//             console.log(`我是nat1发的第${received}条消息`);
//             if (received >= loop) {
//               let stop = new Date().getTime();
//               let mps = parseInt(`${loop / ((stop - start) / 1000)}`);
//               console.log('\nPublished/Subscribe at ' + mps + ' msgs/sec', `消耗总时间：${(stop - start) / 1000}s`);
//               console.log('Received ' + received + ' messages');
//               received = 0;
//               start = new Date().getTime();
//             }
//             doWork();
//           }
//         });

//         nc2.flush().then(() => {
//           doWork();
//         });
//       });
//     });
//   };

//   // 请求-响应模式
//   const work3 = () => {
//     let received = 0; // 接收次数
//     let start = new Date().getTime(); // 开始时间

//     const sid = nc1.subscribe('test', {
//       callback: (error, msg) => {
//         nc1.publish(msg.reply || 'reply', undefined, { reply: 'ok' });
//       }
//     });

//     // Make sure sub is registered
//     nc1.flush().then(() => {
//       for (let i = 0; i < loop; i++) {
//         nat2.then((nc2) => {
//           nc2.request('test', undefined, { timeout: 10000, reply: 'reply', noMux: true }).then((msg) => {
//             received += 1;
//             console.log(`我是nat2发的第${received}条请求`);

//             if (received % hash === 0) {
//               process.stdout.write('.');
//             }

//             if (received === loop) {
//               let stop = new Date().getTime();
//               let mps = parseInt(`${loop / ((stop - start) / 1000)}`);
//               console.log(`\n平均每秒发送${mps}条消息 消耗总时间：${(stop - start) / 1000}s`);
//               console.log('Received ' + received + ' messages');
//               sid.unsubscribe();
//               // setImmediate(work3);
//             }
//           });
//         });

//         if (i % hash === 0) {
//           process.stdout.write('+');
//         }
//       }
//     });
//   };

//   // 运行
//   // work1();
//   // work2();
//   work3();
// });
