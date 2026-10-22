import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LeaderboardCard } from './LeaderboardCard';

describe('LeaderboardCard', () => {
  it('should render leaderboard title', () => {
    render(<LeaderboardCard />);
    expect(screen.getByText('Top Participants')).toBeInTheDocument();
  });

  it('should display top 5 participants', () => {
    render(<LeaderboardCard />);
    expect(screen.getByText('EcoCollector Pro')).toBeInTheDocument();
    expect(screen.getByText('Green Recycler')).toBeInTheDocument();
    expect(screen.getByText('Waste Warrior')).toBeInTheDocument();
  });

  it('should show participant ranks', () => {
    render(<LeaderboardCard />);
    expect(screen.getByText('Rank #1')).toBeInTheDocument();
    expect(screen.getByText('Rank #2')).toBeInTheDocument();
  });

  it('should display points for each participant', () => {
    render(<LeaderboardCard />);
    expect(screen.getByText('15,420')).toBeInTheDocument();
    expect(screen.getByText('12,350')).toBeInTheDocument();
  });
});
