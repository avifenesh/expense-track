/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFormValidation, validators } from '@/hooks/useFormValidation'

describe('useFormValidation', () => {
  describe('validateField', () => {
    it('should validate required field with valid value', () => {
      const { result } = renderHook(() =>
        useFormValidation({
          name: { rules: [validators.required()], validateOnBlur: true },
        }),
      )

      act(() => {
        result.current.validateField('name', 'John')
      })

      expect(result.current.fields.name.valid).toBe(true)
      expect(result.current.fields.name.error).toBeNull()
    })

    it('should validate required field with empty value', () => {
      const { result } = renderHook(() =>
        useFormValidation({
          name: { rules: [validators.required()], validateOnBlur: true },
        }),
      )

      act(() => {
        result.current.validateField('name', '')
      })

      expect(result.current.fields.name.valid).toBe(false)
      expect(result.current.fields.name.error).toBe('This field is required')
    })

    it('should use custom error message', () => {
      const { result } = renderHook(() =>
        useFormValidation({
          name: { rules: [validators.required('Name is required')], validateOnBlur: true },
        }),
      )

      act(() => {
        result.current.validateField('name', '')
      })

      expect(result.current.fields.name.error).toBe('Name is required')
    })
  })

  describe('validateAll', () => {
    it('should validate all fields at once', () => {
      const { result } = renderHook(() =>
        useFormValidation({
          name: { rules: [validators.required()], validateOnBlur: true },
          email: { rules: [validators.required()], validateOnBlur: true },
        }),
      )

      let isValid: boolean
      act(() => {
        isValid = result.current.validateAll({ name: 'John', email: 'john@example.com' })
      })

      expect(isValid!).toBe(true)
      expect(result.current.fields.name.valid).toBe(true)
      expect(result.current.fields.email.valid).toBe(true)
    })

    it('should return false when any field is invalid', () => {
      const { result } = renderHook(() =>
        useFormValidation({
          name: { rules: [validators.required()], validateOnBlur: true },
          email: { rules: [validators.required()], validateOnBlur: true },
        }),
      )

      let isValid: boolean
      act(() => {
        isValid = result.current.validateAll({ name: 'John', email: '' })
      })

      expect(isValid!).toBe(false)
      expect(result.current.fields.name.valid).toBe(true)
      expect(result.current.fields.email.valid).toBe(false)
    })
  })

  describe('resetField', () => {
    it('should reset a single field', () => {
      const { result } = renderHook(() =>
        useFormValidation({
          name: { rules: [validators.required()], validateOnBlur: true },
        }),
      )

      act(() => {
        result.current.validateField('name', '')
      })

      expect(result.current.fields.name.error).not.toBeNull()

      act(() => {
        result.current.resetField('name')
      })

      expect(result.current.fields.name.touched).toBe(false)
      expect(result.current.fields.name.error).toBeNull()
      expect(result.current.fields.name.valid).toBe(false)
    })
  })

  describe('resetAll', () => {
    it('should reset all fields', () => {
      const { result } = renderHook(() =>
        useFormValidation({
          name: { rules: [validators.required()], validateOnBlur: true },
          email: { rules: [validators.required()], validateOnBlur: true },
        }),
      )

      act(() => {
        result.current.validateAll({ name: '', email: '' })
      })

      expect(result.current.fields.name.error).not.toBeNull()
      expect(result.current.fields.email.error).not.toBeNull()

      act(() => {
        result.current.resetAll()
      })

      expect(result.current.fields.name.touched).toBe(false)
      expect(result.current.fields.email.touched).toBe(false)
    })
  })

  describe('setFieldError', () => {
    it('should set error on a field', () => {
      const { result } = renderHook(() =>
        useFormValidation({
          name: { rules: [validators.required()], validateOnBlur: true },
        }),
      )

      act(() => {
        result.current.setFieldError('name', 'Custom error')
      })

      expect(result.current.fields.name.error).toBe('Custom error')
      expect(result.current.fields.name.valid).toBe(false)
    })

    it('should clear error when set to null', () => {
      const { result } = renderHook(() =>
        useFormValidation({
          name: { rules: [validators.required()], validateOnBlur: true },
        }),
      )

      act(() => {
        result.current.setFieldError('name', 'Some error')
      })

      expect(result.current.fields.name.error).toBe('Some error')

      act(() => {
        result.current.setFieldError('name', null)
      })

      expect(result.current.fields.name.error).toBeNull()
      expect(result.current.fields.name.valid).toBe(true)
    })
  })

  describe('setFieldsFromServer', () => {
    it('should set errors from server response', () => {
      const { result } = renderHook(() =>
        useFormValidation({
          name: { rules: [validators.required()], validateOnBlur: true },
          email: { rules: [validators.required()], validateOnBlur: true },
        }),
      )

      act(() => {
        result.current.setFieldsFromServer({
          name: ['Name already exists'],
          email: ['Email is invalid'],
        })
      })

      expect(result.current.fields.name.error).toBe('Name already exists')
      expect(result.current.fields.email.error).toBe('Email is invalid')
    })
  })

  describe('getFieldProps', () => {
    it('should return field props for input', () => {
      const { result } = renderHook(() =>
        useFormValidation({
          name: { rules: [validators.required()], validateOnBlur: true },
        }),
      )

      const props = result.current.getFieldProps('name')

      expect(props.error).toBe(false)
      expect(props.valid).toBe(false)
      expect(typeof props.onBlur).toBe('function')
      expect(typeof props.onChange).toBe('function')
    })

    it('should return error=true when field has error and is touched', () => {
      const { result } = renderHook(() =>
        useFormValidation({
          name: { rules: [validators.required()], validateOnBlur: true },
        }),
      )

      act(() => {
        result.current.validateField('name', '')
      })

      const props = result.current.getFieldProps('name')

      expect(props.error).toBe(true)
      expect(props.valid).toBe(false)
      expect(props['aria-invalid']).toBe('true')
      expect(props['aria-describedby']).toBe('name-error')
    })

    it('should return valid=true when field is valid and touched', () => {
      const { result } = renderHook(() =>
        useFormValidation({
          name: { rules: [validators.required()], validateOnBlur: true },
        }),
      )

      act(() => {
        result.current.validateField('name', 'John')
      })

      const props = result.current.getFieldProps('name')

      expect(props.error).toBe(false)
      expect(props.valid).toBe(true)
    })

    it('should clear error on onChange', () => {
      const { result } = renderHook(() =>
        useFormValidation({
          name: { rules: [validators.required()], validateOnBlur: true },
        }),
      )

      act(() => {
        result.current.validateField('name', '')
      })

      expect(result.current.fields.name.error).not.toBeNull()

      act(() => {
        result.current.getFieldProps('name').onChange()
      })

      expect(result.current.fields.name.error).toBeNull()
    })
  })

  describe('errors object', () => {
    it('should aggregate errors from fields', () => {
      const { result } = renderHook(() =>
        useFormValidation({
          name: { rules: [validators.required('Name required')], validateOnBlur: true },
          email: { rules: [validators.required('Email required')], validateOnBlur: true },
        }),
      )

      act(() => {
        result.current.validateAll({ name: '', email: '' })
      })

      expect(result.current.errors.name).toEqual(['Name required'])
      expect(result.current.errors.email).toEqual(['Email required'])
    })

    it('should not include fields without errors', () => {
      const { result } = renderHook(() =>
        useFormValidation({
          name: { rules: [validators.required()], validateOnBlur: true },
          email: { rules: [validators.required()], validateOnBlur: true },
        }),
      )

      act(() => {
        result.current.validateAll({ name: 'John', email: '' })
      })

      expect(result.current.errors.name).toBeUndefined()
      expect(result.current.errors.email).toBeDefined()
    })
  })

  describe('isValid', () => {
    it('should be false initially', () => {
      const { result } = renderHook(() =>
        useFormValidation({
          name: { rules: [validators.required()], validateOnBlur: true },
        }),
      )

      expect(result.current.isValid).toBe(false)
    })

    it('should be true when all fields are valid and touched', () => {
      const { result } = renderHook(() =>
        useFormValidation({
          name: { rules: [validators.required()], validateOnBlur: true },
          email: { rules: [validators.required()], validateOnBlur: true },
        }),
      )

      act(() => {
        result.current.validateAll({ name: 'John', email: 'john@example.com' })
      })

      expect(result.current.isValid).toBe(true)
    })

    it('should be false when any field is invalid', () => {
      const { result } = renderHook(() =>
        useFormValidation({
          name: { rules: [validators.required()], validateOnBlur: true },
          email: { rules: [validators.required()], validateOnBlur: true },
        }),
      )

      act(() => {
        result.current.validateAll({ name: 'John', email: '' })
      })

      expect(result.current.isValid).toBe(false)
    })
  })
})

describe('validators', () => {
  describe('required', () => {
    const rule = validators.required()

    it('should pass for non-empty string', () => {
      expect(rule.validate('hello')).toBe(true)
    })

    it('should fail for empty string', () => {
      expect(rule.validate('')).toBe(false)
    })

    it('should fail for null', () => {
      expect(rule.validate(null)).toBe(false)
    })

    it('should fail for undefined', () => {
      expect(rule.validate(undefined)).toBe(false)
    })

    it('should pass for non-zero number', () => {
      expect(rule.validate(42)).toBe(true)
    })

    it('should pass for zero', () => {
      expect(rule.validate(0)).toBe(true)
    })
  })

  describe('minLength', () => {
    const rule = validators.minLength(3)

    it('should pass for string >= min length', () => {
      expect(rule.validate('abc')).toBe(true)
      expect(rule.validate('abcd')).toBe(true)
    })

    it('should fail for string < min length', () => {
      expect(rule.validate('ab')).toBe(false)
    })
  })

  describe('maxLength', () => {
    const rule = validators.maxLength(5)

    it('should pass for string <= max length', () => {
      expect(rule.validate('abc')).toBe(true)
      expect(rule.validate('abcde')).toBe(true)
    })

    it('should fail for string > max length', () => {
      expect(rule.validate('abcdef')).toBe(false)
    })
  })

  describe('positiveNumber', () => {
    const rule = validators.positiveNumber()

    it('should pass for positive number', () => {
      expect(rule.validate(1)).toBe(true)
      expect(rule.validate(0.5)).toBe(true)
    })

    it('should fail for zero', () => {
      expect(rule.validate(0)).toBe(false)
    })

    it('should fail for negative number', () => {
      expect(rule.validate(-1)).toBe(false)
    })

    it('should handle string numbers', () => {
      expect(rule.validate('10')).toBe(true)
      expect(rule.validate('-5')).toBe(false)
    })

    it('should fail for non-numeric string', () => {
      expect(rule.validate('abc')).toBe(false)
    })
  })

  describe('nonNegativeNumber', () => {
    const rule = validators.nonNegativeNumber()

    it('should pass for zero', () => {
      expect(rule.validate(0)).toBe(true)
    })

    it('should pass for positive number', () => {
      expect(rule.validate(1)).toBe(true)
    })

    it('should fail for negative number', () => {
      expect(rule.validate(-1)).toBe(false)
    })
  })

  describe('validDate', () => {
    const rule = validators.validDate()

    it('should pass for valid date string', () => {
      expect(rule.validate('2025-01-15')).toBe(true)
    })

    it('should fail for invalid date string', () => {
      expect(rule.validate('invalid')).toBe(false)
    })

    it('should fail for empty string', () => {
      expect(rule.validate('')).toBe(false)
    })
  })

  describe('pattern', () => {
    const emailRule = validators.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email')

    it('should pass for matching pattern', () => {
      expect(emailRule.validate('test@example.com')).toBe(true)
    })

    it('should fail for non-matching pattern', () => {
      expect(emailRule.validate('invalid')).toBe(false)
    })
  })
})
