import type { Meta, StoryObj } from '@storybook/react'
import { Button } from './Button'
import { WasteCard } from './WasteCard'
import { WasteType } from '@/api/types'

const meta: Meta<typeof WasteCard> = {
  title: 'Design System/WasteCard',
  component: WasteCard,
  tags: ['autodocs']
}
export default meta
type Story = StoryObj<typeof WasteCard>

const baseWaste = {
  waste_id: BigInt(1001),
  waste_type: WasteType.Paper,
  weight: BigInt(5200),
  current_owner: 'GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTQSXUSMIQ75XABZEYYWRB46Z',
  latitude: BigInt(40712800),
  longitude: BigInt(-74006000),
  recycled_timestamp: Date.now(),
  is_active: true,
  is_confirmed: false,
  confirmer: ''
}

export const Pending: Story = {
  args: {
    waste: baseWaste
  }
}

export const Confirmed: Story = {
  args: {
    waste: {
      ...baseWaste,
      waste_id: BigInt(1002),
      is_confirmed: true,
      confirmer: 'GBVNO3XEUPVHPQXGTHFZEPXE4RXQFQFVHIFLZXDSFGK7YKIBLNRJRPH'
    }
  }
}

export const Inactive: Story = {
  args: {
    waste: {
      ...baseWaste,
      waste_id: BigInt(1003),
      waste_type: WasteType.Plastic,
      is_active: false,
      weight: BigInt(12000)
    }
  }
}

export const WithActions: Story = {
  args: {
    waste: {
      ...baseWaste,
      waste_id: BigInt(1004),
      waste_type: WasteType.Metal,
      weight: BigInt(750)
    },
    actions: (
      <>
        <Button size="sm" variant="outline" className="flex-1">
          View
        </Button>
        <Button size="sm" className="flex-1">
          Transfer
        </Button>
      </>
    )
  }
}

export const AllWasteTypes: Story = {
  render: () => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {(
        [
          WasteType.Paper,
          WasteType.Plastic,
          WasteType.PetPlastic,
          WasteType.Metal,
          WasteType.Glass
        ] as WasteType[]
      ).map((type, i) => (
        <WasteCard
          key={type}
          waste={{
            ...baseWaste,
            waste_id: BigInt(2000 + i),
            waste_type: type,
            weight: BigInt(1000 + i * 500),
            is_confirmed: i % 2 === 0
          }}
        />
      ))}
    </div>
  )
}
