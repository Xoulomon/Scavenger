import type { Meta, StoryObj } from '@storybook/react'
import { Badge } from './Badge'
import { Button } from './Button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './Card'

const meta: Meta<typeof Card> = {
  title: 'Design System/Card',
  component: Card,
  tags: ['autodocs']
}
export default meta
type Story = StoryObj<typeof Card>

export const Default: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Waste Submission</CardTitle>
        <CardDescription>Submit recyclable materials to earn rewards.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Upload photos and details of your recyclable waste to get verified and earn tokens.
        </p>
      </CardContent>
      <CardFooter>
        <Button className="w-full">Submit Waste</Button>
      </CardFooter>
    </Card>
  )
}

export const StatCard: Story = {
  render: () => (
    <Card className="w-56">
      <CardHeader className="pb-2">
        <CardDescription>Total Recycled</CardDescription>
        <CardTitle className="text-3xl">1,240 kg</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">+12% from last month</p>
      </CardContent>
    </Card>
  )
}

export const WithBadge: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle>Plastic Bottles</CardTitle>
          <Badge variant="default">Verified</Badge>
        </div>
        <CardDescription>Submitted by 0xABCD…1234</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-muted-foreground">Weight</dt>
          <dd className="font-medium">5.2 kg</dd>
          <dt className="text-muted-foreground">Reward</dt>
          <dd className="font-medium text-primary">52 tokens</dd>
        </dl>
      </CardContent>
    </Card>
  )
}
