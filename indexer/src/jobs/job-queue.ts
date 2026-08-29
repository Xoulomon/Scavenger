import Redis from 'redis';

export enum JobPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
}

export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface Job {
  id: string;
  type: string;
  data: unknown;
  priority: JobPriority;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  schedule?: string;
}

export interface JobProcessor {
  (job: Job): Promise<void>;
}

export class JobQueue {
  private client: Redis.RedisClient;
  private processors: Map<string, JobProcessor>;
  private processing: boolean;
  private jobCounter: number;

  constructor(redisClient: Redis.RedisClient) {
    this.client = redisClient;
    this.processors = new Map();
    this.processing = false;
    this.jobCounter = 0;
  }

  registerProcessor(jobType: string, processor: JobProcessor): void {
    this.processors.set(jobType, processor);
  }

  /** Returns the set of job types that have a registered processor. */
  getRegisteredJobTypes(): string[] {
    return Array.from(this.processors.keys());
  }

  async enqueue(
    type: string,
    data: unknown,
    priority: JobPriority = JobPriority.NORMAL,
    maxAttempts: number = 3
  ): Promise<string> {
    const id = `job:${Date.now()}:${++this.jobCounter}`;
    const job: Job = {
      id,
      type,
      data,
      priority,
      status: JobStatus.PENDING,
      attempts: 0,
      maxAttempts,
      createdAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const score = priority * 1000000 + Date.now();
      this.client.zadd(`queue:${type}`, score, JSON.stringify(job), (err) => {
        if (err) {reject(err);}
        this.client.hset(`job:${id}`, 'data', JSON.stringify(job), (err) => {
          if (err) {reject(err);}
          resolve(id);
        });
      });
    });
  }

  async schedule(
    type: string,
    data: unknown,
    cronExpression: string,
    priority: JobPriority = JobPriority.NORMAL
  ): Promise<string> {
    const id = `scheduled:${type}:${Date.now()}`;
    const job: Job = {
      id,
      type,
      data,
      priority,
      status: JobStatus.PENDING,
      attempts: 0,
      maxAttempts: -1,
      createdAt: Date.now(),
      schedule: cronExpression,
    };

    return new Promise((resolve, reject) => {
      this.client.hset(`scheduled:${type}`, id, JSON.stringify(job), (err) => {
        if (err) {reject(err);}
        resolve(id);
      });
    });
  }

  async process(): Promise<void> {
    if (this.processing) {return;}
    this.processing = true;

    try {
      for (const [jobType, processor] of this.processors) {
        await this.processQueue(jobType, processor);
      }
    } finally {
      this.processing = false;
    }
  }

  private async processQueue(jobType: string, processor: JobProcessor): Promise<void> {
    return new Promise((resolve) => {
      this.client.zrange(`queue:${jobType}`, 0, 0, (err, jobs) => {
        if (err || !jobs || jobs.length === 0) {
          resolve();
          return;
        }

        const jobData = JSON.parse(jobs[0]);
        this.executeJob(jobData, processor, jobType, resolve);
      });
    });
  }

  private executeJob(
    job: Job,
    processor: JobProcessor,
    jobType: string,
    resolve: () => void
  ): void {
    job.status = JobStatus.PROCESSING;
    job.startedAt = Date.now();
    job.attempts++;

    processor(job)
      .then(() => {
        job.status = JobStatus.COMPLETED;
        job.completedAt = Date.now();
        this.updateJobStatus(job, jobType, resolve);
      })
      .catch((error) => {
        job.error = error.message;
        if (job.attempts < job.maxAttempts) {
          job.status = JobStatus.PENDING;
          const score = job.priority * 1000000 + Date.now() + 5000 * job.attempts;
          this.client.zadd(`queue:${jobType}`, score, JSON.stringify(job), () => {
            this.updateJobStatus(job, jobType, resolve);
          });
        } else {
          job.status = JobStatus.FAILED;
          this.updateJobStatus(job, jobType, resolve);
        }
      });
  }

  private updateJobStatus(job: Job, jobType: string, resolve: () => void): void {
    this.client.zrem(`queue:${jobType}`, JSON.stringify(job), () => {
      this.client.hset(`job:${job.id}`, 'data', JSON.stringify(job), () => {
        resolve();
      });
    });
  }

  async getJob(jobId: string): Promise<Job | null> {
    return new Promise((resolve, reject) => {
      this.client.hget(`job:${jobId}`, 'data', (err, data) => {
        if (err) {reject(err);}
        resolve(data ? JSON.parse(data) : null);
      });
    });
  }

  async getQueueStats(jobType: string): Promise<{ pending: number; processing: number }> {
    return new Promise((resolve, reject) => {
      this.client.zcard(`queue:${jobType}`, (err, count) => {
        if (err) {reject(err);}
        resolve({
          pending: count || 0,
          processing: 0,
        });
      });
    });
  }
}
