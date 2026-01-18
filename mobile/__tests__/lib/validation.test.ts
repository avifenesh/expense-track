import {
  validateEmail,
  validatePassword,
  validateDisplayName,
  validatePasswordMatch,
  getPasswordRequirements,
  isPasswordValid,
  validateTransactionAmount,
  validateTransactionDescription,
  validateTransactionCategory,
  validateTransactionDate,
} from '../../src/lib/validation';

describe('validateEmail', () => {
  it('returns null for valid email', () => {
    expect(validateEmail('test@example.com')).toBeNull();
    expect(validateEmail('user.name@domain.co.uk')).toBeNull();
    expect(validateEmail('user+tag@example.com')).toBeNull();
  });

  it('returns error for empty email', () => {
    expect(validateEmail('')).toBe('Email is required');
    expect(validateEmail('   ')).toBe('Email is required');
  });

  it('returns error for invalid email format', () => {
    expect(validateEmail('notanemail')).toBe('Please enter a valid email address');
    expect(validateEmail('missing@domain')).toBe('Please enter a valid email address');
    expect(validateEmail('@nodomain.com')).toBe('Please enter a valid email address');
    expect(validateEmail('spaces in@email.com')).toBe('Please enter a valid email address');
  });

  it('returns error for email too long', () => {
    const longEmail = 'a'.repeat(250) + '@example.com';
    expect(validateEmail(longEmail)).toBe('Email is too long');
  });
});

describe('validatePassword', () => {
  it('returns empty array for valid password', () => {
    expect(validatePassword('Password123')).toEqual([]);
    expect(validatePassword('MyP@ssw0rd!')).toEqual([]);
  });

  it('returns errors for password too short', () => {
    const errors = validatePassword('Pass1');
    expect(errors).toContain('At least 8 characters');
  });

  it('returns errors for missing uppercase', () => {
    const errors = validatePassword('password123');
    expect(errors).toContain('At least one uppercase letter');
  });

  it('returns errors for missing lowercase', () => {
    const errors = validatePassword('PASSWORD123');
    expect(errors).toContain('At least one lowercase letter');
  });

  it('returns errors for missing number', () => {
    const errors = validatePassword('PasswordABC');
    expect(errors).toContain('At least one number');
  });

  it('returns multiple errors for multiple issues', () => {
    const errors = validatePassword('abc');
    expect(errors.length).toBeGreaterThan(1);
    expect(errors).toContain('At least 8 characters');
    expect(errors).toContain('At least one uppercase letter');
    expect(errors).toContain('At least one number');
  });
});

describe('getPasswordRequirements', () => {
  it('returns all requirements with met status', () => {
    const requirements = getPasswordRequirements('Password123');
    expect(requirements).toHaveLength(4);
    expect(requirements.every((r) => r.met)).toBe(true);
  });

  it('shows unmet requirements', () => {
    const requirements = getPasswordRequirements('abc');
    const unmet = requirements.filter((r) => !r.met);
    expect(unmet.length).toBeGreaterThan(0);
  });
});

describe('isPasswordValid', () => {
  it('returns true for valid password', () => {
    expect(isPasswordValid('Password123')).toBe(true);
  });

  it('returns false for invalid password', () => {
    expect(isPasswordValid('abc')).toBe(false);
    expect(isPasswordValid('password')).toBe(false);
  });
});

describe('validateDisplayName', () => {
  it('returns null for valid display name', () => {
    expect(validateDisplayName('John Doe')).toBeNull();
    expect(validateDisplayName('Alice')).toBeNull();
    expect(validateDisplayName("O'Brien")).toBeNull();
    expect(validateDisplayName('Jean-Pierre')).toBeNull();
  });

  it('returns error for empty display name', () => {
    expect(validateDisplayName('')).toBe('Display name is required');
    expect(validateDisplayName('   ')).toBe('Display name is required');
  });

  it('returns error for display name too short', () => {
    expect(validateDisplayName('A')).toBe('Display name must be at least 2 characters');
  });

  it('returns error for display name too long', () => {
    const longName = 'a'.repeat(101);
    expect(validateDisplayName(longName)).toBe('Display name is too long');
  });

  it('returns error for invalid characters', () => {
    expect(validateDisplayName('Test<script>')).toBe('Display name contains invalid characters');
    expect(validateDisplayName('Name@123')).toBe('Display name contains invalid characters');
    expect(validateDisplayName('Name#Tag')).toBe('Display name contains invalid characters');
  });
});

describe('validatePasswordMatch', () => {
  it('returns null when passwords match', () => {
    expect(validatePasswordMatch('Password123', 'Password123')).toBeNull();
  });

  it('returns error when passwords do not match', () => {
    expect(validatePasswordMatch('Password123', 'Password456')).toBe(
      'Passwords do not match'
    );
  });

  it('handles empty passwords', () => {
    expect(validatePasswordMatch('', '')).toBeNull();
    expect(validatePasswordMatch('Password123', '')).toBe('Passwords do not match');
  });
});

// Transaction validation tests

describe('validateTransactionAmount', () => {
  it('returns null for valid amount', () => {
    expect(validateTransactionAmount('50.00')).toBeNull();
    expect(validateTransactionAmount('100')).toBeNull();
    expect(validateTransactionAmount('0.01')).toBeNull();
    expect(validateTransactionAmount('999999999.99')).toBeNull();
  });

  it('returns error for empty amount', () => {
    expect(validateTransactionAmount('')).toBe('Amount is required');
    expect(validateTransactionAmount('   ')).toBe('Amount is required');
  });

  it('returns error for invalid amount format', () => {
    expect(validateTransactionAmount('abc')).toBe('Please enter a valid amount');
    expect(validateTransactionAmount('NaN')).toBe('Please enter a valid amount');
  });

  it('returns error for zero or negative amount', () => {
    expect(validateTransactionAmount('0')).toBe('Amount must be greater than zero');
    expect(validateTransactionAmount('-50')).toBe('Amount must be greater than zero');
    expect(validateTransactionAmount('0.00')).toBe('Amount must be greater than zero');
  });

  it('returns error for amount too large', () => {
    expect(validateTransactionAmount('9999999999.99')).toBe('Amount is too large');
    expect(validateTransactionAmount('1000000000')).toBe('Amount is too large');
  });

  it('returns error for too many decimal places', () => {
    expect(validateTransactionAmount('50.123')).toBe('Amount can have at most 2 decimal places');
    expect(validateTransactionAmount('50.1234')).toBe('Amount can have at most 2 decimal places');
  });
});

describe('validateTransactionDescription', () => {
  it('returns null for valid description', () => {
    expect(validateTransactionDescription('Groceries')).toBeNull();
    expect(validateTransactionDescription('Monthly rent payment')).toBeNull();
    expect(validateTransactionDescription('')).toBeNull(); // Optional field
    expect(validateTransactionDescription('   ')).toBeNull(); // Optional field
  });

  it('returns null for empty description (optional)', () => {
    expect(validateTransactionDescription('')).toBeNull();
    expect(validateTransactionDescription(null as unknown as string)).toBeNull();
    expect(validateTransactionDescription(undefined as unknown as string)).toBeNull();
  });

  it('returns error for description too long', () => {
    const longDesc = 'a'.repeat(201);
    expect(validateTransactionDescription(longDesc)).toBe(
      'Description is too long (max 200 characters)'
    );
  });

  it('returns error for potentially dangerous content', () => {
    expect(validateTransactionDescription('<script>alert("xss")</script>')).toBe(
      'Description contains invalid characters'
    );
    expect(validateTransactionDescription('javascript:alert(1)')).toBe(
      'Description contains invalid characters'
    );
    expect(validateTransactionDescription('onclick=alert(1)')).toBe(
      'Description contains invalid characters'
    );
  });

  it('allows safe special characters', () => {
    expect(validateTransactionDescription('Coffee & snacks')).toBeNull();
    expect(validateTransactionDescription("John's birthday gift")).toBeNull();
    expect(validateTransactionDescription('Payment #123')).toBeNull();
    expect(validateTransactionDescription('50% discount')).toBeNull();
  });
});

describe('validateTransactionCategory', () => {
  it('returns null for valid category ID', () => {
    expect(validateTransactionCategory('cat-123')).toBeNull();
    expect(validateTransactionCategory('abc')).toBeNull();
  });

  it('returns error for empty category', () => {
    expect(validateTransactionCategory('')).toBe('Please select a category');
    expect(validateTransactionCategory('   ')).toBe('Please select a category');
  });

  it('returns error for null category', () => {
    expect(validateTransactionCategory(null)).toBe('Please select a category');
  });
});

describe('validateTransactionDate', () => {
  it('returns null for valid date', () => {
    const today = new Date();
    expect(validateTransactionDate(today)).toBeNull();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(validateTransactionDate(yesterday)).toBeNull();

    const lastYear = new Date();
    lastYear.setFullYear(lastYear.getFullYear() - 1);
    expect(validateTransactionDate(lastYear)).toBeNull();
  });

  it('returns error for null date', () => {
    expect(validateTransactionDate(null)).toBe('Date is required');
  });

  it('returns error for invalid date', () => {
    expect(validateTransactionDate(new Date('invalid'))).toBe(
      'Please enter a valid date'
    );
  });

  it('returns error for future date', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(validateTransactionDate(tomorrow)).toBe('Date cannot be in the future');

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    expect(validateTransactionDate(nextWeek)).toBe('Date cannot be in the future');
  });

  it('returns error for date too far in the past', () => {
    const elevenYearsAgo = new Date();
    elevenYearsAgo.setFullYear(elevenYearsAgo.getFullYear() - 11);
    expect(validateTransactionDate(elevenYearsAgo)).toBe(
      'Date is too far in the past'
    );
  });

  it('allows dates within acceptable range', () => {
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    expect(validateTransactionDate(fiveYearsAgo)).toBeNull();

    const nineYearsAgo = new Date();
    nineYearsAgo.setFullYear(nineYearsAgo.getFullYear() - 9);
    expect(validateTransactionDate(nineYearsAgo)).toBeNull();
  });
});
