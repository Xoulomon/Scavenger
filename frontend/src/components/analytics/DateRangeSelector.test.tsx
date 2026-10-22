import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DateRangeSelector } from './DateRangeSelector';

describe('DateRangeSelector', () => {
  const mockOnChange = vi.fn();
  const mockValue = { start: null, end: null };

  it('should render date range presets', () => {
    render(<DateRangeSelector value={mockValue} onChange={mockOnChange} />);
    expect(screen.getByText('Last 7 days')).toBeInTheDocument();
    expect(screen.getByText('Last 30 days')).toBeInTheDocument();
    expect(screen.getByText('Last 90 days')).toBeInTheDocument();
  });

  it('should call onChange when preset clicked', () => {
    render(<DateRangeSelector value={mockValue} onChange={mockOnChange} />);
    fireEvent.click(screen.getByText('Last 7 days'));
    expect(mockOnChange).toHaveBeenCalled();
  });

  it('should render calendar icon', () => {
    const { container } = render(
      <DateRangeSelector value={mockValue} onChange={mockOnChange} />
    );
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
