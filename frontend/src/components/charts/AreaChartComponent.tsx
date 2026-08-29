import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DEFAULT_CHART_MARGIN, DEFAULT_GRID_PROPS, DEFAULT_RESPONSIVE_PROPS, defaultTooltipProps, defaultLegendProps } from './chartConfig';

interface AreaChartProps {
  data: Record<string, unknown>[];
  xKey: string;
  areas: { key: string; color: string; name?: string }[];
}

export function AreaChartComponent({ data, xKey, areas }: AreaChartProps) {
  return (
    <ResponsiveContainer {...DEFAULT_RESPONSIVE_PROPS}>
      <AreaChart data={data} margin={DEFAULT_CHART_MARGIN}>
        <CartesianGrid {...DEFAULT_GRID_PROPS} />
        <XAxis dataKey={xKey} />
        <YAxis />
        <Tooltip {...defaultTooltipProps} />
        <Legend {...defaultLegendProps} />
        {areas.map((area) => (
          <Area
            key={area.key}
            type="monotone"
            dataKey={area.key}
            stroke={area.color}
            fill={area.color}
            name={area.name || area.key}
            fillOpacity={0.6}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

