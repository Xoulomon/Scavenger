import { useState, useMemo, useRef, useId, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Controller, type Control, type FieldErrors } from 'react-hook-form'
import {
  Newspaper,
  Recycle,
  Package,
  Wrench,
  GlassWater,
  Leaf,
  Cpu,
  Search,
  ChevronDown
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { handleListKeyboard } from '@/lib/accessibility'
import { WasteType } from '@/api/types'
import { EmptyState } from '@/components/ui/EmptyState'
import { WASTE_TYPES } from '@/lib/constants'
import type { WasteFormValues } from '@/lib/schemas/waste'

const WASTE_TYPE_ICONS = {
  [WasteType.Paper]: Newspaper,
  [WasteType.PetPlastic]: Recycle,
  [WasteType.Plastic]: Package,
  [WasteType.Metal]: Wrench,
  [WasteType.Glass]: GlassWater,
  [WasteType.Organic]: Leaf,
  [WasteType.Electronic]: Cpu
} as const

/**
 * Static option metadata. `label` is kept for backwards compatibility with
 * existing callers/tests; UI rendering uses the i18n key `labelKey`.
 */
export const WASTE_TYPE_OPTIONS = WASTE_TYPES.map((wasteType) => ({
  value: wasteType.value,
  label: wasteType.label,
  labelKey: `waste.materials.${wasteType.value}`,
  icon: WASTE_TYPE_ICONS[wasteType.value]
}))

interface WasteMaterialSelectorProps {
  control: Control<WasteFormValues>
  selectedType: WasteType | ''
  errors: FieldErrors<WasteFormValues>
}

export function WasteMaterialSelector({
  control,
  selectedType,
  errors
}: WasteMaterialSelectorProps) {
  const { t } = useTranslation()
  const [materialSearch, setMaterialSearch] = useState('')
  const [materialDropdownOpen, setMaterialDropdownOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const baseId = useId()
  const listboxId = `${baseId}-listbox`
  const searchLabelId = `${baseId}-search-label`
  const optionId = (index: number) => `${baseId}-option-${index}`

  const filteredMaterials = useMemo(() => {
    if (!materialSearch) return WASTE_TYPE_OPTIONS
    const lower = materialSearch.toLowerCase()
    return WASTE_TYPE_OPTIONS.filter((opt) => t(opt.labelKey).toLowerCase().includes(lower))
  }, [materialSearch, t])

  const selectedOption = WASTE_TYPE_OPTIONS.find((opt) => opt.value === selectedType)

  const openDropdown = () => {
    setMaterialDropdownOpen(true)
    const selectedIdx = filteredMaterials.findIndex((opt) => opt.value === selectedType)
    setActiveIndex(selectedIdx >= 0 ? selectedIdx : 0)
    requestAnimationFrame(() => searchInputRef.current?.focus())
  }

  const closeDropdown = () => {
    setMaterialDropdownOpen(false)
    setMaterialSearch('')
    setActiveIndex(-1)
  }

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault()
      openDropdown()
    }
  }

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeDropdown()
      return
    }
    if (event.key === 'Enter' && activeIndex >= 0 && filteredMaterials[activeIndex]) {
      event.preventDefault()
      onSelectOption(filteredMaterials[activeIndex].value)
      return
    }
    handleListKeyboard(event, {
      itemCount: filteredMaterials.length,
      activeIndex,
      setActiveIndex
    })
  }

  return (
    <section>
      <span id={`${baseId}-label`} className="mb-2 block text-sm font-medium">
        {t('waste.materialType')}{' '}
        <span className="text-destructive" aria-hidden="true">
          *
        </span>
      </span>
      <Controller
        name="wasteType"
        control={control}
        render={({ field, fieldState }) => {
          const onSelectOption = (value: WasteType) => {
            field.onChange(value)
            field.onBlur()
            closeDropdown()
          }

          return (
            <div className="relative">
              <button
                type="button"
                onClick={() => (materialDropdownOpen ? closeDropdown() : openDropdown())}
                onKeyDown={handleTriggerKeyDown}
                className={cn(
                  'flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-background px-2 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 xs:px-3',
                  !selectedOption && 'text-muted-foreground',
                  fieldState.error && 'border-destructive'
                )}
                aria-label={t('waste.selectMaterialType')}
                aria-labelledby={`${baseId}-label`}
                aria-expanded={materialDropdownOpen}
                aria-haspopup="listbox"
                aria-controls={materialDropdownOpen ? listboxId : undefined}
                aria-invalid={fieldState.invalid}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {selectedOption ? (
                    <>
                      <selectedOption.icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{t(selectedOption.labelKey)}</span>
                    </>
                  ) : (
                    <span className="truncate">{t('waste.selectMaterialType')}</span>
                  )}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
              </button>
              {materialDropdownOpen && (
                <div className="absolute z-50 mt-1 w-full min-w-0 rounded-md border bg-popover shadow-md">
                  <div className="flex items-center border-b px-2 xs:px-3">
                    <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <label id={searchLabelId} htmlFor={`${baseId}-search`} className="sr-only">
                      Search materials
                    </label>
                    <input
                      id={`${baseId}-search`}
                      ref={searchInputRef}
                      type="text"
                      placeholder={t('waste.searchMaterials')}
                      value={materialSearch}
                      onChange={(e) => {
                        setMaterialSearch(e.target.value)
                        setActiveIndex(0)
                      }}
                      onKeyDown={handleSearchKeyDown}
                      className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
                      aria-label={t('waste.searchMaterials')}
                      aria-labelledby={searchLabelId}
                      aria-controls={listboxId}
                      aria-activedescendant={
                        activeIndex >= 0 && filteredMaterials[activeIndex]
                          ? optionId(activeIndex)
                          : undefined
                      }
                      aria-autocomplete="list"
                    />
                  </div>
                  <ul
                    id={listboxId}
                    role="listbox"
                    aria-labelledby={`${baseId}-label`}
                    className="max-h-48 overflow-y-auto p-1 xs:max-h-56 tablet:max-h-64"
                  >
                    {filteredMaterials.length === 0 ? (
                      <li>
                        <EmptyState title={t('waste.noMaterialsFound')} className="px-3 py-2" />
                      </li>
                    ) : (
                      filteredMaterials.map((opt, index) => {
                        const Icon = opt.icon
                        return (
                          <li
                            key={opt.value}
                            id={optionId(index)}
                            role="option"
                            aria-selected={field.value === opt.value}
                            onClick={() => onSelectOption(opt.value)}
                            onMouseEnter={() => setActiveIndex(index)}
                            className={cn(
                              'flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm hover:bg-accent xs:px-3',
                              field.value === opt.value && 'bg-accent',
                              activeIndex === index && 'ring-1 ring-ring'
                            )}
                          >
                            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <span className="truncate">{t(opt.labelKey)}</span>
                          </li>
                        )
                      })
                    )}
                  </ul>
                </div>
              )}
            </div>
          )
        }}
      />
      {errors.wasteType && (
        <p className="mt-1 text-sm text-destructive" role="alert">
          {errors.wasteType.message}
        </p>
      )}
      {!errors.wasteType && selectedType === '' && (
        <p className="mt-1 text-xs text-muted-foreground">
          Choose the material you are submitting.
        </p>
      )}
    </section>
  )
}
