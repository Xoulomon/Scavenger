// #1159: Use config module instead of reading process.env.LOG_LEVEL directly.
import { config } from '../config';
import { StructuredLogger } from '../../../packages/shared/src/logger';
import type { LogLevel } from '../../../packages/shared/src/logger';

export const logger = new StructuredLogger(
  (config.logging.level as LogLevel | undefined) ?? 'info',
  true,
);

export type { LogLevel };
