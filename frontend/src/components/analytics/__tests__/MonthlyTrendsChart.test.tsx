import { render } from '@testing-library/react';
import { MonthlyTrendsChart } from '../MonthlyTrendsChart';

test('MonthlyTrendsChart matches snapshot', () => {
  const { container } = render(<MonthlyTrendsChart />);
  expect(container).toMatchSnapshot();
});
