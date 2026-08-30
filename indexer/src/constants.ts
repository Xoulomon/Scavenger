/**
 * Application constants
 */

export const WASTE_TYPES = ['Paper', 'Plastic', 'Metal', 'Glass', 'Organic', 'Electronic'] as const;
export const PARTICIPANT_ROLES = ['Recycler', 'Collector', 'Manufacturer'] as const;
export const DEFAULT_WASTE_TYPE = WASTE_TYPES[0];
export const DEFAULT_PARTICIPANT_ROLE = PARTICIPANT_ROLES[0];

export const CONTRACT_EVENT_TYPES = {
  WASTE_REGISTERED: 'recycled',
  PARTICIPANT_REGISTERED: 'reg',
  WASTE_TRANSFERRED: 'transfer',
  WASTE_CONFIRMED: 'confirmed',
  TOKENS_REWARDED: 'rewarded',
  WASTE_DEACTIVATED: 'deactive',
  WASTE_GRADED: 'graded',
  PROCESSING_STATUS_CHANGED: 'proc_upd',
  WASTE_CONTAMINATED: 'contam',
  AUCTION_CREATED: 'auc_cre',
  AUCTION_ENDED: 'auc_end',
  CARBON_CREDITS_EARNED: 'carbon',
} as const;

export const QUERY_LIMITS = {
  DEFAULT: 20,
  MAX: 1000,
  MIN: 1,
} as const;

export const PERFORMANCE = {
  SLOW_QUERY_THRESHOLD_MS: 100,
  CONNECTION_TIMEOUT_MS: 5000,
  QUERY_TIMEOUT_MS: 30000,
} as const;

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

export const ANALYTICS = {
  DEFAULT_TOP_RESULTS_LIMIT: 10,
  DEFAULT_TRANSFER_ACTIVITY_DAYS: 30,
} as const;

export const EVENT_PAGINATION = {
  DEFAULT_RECENT_EVENTS_LIMIT: 50,
  MAX_RECENT_EVENTS_LIMIT: 500,
} as const;

export const CACHE = {
  METRICS_TTL_MS: 30_000,
} as const;

export const FULL_TEXT_SEARCH_CONFIG = 'english';
