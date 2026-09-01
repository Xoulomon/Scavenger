import { WasteType } from '@/api/types'
import { Newspaper, Recycle, Package, Wrench, GlassWater } from 'lucide-react'
import { WasteTypeStepProps } from '../types'

const WASTE_TYPES: { value: WasteType; label: string; icon: React.ReactNode }[] = [
  { value: WasteType.Paper, label: 'Paper', icon: <Newspaper className="h-5 w-5" /> },
  { value: WasteType.PetPlastic, label: 'PET Plastic', icon: <Recycle className="h-5 w-5" /> },
  { value: WasteType.Plastic, label: 'Plastic', icon: <Package className="h-5 w-5" /> },
  { value: WasteType.Metal, label: 'Metal', icon: <Wrench className="h-5 w-5" /> },
  { value: WasteType.Glass, label: 'Glass', icon: <GlassWater className="h-5 w-5" /> },
];

export function WasteTypeStep({ register, formData, setValue }: WasteTypeStepProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Waste Type</h2>
      <p className="text-sm text-muted-foreground">
        Select the type of waste you want to submit
      </p>

      <div className="space-y-2">
        {WASTE_TYPES.map((type) => (
          <label
            key={type.value}
            className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-muted/50"
          >
            <input
              type="radio"
              value={type.value}
              checked={formData.wasteType === type.value}
              onChange={(e) => setValue('wasteType', Number(e.target.value) as WasteType)}
              className="mr-3"
            />
            <div className="flex-1 flex items-center gap-3">
              {type.icon}
              <span className="font-medium">{type.label}</span>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
