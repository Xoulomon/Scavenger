import { Role, WasteType } from '../api/types'
export { formatDate, formatTokenAmount } from './format'

export const formatAddress = (addr: string): string =>
  `${addr.slice(0, 4)}...${addr.slice(-4)}`

export const wasteTypeLabel = (type: WasteType): string =>
  ({
    [WasteType.Paper]: 'Paper',
    [WasteType.PetPlastic]: 'PET Plastic',
    [WasteType.Plastic]: 'Plastic',
    [WasteType.Metal]: 'Metal',
    [WasteType.Glass]: 'Glass',
    [WasteType.Organic]: 'Organic',
    [WasteType.Electronic]: 'Electronic',
  })[type] ?? 'Unknown'

export const roleLabel = (role: Role): string =>
  ({ [Role.Recycler]: 'Recycler', [Role.Collector]: 'Collector', [Role.Manufacturer]: 'Manufacturer' })[role] ?? 'Unknown'
