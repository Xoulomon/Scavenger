import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BarChartCard, LineChartCard, PieChartCard } from './ChartCards';
import { DEFAULT_CHART_COLORS } from './chartConfig';
import { BarChartComponent } from './BarChartComponent';
import { LineChartComponent } from './LineChartComponent';
import { PieChartComponent } from './PieChartComponent';

vi.mock('./BarChartComponent', () => ({ BarChartComponent: vi.fn(() => <div data-testid="bar" />) }));
vi.mock('./LineChartComponent', () => ({ LineChartComponent: vi.fn(() => <div data-testid="line" />) }));
vi.mock('./PieChartComponent', () => ({ PieChartComponent: vi.fn(() => <div data-testid="pie" />) }));

const monthly = [
  { month: 'Jan', count: 3 },
  { month: 'Feb', count: 5 },
];

describe('chart cards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('empty data', () => {
    it('shows the empty message and skips the chart for an empty bar series', () => {
      render(<BarChartCard title="Submissions" data={[]} xKey="month" bars={[{ key: 'count' }]} />);

      expect(screen.getByText('Submissions')).toBeInTheDocument();
      expect(screen.getByText('No data yet')).toBeInTheDocument();
      expect(BarChartComponent).not.toHaveBeenCalled();
    });

    it('uses a custom empty message for a pie chart', () => {
      render(<PieChartCard title="Waste" data={[]} emptyMessage="Nothing recycled" />);

      expect(screen.getByText('Nothing recycled')).toBeInTheDocument();
      expect(PieChartComponent).not.toHaveBeenCalled();
    });
  });

  describe('loading', () => {
    it('shows a loading status instead of the empty message while loading', () => {
      render(<LineChartCard title="Trend" data={[]} xKey="month" lines={[{ key: 'count' }]} isLoading />);

      expect(screen.getByRole('status', { name: 'Loading Trend' })).toBeInTheDocument();
      expect(screen.queryByText('No data yet')).not.toBeInTheDocument();
      expect(LineChartComponent).not.toHaveBeenCalled();
    });
  });

  describe('single and multi series', () => {
    it('renders one bar with the default palette colour when no colour is given', () => {
      render(<BarChartCard title="Submissions" data={monthly} xKey="month" bars={[{ key: 'count' }]} />);

      expect(screen.getByTestId('bar')).toBeInTheDocument();
      const props = vi.mocked(BarChartComponent).mock.calls[0][0];
      expect(props.bars).toEqual([{ key: 'count', color: DEFAULT_CHART_COLORS[0] }]);
    });

    it('gives each line in a multi-series chart its own palette colour', () => {
      render(
        <LineChartCard
          title="Trend"
          data={monthly}
          xKey="month"
          lines={[{ key: 'a' }, { key: 'b' }, { key: 'c', color: '#123456' }]}
        />,
      );

      const props = vi.mocked(LineChartComponent).mock.calls[0][0];
      expect(props.lines.map((l) => l.color)).toEqual([
        DEFAULT_CHART_COLORS[0],
        DEFAULT_CHART_COLORS[1],
        '#123456',
      ]);
    });

    it('passes pie slices through to the pie wrapper', () => {
      const slices = [
        { name: 'Plastic', value: 4 },
        { name: 'Glass', value: 1 },
      ];
      render(<PieChartCard title="Waste by Type" data={slices} />);

      expect(screen.getByTestId('pie')).toBeInTheDocument();
      expect(vi.mocked(PieChartComponent).mock.calls[0][0].data).toEqual(slices);
    });
  });
});
