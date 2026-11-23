import type { Meta, StoryObj } from '@storybook/react'
import {
  StatCardSkeleton,
  WasteCardSkeleton,
  IncentiveCardSkeleton,
  PageSkeleton
} from './Skeletons'

const meta: Meta = {
  title: 'Design System/Skeletons',
  tags: ['autodocs']
}
export default meta

export const StatCard: StoryObj = {
  render: () => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
    </div>
  )
}

export const WasteCard: StoryObj = {
  render: () => (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full">
        <tbody>
          <WasteCardSkeleton />
          <WasteCardSkeleton />
          <WasteCardSkeleton />
        </tbody>
      </table>
    </div>
  )
}

export const IncentiveCard: StoryObj = {
  render: () => (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full">
        <tbody>
          <IncentiveCardSkeleton />
          <IncentiveCardSkeleton />
        </tbody>
      </table>
    </div>
  )
}

export const FullPage: StoryObj = {
  render: () => <PageSkeleton />
}
