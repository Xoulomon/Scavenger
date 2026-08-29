import { render } from '@testing-library/react';
import { TopMaterialsChart } from '../TopMaterialsChart';

test('TopMaterialsChart matches snapshot', () => {
  const { container } = render(<TopMaterialsChart />);
  expect(container).toMatchSnapshot();
});
