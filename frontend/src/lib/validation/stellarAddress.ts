import { stellarAddressSchema } from '@/lib/schemas/shared'

export { stellarAddressSchema }

export function isValidStellarAddress(address: string): boolean {
  return stellarAddressSchema.safeParse(address).success
}
