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

export function roundToTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateEqualSplit(totalAmount: number, participantCount: number): number {
  if (participantCount <= 0) {
    return 0;
  }

  const totalPeople = participantCount + 1;
  const sharePerPerson = totalAmount / totalPeople;

  return roundToTwoDecimals(sharePerPerson);
}

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

export function getOwnerShare(totalAmount: number, participantShares: number[]): number {
  const totalParticipantShares = participantShares.reduce((sum, share) => sum + share, 0);
  const ownerShare = totalAmount - totalParticipantShares;
  return roundToTwoDecimals(ownerShare);
}

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

export function getTotalParticipantShare(shares: ParticipantShare[]): number {
  const total = shares.reduce((sum, share) => sum + share.amount, 0);
  return roundToTwoDecimals(total);
}

export function validateSplitAmounts(
  splitType: SplitType,
  totalAmount: number,
  participants: Array<{ email: string; percentage?: number; fixedAmount?: number }>
): SplitValidationError[] {
  const errors: SplitValidationError[] = [];

  if (participants.length === 0) {
    errors.push({
      field: 'participants',
      message: 'At least one participant is required',
    });
    return errors;
  }

  if (totalAmount <= 0) {
    errors.push({
      field: 'amount',
      message: 'Total amount must be greater than zero',
    });
    return errors;
  }

  switch (splitType) {
    case 'PERCENTAGE': {
      for (const p of participants) {
        if (p.percentage == null || p.percentage < 0 || p.percentage > 100) {
          errors.push({
            field: 'percentage',
            message: `Invalid percentage for ${p.email}. Must be between 0 and 100.`,
          });
        }
      }

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
      for (const p of participants) {
        if (p.fixedAmount == null || p.fixedAmount < 0) {
          errors.push({
            field: 'amount',
            message: `Invalid amount for ${p.email}. Must be zero or greater.`,
          });
        }
      }

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
      break;
  }

  return errors;
}

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

export function distributeRoundingError(targetTotal: number, shares: number[]): number[] {
  if (shares.length === 0) {
    return [];
  }

  const currentTotal = shares.reduce((sum, s) => sum + s, 0);
  const difference = roundToTwoDecimals(targetTotal - currentTotal);

  if (Math.abs(difference) < 0.01) {
    return shares;
  }

  const adjusted = [...shares];
  adjusted[0] = roundToTwoDecimals(adjusted[0] + difference);

  return adjusted;
}
