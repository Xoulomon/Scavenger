import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TransferWizard } from '../TransferWizard';

describe('TransferWizard', () => {
  const mockOnComplete = vi.fn();
  const mockOnCancel = vi.fn();

  it('should render wizard with first step', () => {
    render(<TransferWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);
    expect(screen.getAllByText('Select Waste').length).toBeGreaterThan(0);
  });

  it('should show progress indicator', () => {
    render(<TransferWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);
    expect(screen.getAllByText('Select Waste').length).toBe(2);
    expect(screen.getByText('Select Recipient')).toBeInTheDocument();
  });

  it('should have Next button', () => {
    render(<TransferWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('should have Save Draft button', () => {
    render(<TransferWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);
    expect(screen.getByText('Save Draft')).toBeInTheDocument();
  });

  it('should call onCancel when Cancel clicked', () => {
    render(<TransferWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should not show Back button on first step', () => {
    render(<TransferWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);
    expect(screen.queryByText('Back')).not.toBeInTheDocument();
  });

  it('should save draft to localStorage', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    render(<TransferWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);
    fireEvent.click(screen.getByText('Save Draft'));
    expect(setItemSpy).toHaveBeenCalledWith('transfer_draft', expect.any(String));
  });

  it('should display all 4 steps in progress', () => {
    render(<TransferWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);
    expect(screen.getByText('Transfer Details')).toBeInTheDocument();
    expect(screen.getByText('Review & Confirm')).toBeInTheDocument();
  });
});
