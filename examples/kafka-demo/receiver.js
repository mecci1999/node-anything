// 接收方
const Univserse = require('../../dist/index');

const star = new Univserse.Star({
  namespace: 'kafka-demo',
  transporter: {
    type: 'KAFKA',
    debug: true,
    host: '0.0.0.0:9092'
  }
});

// 创建网关服务
star.createService({
  name: `receiver`,
  actions: {
    receiveData: {
      cache: false,
      trancing: false,
      handler(ctx) {
        // 接受数据
        const { data, from } = ctx.params;
        star.logger.debug(`Received data from ${from} with size: ${data.length} bytes`);
        return data;
      }
    }
  }
});

star.start();
