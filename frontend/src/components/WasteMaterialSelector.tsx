import { useState, useMemo } from 'react'
import { Controller, type Control, type FieldErrors } from 'react-hook-form'
import {
  Newspaper, Recycle, Package, Wrench, GlassWater,
  Leaf, Cpu, Search, ChevronDown
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { WasteType } from '@/api/types'
import type { WasteFormValues } from './WasteSubmissionFields'

export const WASTE_TYPE_OPTIONS = [
  { value: WasteType.Paper, label: 'Paper', icon: Newspaper },
  { value: WasteType.PetPlastic, label: 'PET Plastic', icon: Recycle },
  { value: WasteType.Plastic, label: 'Plastic', icon: Package },
  { value: WasteType.Metal, label: 'Metal', icon: Wrench },
  { value: WasteType.Glass, label: 'Glass', icon: GlassWater },
  { value: WasteType.Organic, label: 'Organic', icon: Leaf },
  { value: WasteType.Electronic, label: 'Electronic', icon: Cpu },
] as const

interface WasteMaterialSelectorProps {
  control: Control<WasteFormValues>
  selectedType: WasteType | ''
  errors: FieldErrors<WasteFormValues>
}

export function WasteMaterialSelector({ control, selectedType, errors }: WasteMaterialSelectorProps) {
  const [materialSearch, setMaterialSearch] = useState('')
  const [materialDropdownOpen, setMaterialDropdownOpen] = useState(false)

  const filteredMaterials = useMemo(() => {
    if (!materialSearch) return WASTE_TYPE_OPTIONS
    const lower = materialSearch.toLowerCase()
    return WASTE_TYPE_OPTIONS.filter((opt) => opt.label.toLowerCase().includes(lower))
  }, [materialSearch])

  const selectedOption = WASTE_TYPE_OPTIONS.find((opt) => opt.value === selectedType)

  return (
    <section>
      <label className="block text-sm font-medium mb-2">
        Material Type <span className="text-destructive">*</span>
      </label>
      <Controller
        name="wasteType"
        control={control}
        render={({ field }) => (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMaterialDropdownOpen(!materialDropdownOpen)}
              className={cn(
                'flex h-11 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                !selectedOption && 'text-muted-foreground'
              )}
              aria-label="Select material type"
              aria-expanded={materialDropdownOpen}
              aria-haspopup="listbox"
            >
              <span className="flex items-center gap-2">
                {selectedOption ? (
                  <>
                    <selectedOption.icon className="h-4 w-4" />
                    {selectedOption.label}
                  </>
                ) : (
                  'Select material type'
                )}
              </span>
              <ChevronDown className="h-4 w-4 opacity-50" />
            </button>
            {materialDropdownOpen && (
              <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
                <div className="flex items-center border-b px-3">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search materials..."
                    value={materialSearch}
                    onChange={(e) => setMaterialSearch(e.target.value)}
                    className="flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
                    aria-label="Search materials"
                  />
                </div>
                <ul role="listbox" className="max-h-48 overflow-y-auto p-1">
                  {filteredMaterials.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-muted-foreground">No materials found</li>
                  ) : (
                    filteredMaterials.map((opt) => {
                      const Icon = opt.icon
                      return (
                        <li
                          key={opt.value}
                          role="option"
                          aria-selected={field.value === opt.value}
                          onClick={() => {
                            field.onChange(opt.value)
                            setMaterialDropdownOpen(false)
                            setMaterialSearch('')
                          }}
                          className={cn(
                            'flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent',
                            field.value === opt.value && 'bg-accent'
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {opt.label}
                        </li>
                      )
                    })
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      />
      {errors.wasteType && (
        <p className="mt-1 text-sm text-destructive" role="alert">{errors.wasteType.message}</p>
      )}
    </section>
  )
}
