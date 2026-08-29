/**
 * Upload a file to IPFS via Pinata.
 * Requires VITE_PINATA_JWT in env. Falls back to a data-URL stub when not configured.
 */
export async function uploadToIPFS(
  file: File,
  onProgress?: (pct: number) => void
): Promise<string> {
  const jwt = import.meta.env.VITE_PINATA_JWT as string | undefined

  if (!jwt) {
    // Dev fallback: return a deterministic fake CID so the form still works
    onProgress?.(100)
    return `bafydev${btoa(file.name).replace(/[^a-z0-9]/gi, '').slice(0, 32)}`
  }

  const body = new FormData()
  body.append('file', file)
  body.append('pinataOptions', JSON.stringify({ cidVersion: 1 }))
  body.append('pinataMetadata', JSON.stringify({ name: file.name }))

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', 'https://api.pinata.cloud/pinning/pinFileToIPFS')
    xhr.setRequestHeader('Authorization', `Bearer ${jwt}`)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100))
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText) as { IpfsHash: string }
        resolve(data.IpfsHash)
      } else {
        reject(new Error(`Pinata upload failed: ${xhr.statusText}`))
      }
    }

    xhr.onerror = () => reject(new Error('A network error occurred during the upload operation.'))
    xhr.send(body)
  })
}

export function ipfsGatewayUrl(cid: string): string {
  return `https://gateway.pinata.cloud/ipfs/${cid}`
}
