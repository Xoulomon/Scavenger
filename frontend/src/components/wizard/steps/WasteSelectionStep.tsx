import { WasteSelectionStepProps } from '../types'

const mockWastes = [
  { id: 'W001', type: 'Plastic', quantity: '50kg', status: 'Available' },
  { id: 'W002', type: 'Metal', quantity: '100kg', status: 'Available' },
  { id: 'W003', type: 'Glass', quantity: '75kg', status: 'Available' }
]

export function WasteSelectionStep({ formData, setValue }: WasteSelectionStepProps) {
  const toggleWaste = (wasteId: string) => {
    const current = formData.wasteIds || []
    const updated = current.includes(wasteId)
      ? current.filter((id: string) => id !== wasteId)
      : [...current, wasteId]
    setValue('wasteIds', updated)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Select Waste</h2>
      <p className="text-sm text-muted-foreground">Choose one or more waste items to transfer</p>

      <div className="space-y-2">
        {mockWastes.map((waste) => (
          <label
            key={waste.id}
            className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-muted/50"
          >
            <input
              type="checkbox"
              checked={formData.wasteIds?.includes(waste.id)}
              onChange={() => toggleWaste(waste.id)}
              className="mr-3"
            />
            <div className="flex-1">
              <p className="font-medium">{waste.type}</p>
              <p className="text-sm text-muted-foreground">
                ID: {waste.id} • {waste.quantity} • {waste.status}
              </p>
            </div>
          </label>
        ))}
      </div>

      {formData.wasteIds?.length === 0 && (
        <p className="text-sm text-red-500">Please select at least one waste item</p>
      )}
    </div>
  )
}
