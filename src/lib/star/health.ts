import os from 'os';
import { getIpList } from '@/utils';

const UNIVERSE_VERSION = require('package.json').version;

/**
 * 获取应用信息
 * @returns
 */
const getClientInfo = () => {
  return {
    type: 'nodejs',
    version: UNIVERSE_VERSION,
    langVersionL: process.version
  };
};

/**
 * 获取机器Cpu信息
 */
const getCpuInfo = () => {
  const cpus = os.cpus();
  const load = os.loadavg();
  const cpu: any = {
    load1: load[0],
    load5: load[1],
    load15: load[2],
    cores: Array.isArray(cpus) ? os.cpus().length : null
  };
  cpu.utilization = Math.min(Math.floor((load[0] * 100) / cpu.cores), 100);

  return cpu;
};

/**
 * 获取内存信息
 */
const getMemoryInfo = () => {
  const memory: any = {
    free: os.freemem(), // 剩余内存
    total: os.totalmem() // 整体内存
  };

  memory.percent = (memory.free * 100) / memory.total; // 百分比

  return memory;
};

/**
 * 获取用户信息
 */
const getUserInfo = () => {
  try {
    return os.userInfo();
  } catch (error) {
    return {};
  }
};

/**
 * 获取操作系统信息
 */
const getOsInfo = () => {
  return {
    uptime: os.uptime(),
    type: os.type(),
    release: os.release(),
    hostname: os.hostname(),
    arch: os.arch(),
    platform: os.platform(),
    user: getUserInfo()
  };
};

/**
 * 获取进程信息
 */
const getProcessInfo = () => {
  return {
    pid: process.pid,
    memory: process.memoryUsage(),
    uptime: process.uptime(),
    argv: process.argv
  };
};

/**
 * 获取网络接口信息
 */
const getNetworkInterfacesInfo = () => {
  return {
    ip: getIpList()
  };
};

/**
 * 获取日期时间信息
 */
const getDateTimeInfo = () => {
  return {
    now: Date.now(),
    iso: new Date().toISOString(),
    utc: new Date().toUTCString()
  };
};

/**
 * 获取健康状态
 */
const getHealthStatus = () => {
  return {
    cpu: getCpuInfo(),
    memory: getMemoryInfo(),
    os: getOsInfo(),
    process: getProcessInfo(),
    client: getClientInfo(),
    net: getNetworkInterfacesInfo(),
    time: getDateTimeInfo()
  };
};

export default {
  getHealthStatus,
  getClientInfo,
  getCpuInfo,
  getDateTimeInfo,
  getMemoryInfo,
  getNetworkInterfacesInfo,
  getIpList,
  getProcessInfo
};
