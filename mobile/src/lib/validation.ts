export function validateEmail(email: string): string | null {
  if (!email || email.trim().length === 0) {
    return 'Email is required';
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return 'Please enter a valid email address';
  }

  if (email.length > 255) {
    return 'Email is too long';
  }

  return null;
}

export interface PasswordRequirement {
  label: string;
  met: boolean;
}

export function getPasswordRequirements(password: string): PasswordRequirement[] {
  return [
    {
      label: 'At least 8 characters',
      met: password.length >= 8,
    },
    {
      label: 'At least one uppercase letter',
      met: /[A-Z]/.test(password),
    },
    {
      label: 'At least one lowercase letter',
      met: /[a-z]/.test(password),
    },
    {
      label: 'At least one number',
      met: /[0-9]/.test(password),
    },
  ];
}

export function validatePassword(password: string): string[] {
  const requirements = getPasswordRequirements(password);
  return requirements.filter((r) => !r.met).map((r) => r.label);
}

export function isPasswordValid(password: string): boolean {
  return validatePassword(password).length === 0;
}

export function validateDisplayName(name: string): string | null {
  if (!name || name.trim().length === 0) {
    return 'Display name is required';
  }

  if (name.trim().length < 2) {
    return 'Display name must be at least 2 characters';
  }

  if (name.length > 100) {
    return 'Display name is too long';
  }

  const validNameRegex = /^[a-zA-Z0-9\s\-']+$/;
  if (!validNameRegex.test(name)) {
    return 'Display name contains invalid characters';
  }

  return null;
}

export function validatePasswordMatch(
  password: string,
  confirmPassword: string
): string | null {
  if (password !== confirmPassword) {
    return 'Passwords do not match';
  }
  return null;
}


export function validateTransactionAmount(amount: string): string | null {
  if (!amount || amount.trim().length === 0) {
    return 'Amount is required';
  }

  const numAmount = parseFloat(amount);

  if (isNaN(numAmount)) {
    return 'Please enter a valid amount';
  }

  if (numAmount <= 0) {
    return 'Amount must be greater than zero';
  }

  if (numAmount > 999999999.99) {
    return 'Amount is too large';
  }

  const parts = amount.split('.');
  if (parts[1] && parts[1].length > 2) {
    return 'Amount can have at most 2 decimal places';
  }

  return null;
}

export function validateTransactionDescription(
  description: string | null | undefined
): string | null {
  if (!description || description.trim().length === 0) {
    return null;
  }

  if (description.length > 200) {
    return 'Description is too long (max 200 characters)';
  }

  const dangerousPattern = /<script|javascript:|on\w+\s*=/i;
  if (dangerousPattern.test(description)) {
    return 'Description contains invalid characters';
  }

  return null;
}

export function validateTransactionCategory(
  categoryId: string | null
): string | null {
  if (!categoryId || categoryId.trim().length === 0) {
    return 'Please select a category';
  }

  return null;
}

export function validateTransactionDate(date: Date | null): string | null {
  if (!date) {
    return 'Date is required';
  }

  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return 'Please enter a valid date';
  }

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (date > today) {
    return 'Date cannot be in the future';
  }

  const tenYearsAgo = new Date();
  tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
  if (date < tenYearsAgo) {
    return 'Date is too far in the past';
  }

  return null;
}


const MAX_SHARE_DESCRIPTION_LENGTH = 240;

export function validateShareDescription(description: string | null | undefined): string | null {
  if (!description || description.trim().length === 0) {
    return null;
  }

  if (description.length > MAX_SHARE_DESCRIPTION_LENGTH) {
    return `Description is too long (max ${MAX_SHARE_DESCRIPTION_LENGTH} characters)`;
  }

  const dangerousPattern = /<script|javascript:|on\w+\s*=/i;
  if (dangerousPattern.test(description)) {
    return 'Description contains invalid characters';
  }

  return null;
}

export function validateShareAmount(amount: number, totalAmount: number): string | null {
  if (amount < 0) {
    return 'Amount cannot be negative';
  }

  if (amount > totalAmount) {
    return `Amount cannot exceed total ($${totalAmount.toFixed(2)})`;
  }

  return null;
}

export function validateSharePercentage(percentage: number): string | null {
  if (percentage < 0) {
    return 'Percentage cannot be negative';
  }

  if (percentage > 100) {
    return 'Percentage cannot exceed 100%';
  }

  return null;
}

export function validateParticipantsList(
  participants: { email: string }[]
): string | null {
  if (!participants || participants.length === 0) {
    return 'At least one participant is required';
  }

  // Check for duplicate emails
  const emails = new Set<string>();
  for (const p of participants) {
    const normalizedEmail = p.email.toLowerCase().trim();
    if (emails.has(normalizedEmail)) {
      return 'Duplicate participant emails are not allowed';
    }
    emails.add(normalizedEmail);
  }

  // Validate each email
  for (const p of participants) {
    const emailError = validateEmail(p.email);
    if (emailError) {
      return `Invalid email: ${p.email}`;
    }
  }

  return null;
}

export function validateTotalPercentage(percentages: number[]): string | null {
  const total = percentages.reduce((sum, p) => sum + p, 0);

  if (total > 100) {
    return `Total percentage (${total.toFixed(1)}%) cannot exceed 100%`;
  }

  return null;
}

export function validateTotalFixedAmount(amounts: number[], totalAmount: number): string | null {
  const total = amounts.reduce((sum, a) => sum + a, 0);

  if (total > totalAmount) {
    return `Total amounts ($${total.toFixed(2)}) cannot exceed expense total ($${totalAmount.toFixed(2)})`;
  }

  return null;
}


export function validateBudgetAmount(amount: string): string | null {
  if (!amount || amount.trim().length === 0) {
    return 'Amount is required';
  }

  const numAmount = parseFloat(amount);

  if (isNaN(numAmount)) {
    return 'Please enter a valid amount';
  }

  if (numAmount <= 0) {
    return 'Amount must be greater than zero';
  }

  if (numAmount > 999999999.99) {
    return 'Amount is too large';
  }

  const parts = amount.split('.');
  if (parts[1] && parts[1].length > 2) {
    return 'Amount can have at most 2 decimal places';
  }

  return null;
}

export function validateBudgetCategory(categoryId: string | null): string | null {
  if (!categoryId || categoryId.trim().length === 0) {
    return 'Please select a category';
  }

  return null;
}
