import { useState, useEffect } from 'react'

interface ScanRecord {
  id: string
  wasteId: string
  timestamp: number
}

const STORAGE_KEY = 'qr_scan_history'
const MAX_HISTORY = 50

export function useScanHistory() {
  const [history, setHistory] = useState<ScanRecord[]>([])

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setHistory(JSON.parse(stored))
      } catch (e) {
        console.error('Failed to parse scan history', e)
      }
    }
  }, [])

  const addScan = (wasteId: string) => {
    const newRecord: ScanRecord = {
      id: crypto.randomUUID(),
      wasteId,
      timestamp: Date.now()
    }

    const updated = [newRecord, ...history].slice(0, MAX_HISTORY)
    setHistory(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }

  const clearHistory = () => {
    setHistory([])
    localStorage.removeItem(STORAGE_KEY)
  }

  return { history, addScan, clearHistory }
}
