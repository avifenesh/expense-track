/**
 * Split Calculator Utility
 *
 * Provides pure functions for calculating expense splits across three split types:
 * - EQUAL: Divides amount equally among participants
 * - PERCENTAGE: Calculates amounts based on percentages
 * - FIXED: Uses fixed amounts, owner pays remainder
 *
 * All calculations use 2 decimal places for currency precision.
 */

export type SplitType = 'EQUAL' | 'PERCENTAGE' | 'FIXED';

export interface ParticipantShare {
  email: string;
  amount: number;
  percentage?: number;
}

export interface SplitValidationError {
  field: 'participants' | 'percentage' | 'amount' | 'general';
  message: string;
}

/**
 * Rounds a number to 2 decimal places using banker's rounding.
 * This is the standard for financial calculations.
 */
export function roundToTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates equal split amounts for a given number of participants.
 * The owner is NOT included in the participant count.
 *
 * @param totalAmount - The total expense amount
 * @param participantCount - Number of participants (excluding owner)
 * @returns Share amount per participant
 *
 * @example
 * // Split $100 among 2 participants (owner pays remainder)
 * calculateEqualSplit(100, 2) // Returns 33.33 (each participant pays)
 */
export function calculateEqualSplit(totalAmount: number, participantCount: number): number {
  if (participantCount <= 0) {
    return 0;
  }

  // For equal split, divide by total people (participants + owner)
  const totalPeople = participantCount + 1;
  const sharePerPerson = totalAmount / totalPeople;

  return roundToTwoDecimals(sharePerPerson);
}

/**
 * Calculates share amounts based on percentage allocations.
 *
 * @param totalAmount - The total expense amount
 * @param percentages - Map of email to percentage (0-100)
 * @returns Map of email to calculated amount
 *
 * @example
 * calculatePercentageSplit(100, { 'user@example.com': 30 })
 * // Returns Map { 'user@example.com' => 30.00 }
 */
export function calculatePercentageSplit(
  totalAmount: number,
  percentages: Map<string, number>
): Map<string, number> {
  const result = new Map<string, number>();

  for (const [email, percentage] of percentages) {
    const amount = (totalAmount * percentage) / 100;
    result.set(email, roundToTwoDecimals(amount));
  }

  return result;
}

/**
 * Calculates the owner's share after participants' fixed amounts.
 *
 * @param totalAmount - The total expense amount
 * @param participantShares - Array of participant share amounts
 * @returns Owner's remaining share
 *
 * @example
 * getOwnerShare(100, [30, 20]) // Returns 50.00
 */
export function getOwnerShare(totalAmount: number, participantShares: number[]): number {
  const totalParticipantShares = participantShares.reduce((sum, share) => sum + share, 0);
  const ownerShare = totalAmount - totalParticipantShares;
  return roundToTwoDecimals(ownerShare);
}

/**
 * Calculates all participant shares based on split type.
 *
 * @param splitType - The type of split (EQUAL, PERCENTAGE, FIXED)
 * @param totalAmount - The total expense amount
 * @param participants - Array of participants with optional share data
 * @returns Array of ParticipantShare objects with calculated amounts
 */
export function calculateSplitAmounts(
  splitType: SplitType,
  totalAmount: number,
  participants: Array<{ email: string; percentage?: number; fixedAmount?: number }>
): ParticipantShare[] {
  if (participants.length === 0) {
    return [];
  }

  switch (splitType) {
    case 'EQUAL': {
      const shareAmount = calculateEqualSplit(totalAmount, participants.length);
      return participants.map((p) => ({
        email: p.email,
        amount: shareAmount,
      }));
    }

    case 'PERCENTAGE': {
      const percentageMap = new Map<string, number>();
      for (const p of participants) {
        percentageMap.set(p.email, p.percentage ?? 0);
      }
      const amountMap = calculatePercentageSplit(totalAmount, percentageMap);

      return participants.map((p) => ({
        email: p.email,
        amount: amountMap.get(p.email) ?? 0,
        percentage: p.percentage,
      }));
    }

    case 'FIXED': {
      return participants.map((p) => ({
        email: p.email,
        amount: roundToTwoDecimals(p.fixedAmount ?? 0),
      }));
    }

    default:
      return [];
  }
}

/**
 * Gets the total amount that participants will pay.
 */
export function getTotalParticipantShare(shares: ParticipantShare[]): number {
  const total = shares.reduce((sum, share) => sum + share.amount, 0);
  return roundToTwoDecimals(total);
}

/**
 * Validates split configuration and returns any errors.
 *
 * @param splitType - The type of split
 * @param totalAmount - The total expense amount
 * @param participants - Array of participants with share data
 * @returns Array of validation errors (empty if valid)
 */
export function validateSplitAmounts(
  splitType: SplitType,
  totalAmount: number,
  participants: Array<{ email: string; percentage?: number; fixedAmount?: number }>
): SplitValidationError[] {
  const errors: SplitValidationError[] = [];

  // Check for at least one participant
  if (participants.length === 0) {
    errors.push({
      field: 'participants',
      message: 'At least one participant is required',
    });
    return errors;
  }

  // Check for valid total amount
  if (totalAmount <= 0) {
    errors.push({
      field: 'amount',
      message: 'Total amount must be greater than zero',
    });
    return errors;
  }

  switch (splitType) {
    case 'PERCENTAGE': {
      // Validate each participant has a percentage
      for (const p of participants) {
        if (p.percentage == null || p.percentage < 0 || p.percentage > 100) {
          errors.push({
            field: 'percentage',
            message: `Invalid percentage for ${p.email}. Must be between 0 and 100.`,
          });
        }
      }

      // Validate total percentage doesn't exceed 100%
      const totalPercentage = participants.reduce((sum, p) => sum + (p.percentage ?? 0), 0);
      if (totalPercentage > 100) {
        errors.push({
          field: 'percentage',
          message: `Total percentage (${totalPercentage}%) cannot exceed 100%`,
        });
      }
      break;
    }

    case 'FIXED': {
      // Validate each participant has a valid fixed amount
      for (const p of participants) {
        if (p.fixedAmount == null || p.fixedAmount < 0) {
          errors.push({
            field: 'amount',
            message: `Invalid amount for ${p.email}. Must be zero or greater.`,
          });
        }
      }

      // Validate total fixed amounts don't exceed total
      const totalFixed = participants.reduce((sum, p) => sum + (p.fixedAmount ?? 0), 0);
      if (totalFixed > totalAmount) {
        errors.push({
          field: 'amount',
          message: `Total participant amounts ($${totalFixed.toFixed(2)}) cannot exceed expense total ($${totalAmount.toFixed(2)})`,
        });
      }
      break;
    }

    case 'EQUAL':
      // Equal split has no additional validation requirements
      break;
  }

  return errors;
}

/**
 * Creates a preview of the split for display purposes.
 *
 * @param splitType - The type of split
 * @param totalAmount - The total expense amount
 * @param participants - Array of participants
 * @returns Object containing owner share, participant shares, and totals
 */
export function createSplitPreview(
  splitType: SplitType,
  totalAmount: number,
  participants: Array<{ email: string; displayName?: string | null; percentage?: number; fixedAmount?: number }>
): {
  ownerShare: number;
  participantShares: ParticipantShare[];
  totalParticipantAmount: number;
  isValid: boolean;
  errors: SplitValidationError[];
} {
  const errors = validateSplitAmounts(splitType, totalAmount, participants);
  const isValid = errors.length === 0;

  if (!isValid || participants.length === 0) {
    return {
      ownerShare: totalAmount,
      participantShares: [],
      totalParticipantAmount: 0,
      isValid,
      errors,
    };
  }

  const participantShares = calculateSplitAmounts(splitType, totalAmount, participants);
  const totalParticipantAmount = getTotalParticipantShare(participantShares);
  const ownerShare = getOwnerShare(totalAmount, participantShares.map((s) => s.amount));

  return {
    ownerShare,
    participantShares,
    totalParticipantAmount,
    isValid,
    errors,
  };
}

/**
 * Distributes rounding errors to ensure totals match exactly.
 * Uses the "largest remainder method" for fair distribution.
 *
 * @param targetTotal - The exact total that shares should sum to
 * @param shares - Array of shares to adjust
 * @returns Adjusted shares that sum exactly to targetTotal
 */
export function distributeRoundingError(targetTotal: number, shares: number[]): number[] {
  if (shares.length === 0) {
    return [];
  }

  const currentTotal = shares.reduce((sum, s) => sum + s, 0);
  const difference = roundToTwoDecimals(targetTotal - currentTotal);

  if (Math.abs(difference) < 0.01) {
    return shares;
  }

  // Adjust the first share to account for rounding differences
  const adjusted = [...shares];
  adjusted[0] = roundToTwoDecimals(adjusted[0] + difference);

  return adjusted;
}
