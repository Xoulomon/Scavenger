import { render } from '@testing-library/react';
import { RecyclingRateChart } from '../RecyclingRateChart';

test('RecyclingRateChart matches snapshot', () => {
  const { container } = render(<RecyclingRateChart />);
  expect(container).toMatchSnapshot();
});
