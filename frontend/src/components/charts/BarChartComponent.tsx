import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DEFAULT_CHART_MARGIN, DEFAULT_GRID_PROPS, DEFAULT_RESPONSIVE_PROPS, defaultTooltipProps, defaultLegendProps } from './chartConfig';

interface BarChartProps {
  data: Record<string, unknown>[];
  xKey: string;
  bars: { key: string; color: string; name?: string }[];
}

export function BarChartComponent({ data, xKey, bars }: BarChartProps) {
  return (
    <ResponsiveContainer {...DEFAULT_RESPONSIVE_PROPS}>
      <BarChart data={data} margin={DEFAULT_CHART_MARGIN}>
        <CartesianGrid {...DEFAULT_GRID_PROPS} />
        <XAxis dataKey={xKey} />
        <YAxis />
        <Tooltip {...defaultTooltipProps} />
        <Legend {...defaultLegendProps} />
        {bars.map((bar) => (
          <Bar key={bar.key} dataKey={bar.key} fill={bar.color} name={bar.name || bar.key} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

