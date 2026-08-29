/**
 * Shared configuration and defaults for chart components.
 */

export const DEFAULT_CHART_COLORS = [
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#ff8042',
  '#0088fe',
  '#00c49f',
  '#ffbb28',
  '#a4de6c',
  '#d0ed57',
];

export const DEFAULT_CHART_MARGIN = {
  top: 5,
  right: 30,
  left: 20,
  bottom: 5,
};

export const DEFAULT_GRID_PROPS = {
  strokeDasharray: '3 3',
};

export const DEFAULT_RESPONSIVE_PROPS = {
  width: '100%' as const,
  height: '100%' as const,
};

export const defaultTooltipProps = {
  contentStyle: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  },
};

export const defaultLegendProps = {
  verticalAlign: 'bottom' as const,
  height: 36,
};
