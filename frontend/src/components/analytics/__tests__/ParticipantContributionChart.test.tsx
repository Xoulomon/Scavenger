import { render } from '@testing-library/react';
import { ParticipantContributionChart } from '../ParticipantContributionChart';

test('ParticipantContributionChart matches snapshot', () => {
  const { container } = render(<ParticipantContributionChart />);
  expect(container).toMatchSnapshot();
});
