import { z } from 'zod'
import { WasteType } from '@/api/types'

export type WeightUnit = 'grams' | 'kilograms'

/** Forms track an unselected material as '' before the user picks one. */
export const wasteTypeFieldSchema = z
  .union([z.nativeEnum(WasteType), z.literal('')])
  .refine((v) => v !== '', { message: 'Material type is required' })

/** Weight is always collected in the unit currently selected in the UI; the
 * minimum-weight message and threshold both depend on that unit. */
export function weightFieldSchema(unit: WeightUnit = 'grams') {
  return z.string().superRefine((value, ctx) => {
    const num = parseFloat(value)
    if (value.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Weight is required' })
      return
    }
    if (unit === 'kilograms') {
      if (isNaN(num) || num < 0.001) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Minimum weight is 0.001 kg (1 gram)' })
      }
    } else if (isNaN(num) || num < 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Minimum weight is 1 gram' })
    }
  })
}

export const latitudeFieldSchema = z
  .string()
  .min(1, 'Latitude is required')
  .superRefine((value, ctx) => {
    const num = parseFloat(value)
    if (isNaN(num) || num < -90 || num > 90) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Latitude must be between -90 and 90' })
    }
  })

export const longitudeFieldSchema = z
  .string()
  .min(1, 'Longitude is required')
  .superRefine((value, ctx) => {
    const num = parseFloat(value)
    if (isNaN(num) || num < -180 || num > 180) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Longitude must be between -180 and 180' })
    }
  })

/** Shared shape for the waste-submission form and the waste-submission wizard. */
export function wasteSubmissionSchema(weightUnit: WeightUnit = 'grams') {
  return z.object({
    wasteType: wasteTypeFieldSchema,
    weight: weightFieldSchema(weightUnit),
    latitude: latitudeFieldSchema,
    longitude: longitudeFieldSchema,
    notes: z.string().optional().default(''),
  })
}

export type WasteSubmissionFormValues = z.infer<ReturnType<typeof wasteSubmissionSchema>>

export function convertWeight(weightValue: string, weightUnit: WeightUnit): string | undefined {
  const num = parseFloat(weightValue)
  if (isNaN(num) || num <= 0) return undefined
  if (weightUnit === 'grams') return `${(num / 1000).toFixed(3)} kg`
  return `${(num * 1000).toFixed(0)} g`
}

export function toWeightInGrams(weight: string | number, weightUnit: WeightUnit): number {
  const num = typeof weight === 'string' ? parseFloat(weight) : weight
  return weightUnit === 'grams' ? num : num * 1000
}
