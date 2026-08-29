import { useState, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { decodeQR, handleQRScanError, sanitizeQRData } from '@/lib/qr';

interface QRScannerProps {
  onScan: (wasteId: string) => void;
  onClose: () => void;
}

export function QRScanner({ onScan, onClose }: QRScannerProps) {
  const [manualCode, setManualCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanner, setScanner] = useState<Html5Qrcode | null>(null);

  useEffect(() => {
    return () => {
      if (scanner) {
        scanner.stop().catch(console.error);
      }
    };
  }, [scanner]);

  const handleQRData = (decodedText: string) => {
    const decoded = decodeQR(decodedText);

    if (!decoded.isValid) {
      setError('Invalid QR code format. Please try again.');
      return;
    }

    const sanitized = sanitizeQRData(decoded.data);
    onScan(sanitized);

    if (scanner) {
      scanner.stop();
      setScanning(false);
    }
  };

  const startScanning = async () => {
    try {
      const html5QrCode = new Html5Qrcode('qr-reader');
      setScanner(html5QrCode);

      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        handleQRData,
        () => {
          // Ignore scan errors during continuous scanning
        }
      );

      setScanning(true);
      setError(null);
    } catch (err) {
      const errorMessage = handleQRScanError(err);
      setError(errorMessage);
      console.error(err);
    }
  };

  const stopScanning = () => {
    if (scanner) {
      scanner.stop().then(() => {
        setScanning(false);
      });
    }
  };

  const handleManualSubmit = () => {
    if (!manualCode.trim()) {
      setError('Please enter a waste ID');
      return;
    }

    const decoded = decodeQR(manualCode);
    if (!decoded.isValid) {
      setError('Invalid waste ID format');
      return;
    }

    const sanitized = sanitizeQRData(decoded.data);
    onScan(sanitized);
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Scan QR Code</h2>

        {error && (
          <div className="p-3 bg-red-100 text-red-700 rounded">{error}</div>
        )}

        <div id="qr-reader" className="w-full" />

        <div className="flex gap-2">
          {!scanning ? (
            <Button onClick={startScanning}>Start Camera</Button>
          ) : (
            <Button onClick={stopScanning} variant="outline">Stop Camera</Button>
          )}
          <Button onClick={onClose} variant="outline">Close</Button>
        </div>

        <div className="border-t pt-4">
          <h3 className="font-semibold mb-2">Or enter code manually:</h3>
          <div className="flex gap-2">
            <Input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Enter waste ID"
            />
            <Button onClick={handleManualSubmit}>Submit</Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
