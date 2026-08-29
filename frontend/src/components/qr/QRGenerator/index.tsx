import { useRef } from 'react'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { encodeQR, sanitizeQRData } from '@/lib/qr'

interface QRGeneratorProps {
  wasteId: string
  wasteName?: string
}

export function QRGenerator({ wasteId, wasteName }: QRGeneratorProps) {
  const imgRef = useRef<HTMLImageElement>(null)

  // Sanitize and encode the QR data
  const sanitizedId = sanitizeQRData(wasteId)
  const src = encodeQR(sanitizedId)

  const downloadQR = () => {
    const link = document.createElement('a')
    link.download = `waste-${sanitizedId}.png`
    link.href = src
    link.click()
  }

  return (
    <Card className="p-6 text-center">
      <h3 className="mb-4 text-lg font-semibold">
        {wasteName ? `QR Code for ${wasteName}` : 'Waste QR Code'}
      </h3>

      <div className="mb-4 flex justify-center">
        <img
          ref={imgRef}
          src={src}
          alt={`QR code for waste ${sanitizedId}`}
          width={200}
          height={200}
          className="rounded-md border"
        />
      </div>

      <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">ID: {sanitizedId}</p>

      <Button onClick={downloadQR}>Download QR Code</Button>
    </Card>
  )
}
