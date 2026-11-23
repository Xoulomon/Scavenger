import type { Meta, StoryObj } from '@storybook/react'
import { PerformanceAlert, PerformanceSummary } from './PerformanceAlert'

const meta: Meta = {
  title: 'Design System/PerformanceAlert',
  tags: ['autodocs']
}
export default meta

export const Good: StoryObj = {
  render: () => (
    <PerformanceAlert
      metric="LCP"
      value="1,840 ms"
      severity="good"
      message="Largest Contentful Paint is within the recommended 2,500 ms budget."
    />
  )
}

export const Warning: StoryObj = {
  render: () => (
    <PerformanceAlert
      metric="FCP"
      value="2,300 ms"
      severity="warning"
      message="First Contentful Paint exceeds the 1,800 ms good threshold. Consider optimising render-blocking resources."
    />
  )
}

export const Critical: StoryObj = {
  render: () => (
    <PerformanceAlert
      metric="INP"
      value="620 ms"
      severity="critical"
      message="Interaction to Next Paint is above the 500 ms poor threshold — users will notice sluggish interactions."
    />
  )
}

export const AllSeverities: StoryObj = {
  render: () => (
    <div className="space-y-2 w-96">
      <PerformanceAlert metric="LCP" value="1,840 ms" severity="good" message="Within budget." />
      <PerformanceAlert
        metric="TTFB"
        value="820 ms"
        severity="warning"
        message="Slightly above the 600 ms threshold."
      />
      <PerformanceAlert
        metric="CLS"
        value="0.31"
        severity="critical"
        message="Cumulative Layout Shift exceeds the 0.25 poor threshold."
      />
    </div>
  )
}

export const Summary: StoryObj = {
  render: () => (
    <div className="space-y-2">
      <PerformanceSummary passed={4} total={5} />
      <PerformanceSummary passed={5} total={5} />
      <PerformanceSummary passed={1} total={5} />
    </div>
  )
}
