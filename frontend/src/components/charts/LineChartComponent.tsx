import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DEFAULT_CHART_MARGIN, DEFAULT_GRID_PROPS, DEFAULT_RESPONSIVE_PROPS, defaultTooltipProps, defaultLegendProps } from './chartConfig';

interface LineChartProps {
  data: Record<string, unknown>[];
  xKey: string;
  lines: { key: string; color: string; name?: string }[];
}

export function LineChartComponent({ data, xKey, lines }: LineChartProps) {
  return (
    <ResponsiveContainer {...DEFAULT_RESPONSIVE_PROPS}>
      <LineChart data={data} margin={DEFAULT_CHART_MARGIN}>
        <CartesianGrid {...DEFAULT_GRID_PROPS} />
        <XAxis dataKey={xKey} />
        <YAxis />
        <Tooltip {...defaultTooltipProps} />
        <Legend {...defaultLegendProps} />
        {lines.map((line) => (
          <Line
            key={line.key}
            type="monotone"
            dataKey={line.key}
            stroke={line.color}
            name={line.name || line.key}
            strokeWidth={2}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

