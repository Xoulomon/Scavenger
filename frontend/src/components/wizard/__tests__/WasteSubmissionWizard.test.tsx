import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WasteSubmissionWizard } from '../WasteSubmissionWizard';

describe('WasteSubmissionWizard', () => {
  const mockOnComplete = vi.fn();
  const mockOnCancel = vi.fn();

  it('should render wizard with first step', () => {
    render(<WasteSubmissionWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);
    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings[0]).toHaveTextContent('Waste Type');
  });

  it('should show progress indicator', () => {
    render(<WasteSubmissionWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);
    const stepLabels = screen.getAllByText('Details');
    expect(stepLabels.length).toBeGreaterThan(0);
    expect(screen.getByText('Location')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
  });

  it('should have Next button on first step', () => {
    render(<WasteSubmissionWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('should have Save Draft button', () => {
    render(<WasteSubmissionWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);
    expect(screen.getByText('Save Draft')).toBeInTheDocument();
  });

  it('should call onCancel when Cancel clicked', () => {
    render(<WasteSubmissionWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should not show Back button on first step', () => {
    render(<WasteSubmissionWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);
    expect(screen.queryByText('Back')).not.toBeInTheDocument();
  });

  it('should save draft to localStorage', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    render(<WasteSubmissionWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);
    fireEvent.click(screen.getByText('Save Draft'));
    expect(setItemSpy).toHaveBeenCalledWith('waste_submission_draft', expect.any(String));
  });
});
