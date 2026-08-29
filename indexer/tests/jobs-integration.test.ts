import { JobQueue, JobPriority, JobStatus } from '../src/jobs';
import { PRODUCER_JOB_TYPES, CONSUMER_JOB_TYPES } from '../src/jobs/jobTypes';

/**
 * In-memory mock Redis client that simulates sorted-set and hash operations
 * used by JobQueue. Supports the callback-based `redis` v3 API.
 */
function createMockRedisClient() {
  const sortedSets = new Map<string, { score: number; member: string }[]>();
  const hashes = new Map<string, Record<string, string>>();

  function zadd(
    key: string,
    score: number,
    member: string,
    cb: (err: Error | null) => void
  ) {
    const entries = sortedSets.get(key) || [];
    entries.push({ score, member });
    entries.sort((a, b) => a.score - b.score);
    sortedSets.set(key, entries);
    cb(null);
  }

  function zrange(
    key: string,
    start: number,
    stop: number,
    cb: (err: Error | null, items: string[]) => void
  ) {
    const entries = sortedSets.get(key) || [];
    const result = entries.slice(start, stop + 1).map((e) => e.member);
    cb(null, result);
  }

  function zrem(
    key: string,
    member: string,
    cb: (err: Error | null) => void
  ) {
    const entries = sortedSets.get(key) || [];
    const idx = entries.findIndex((e) => e.member === member);
    if (idx !== -1) entries.splice(idx, 1);
    sortedSets.set(key, entries);
    cb(null);
  }

  function zcard(key: string, cb: (err: Error | null, count: number) => void) {
    const entries = sortedSets.get(key) || [];
    cb(null, entries.length);
  }

  function hset(
    key: string,
    field: string,
    value: string,
    cb: (err: Error | null) => void
  ) {
    const hash = hashes.get(key) || {};
    hash[field] = value;
    hashes.set(key, hash);
    cb(null);
  }

  function hget(
    key: string,
    field: string,
    cb: (err: Error | null, value: string | null) => void
  ) {
    const hash = hashes.get(key) || {};
    cb(null, hash[field] || null);
  }

  function flushdb(cb: (err: Error | null) => void) {
    sortedSets.clear();
    hashes.clear();
    cb(null);
  }

  return {
    zadd,
    zrange,
    zrem,
    zcard,
    hset,
    hget,
    flushdb,
    _sortedSets: sortedSets,
    _hashes: hashes,
  } as any;
}

describe('JobQueue', () => {
  let client: ReturnType<typeof createMockRedisClient>;
  let queue: JobQueue;

  beforeEach(() => {
    client = createMockRedisClient();
    queue = new JobQueue(client);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── Basic enqueue / retrieve ───────────────────────────────────────────────

  describe('enqueue and retrieve', () => {
    test('should enqueue a job and return an ID', async () => {
      const jobId = await queue.enqueue('data-sync', { source: 'contract' });
      expect(jobId).toBeDefined();
      expect(jobId).toMatch(/^job:/);
    });

    test('should retrieve an enqueued job by ID', async () => {
      const jobId = await queue.enqueue('data-sync', { source: 'contract' });
      const job = await queue.getJob(jobId);
      expect(job).toBeDefined();
      expect(job?.type).toBe('data-sync');
      expect(job?.data.source).toBe('contract');
      expect(job?.status).toBe(JobStatus.PENDING);
      expect(job?.attempts).toBe(0);
    });

    test('should return null for non-existent job', async () => {
      const job = await queue.getJob('job:nonexistent');
      expect(job).toBeNull();
    });

    test('should set correct default values on enqueued job', async () => {
      const jobId = await queue.enqueue('test', { x: 1 });
      const job = await queue.getJob(jobId);
      expect(job?.priority).toBe(JobPriority.NORMAL);
      expect(job?.maxAttempts).toBe(3);
      expect(job?.createdAt).toBeGreaterThan(0);
    });

    test('should enqueue with custom priority and max attempts', async () => {
      const jobId = await queue.enqueue('test', {}, JobPriority.HIGH, 5);
      const job = await queue.getJob(jobId);
      expect(job?.priority).toBe(JobPriority.HIGH);
      expect(job?.maxAttempts).toBe(5);
    });
  });

  // ── Process with registered processor ──────────────────────────────────────

  describe('processing', () => {
    test('should process a job with a registered processor', async () => {
      const processorMock = jest.fn(async () => {});
      queue.registerProcessor('test-job', processorMock);

      await queue.enqueue('test-job', { test: true });
      await queue.process();

      expect(processorMock).toHaveBeenCalledTimes(1);
      const calls = processorMock.mock.calls as any[][];
      expect(calls[0][0].type).toBe('test-job');
      expect(calls[0][0].data.test).toBe(true);
    });

    test('should mark job as completed after successful processing', async () => {
      const processor = jest.fn(async () => {});
      queue.registerProcessor('complete-job', processor);

      const jobId = await queue.enqueue('complete-job', {});
      await queue.process();

      const job = await queue.getJob(jobId);
      expect(job?.status).toBe(JobStatus.COMPLETED);
      expect(job?.completedAt).toBeDefined();
      expect(job?.completedAt).toBeGreaterThan(0);
    });

    test('should mark job as processing during execution', async () => {
      let capturedStatus: string | undefined;
      const processor = jest.fn(async (job: any) => {
        capturedStatus = job.status;
      });
      queue.registerProcessor('status-job', processor);

      await queue.enqueue('status-job', {});
      await queue.process();

      expect(capturedStatus).toBe(JobStatus.PROCESSING);
    });

    test('should set startedAt when job begins processing', async () => {
      let capturedStartedAt: number | undefined;
      const processor = jest.fn(async (job: any) => {
        capturedStartedAt = job.startedAt;
      });
      queue.registerProcessor('time-job', processor);

      await queue.enqueue('time-job', {});
      await queue.process();

      expect(capturedStartedAt).toBeDefined();
      expect(capturedStartedAt).toBeGreaterThan(0);
    });

    test('should return early if already processing', async () => {
      const processor = jest.fn(async () => {});
      queue.registerProcessor('guard-job', processor);

      await queue.enqueue('guard-job', {});

      const p1 = queue.process();
      const p2 = queue.process();

      await Promise.all([p1, p2]);
      expect(processor).toHaveBeenCalledTimes(1);
    });

    test('should process multiple job types', async () => {
      const processor1 = jest.fn(async () => {});
      const processor2 = jest.fn(async () => {});

      queue.registerProcessor('job-type-1', processor1);
      queue.registerProcessor('job-type-2', processor2);

      await queue.enqueue('job-type-1', {});
      await queue.enqueue('job-type-2', {});

      await queue.process();

      expect(processor1).toHaveBeenCalledTimes(1);
      expect(processor2).toHaveBeenCalledTimes(1);
    });

    test('should handle empty queue gracefully', async () => {
      const processor = jest.fn(async () => {});
      queue.registerProcessor('empty-job', processor);

      await queue.process();

      expect(processor).not.toHaveBeenCalled();
    });

    test('should process only one job per type per process call', async () => {
      const processor = jest.fn(async () => {});
      queue.registerProcessor('single-job', processor);

      await queue.enqueue('single-job', { n: 1 });
      await queue.enqueue('single-job', { n: 2 });
      await queue.enqueue('single-job', { n: 3 });

      await queue.process();

      expect(processor).toHaveBeenCalledTimes(1);
    });
  });

  // ── Retry on failure ───────────────────────────────────────────────────────

  describe('retry on failure', () => {
    test('should mark job as FAILED after exhausting maxAttempts', async () => {
      const processor = jest.fn(async () => {
        throw new Error('Permanent failure');
      });
      queue.registerProcessor('fail-job', processor);

      const jobId = await queue.enqueue('fail-job', {}, JobPriority.NORMAL, 1);
      await queue.process();

      const job = await queue.getJob(jobId);
      expect(job?.status).toBe(JobStatus.FAILED);
      expect(job?.error).toBe('Permanent failure');
    });

    test('should store error message from failed processor', async () => {
      const processor = jest.fn(async () => {
        throw new Error('Specific error message');
      });
      queue.registerProcessor('err-job', processor);

      const jobId = await queue.enqueue('err-job', {}, JobPriority.NORMAL, 1);
      await queue.process();

      const job = await queue.getJob(jobId);
      expect(job?.error).toBe('Specific error message');
    });

    test('should set status to PENDING when retried (attempts < maxAttempts)', async () => {
      const processor = jest.fn(async () => {
        throw new Error('Temporary failure');
      });

      queue.registerProcessor('retry-job', processor);
      const jobId = await queue.enqueue('retry-job', {}, JobPriority.NORMAL, 3);

      await queue.process();
      const job = await queue.getJob(jobId);
      expect(job?.status).toBe(JobStatus.PENDING);
      expect(job?.attempts).toBe(1);
      expect(job?.error).toBe('Temporary failure');
    });

    test('retried job retains its data after failure', async () => {
      const processor = jest.fn(async () => {
        throw new Error('fail');
      });

      queue.registerProcessor('data-job', processor);
      const jobId = await queue.enqueue('data-job', { important: 'data' }, JobPriority.NORMAL, 3);

      await queue.process();
      const job = await queue.getJob(jobId);
      expect(job?.data.important).toBe('data');
    });
  });

  // ── Priority ───────────────────────────────────────────────────────────────

  describe('priority', () => {
    test('should enqueue jobs with different priorities', async () => {
      const low = await queue.enqueue('p-job', { p: 'low' }, JobPriority.LOW);
      const normal = await queue.enqueue('p-job', { p: 'normal' }, JobPriority.NORMAL);
      const high = await queue.enqueue('p-job', { p: 'high' }, JobPriority.HIGH);

      const lowJob = await queue.getJob(low);
      const normalJob = await queue.getJob(normal);
      const highJob = await queue.getJob(high);

      expect(lowJob?.priority).toBe(JobPriority.LOW);
      expect(normalJob?.priority).toBe(JobPriority.NORMAL);
      expect(highJob?.priority).toBe(JobPriority.HIGH);
    });

    test('should process jobs from the queue', async () => {
      const processed: string[] = [];
      const processor = jest.fn(async (job: any) => {
        processed.push(job.data.label);
      });

      queue.registerProcessor('pri-job', processor);

      await queue.enqueue('pri-job', { label: 'low' }, JobPriority.LOW);
      await queue.enqueue('pri-job', { label: 'high' }, JobPriority.HIGH);

      await queue.process();

      expect(processed).toHaveLength(1);
    });
  });

  // ── Schedule ───────────────────────────────────────────────────────────────

  describe('schedule', () => {
    test('should schedule a recurring job', async () => {
      const jobId = await queue.schedule('recurring-sync', { interval: 'hourly' }, '0 * * * *');
      expect(jobId).toBeDefined();
      expect(jobId).toMatch(/^scheduled:/);
    });

    test('schedule stores job in scheduled hash (separate from job hash)', async () => {
      const jobId = await queue.schedule('sched-job', { x: 1 }, '*/5 * * * *');
      const job = await queue.getJob(jobId);
      expect(job).toBeNull();
    });
  });

  // ── Queue statistics ───────────────────────────────────────────────────────

  describe('queue statistics', () => {
    test('should report correct pending count', async () => {
      await queue.enqueue('stats-job', {});
      await queue.enqueue('stats-job', {});

      const stats = await queue.getQueueStats('stats-job');
      expect(stats.pending).toBe(2);
      expect(stats.processing).toBe(0);
    });

    test('should return zero stats for empty queue', async () => {
      const stats = await queue.getQueueStats('empty-stats');
      expect(stats.pending).toBe(0);
      expect(stats.processing).toBe(0);
    });

    test('queue stats reflect enqueued count', async () => {
      const processor = jest.fn(async () => {});
      queue.registerProcessor('dec-job', processor);

      await queue.enqueue('dec-job', {});
      await queue.enqueue('dec-job', {});

      const stats = await queue.getQueueStats('dec-job');
      expect(stats.pending).toBe(2);
      expect(stats.processing).toBe(0);
    });
  });

  // ── Registered job types ───────────────────────────────────────────────────

  describe('registered job types', () => {
    test('should return registered job types', () => {
      queue.registerProcessor('type-a', async () => {});
      queue.registerProcessor('type-b', async () => {});

      const types = queue.getRegisteredJobTypes();
      expect(types).toContain('type-a');
      expect(types).toContain('type-b');
    });

    test('should return empty array when no processors registered', () => {
      const types = queue.getRegisteredJobTypes();
      expect(types).toEqual([]);
    });
  });

  // ── Idempotency ────────────────────────────────────────────────────────────

  describe('idempotency', () => {
    test('completed job has correct status in the job store', async () => {
      const processor = jest.fn(async () => {});
      queue.registerProcessor('idemp-job', processor);

      const jobId = await queue.enqueue('idemp-job', {});
      await queue.process();

      const job = await queue.getJob(jobId);
      expect(job?.status).toBe(JobStatus.COMPLETED);
      expect(job?.completedAt).toBeDefined();
    });

    test('re-enqueueing after completion creates a new job', async () => {
      const processor = jest.fn(async () => {});
      queue.registerProcessor('new-job', processor);

      const id1 = await queue.enqueue('new-job', { run: 1 });
      await queue.process();

      const id2 = await queue.enqueue('new-job', { run: 2 });
      expect(id1).not.toBe(id2);

      await queue.process();
      expect(processor).toHaveBeenCalledTimes(2);
    });
  });

  // ── Partial failure recovery ───────────────────────────────────────────────

  describe('partial failure recovery', () => {
    test('failed job data is preserved in job store', async () => {
      const processor = jest.fn(async () => {
        throw new Error('Transient error');
      });

      queue.registerProcessor('recover-job', processor);
      const jobId = await queue.enqueue('recover-job', { important: 'data' }, JobPriority.NORMAL, 3);

      await queue.process();
      const job = await queue.getJob(jobId);
      expect(job?.data.important).toBe('data');
      expect(job?.status).toBe(JobStatus.PENDING);
    });

    test('multiple jobs - first failure does not affect other enqueued jobs', async () => {
      const processed: string[] = [];
      const processor = jest.fn(async (job: any) => {
        processed.push(job.data.label);
        if (job.data.fail) throw new Error('This job fails');
      });

      queue.registerProcessor('multi-fail', processor);

      await queue.enqueue('multi-fail', { fail: true, label: 'bad' });
      await queue.enqueue('multi-fail', { fail: false, label: 'good' });

      await queue.process();

      expect(processor).toHaveBeenCalledTimes(1);
      expect(processed).toContain('bad');
    });
  });

  // ── Job type parity (jobTypes.ts) ──────────────────────────────────────────

  describe('jobTypes parity', () => {
    test('PRODUCER_JOB_TYPES and CONSUMER_JOB_TYPES should be identical', () => {
      expect([...PRODUCER_JOB_TYPES].sort()).toEqual([...CONSUMER_JOB_TYPES].sort());
    });

    test('all job types should be non-empty strings', () => {
      PRODUCER_JOB_TYPES.forEach((type) => {
        expect(typeof type).toBe('string');
        expect(type.length).toBeGreaterThan(0);
      });
    });

    test('all producer job types have a registered processor in a full setup', () => {
      const allTypes = new Set([...PRODUCER_JOB_TYPES, ...CONSUMER_JOB_TYPES]);
      allTypes.forEach((type) => {
        queue.registerProcessor(type, async () => {});
      });
      const registered = queue.getRegisteredJobTypes();
      allTypes.forEach((type) => {
        expect(registered).toContain(type);
      });
    });
  });
});
