import { JobQueue, JobPriority, JobStatus } from '../src/jobs'
import Redis from 'redis'

describe('JobQueue', () => {
  let client: Redis.RedisClient
  let queue: JobQueue

  beforeEach(() => {
    client = Redis.createClient({
      host: 'localhost',
      port: 6379
    })
    queue = new JobQueue(client)
  })

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      client.flushdb(() => resolve())
    })
  })

  test('should enqueue job', async () => {
    const jobId = await queue.enqueue('data-sync', { source: 'contract' })
    expect(jobId).toBeDefined()
    expect(jobId).toMatch(/^job:/)
  })

  test('should retrieve enqueued job', async () => {
    const jobId = await queue.enqueue('data-sync', { source: 'contract' })
    const job = await queue.getJob(jobId)
    expect(job).toBeDefined()
    expect(job?.type).toBe('data-sync')
    expect(job?.data.source).toBe('contract')
  })

  test('should process job with registered processor', async () => {
    const processorMock = jest.fn(async () => {})
    queue.registerProcessor('test-job', processorMock)

    const jobId = await queue.enqueue('test-job', { test: true })
    await queue.process()

    expect(processorMock).toHaveBeenCalled()
  })

  test('should retry failed jobs', async () => {
    let attempts = 0
    const processor = jest.fn(async () => {
      attempts++
      if (attempts < 2) throw new Error('Temporary failure')
    })

    queue.registerProcessor('retry-job', processor)
    const jobId = await queue.enqueue('retry-job', {}, JobPriority.NORMAL, 3)

    await queue.process()
    const job = await queue.getJob(jobId)
    expect(job?.attempts).toBe(1)
  })

  test('should respect job priority', async () => {
    const processor = jest.fn(async () => {})
    queue.registerProcessor('priority-job', processor)

    await queue.enqueue('priority-job', { priority: 'low' }, JobPriority.LOW)
    await queue.enqueue('priority-job', { priority: 'high' }, JobPriority.HIGH)

    await queue.process()
    expect(processor).toHaveBeenCalled()
  })

  test('should schedule recurring jobs', async () => {
    const jobId = await queue.schedule('recurring-sync', { interval: 'hourly' }, '0 * * * *')
    expect(jobId).toBeDefined()
    expect(jobId).toMatch(/^scheduled:/)
  })

  test('should get queue statistics', async () => {
    await queue.enqueue('stats-job', {})
    await queue.enqueue('stats-job', {})

    const stats = await queue.getQueueStats('stats-job')
    expect(stats.pending).toBe(2)
  })

  test('should mark job as completed', async () => {
    const processor = jest.fn(async () => {})
    queue.registerProcessor('complete-job', processor)

    const jobId = await queue.enqueue('complete-job', {})
    await queue.process()

    const job = await queue.getJob(jobId)
    expect(job?.status).toBe(JobStatus.COMPLETED)
    expect(job?.completedAt).toBeDefined()
  })

  test('should mark job as failed after max attempts', async () => {
    const processor = jest.fn(async () => {
      throw new Error('Permanent failure')
    })
    queue.registerProcessor('fail-job', processor)

    const jobId = await queue.enqueue('fail-job', {}, JobPriority.NORMAL, 1)
    await queue.process()

    const job = await queue.getJob(jobId)
    expect(job?.status).toBe(JobStatus.FAILED)
    expect(job?.error).toBeDefined()
  })

  test('should handle multiple job types', async () => {
    const processor1 = jest.fn(async () => {})
    const processor2 = jest.fn(async () => {})

    queue.registerProcessor('job-type-1', processor1)
    queue.registerProcessor('job-type-2', processor2)

    await queue.enqueue('job-type-1', {})
    await queue.enqueue('job-type-2', {})

    await queue.process()

    expect(processor1).toHaveBeenCalled()
    expect(processor2).toHaveBeenCalled()
  })
})
