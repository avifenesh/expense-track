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
