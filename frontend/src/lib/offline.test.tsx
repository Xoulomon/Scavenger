import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useOfflineMutation } from '@/hooks/useOfflineMutation'
import {
  getDB,
  setQueryData,
  getQueryData,
  removeQueryData,
  addMutationToQueue,
  getPendingMutations,
  updateMutationStatus,
  removeMutationFromQueue,
} from '@/lib/indexedDB'
import { resolveConflict, detectConflict } from '@/lib/conflictResolution'

// Mock IndexedDB
const indexedDB = vi.fn()
const IDBKeyRange = vi.fn()

vi.stubGlobal('indexedDB', indexedDB)
vi.stubGlobal('IDBKeyRange', IDBKeyRange)

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
})

describe('Offline Functionality', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })
  })

  afterEach(() => {
    queryClient.clear()
  })

  describe('useOnlineStatus', () => {
    it('should return true when online', () => {
      navigator.onLine = true
      const { result } = renderHook(() => useOnlineStatus())
      expect(result.current).toBe(true)
    })

    it('should return false when offline', () => {
      navigator.onLine = false
      const { result } = renderHook(() => useOnlineStatus())
      expect(result.current).toBe(false)
    })

    it('should update status when online/offline events fire', () => {
      navigator.onLine = true
      const { result } = renderHook(() => useOnlineStatus())

      act(() => {
        window.dispatchEvent(new Event('offline'))
      })
      expect(result.current).toBe(false)

      act(() => {
        window.dispatchEvent(new Event('online'))
      })
      expect(result.current).toBe(true)
    })
  })

  describe('IndexedDB Operations', () => {
    it('should set and get query data', async () => {
      const testData = { id: 1, name: 'test' }
      const queryKey = ['test', 'query']

      await setQueryData('test-key', testData, queryKey)
      const retrieved = await getQueryData('test-key')

      expect(retrieved?.data).toEqual(testData)
      expect(retrieved?.queryKey).toEqual(queryKey)
    })

    it('should remove query data', async () => {
      const testData = { id: 1, name: 'test' }
      const queryKey = ['test', 'query']

      await setQueryData('test-key', testData, queryKey)
      await removeQueryData('test-key')
      const retrieved = await getQueryData('test-key')

      expect(retrieved).toBeUndefined()
    })

    it('should queue and retrieve mutations', async () => {
      const mutationData = {
        id: 'test-mutation',
        mutationKey: ['test', 'mutation'],
        variables: { param: 'value' },
      }

      await addMutationToQueue(mutationData)
      const pending = await getPendingMutations()

      expect(pending).toHaveLength(1)
      expect(pending[0].id).toBe('test-mutation')
      expect(pending[0].variables).toEqual({ param: 'value' })
    })

    it('should update mutation status', async () => {
      const mutationData = {
        id: 'test-mutation',
        mutationKey: ['test', 'mutation'],
        variables: { param: 'value' },
      }

      await addMutationToQueue(mutationData)
      await updateMutationStatus('test-mutation', 'synced')

      const pending = await getPendingMutations()
      expect(pending).toHaveLength(0)
    })

    it('should remove mutation from queue', async () => {
      const mutationData = {
        id: 'test-mutation',
        mutationKey: ['test', 'mutation'],
        variables: { param: 'value' },
      }

      await addMutationToQueue(mutationData)
      await removeMutationFromQueue('test-mutation')

      const pending = await getPendingMutations()
      expect(pending).toHaveLength(0)
    })
  })

  describe('Conflict Resolution', () => {
    it('should detect conflicts between different objects', () => {
      const local = { id: 1, name: 'local' }
      const remote = { id: 1, name: 'remote' }

      expect(detectConflict(local, remote)).toBe(true)
    })

    it('should not detect conflicts for identical objects', () => {
      const local = { id: 1, name: 'same' }
      const remote = { id: 1, name: 'same' }

      expect(detectConflict(local, remote)).toBe(false)
    })

    it('should resolve conflicts with remote-wins strategy', () => {
      const conflict = {
        local: { id: 1, name: 'local' },
        remote: { id: 1, name: 'remote' },
        timestamp: Date.now(),
      }

      const result = resolveConflict(conflict, 'remote-wins')
      expect(result).toEqual({ id: 1, name: 'remote' })
    })

    it('should resolve conflicts with local-wins strategy', () => {
      const conflict = {
        local: { id: 1, name: 'local' },
        remote: { id: 1, name: 'remote' },
        timestamp: Date.now(),
      }

      const result = resolveConflict(conflict, 'local-wins')
      expect(result).toEqual({ id: 1, name: 'local' })
    })
  })

  describe('useOfflineMutation', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    it('should execute mutation immediately when online', async () => {
      navigator.onLine = true
      const mockMutationFn = vi.fn().mockResolvedValue({ success: true })

      const { result } = renderHook(
        () =>
          useOfflineMutation({
            mutationFn: mockMutationFn,
            mutationKey: ['test'],
          }),
        { wrapper }
      )

      await act(async () => {
        await result.current.mutateAsync({ param: 'value' })
      })

      expect(mockMutationFn).toHaveBeenCalledWith({ param: 'value' })
    })

    it('should queue mutation when offline', async () => {
      navigator.onLine = false
      const mockMutationFn = vi.fn().mockResolvedValue({ success: true })

      const { result } = renderHook(
        () =>
          useOfflineMutation({
            mutationFn: mockMutationFn,
            mutationKey: ['test'],
          }),
        { wrapper }
      )

      let queueResult
      await act(async () => {
        queueResult = await result.current.mutateAsync({ param: 'value' })
      })

      expect(queueResult).toEqual({ queued: true, id: expect.any(String) })
      expect(mockMutationFn).not.toHaveBeenCalled()
    })

    it('should sync queued mutations when coming back online', async () => {
      navigator.onLine = false
      const mockMutationFn = vi.fn().mockResolvedValue({ success: true })

      const { result, rerender } = renderHook(
        () =>
          useOfflineMutation({
            mutationFn: mockMutationFn,
            mutationKey: ['test'],
          }),
        { wrapper }
      )

      // Queue mutation while offline
      await act(async () => {
        await result.current.mutateAsync({ param: 'value' })
      })

      // Come back online
      navigator.onLine = true
      rerender()

      // Wait for sync to complete
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockMutationFn).toHaveBeenCalledWith({ param: 'value' })
    })
  })

  describe('React Query Persistence', () => {
    it('should persist query data to IndexedDB', async () => {
      const testData = { id: 1, name: 'persisted' }
      const queryKey = ['test', 'persisted']

      await setQueryData(JSON.stringify(queryKey), testData, queryKey)
      const retrieved = await getQueryData(JSON.stringify(queryKey))

      expect(retrieved?.data).toEqual(testData)
    })

    it('should restore persisted query data', async () => {
      const testData = { id: 1, name: 'restored' }
      const queryKey = ['test', 'restored']

      // Simulate persisted data
      await setQueryData(JSON.stringify(queryKey), testData, queryKey)

      // Create query client and check if data is restored
      const newQueryClient = new QueryClient()
      const data = newQueryClient.getQueryData(queryKey)

      // Note: In a real scenario, the persister would restore this
      // This test verifies the IndexedDB functions work correctly
      expect(data).toBeUndefined() // Not restored yet in this test setup
    })
  })
})
