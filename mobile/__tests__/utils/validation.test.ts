import { validateCategoryName, CATEGORY_NAME_PATTERN, CATEGORY_NAME_MIN_LENGTH, CATEGORY_NAME_MAX_LENGTH } from '../../src/utils/validation'

describe('validateCategoryName', () => {
  describe('valid names', () => {
    it('should accept a simple name', () => {
      expect(validateCategoryName('Groceries')).toEqual({ valid: true })
    })

    it('should accept name with spaces', () => {
      expect(validateCategoryName('Food and Dining')).toEqual({ valid: true })
    })

    it('should accept name with hyphens', () => {
      expect(validateCategoryName('Day-to-Day')).toEqual({ valid: true })
    })

    it('should accept name with underscores', () => {
      expect(validateCategoryName('Work_Expenses')).toEqual({ valid: true })
    })

    it('should accept minimum length name', () => {
      expect(validateCategoryName('AB')).toEqual({ valid: true })
    })

    it('should reject single character name (min length is 2)', () => {
      const result = validateCategoryName('X')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('at least 2')
    })

    it('should accept name starting with number', () => {
      expect(validateCategoryName('401k')).toEqual({ valid: true })
    })
  })

  describe('invalid names', () => {
    it('should reject empty name', () => {
      const result = validateCategoryName('')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('required')
    })

    it('should reject whitespace only', () => {
      const result = validateCategoryName('   ')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('required')
    })

    it('should accept name with leading space (trimmed)', () => {
      // The validation trims the name first, so ' Groceries' becomes 'Groceries'
      expect(validateCategoryName(' Groceries')).toEqual({ valid: true })
    })

    it('should accept name with trailing space (trimmed)', () => {
      // The validation trims the name first, so 'Groceries ' becomes 'Groceries'
      expect(validateCategoryName('Groceries ')).toEqual({ valid: true })
    })

    it('should reject name starting with hyphen', () => {
      const result = validateCategoryName('-Groceries')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('letter or number')
    })

    it('should reject name too long', () => {
      const longName = 'A'.repeat(101)
      const result = validateCategoryName(longName)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('at most')
    })
  })

  describe('constants', () => {
    it('should have correct min length', () => {
      expect(CATEGORY_NAME_MIN_LENGTH).toBe(2)
    })

    it('should have correct max length', () => {
      expect(CATEGORY_NAME_MAX_LENGTH).toBe(100)
    })

    it('should have valid pattern', () => {
      expect(CATEGORY_NAME_PATTERN).toBeInstanceOf(RegExp)
      expect(CATEGORY_NAME_PATTERN.test('Groceries')).toBe(true)
      expect(CATEGORY_NAME_PATTERN.test(' Groceries')).toBe(false)
    })
  })
})
