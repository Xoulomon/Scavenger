//! Ownership: request protection (rate limits, CORS and CSRF) is in `middleware/`. `security/` keeps
//! the crypto and auth primitives only.

// #1158: `csrf.rs` was removed — it was imported but never `.wrap()`-ed into
// the active router (see main.rs's App builder), so it was dead weight left
// over from an earlier auth scheme. CSRF protection is out of scope for the
// currently registered middleware stack.
pub mod rate_limit;
pub mod request_id;
pub mod validation;
// #919: Idempotency key support for write operations
pub mod idempotency;

pub use idempotency::IdempotencyMiddleware;
// #1158: `RateLimitLayer` was a stale re-export left over from a superseded
// rate-limiting implementation; no such type is defined in `rate_limit`, and
// `RateLimitMiddleware` is the one actually registered in the router.
pub use rate_limit::{RateLimitConfig, RateLimitMiddleware, RateLimitTier, RouteRateLimitConfig};
pub use request_id::{RequestId, RequestIdMiddleware};
pub use validation::ValidationMiddleware;

/// Lock a `std::sync::Mutex`, recovering the guard if an earlier holder panicked.
///
/// Used for in-memory rate-limit counters and idempotency caches. A poisoned
/// value is still safe to read and update, so a panic in one request should
/// not make every later request on that worker panic too.
pub(crate) fn lock_unpoisoned<T>(m: &std::sync::Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    m.lock().unwrap_or_else(std::sync::PoisonError::into_inner)
}

#[cfg(test)]
mod tests {
    use super::lock_unpoisoned;
    use std::sync::{Arc, Mutex};

    #[test]
    fn lock_unpoisoned_recovers_after_a_panic() {
        let m = Arc::new(Mutex::new(1));
        let holder = Arc::clone(&m);
        let _ = std::thread::spawn(move || {
            let _guard = holder.lock().unwrap();
            panic!("poison the mutex");
        })
        .join();

        assert!(m.is_poisoned());
        *lock_unpoisoned(&m) += 1;
        assert_eq!(*lock_unpoisoned(&m), 2);
    }
}
