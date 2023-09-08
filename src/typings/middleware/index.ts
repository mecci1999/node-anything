import Service from '@/lib/star/service';
import { ActionHandler, ActionSchema, CallingOptions } from '../context';
import { Star } from '@/lib/star';
import { ServiceEvent } from '../context/event';

export type CallMiddlewareHandler = {
  actionName: string;
  params: any;
  options: CallingOptions;
};

export type Middleware = {
  [name: string]:
    | ((handler: ActionHandler, action: ActionSchema) => any)
    | ((handler: ActionHandler, event: ServiceEvent) => any)
    | ((handler: ActionHandler) => any)
    | ((service: Service) => any)
    | ((star: Star) => any)
    | ((handler: CallMiddlewareHandler) => CallMiddlewareHandler);
};

export type MiddlewareInit = (star: Star) => Middleware;
