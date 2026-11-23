# Rate Limiting

The Scavenger backend enforces per-IP rate limits using a **sliding window** algorithm.

## Tiers

| Tier      | Requests / minute | Requests / hour |
| --------- | ----------------- | --------------- |
| Anonymous | 30                | 200             |
| Free      | 60                | 1 000           |
| Premium   | 300               | 5 000           |
| Admin     | 1 000             | 50 000          |

The default tier applied to all requests is **Free** unless the middleware is configured with a specific `RateLimitConfig`.

## Response Headers

Every response includes:

| Header                         | Description                                             |
| ------------------------------ | ------------------------------------------------------- |
| `X-RateLimit-Limit-Minute`     | Maximum requests allowed per minute                     |
| `X-RateLimit-Limit-Hour`       | Maximum requests allowed per hour                       |
| `X-RateLimit-Remaining-Minute` | Requests remaining in the current minute window         |
| `X-RateLimit-Remaining-Hour`   | Requests remaining in the current hour window           |
| `Retry-After`                  | Seconds until the window resets (only on 429 responses) |

## Handling 429 Too Many Requests

When rate limited, the API returns HTTP `429` with a plain-text body. Clients should:

1. Read `Retry-After` to determine when to retry.
2. Implement exponential backoff for repeated 429s.
3. Cache responses where possible to reduce request volume.

## Sliding Window Algorithm

Each request timestamp is stored in an in-memory bucket keyed by `<ip>:<window>`. On every request, timestamps older than the window duration are evicted, and the remaining count is compared against the limit. This avoids the burst problem of fixed-window counters.

For production deployments with multiple instances, replace the in-memory store with a shared Redis-backed implementation (see `indexer/src/rate-limit/rate-limiter.ts` for a Redis reference implementation).
