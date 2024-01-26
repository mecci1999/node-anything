import BaseCacher from '@/lib/cachers/base';
import Context from '@/lib/context';
import { GenericObject } from '..';

export type ActionCacheEnabledFuncType = (ctx: Context) => boolean;

export interface ActionCacheOptions<P = Record<string, unknown>, M = unknown> {
  enabled?: boolean | ActionCacheEnabledFuncType;
  ttl?: number;
  keys?: string[];
  keygen?: CacherKeygenFunc<P, M>;
  lock?: {
    enabled?: boolean;
    staleTime?: number;
  };
}

export type CacherKeygenFunc<P = Record<string, unknown>, M = unknown> = (
  actionName: string,
  params: P,
  meta: M,
  keys?: string[]
) => string;

export interface CacherOptions {
  ttl?: number;
  keygen?: CacherKeygenFunc;
  maxParamsLength?: number;
  [key: string]: any;
}

export interface RedisCacherOptions extends CacherOptions {
  prefix?: string;
  redis?: GenericObject;
  redlock?: boolean | GenericObject;
  monitor?: boolean;
  pingInterval?: number;
}

export type Cacher<T extends BaseCacher = BaseCacher> = T;
