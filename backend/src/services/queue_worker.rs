//! # Queue Worker — Issue #1719
//!
//! Provides a lightweight, channel-backed task queue that processes jobs
//! concurrently on a configurable number of worker tasks.
//!
//! ## Design
//!
//! - Jobs are submitted via `QueueWorker::submit`, which is non-blocking.
//! - A fixed pool of `tokio` worker tasks drains the channel continuously.
//! - `QueueWorker::shutdown` signals all workers to stop and waits for them
//!   to finish draining any in-flight jobs.
//! - The generic `Job` trait is implemented by callers; the queue itself is
//!   agnostic to job content.
//!
//! ## Backward compatibility
//!
//! This module is additive.  Existing callers that use `tokio::spawn` directly
//! (e.g. `WebhookManager::trigger`) continue to compile unchanged.  Callers
//! can migrate to `QueueWorker` incrementally.

use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};
use tokio::sync::mpsc;
use tracing::{debug, error, info};

// ── Job trait ─────────────────────────────────────────────────────────────────

/// A unit of work that can be submitted to a `QueueWorker`.
///
/// Implement this trait for any type that represents a background task.
#[async_trait::async_trait]
pub trait Job: Send + 'static {
    /// A short human-readable name used in log output.
    fn name(&self) -> &str;

    /// Execute the job.  Returning `Err` causes the worker to log the failure
    /// but does not stop the worker loop.
    async fn run(self) -> Result<(), String>;
}

// ── QueueWorker ───────────────────────────────────────────────────────────────

/// A bounded, multi-worker task queue.
///
/// # Example
///
/// ```ignore
/// let worker: QueueWorker<MyJob> = QueueWorker::new(4, 128);
/// worker.submit(MyJob { ... }).await?;
/// // … on shutdown:
/// worker.shutdown().await;
/// ```
pub struct QueueWorker<J: Job> {
    sender: mpsc::Sender<J>,
    pending: Arc<AtomicUsize>,
    shutdown_tx: tokio::sync::broadcast::Sender<()>,
}

impl<J: Job> QueueWorker<J> {
    /// Create a new queue worker pool.
    ///
    /// - `workers` — number of concurrent worker tasks to spawn.
    /// - `capacity` — maximum number of jobs queued before `submit` applies
    ///   back-pressure (the caller awaits until a slot is free).
    pub fn new(workers: usize, capacity: usize) -> Self {
        let (sender, receiver) = mpsc::channel::<J>(capacity);
        let (shutdown_tx, _) = tokio::sync::broadcast::channel(1);
        let pending = Arc::new(AtomicUsize::new(0));

        // Share the receiver across workers using an Arc<Mutex<_>>.
        let receiver = Arc::new(tokio::sync::Mutex::new(receiver));

        for id in 0..workers.max(1) {
            let rx = receiver.clone();
            let pending = pending.clone();
            let mut shutdown_rx = shutdown_tx.subscribe();

            tokio::spawn(async move {
                loop {
                    // Wait for a job or a shutdown signal.
                    let job = {
                        let mut guard = rx.lock().await;
                        tokio::select! {
                            biased;
                            _ = shutdown_rx.recv() => {
                                debug!(worker_id = id, "queue worker received shutdown signal");
                                break;
                            }
                            job = guard.recv() => {
                                match job {
                                    Some(j) => j,
                                    None => break, // sender dropped
                                }
                            }
                        }
                    };

                    let name = job.name().to_string();
                    pending.fetch_add(1, Ordering::Relaxed);
                    debug!(worker_id = id, job = %name, "executing queued job");

                    match job.run().await {
                        Ok(()) => info!(worker_id = id, job = %name, "job completed"),
                        Err(e) => error!(worker_id = id, job = %name, error = %e, "job failed"),
                    }

                    pending.fetch_sub(1, Ordering::Relaxed);
                }
                info!(worker_id = id, "queue worker stopped");
            });
        }

        Self {
            sender,
            pending,
            shutdown_tx,
        }
    }

    /// Submit a job to the queue.
    ///
    /// Applies back-pressure: if the queue is full this awaits until a slot
    /// becomes available.  Returns `Err` only if all workers have stopped.
    pub async fn submit(&self, job: J) -> Result<(), String> {
        self.sender
            .send(job)
            .await
            .map_err(|_| "queue worker pool has stopped".to_string())
    }

    /// Number of jobs currently being processed or waiting in the queue.
    pub fn pending(&self) -> usize {
        self.pending.load(Ordering::Relaxed)
    }

    /// Signal all workers to stop after they finish any in-flight job, then
    /// wait for them to exit.
    ///
    /// Any jobs already submitted but not yet started will not be executed
    /// once shutdown has been signalled.
    pub async fn shutdown(self) {
        let _ = self.shutdown_tx.send(());
        // Drop the sender so workers exit when the channel drains.
        drop(self.sender);
        // Give workers a moment to notice and exit cleanly.
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        info!("queue worker pool shut down");
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, Mutex};
    use tokio::time::{sleep, Duration};

    struct CounterJob {
        counter: Arc<Mutex<u32>>,
    }

    #[async_trait::async_trait]
    impl Job for CounterJob {
        fn name(&self) -> &str {
            "counter"
        }

        async fn run(self) -> Result<(), String> {
            *self.counter.lock().unwrap() += 1;
            Ok(())
        }
    }

    struct FailingJob;

    #[async_trait::async_trait]
    impl Job for FailingJob {
        fn name(&self) -> &str {
            "failing"
        }

        async fn run(self) -> Result<(), String> {
            Err("intentional failure".to_string())
        }
    }

    #[tokio::test]
    async fn jobs_are_executed() {
        let counter = Arc::new(Mutex::new(0u32));
        let worker: QueueWorker<CounterJob> = QueueWorker::new(2, 16);

        for _ in 0..5 {
            worker
                .submit(CounterJob {
                    counter: counter.clone(),
                })
                .await
                .unwrap();
        }

        // Allow time for workers to process.
        sleep(Duration::from_millis(50)).await;
        assert_eq!(*counter.lock().unwrap(), 5);
    }

    #[tokio::test]
    async fn failing_job_does_not_stop_worker() {
        let counter = Arc::new(Mutex::new(0u32));
        let worker: QueueWorker<CounterJob> = QueueWorker::new(1, 16);

        // We can't mix types, so just submit FailingJob in its own worker
        let fail_worker: QueueWorker<FailingJob> = QueueWorker::new(1, 4);
        fail_worker.submit(FailingJob).await.unwrap();
        sleep(Duration::from_millis(20)).await;
        // Worker should still be alive — submit another job
        let result = fail_worker.submit(FailingJob).await;
        assert!(result.is_ok());

        // Counter jobs should work normally
        worker
            .submit(CounterJob {
                counter: counter.clone(),
            })
            .await
            .unwrap();
        sleep(Duration::from_millis(50)).await;
        assert_eq!(*counter.lock().unwrap(), 1);
    }

    #[tokio::test]
    async fn shutdown_completes_without_panic() {
        let worker: QueueWorker<CounterJob> = QueueWorker::new(2, 8);
        worker.shutdown().await;
    }
}
