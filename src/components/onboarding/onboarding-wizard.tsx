'use client'

import { useState, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Currency } from '@prisma/client'
import { useCsrfToken } from '@/hooks/useCsrfToken'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { WelcomeStep, CurrencyStep, CategoriesStep, BudgetStep, SampleDataStep, CompleteStep } from './steps'
import {
  skipOnboardingAction,
  completeOnboardingAction,
  updatePreferredCurrencyAction,
  createInitialCategoriesAction,
  createQuickBudgetAction,
  seedSampleDataAction,
} from '@/app/actions'

export type OnboardingStep = 'welcome' | 'currency' | 'categories' | 'budget' | 'sample-data' | 'complete'

const STEPS: OnboardingStep[] = ['welcome', 'currency', 'categories', 'budget', 'sample-data', 'complete']

type OnboardingWizardProps = {
  displayName: string
  preferredCurrency: Currency
  accounts: { id: string; name: string }[]
  existingCategoriesCount: number
}

export function OnboardingWizard({
  displayName,
  preferredCurrency: initialCurrency,
  accounts,
  existingCategoriesCount,
}: OnboardingWizardProps) {
  const router = useRouter()
  const csrfToken = useCsrfToken()
  const [isPending, startTransition] = useTransition()

  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome')
  const [error, setError] = useState<string | null>(null)

  // Wizard state
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(initialCurrency)
  const [createdCategories, setCreatedCategories] = useState<{ id: string; name: string }[]>([])
  const [hasSampleData, setHasSampleData] = useState(false)

  const currentStepIndex = STEPS.indexOf(currentStep)
  const progress = Math.round(((currentStepIndex + 1) / STEPS.length) * 100)

  const goToNextStep = useCallback(() => {
    const nextIndex = currentStepIndex + 1
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex])
      setError(null)
    }
  }, [currentStepIndex])

  const goToPreviousStep = useCallback(() => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex])
      setError(null)
    }
  }, [currentStepIndex])

  const handleSkip = () => {
    startTransition(async () => {
      const result = await skipOnboardingAction({ csrfToken })
      if ('error' in result) {
        setError(result.error.general?.[0] ?? 'Failed to skip onboarding')
        return
      }
      router.push('/')
      router.refresh()
    })
  }

  const handleComplete = () => {
    startTransition(async () => {
      const result = await completeOnboardingAction({ csrfToken })
      if ('error' in result) {
        setError(result.error.general?.[0] ?? 'Failed to complete onboarding')
        return
      }
      router.push('/')
      router.refresh()
    })
  }

  const handleCurrencyChange = (currency: Currency) => {
    setSelectedCurrency(currency)
    startTransition(async () => {
      const result = await updatePreferredCurrencyAction({ currency, csrfToken })
      if ('error' in result) {
        setError(result.error.general?.[0] ?? 'Failed to update currency')
        return
      }
      goToNextStep()
    })
  }

  const handleCategoriesCreate = (
    categories: { name: string; type: 'INCOME' | 'EXPENSE'; color?: string | null }[],
  ) => {
    startTransition(async () => {
      const result = await createInitialCategoriesAction({ categories, csrfToken })
      if ('error' in result) {
        setError(result.error.general?.[0] ?? result.error.categories?.[0] ?? 'Failed to create categories')
        return
      }
      if (result.success) {
        setCreatedCategories(categories.map((c, i) => ({ id: `temp-${i}`, name: c.name })))
      }
      goToNextStep()
    })
  }

  const handleBudgetCreate = (data: { accountId: string; categoryId: string; monthKey: string; planned: number }) => {
    startTransition(async () => {
      const result = await createQuickBudgetAction({
        ...data,
        currency: selectedCurrency,
        csrfToken,
      })
      if ('error' in result) {
        setError(result.error.general?.[0] ?? 'Failed to create budget')
        return
      }
      goToNextStep()
    })
  }

  const handleSampleData = (addSampleData: boolean) => {
    if (!addSampleData) {
      goToNextStep()
      return
    }

    startTransition(async () => {
      const result = await seedSampleDataAction({ csrfToken })
      if ('error' in result) {
        setError(result.error.general?.[0] ?? 'Failed to create sample data')
        return
      }
      setHasSampleData(true)
      goToNextStep()
    })
  }

  const renderStep = () => {
    switch (currentStep) {
      case 'welcome':
        return (
          <WelcomeStep displayName={displayName} onContinue={goToNextStep} onSkip={handleSkip} isPending={isPending} />
        )
      case 'currency':
        return (
          <CurrencyStep
            selectedCurrency={selectedCurrency}
            onSelect={handleCurrencyChange}
            onBack={goToPreviousStep}
            isPending={isPending}
          />
        )
      case 'categories':
        return (
          <CategoriesStep
            existingCount={existingCategoriesCount}
            onSubmit={handleCategoriesCreate}
            onBack={goToPreviousStep}
            onSkip={goToNextStep}
            isPending={isPending}
          />
        )
      case 'budget':
        return (
          <BudgetStep
            accounts={accounts}
            categories={createdCategories}
            currency={selectedCurrency}
            onSubmit={handleBudgetCreate}
            onBack={goToPreviousStep}
            onSkip={goToNextStep}
            isPending={isPending}
          />
        )
      case 'sample-data':
        return <SampleDataStep onSubmit={handleSampleData} onBack={goToPreviousStep} isPending={isPending} />
      case 'complete':
        return (
          <CompleteStep
            hasSampleData={hasSampleData}
            categoriesCount={createdCategories.length || existingCategoriesCount}
            onComplete={handleComplete}
            isPending={isPending}
          />
        )
    }
  }

  return (
    <Card className="w-full max-w-lg border-white/20 bg-white/10 text-slate-100 shadow-2xl backdrop-blur">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-wide text-slate-200">
            <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
            Setup Wizard
          </div>
          <span className="text-xs text-slate-400">
            Step {currentStepIndex + 1} of {STEPS.length}
          </span>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-400 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <CardTitle className="text-2xl font-semibold text-white">
          {currentStep === 'welcome' && 'Welcome to Balance Beacon'}
          {currentStep === 'currency' && 'Choose Your Currency'}
          {currentStep === 'categories' && 'Set Up Categories'}
          {currentStep === 'budget' && 'Create Your First Budget'}
          {currentStep === 'sample-data' && 'Sample Data'}
          {currentStep === 'complete' && 'All Set!'}
        </CardTitle>
        <CardDescription className="text-slate-400">
          {currentStep === 'welcome' && "Let's get your account set up in just a few steps."}
          {currentStep === 'currency' && 'Select the currency you primarily use for tracking expenses.'}
          {currentStep === 'categories' && 'Choose categories to organize your income and expenses.'}
          {currentStep === 'budget' && 'Set a monthly budget for one of your expense categories.'}
          {currentStep === 'sample-data' && 'Would you like to see how the app works with example data?'}
          {currentStep === 'complete' && "You're ready to start tracking your finances!"}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {error && (
          <div className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {error}
          </div>
        )}

        {renderStep()}
      </CardContent>
    </Card>
  )
}
