const Univserse = require('../../dist/index');
const testData = require('./testJson');

// 微服务数
const count = 3;

const star = new Univserse.Star({
  namespace: 'kafka-demo',
  transporter: {
    type: 'KAFKA',
    debug: true,
    host: 'localhost:9092'
  },
  tracing: {
    enabled: true,
    exporter: {
      type: 'NewRelic'
    }
  }
});

for (let i = 1; i < count; i++) {
  // 创建网关服务
  star.createService({
    name: `sender-${i}`,
    actions: {
      sendData: {
        cache: false,
        trancing: false,
        handler() {
          // 转发请求到相应的微服务
          return star.call(`receiver.receiveData`, {
            data: JSON.stringify(testData),
            from: `sender-${i}`
          });
        }
      }
    }
  });
}

star.start().then(() => {
  // 启动所有客户端并发送数据
  for (let i = 1; i < count; i++) {
    setTimeout(() => {
      star.call(`sender-${i}.sendData`);
    }, 3000);
  }
});
