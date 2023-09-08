import Context from '@/lib/context';

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
