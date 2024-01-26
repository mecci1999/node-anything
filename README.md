# Node-Universe 基于 Nodejs 环境的一款微服务框架

## 灵感来自宇宙中的恒星与行星，一个星系中可以有一个或多个恒星，恒星作为服务主体，为行星之间提供服务。

### 目前还在开发中

## 使用配置参数模板

```js
const options = {
  namespace: '', // 空间命名，可选
  nodeID: '', // 节点ID，可指定，默认系统命名
  metadata: {}, // 可选
  metrics: {
    enable: true // 性能指标记录开关，默认开,可选
  },
  // 日志模块，默认使用控制台打印输出，可选
  logger: {
    type: 'console' | 'file' | 'log4js' | 'pino', // 日志类型，提供file(文件形式)｜log4js库 ｜ pino库
    options: {
      file: {
        folder: './logs', // 日志文件存储相对路径
        filename: 'universer-{date}.log', // 日志文件名
        interval: 1000, // 日志文件更新时间间隔，单位ms
        colors: true, // 是否启用颜色标记
        formatter: 'full' | 'json' | 'jsonnext' | 'simple' | 'short' // 日志输出格式，默认full
      }, // 使用文件形式的配置参数
      log4js: {}, // 使用log4js的配置参数,参考log4js库的官方文档 https://log4js-node.github.io/log4js-node/
      pino: {
        options: {},
        destination: {}
      } // 使用pino的配置参数，参考pino库的官方文档 https://pino.nodejs.cn/docs/api?id=options
    }
  },

  // 服务注册与发现模块，可选
  registry: {
    strategy: {
      type: 'RoundRobin' | 'Random' | 'CpuUsage' | 'Latency' // 默认为轮询策略， Random（随机策略）、CpuUsage（CPU使用率策略）、Latency（近期缓存策略）
    }, // 服务节点查询策略
    preferLocal: true,
    stopDelay: 100,
    discoverer: {
      type: 'Local', // 服务发现模块，默认使用系统本地存储，暂不支持其它库，计划后期支持etcd库
      options: {
        heartbeatInterval: 15, // 心跳间隔时间，单位s
        heartbeatTimeout: 30 // 心跳
      }
    }
  },

  // 缓存模块
  cacher: {
    type: 'Memory' | 'Redis',
    clone: true
  }
};
```
