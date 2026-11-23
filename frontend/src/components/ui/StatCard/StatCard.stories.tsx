import type { Meta, StoryObj } from '@storybook/react'
import { Recycle, Users, TrendingUp, Award, Package, AlertTriangle } from 'lucide-react'
import { StatCard } from './index'

const meta: Meta<typeof StatCard> = {
  title: 'Design System/StatCard',
  component: StatCard,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'primary', 'success', 'warning', 'destructive']
    },
    trend: {
      control: 'select',
      options: [undefined, 'up', 'down']
    }
  }
}
export default meta
type Story = StoryObj<typeof StatCard>

export const Default: Story = {
  args: {
    icon: <Recycle className="h-4 w-4" />,
    label: 'Total Recycled',
    value: '1,240 kg'
  }
}

export const WithTrend: Story = {
  args: {
    icon: <TrendingUp className="h-4 w-4" />,
    label: 'Tokens Earned',
    value: '8,420',
    trend: 'up',
    trendLabel: '+12% this month',
    variant: 'success'
  }
}

export const NegativeTrend: Story = {
  args: {
    icon: <Package className="h-4 w-4" />,
    label: 'Pending Submissions',
    value: '34',
    trend: 'down',
    trendLabel: '-5 from last week',
    variant: 'warning'
  }
}

export const Loading: Story = {
  args: {
    icon: <Users className="h-4 w-4" />,
    label: 'Active Participants',
    value: '—',
    isLoading: true,
    trendLabel: 'loading...'
  }
}

export const AllVariants: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
      <StatCard
        icon={<Recycle className="h-4 w-4" />}
        label="Default"
        value="1,240 kg"
        variant="default"
      />
      <StatCard
        icon={<TrendingUp className="h-4 w-4" />}
        label="Primary"
        value="8,420"
        variant="primary"
        trendLabel="tokens"
      />
      <StatCard
        icon={<Award className="h-4 w-4" />}
        label="Success"
        value="92%"
        variant="success"
        trend="up"
        trendLabel="+4% vs last month"
      />
      <StatCard
        icon={<AlertTriangle className="h-4 w-4" />}
        label="Warning"
        value="12"
        variant="warning"
        trendLabel="pending reviews"
      />
      <StatCard
        icon={<Package className="h-4 w-4" />}
        label="Destructive"
        value="3"
        variant="destructive"
        trendLabel="failed transfers"
      />
    </div>
  )
}
