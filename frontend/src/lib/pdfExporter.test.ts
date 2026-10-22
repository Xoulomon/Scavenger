import { describe, it, expect, vi } from 'vitest';
import PDFExporter, { WasteData } from './pdfExporter';

describe('PDFExporter', () => {
  const mockWastes: WasteData[] = [
    {
      id: '1',
      type: 'Plastic',
      weight: 10,
      status: 'Verified',
      date: new Date('2024-01-01'),
      verificationStatus: 'verified',
    },
    {
      id: '2',
      type: 'Metal',
      weight: 20,
      status: 'Pending',
      date: new Date('2024-01-02'),
      verificationStatus: 'unverified',
    },
  ];

  it('creates a PDF exporter instance', () => {
    const exporter = new PDFExporter();
    expect(exporter).toBeDefined();
  });

  it('exports waste data to PDF', () => {
    const exporter = new PDFExporter();
    const result = exporter.exportWasteData(mockWastes, {
      title: 'Test Report',
      includeMetadata: true,
    });

    expect(result).toBeDefined();
  });

  it('exports analytics data to PDF', () => {
    const exporter = new PDFExporter();
    const analyticsData = {
      totalWaste: 2,
      wasteByType: { Plastic: 1, Metal: 1 },
      verificationRate: 0.5,
      averageWeight: 15,
    };

    const result = exporter.exportAnalytics(analyticsData, {
      title: 'Analytics Report',
    });

    expect(result).toBeDefined();
  });

  it('respects orientation option', () => {
    const exporter = new PDFExporter({ orientation: 'landscape' });
    const result = exporter.exportWasteData(mockWastes);

    expect(result).toBeDefined();
  });

  it('respects format option', () => {
    const exporter = new PDFExporter({ format: 'letter' });
    const result = exporter.exportWasteData(mockWastes);

    expect(result).toBeDefined();
  });

  it('generates blob from PDF', () => {
    const exporter = new PDFExporter();
    exporter.exportWasteData(mockWastes);
    const blob = exporter.getBlob();

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/pdf');
  });

  it('handles empty waste data', () => {
    const exporter = new PDFExporter();
    const result = exporter.exportWasteData([], {
      title: 'Empty Report',
    });

    expect(result).toBeDefined();
  });

  it('includes metadata when requested', () => {
    const exporter = new PDFExporter();
    const result = exporter.exportWasteData(mockWastes, {
      includeMetadata: true,
    });

    expect(result).toBeDefined();
  });
});
