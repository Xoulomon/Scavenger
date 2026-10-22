import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { BarChartComponent } from './BarChartComponent';
import { LineChartComponent } from './LineChartComponent';
import { PieChartComponent } from './PieChartComponent';
import { DEFAULT_CHART_COLORS } from './chartConfig';

/**
 * Card shells for the chart wrappers. They are the only place pages should
 * build a chart: the title, loading state, empty state and height are shared.
 */

const CHART_HEIGHT = 200;

interface ChartCardProps {
  title: string;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  children: ReactNode;
}

export function ChartCard({ title, isLoading = false, isEmpty = false, emptyMessage = 'No data yet', children }: ChartCardProps) {
  let body: ReactNode;
  if (isLoading) {
    body = <div role="status" aria-label={`Loading ${title}`} className="h-48 w-full animate-pulse rounded-lg bg-muted" />;
  } else if (isEmpty) {
    body = <p className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
  } else {
    body = <div style={{ height: CHART_HEIGHT }}>{children}</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}

interface BarChartCardProps {
  title: string;
  data: Record<string, unknown>[];
  xKey: string;
  bars: { key: string; color?: string; name?: string }[];
  isLoading?: boolean;
  emptyMessage?: string;
}

export function BarChartCard({ title, data, xKey, bars, isLoading, emptyMessage }: BarChartCardProps) {
  const resolved = bars.map((bar, index) => ({
    ...bar,
    color: bar.color ?? DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length],
  }));
  return (
    <ChartCard title={title} isLoading={isLoading} isEmpty={data.length === 0} emptyMessage={emptyMessage}>
      <BarChartComponent data={data} xKey={xKey} bars={resolved} />
    </ChartCard>
  );
}

interface LineChartCardProps {
  title: string;
  data: Record<string, unknown>[];
  xKey: string;
  lines: { key: string; color?: string; name?: string }[];
  isLoading?: boolean;
  emptyMessage?: string;
}

export function LineChartCard({ title, data, xKey, lines, isLoading, emptyMessage }: LineChartCardProps) {
  const resolved = lines.map((line, index) => ({
    ...line,
    color: line.color ?? DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length],
  }));
  return (
    <ChartCard title={title} isLoading={isLoading} isEmpty={data.length === 0} emptyMessage={emptyMessage}>
      <LineChartComponent data={data} xKey={xKey} lines={resolved} />
    </ChartCard>
  );
}

interface PieChartCardProps {
  title: string;
  data: { name: string; value: number }[];
  colors?: string[];
  isLoading?: boolean;
  emptyMessage?: string;
}

export function PieChartCard({ title, data, colors, isLoading, emptyMessage }: PieChartCardProps) {
  return (
    <ChartCard title={title} isLoading={isLoading} isEmpty={data.length === 0} emptyMessage={emptyMessage}>
      <PieChartComponent data={data} colors={colors} />
    </ChartCard>
  );
}
