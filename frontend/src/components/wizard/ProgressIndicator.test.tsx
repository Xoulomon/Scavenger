import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressIndicator } from './ProgressIndicator';

const mockSteps = [
  { id: 1, title: 'Step 1' },
  { id: 2, title: 'Step 2' },
  { id: 3, title: 'Step 3' },
];

describe('ProgressIndicator', () => {
  it('should render all steps', () => {
    render(<ProgressIndicator steps={mockSteps} currentStep={1} />);
    expect(screen.getByText('Step 1')).toBeInTheDocument();
    expect(screen.getByText('Step 2')).toBeInTheDocument();
    expect(screen.getByText('Step 3')).toBeInTheDocument();
  });

  it('should highlight current step', () => {
    const { container } = render(<ProgressIndicator steps={mockSteps} currentStep={2} />);
    const stepCircles = container.querySelectorAll('div[class*="rounded-full"]');
    expect(stepCircles[1]).toHaveClass('bg-blue-500');
  });

  it('should show completed steps with check mark', () => {
    render(<ProgressIndicator steps={mockSteps} currentStep={3} />);
    const checkIcons = screen.getAllByRole('img', { hidden: true });
    const svgElements = document.querySelectorAll('svg.lucide-check');
    expect(svgElements.length).toBeGreaterThan(0);
  });

  it('should render connecting lines between steps', () => {
    const { container } = render(<ProgressIndicator steps={mockSteps} currentStep={2} />);
    const lines = container.querySelectorAll('div[class*="flex-1 h-1"]');
    expect(lines.length).toBe(mockSteps.length - 1);
  });
});
