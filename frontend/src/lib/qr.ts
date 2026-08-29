/**
 * Shared QR code encoding/decoding utilities
 * Centralizes QR code generation and parsing logic
 */

const QR_API_BASE = 'https://api.qrserver.com/v1/create-qr-code/'
const DEFAULT_QR_SIZE = '200x200'
const DEFAULT_ERROR_CORRECTION = 'H'

export interface QREncodeOptions {
  size?: string
  errorCorrection?: string
}

export interface QRDecodeResult {
  data: string
  isValid: boolean
}

/**
 * Validates QR code payload for malformed data
 * @param payload - The data to be encoded as QR
 * @returns boolean - True if payload is valid
 */
export function validateQRPayload(payload: unknown): boolean {
  if (!payload) return false

  const stringPayload = String(payload).trim()
  if (stringPayload.length === 0) return false
  if (stringPayload.length > 2953) return false // QR code capacity limit

  return true
}

/**
 * Encodes data as a QR code URL
 * @param data - The data to encode
 * @param options - Encoding options (size, error correction level)
 * @returns QR code image URL
 * @throws Error if payload is malformed
 */
export function encodeQR(data: unknown, options: QREncodeOptions = {}): string {
  if (!validateQRPayload(data)) {
    throw new Error('Invalid QR payload: payload is empty, too long, or malformed')
  }

  const {
    size = DEFAULT_QR_SIZE,
    errorCorrection = DEFAULT_ERROR_CORRECTION,
  } = options

  const encodedData = encodeURIComponent(String(data))
  return `${QR_API_BASE}?size=${size}&data=${encodedData}&ecc=${errorCorrection}`
}

/**
 * Decodes QR code data
 * Handles various QR data formats and validates them
 * @param data - The decoded QR data
 * @returns QRDecodeResult object with decoded data and validation status
 */
export function decodeQR(data: unknown): QRDecodeResult {
  if (!data) {
    return {
      data: '',
      isValid: false,
    }
  }

  try {
    const stringData = String(data).trim()

    if (!validateQRPayload(stringData)) {
      return {
        data: stringData,
        isValid: false,
      }
    }

    // Try to decode URI component if it's encoded
    let decodedData = stringData
    try {
      decodedData = decodeURIComponent(stringData)
    } catch (e) {
      // If decoding fails, use original string
      decodedData = stringData
    }

    return {
      data: decodedData,
      isValid: true,
    }
  } catch (error) {
    return {
      data: String(data),
      isValid: false,
    }
  }
}

/**
 * Validates if a string is a valid QR code format
 * @param data - The data to validate
 * @returns boolean - True if valid QR format
 */
export function isValidQRFormat(data: unknown): boolean {
  const result = decodeQR(data)
  return result.isValid
}

/**
 * Handles QR scanning errors and provides user-friendly messages
 * @param error - The error that occurred
 * @returns User-friendly error message
 */
export function handleQRScanError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()

    if (message.includes('permission')) {
      return 'Camera permission denied. Please enable camera access in settings.'
    }
    if (message.includes('camera') || message.includes('device')) {
      return 'Failed to access camera. Please check that a camera is available.'
    }
    if (message.includes('not found') || message.includes('not supported')) {
      return 'Camera not found. Please check your device configuration.'
    }
  }

  return 'Failed to scan QR code. Please check camera permissions and try again.'
}

/**
 * Sanitizes QR data to prevent injection attacks
 * @param data - The data to sanitize
 * @returns Sanitized data
 */
export function sanitizeQRData(data: unknown): string {
  const stringData = String(data).trim()

  // Remove any potential script tags or dangerous content
  const sanitized = stringData
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/javascript:/gi, '')

  return sanitized
}
