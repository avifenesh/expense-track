/**
 * Validation utilities for mobile app
 * Centralized validation logic to ensure consistency with API schemas
 */

/**
 * Category name validation pattern
 * Must start and end with alphanumeric (Unicode-aware), can contain spaces/hyphens/underscores
 * Uses Unicode property escapes to match server-side validation
 */
export const CATEGORY_NAME_PATTERN = /^[\p{L}\p{N}](?:.*\S.*)?[\p{L}\p{N}]$|^[\p{L}\p{N}]{2}$/u

export const CATEGORY_NAME_MIN_LENGTH = 2
export const CATEGORY_NAME_MAX_LENGTH = 100

export interface ValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validate category name
 * Matches server-side validation in src/schemas/api.ts
 */
export function validateCategoryName(name: string): ValidationResult {
  const trimmed = name.trim()

  if (!trimmed) {
    return { valid: false, error: 'Name is required' }
  }

  if (trimmed.length < CATEGORY_NAME_MIN_LENGTH) {
    return { valid: false, error: `Name must be at least ${CATEGORY_NAME_MIN_LENGTH} characters` }
  }

  if (trimmed.length > CATEGORY_NAME_MAX_LENGTH) {
    return { valid: false, error: `Name must be at most ${CATEGORY_NAME_MAX_LENGTH} characters` }
  }

  if (!CATEGORY_NAME_PATTERN.test(trimmed)) {
    return { valid: false, error: 'Name must start and end with a letter or number' }
  }

  return { valid: true }
}
