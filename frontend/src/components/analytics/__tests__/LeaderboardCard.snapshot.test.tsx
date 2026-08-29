import { render } from '@testing-library/react';
import { LeaderboardCard } from '../LeaderboardCard';

test('LeaderboardCard matches snapshot', () => {
  const { container } = render(<LeaderboardCard />);
  expect(container).toMatchSnapshot();
});
