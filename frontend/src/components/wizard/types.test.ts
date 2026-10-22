import { describe, it, expect } from 'vitest'
import {
  WasteSubmissionFormData,
  TransferFormData,
  LocationStepProps,
  WasteTypeStepProps,
  WasteSelectionStepProps,
  RecipientSelectionStepProps,
  ReviewStepProps,
  ReviewConfirmStepProps,
} from './types'
import { WasteType } from '@/api/types'

describe('Wizard Types', () => {
  describe('WasteSubmissionFormData', () => {
    it('should have required properties', () => {
      const data: WasteSubmissionFormData = {
        wasteType: WasteType.Paper,
        weight: 10,
        latitude: '40.7128',
        longitude: '-74.0060',
        notes: 'Test waste',
      }
      expect(data.wasteType).toBe(WasteType.Paper)
      expect(data.weight).toBe(10)
      expect(data.latitude).toBe('40.7128')
      expect(data.longitude).toBe('-74.0060')
      expect(data.notes).toBe('Test waste')
    })
  })

  describe('TransferFormData', () => {
    it('should have required properties', () => {
      const data: TransferFormData = {
        wasteId: 'W123',
        recipientAddress: 'GXYZ123ABC',
        latitude: '40.7128',
        longitude: '-74.0060',
        notes: 'Transfer test',
      }
      expect(data.wasteId).toBe('W123')
      expect(data.recipientAddress).toBe('GXYZ123ABC')
      expect(data.latitude).toBe('40.7128')
      expect(data.longitude).toBe('-74.0060')
      expect(data.notes).toBe('Transfer test')
    })
  })
})
