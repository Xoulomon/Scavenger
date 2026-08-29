import { render } from '@testing-library/react';
import { WasteTypeChart } from '../WasteTypeChart';

test('WasteTypeChart matches snapshot', () => {
  const { container } = render(<WasteTypeChart />);
  expect(container).toMatchSnapshot();
});
