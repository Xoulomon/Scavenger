import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DEFAULT_CHART_COLORS, DEFAULT_RESPONSIVE_PROPS, defaultTooltipProps, defaultLegendProps } from './chartConfig';

interface PieChartProps {
  data: { name: string; value: number }[];
  colors?: string[];
}

export function PieChartComponent({ data, colors = DEFAULT_CHART_COLORS }: PieChartProps) {
  return (
    <ResponsiveContainer {...DEFAULT_RESPONSIVE_PROPS}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" labelLine={false} label outerRadius={80} fill="#8884d8" dataKey="value">
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip {...defaultTooltipProps} />
        <Legend {...defaultLegendProps} />
      </PieChart>
    </ResponsiveContainer>
  );
}

