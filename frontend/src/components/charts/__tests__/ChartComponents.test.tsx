import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { LineChartComponent } from '../LineChartComponent';
import { BarChartComponent } from '../BarChartComponent';
import { PieChartComponent } from '../PieChartComponent';
import { AreaChartComponent } from '../AreaChartComponent';

describe('Chart Components', () => {
  const mockData = [
    { month: 'Jan', value: 10, revenue: 100 },
    { month: 'Feb', value: 20, revenue: 200 },
    { month: 'Mar', value: 15, revenue: 150 },
  ];

  const mockPieData = [
    { name: 'Plastic', value: 40 },
    { name: 'Glass', value: 30 },
    { name: 'Metal', value: 30 },
  ];

  describe('LineChartComponent', () => {
    it('should render without crashing', () => {
      const { container } = render(
        <LineChartComponent
          data={mockData}
          xKey="month"
          lines={[
            { key: 'value', color: '#8884d8', name: 'Value' },
            { key: 'revenue', color: '#82ca9d', name: 'Revenue' },
          ]}
        />,
      );
      expect(container).toBeTruthy();
    });
  });

  describe('BarChartComponent', () => {
    it('should render without crashing', () => {
      const { container } = render(
        <BarChartComponent
          data={mockData}
          xKey="month"
          bars={[
            { key: 'value', color: '#8884d8', name: 'Value' },
            { key: 'revenue', color: '#82ca9d', name: 'Revenue' },
          ]}
        />,
      );
      expect(container).toBeTruthy();
    });
  });

  describe('PieChartComponent', () => {
    it('should render without crashing', () => {
      const { container } = render(
        <PieChartComponent data={mockPieData} colors={['#8884d8', '#82ca9d', '#ffc658']} />,
      );
      expect(container).toBeTruthy();
    });

    it('should render with default colors when colors prop is omitted', () => {
      const { container } = render(<PieChartComponent data={mockPieData} />);
      expect(container).toBeTruthy();
    });
  });

  describe('AreaChartComponent', () => {
    it('should render without crashing', () => {
      const { container } = render(
        <AreaChartComponent
          data={mockData}
          xKey="month"
          areas={[
            { key: 'value', color: '#8884d8', name: 'Value' },
            { key: 'revenue', color: '#82ca9d', name: 'Revenue' },
          ]}
        />,
      );
      expect(container).toBeTruthy();
    });
  });
});

