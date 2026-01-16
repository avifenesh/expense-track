import { useState, useCallback, useMemo } from 'react'

export type ValidationRule<T> = {
  validate: (value: T) => boolean
  message: string
}

export type FieldConfig<T = string> = {
  rules: ValidationRule<T>[]
  validateOnBlur?: boolean
}

type FieldState = {
  touched: boolean
  error: string | null
  valid: boolean
}

type ValidationState<K extends string> = {
  [key in K]: FieldState
}

type ValidationResult<K extends string> = {
  fields: ValidationState<K>
  errors: Partial<Record<K, string[]>>
  isValid: boolean
  getFieldProps: (name: K) => {
    error: boolean
    valid: boolean
    onBlur: () => void
    onChange: () => void
    'aria-invalid': 'true' | undefined
    'aria-describedby': string | undefined
  }
  validateField: (name: K, value: unknown) => boolean
  validateAll: (values: Record<K, unknown>) => boolean
  resetField: (name: K) => void
  resetAll: () => void
  setFieldError: (name: K, error: string | null) => void
  setFieldsFromServer: (serverErrors: Partial<Record<K, string[]>>) => void
}

export function useFormValidation<K extends string>(config: Record<K, FieldConfig>): ValidationResult<K> {
  const fieldNames = useMemo(() => Object.keys(config) as K[], [config])

  const initialState = useMemo(
    () =>
      fieldNames.reduce(
        (acc, name) => ({
          ...acc,
          [name]: { touched: false, error: null, valid: false },
        }),
        {} as ValidationState<K>,
      ),
    [fieldNames],
  )

  const [fields, setFields] = useState<ValidationState<K>>(initialState)

  const validateField = useCallback(
    (name: K, value: unknown): boolean => {
      const fieldConfig = config[name]
      if (!fieldConfig) return true

      for (const rule of fieldConfig.rules) {
        if (!rule.validate(value as never)) {
          setFields((prev) => ({
            ...prev,
            [name]: { touched: true, error: rule.message, valid: false },
          }))
          return false
        }
      }

      setFields((prev) => ({
        ...prev,
        [name]: { touched: true, error: null, valid: true },
      }))
      return true
    },
    [config],
  )

  const validateAll = useCallback(
    (values: Record<K, unknown>): boolean => {
      let allValid = true

      setFields((prev) => {
        const next = { ...prev }
        for (const name of fieldNames) {
          const fieldConfig = config[name]
          if (!fieldConfig) continue

          let fieldError: string | null = null
          for (const rule of fieldConfig.rules) {
            if (!rule.validate(values[name] as never)) {
              fieldError = rule.message
              allValid = false
              break
            }
          }
          next[name] = { touched: true, error: fieldError, valid: fieldError === null }
        }
        return next
      })

      return allValid
    },
    [config, fieldNames],
  )

  const resetField = useCallback((name: K) => {
    setFields((prev) => ({
      ...prev,
      [name]: { touched: false, error: null, valid: false },
    }))
  }, [])

  const resetAll = useCallback(() => {
    setFields(initialState)
  }, [initialState])

  const setFieldError = useCallback((name: K, error: string | null) => {
    setFields((prev) => ({
      ...prev,
      [name]: { touched: true, error, valid: error === null },
    }))
  }, [])

  const setFieldsFromServer = useCallback(
    (serverErrors: Partial<Record<K, string[]>>) => {
      setFields((prev) => {
        const next = { ...prev }
        for (const name of fieldNames) {
          const errors = serverErrors[name]
          if (errors && errors.length > 0) {
            next[name] = { touched: true, error: errors[0], valid: false }
          }
        }
        return next
      })
    },
    [fieldNames],
  )

  const errors = useMemo(() => {
    const result: Partial<Record<K, string[]>> = {}
    for (const name of fieldNames) {
      const field = fields[name]
      if (field.error) {
        result[name] = [field.error]
      }
    }
    return result
  }, [fields, fieldNames])

  const isValid = useMemo(
    () => fieldNames.every((name) => !fields[name].error && fields[name].valid),
    [fields, fieldNames],
  )

  const getFieldProps = useCallback(
    (name: K) => {
      const field = fields[name]
      const hasError = field.touched && field.error !== null
      const isFieldValid = field.touched && field.valid

      return {
        error: hasError,
        valid: isFieldValid,
        onBlur: () => {
          if (!field.touched) {
            setFields((prev) => ({
              ...prev,
              [name]: { ...prev[name], touched: true },
            }))
          }
        },
        onChange: () => {
          if (field.error) {
            setFields((prev) => ({
              ...prev,
              [name]: { ...prev[name], error: null },
            }))
          }
        },
        'aria-invalid': hasError ? ('true' as const) : undefined,
        'aria-describedby': hasError ? `${name}-error` : undefined,
      }
    },
    [fields],
  )

  return {
    fields,
    errors,
    isValid,
    getFieldProps,
    validateField,
    validateAll,
    resetField,
    resetAll,
    setFieldError,
    setFieldsFromServer,
  }
}

export const validators = {
  required: (message = 'This field is required'): ValidationRule<unknown> => ({
    validate: (value) => value !== '' && value !== null && value !== undefined,
    message,
  }),

  minLength: (min: number, message?: string): ValidationRule<string> => ({
    validate: (value) => value.length >= min,
    message: message ?? `Must be at least ${min} characters`,
  }),

  maxLength: (max: number, message?: string): ValidationRule<string> => ({
    validate: (value) => value.length <= max,
    message: message ?? `Must be at most ${max} characters`,
  }),

  positiveNumber: (message = 'Enter a positive number'): ValidationRule<string | number> => ({
    validate: (value) => {
      const num = typeof value === 'string' ? parseFloat(value) : value
      return Number.isFinite(num) && num > 0
    },
    message,
  }),

  nonNegativeNumber: (message = 'Enter a non-negative number'): ValidationRule<string | number> => ({
    validate: (value) => {
      const num = typeof value === 'string' ? parseFloat(value) : value
      return Number.isFinite(num) && num >= 0
    },
    message,
  }),

  validDate: (message = 'Enter a valid date'): ValidationRule<string> => ({
    validate: (value) => {
      if (!value) return false
      const date = new Date(value)
      return !isNaN(date.getTime())
    },
    message,
  }),

  pattern: (regex: RegExp, message: string): ValidationRule<string> => ({
    validate: (value) => regex.test(value),
    message,
  }),
}
