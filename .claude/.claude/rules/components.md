---
paths: ['src/components/**']
---

# React Component Rules

## Client vs Server Components

- Default is Server Component
- Add `'use client'` only when needed (hooks, event handlers, browser APIs)

## CSRF Token Usage

```typescript
import { useCsrfToken } from '@/hooks/useCsrfToken'

function MyComponent() {
  const csrfToken = useCsrfToken()

  const handleSubmit = () => {
    await someAction({ ...data, csrfToken })
  }
}
```

## Loading States with useTransition

```typescript
import { useTransition } from 'react'

function MyComponent() {
  const [isPending, startTransition] = useTransition()

  const handleClick = () => {
    startTransition(async () => {
      const result = await someAction(data)
      // handle result
    })
  }

  return (
    <Button loading={isPending} disabled={isPending}>
      {isPending ? 'Saving...' : 'Save'}
    </Button>
  )
}
```

## Toast Notifications

```typescript
import { toast } from '@/hooks/useToast'

toast.success('Budget saved!')
toast.error('Failed to delete category.')
toast.info('Exchange rates updated.')
```

## Error Handling from Actions

```typescript
const result = await someAction(data)

if ('error' in result) {
  if (result.error.fieldName) {
    setFieldError(result.error.fieldName[0])
  }
  if (result.error.general) {
    toast.error(result.error.general[0])
  }
  return
}

toast.success('Operation completed!')
```

## Form Pattern

```typescript
function MyForm() {
  const csrfToken = useCsrfToken()
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string[]>>({})

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setErrors({})

    startTransition(async () => {
      const result = await someAction({ ...formData, csrfToken })

      if ('error' in result) {
        setErrors(result.error)
        const general = result.error.general?.[0]
        if (general) toast.error(general)
        return
      }

      toast.success('Saved!')
      onClose?.()
    })
  }
}
```

## Currency Formatting

```typescript
import { formatCurrency, formatRelativeAmount } from '@/utils/format'

formatCurrency(100.5, Currency.USD) // "$100.50"
formatRelativeAmount(50, Currency.USD) // "+$50.00"
formatRelativeAmount(-25, Currency.USD) // "-$25.00"
```

## Mobile-First Considerations

- Primary users: mid-range Android with unstable internet
- Always show loading states and skeletons
- Handle error states with retry options
- Keep UI responsive during async operations
