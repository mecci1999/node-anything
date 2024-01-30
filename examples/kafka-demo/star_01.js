const Univserse = require('../../dist/index');

const star = new Univserse.Star({
  namespace: 'kafka-demo',
  transporter: {
    type: 'KAFKA',
    debug: true,
    host: '0.0.0.0:9092'
  }
});

star.start().then(() => {
  star.logger.info(`star_01启动完成`);
});
