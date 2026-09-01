import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QRScanner } from '../QRScanner';

describe('QRScanner', () => {
  const mockOnScan = vi.fn();
  const mockOnClose = vi.fn();

  it('should render scanner component', () => {
    render(<QRScanner onScan={mockOnScan} onClose={mockOnClose} />);
    expect(screen.getByText('Scan QR Code')).toBeInTheDocument();
  });

  it('should show manual entry option', () => {
    render(<QRScanner onScan={mockOnScan} onClose={mockOnClose} />);
    expect(screen.getByPlaceholderText('Enter waste ID')).toBeInTheDocument();
  });

  it('should handle manual code submission', () => {
    render(<QRScanner onScan={mockOnScan} onClose={mockOnClose} />);
    const input = screen.getByPlaceholderText('Enter waste ID');
    const submitBtn = screen.getByText('Submit');

    fireEvent.change(input, { target: { value: 'WASTE123' } });
    fireEvent.click(submitBtn);

    expect(mockOnScan).toHaveBeenCalledWith('WASTE123');
  });

  it('should call onClose when close button clicked', () => {
    render(<QRScanner onScan={mockOnScan} onClose={mockOnClose} />);
    fireEvent.click(screen.getByText('Close'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should show start camera button initially', () => {
    render(<QRScanner onScan={mockOnScan} onClose={mockOnClose} />);
    expect(screen.getByText('Start Camera')).toBeInTheDocument();
  });

  it('should not submit empty manual code', () => {
    render(<QRScanner onScan={mockOnScan} onClose={mockOnClose} />);
    const submitBtn = screen.getByText('Submit');

    fireEvent.click(submitBtn);

    expect(mockOnScan).not.toHaveBeenCalled();
  });
});
