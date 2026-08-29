import { StructuredLogger } from '../../../packages/shared/src/logger';
import type { LogLevel } from '../../../packages/shared/src/logger';

export const logger = new StructuredLogger(
  (process.env.LOG_LEVEL as LogLevel | undefined) ?? 'info',
  true,
);

export type { LogLevel };