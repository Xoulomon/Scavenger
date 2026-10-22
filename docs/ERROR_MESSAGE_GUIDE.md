# Error Message Style Guide

## Overview
This document defines the style guide for error messages in the Scavenger project.

## Stellar Contract Error Codes

The Soroban contract's `Error` enum is the canonical source for contract errors.
Each domain has a reserved `u32` range; numeric codes are stable API identifiers
and must not be renumbered or reused. The matching enum and ranges are defined
in `stellar-contract/src/errors.rs`. These ranges supersede the legacy
sequential `1–54` values; clients must migrate to this table.

| u32 code | Category | Stable code string | Variant | Meaning |
|---:|---|---|---|---|
| 1000 | Auth | `AUTH/ALREADY_INITIALIZED` | `AlreadyInitialized` | Contract admin has already been initialized |
| 1001 | Auth | `AUTH/UNAUTHORIZED` | `Unauthorized` | Caller is not the contract administrator |
| 1002 | Auth | `AUTH/NOT_REGISTERED` | `NotRegistered` | Address is not a registered participant |
| 1003 | Auth | `AUTH/ALREADY_REGISTERED` | `AlreadyRegistered` | Address is already registered |
| 1004 | Auth | `AUTH/NOT_MANUFACTURER` | `NotManufacturer` | Caller does not have the Manufacturer role |
| 1005 | Auth | `AUTH/NOT_WASTE_OWNER` | `NotWasteOwner` | Caller does not own the waste item |
| 1006 | Auth | `AUTH/SELF_CONFIRMATION` | `SelfConfirmation` | Waste owner attempted to confirm their own item |
| 1007 | Auth | `AUTH/NOT_CREATOR` | `NotCreator` | Caller is not the resource creator |
| 1008 | Auth | `AUTH/NOT_RESERVER` | `NotReserver` | Caller is not the reserver or owner |
| 1009 | Auth | `AUTH/NOT_LISTING_SELLER` | `NotListingSeller` | Caller is not the carbon listing seller |
| 1010 | Auth | `AUTH/PERMISSION_DENIED` | `PermissionDenied` | Caller lacks the required permission |
| 1011 | Auth | `AUTH/INVALID_PERMISSION` | `InvalidPermission` | Permission type is invalid |
| 2000 | Input | `INPUT/INVALID_AMOUNT` | `InvalidAmount` | Amount is zero or negative |
| 2001 | Input | `INPUT/INVALID_WEIGHT` | `InvalidWeight` | Waste weight is outside the accepted range |
| 2002 | Input | `INPUT/INVALID_COORDINATES` | `InvalidCoordinates` | Latitude or longitude is out of range |
| 2003 | Input | `INPUT/INVALID_PERCENTAGE` | `InvalidPercentage` | Percentages sum to more than 100 |
| 2004 | Input | `INPUT/INVALID_TRANSFER_ROUTE` | `InvalidTransferRoute` | Role combination is not a permitted transfer route |
| 2005 | Input | `INPUT/SAME_ADDRESS` | `SameAddress` | Addresses that must differ are equal |
| 2006 | Input | `INPUT/TOO_MANY_SPLITS` | `TooManySplits` | Split count exceeds the maximum |
| 2007 | Input | `INPUT/TOO_FEW_SPLITS` | `TooFewSplits` | Fewer than two split weights were provided |
| 2008 | Input | `INPUT/TOO_FEW_WASTES` | `TooFewWastes` | Fewer than two waste IDs were provided for merge |
| 2009 | Input | `INPUT/TOO_MANY_WASTES` | `TooManyWastes` | More than 20 waste IDs were provided for merge |
| 2010 | Input | `INPUT/WEIGHT_MISMATCH` | `WeightMismatch` | Split weights do not sum to the original weight |
| 2011 | Input | `INPUT/LOCATION_MISMATCH` | `LocationMismatch` | Waste items have different locations |
| 2012 | Input | `INPUT/INVALID_SCHEDULE` | `InvalidSchedule` | Schedule start and end times are invalid |
| 2013 | Input | `INPUT/INVALID_LISTING` | `InvalidListing` | Listing amount/price is invalid or buyer equals seller |
| 3000 | State | `STATE/WASTE_DEACTIVATED` | `WasteDeactivated` | Deactivated waste cannot be transferred or confirmed |
| 3001 | State | `STATE/WASTE_ALREADY_DEACTIVATED` | `WasteAlreadyDeactivated` | Waste is already deactivated |
| 3002 | State | `STATE/WASTE_ALREADY_CONFIRMED` | `WasteAlreadyConfirmed` | Waste has already been confirmed |
| 3003 | State | `STATE/WASTE_NOT_CONFIRMED` | `WasteNotConfirmed` | Waste has not been confirmed |
| 3004 | State | `STATE/WASTE_TYPE_MISMATCH` | `WasteTypeMismatch` | Waste types involved in the operation do not match |
| 3005 | State | `STATE/WASTE_ALREADY_RESERVED` | `WasteAlreadyReserved` | Waste is already reserved |
| 3006 | State | `STATE/WASTE_NOT_RESERVED` | `WasteNotReserved` | Waste is not reserved |
| 3007 | State | `STATE/WASTE_RESERVED_BY_OTHER` | `WasteReservedByOther` | Waste is reserved by another participant |
| 3008 | State | `STATE/WASTE_EXPIRED` | `WasteExpired` | Waste item has expired |
| 3009 | State | `STATE/WASTE_FROZEN` | `WasteFrozen` | Frozen waste cannot be transferred |
| 3010 | State | `STATE/INCENTIVE_INACTIVE` | `IncentiveInactive` | Incentive is inactive |
| 3011 | State | `STATE/MATERIAL_NOT_VERIFIED` | `MaterialNotVerified` | Material has not been verified |
| 3012 | State | `STATE/NO_REWARD_AVAILABLE` | `NoRewardAvailable` | No reward is available |
| 3013 | State | `STATE/INSUFFICIENT_BALANCE` | `InsufficientBalance` | Donor token balance is too low |
| 3014 | State | `STATE/INSUFFICIENT_BUDGET` | `InsufficientBudget` | Reward budget is insufficient |
| 3015 | State | `STATE/INSUFFICIENT_CARBON_CREDITS` | `InsufficientCarbonCredits` | Participant lacks enough carbon credits |
| 3016 | State | `STATE/CARBON_LISTING_INACTIVE` | `CarbonListingInactive` | Carbon listing is not active |
| 3017 | State | `STATE/NO_DISCREPANCY` | `NoDiscrepancy` | Waste has no weight discrepancy to reconcile |
| 3018 | State | `STATE/RECONCILIATION_THRESHOLD_EXCEEDED` | `ReconciliationThresholdExceeded` | Reconciliation exceeds the allowed threshold |
| 4000 | NotFound | `NOT_FOUND/WASTE` | `WasteNotFound` | No waste record exists for the ID |
| 4001 | NotFound | `NOT_FOUND/MATERIAL` | `MaterialNotFound` | No material record exists for the ID |
| 4002 | NotFound | `NOT_FOUND/INCENTIVE` | `IncentiveNotFound` | No incentive record exists for the ID |
| 4003 | NotFound | `NOT_FOUND/PARTICIPANT` | `ParticipantNotFound` | No participant record exists for the address |
| 4004 | NotFound | `NOT_FOUND/CARBON_LISTING` | `CarbonListingNotFound` | No carbon listing exists for the ID |
| 5000 | Arithmetic | `ARITHMETIC/OVERFLOW` | `Overflow` | Checked arithmetic operation would overflow |
| 6000 | Config | `CONFIG/CHARITY_NOT_SET` | `CharityNotSet` | Charity contract address has not been configured |
| 6001 | Config | `CONFIG/TOKEN_ADDRESS_NOT_SET` | `TokenAddressNotSet` | Token contract address has not been configured |

Reserved ranges: Auth `1000–1099`, Input `2000–2099`, State `3000–3099`,
NotFound `4000–4099`, Arithmetic `5000–5099`, and Config `6000–6099`.
Do not reuse a retired code; use the next unused value in its domain.

## Message Format

### User-Facing Error Messages

#### Format
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "level": "ERROR",
  "context": "UserService",
  "message": "Failed to create user",
  "data": {
    "userId": "123",
    "error": "ValidationError",
    "field": "email"
  }
}
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "level": "WARN",
  "context": "AuthMiddleware",
  "message": "Authentication failed due to expired token",
  "data": {
    "userId": "123",
    "tokenExpiry": "2024-01-01T00:00:00.000Z"
  }
}
export class AppError extends Error {
  code: string;
  statusCode: number;
  details?: Record<string, any>;

  constructor(message: string, code: string, statusCode: number, details?: Record<string, any>) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.name = this.constructor.name;
  }
}
export const createError = {
  validation: (field: string, reason: string) => {
    return new AppError(
      `Failed to validate ${field}. ${reason}`,
      'VAL-001',
      400,
      { field, reason }
    );
  },
  notFound: (resource: string, id?: string) => {
    return new AppError(
      `${resource} not found${id ? `: ${id}` : ''}`,
      'NOTF-001',
      404,
      { resource, id }
    );
  },
  unauthorized: (action: string) => {
    return new AppError(
      `Unauthorized: ${action} requires authentication`,
      'AUTH-001',
      401,
      { action }
    );
  },
};
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.name,
      message: err.message,
      code: err.code,
      details: err.details,
    });
  }

  // Unknown error
  console.error(err);
  return res.status(500).json({
    error: 'InternalServerError',
    message: 'An unexpected error occurred. Please try again later.',
    code: 'SRV-001',
  });
};
// .eslintrc.js
module.exports = {
  rules: {
    'custom/error-message-format': ['error', {
      pattern: /^[A-Z].*\.$/,
    }],
    'custom/no-vague-error-messages': 'error',
  },
};
// scripts/validate-error-messages.ts
const validateMessages = (file: string) => {
  // Check for vague messages
  const vaguePatterns = [
    /error/i,
    /something went wrong/i,
    /failed/i,
    /unexpected/i,
  ];
  
  // Validate message format
  const formatPattern = /^[A-Z][a-zA-Z0-9\s,'".?!-]*\.$/;
};
