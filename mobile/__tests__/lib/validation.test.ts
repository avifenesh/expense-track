import {
  validateEmail,
  validatePassword,
  validateDisplayName,
  validatePasswordMatch,
  getPasswordRequirements,
  isPasswordValid,
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
