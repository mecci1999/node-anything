import BaseValidator from '@/lib/validators/base';

export type Validator<T extends BaseValidator = BaseValidator> = T;
