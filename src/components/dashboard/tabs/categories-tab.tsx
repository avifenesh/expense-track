'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { TransactionType } from '@prisma/client'
import { Tags } from 'lucide-react'
import { archiveCategoryAction, createCategoryAction } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { filterCategories } from '@/lib/dashboard-ux'
import { useFeedback } from '@/hooks/useFeedback'
import { cn } from '@/utils/cn'
import { DashboardCategory, transactionTypeOptions, typeFilterOptions, TypeFilterValue } from './types'

export type CategoriesTabProps = {
  categories: DashboardCategory[]
}

export function CategoriesTab({ categories }: CategoriesTabProps) {
  const router = useRouter()

  // Local state
  const [categorySearch, setCategorySearch] = useState('')
  const [categoryTypeFilter, setCategoryTypeFilter] = useState<TypeFilterValue>('all')
  const [showArchivedCategories, setShowArchivedCategories] = useState(false)
  const [visibleCategoriesCount, setVisibleCategoriesCount] = useState(10)
  const { feedback: categoryFeedback, showSuccess, showError } = useFeedback()
  const [isPendingCategory, startCategory] = useTransition()

  // Computed
  const filteredCategoryList = useMemo(
    () =>
      filterCategories(categories, {
        search: categorySearch,
        type: categoryTypeFilter,
        includeArchived: showArchivedCategories,
      }),
    [categories, categorySearch, categoryTypeFilter, showArchivedCategories],
  )

  // Handlers
  const handleCategorySubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)

    const payload = {
      name: formData.get('categoryName') as string,
      type: formData.get('categoryType') as TransactionType,
      color: (formData.get('categoryColor') as string) || undefined,
    }

    startCategory(async () => {
      const result = await createCategoryAction(payload)
      if ('error' in result) {
        showError('Could not create category.')
        return
      }
      showSuccess('Category added.')
      form.reset()
      router.refresh()
    })
  }

  const handleCategoryArchive = (id: string, isArchived: boolean) => {
    startCategory(async () => {
      const result = await archiveCategoryAction({ id, isArchived })
      if ('error' in result) {
        showError('Unable to update category.')
        return
      }
      showSuccess(isArchived ? 'Category archived.' : 'Category reactivated.')
      router.refresh()
    })
  }

  return (
    <div role="tabpanel" id="panel-categories" aria-labelledby="tab-categories" className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[2fr,3fr]">
        <Card className="border-white/15 bg-white/10">
          <CardHeader className="gap-1">
            <CardTitle
              className="text-lg font-semibold text-white"
              helpText="Add bookkeeping categories with type, color, and archive controls for budgeting and rules."
            >
              Create categories
            </CardTitle>
            <p className="text-sm text-slate-400">
              Enable, archive, and color-code the buckets your household relies on.
            </p>
          </CardHeader>
          <CardContent>
            <form
              id="category-form"
              onSubmit={handleCategorySubmit}
              className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5"
              tabIndex={-1}
            >
              <div>
                <h3 className="text-sm font-semibold text-white">Add new category</h3>
                <p className="text-xs text-slate-400">Segment transactions with meaningful labels.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-300" htmlFor="categoryName">
                    Name
                  </label>
                  <Input name="categoryName" id="categoryName" placeholder="e.g. Car Leasing" required />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-300" htmlFor="categoryType">
                    Type
                  </label>
                  <Select
                    id="categoryType"
                    name="categoryType"
                    options={transactionTypeOptions}
                    defaultValue={TransactionType.EXPENSE}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-300" htmlFor="categoryColor">
                    Color (optional)
                  </label>
                  <Input name="categoryColor" id="categoryColor" type="color" defaultValue="#0ea5e9" />
                </div>
              </div>
              <Button type="submit" loading={isPendingCategory} className="w-full">
                Add category
              </Button>
              {categoryFeedback && (
                <p
                  role="status"
                  className={cn('text-xs', categoryFeedback.type === 'error' ? 'text-rose-600' : 'text-emerald-600')}
                >
                  {categoryFeedback.message}
                </p>
              )}
            </form>
          </CardContent>
        </Card>

        <Card className="border-white/15 bg-white/10">
          <CardHeader>
            <CardTitle
              className="text-lg font-semibold text-white"
              helpText="Search, filter, and archive categories; changes sync across budgeting and transaction forms."
            >
              Category library
            </CardTitle>
            <p className="text-sm text-slate-400">
              Toggle availability to keep dropdowns focused and reports meaningful.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300" htmlFor="category-filter-type">
                  Type filter
                </label>
                <Select
                  id="category-filter-type"
                  value={categoryTypeFilter}
                  onChange={(event) => {
                    setCategoryTypeFilter(event.target.value as TypeFilterValue)
                    setVisibleCategoriesCount(10)
                  }}
                  options={typeFilterOptions}
                />
              </div>
              <div className="space-y-2 md:col-span-2 lg:col-span-1">
                <label className="text-xs font-medium text-slate-300" htmlFor="category-filter-search">
                  Search categories
                </label>
                <Input
                  id="category-filter-search"
                  value={categorySearch}
                  onChange={(event) => {
                    setCategorySearch(event.target.value)
                    setVisibleCategoriesCount(10)
                  }}
                  placeholder="e.g. groceries, rent"
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-xs text-slate-200"
                  onClick={() => {
                    setShowArchivedCategories((prev) => !prev)
                    setVisibleCategoriesCount(10)
                  }}
                >
                  {showArchivedCategories ? 'Hide archived' : 'Show archived'}
                </Button>
              </div>
            </div>
            {filteredCategoryList.length === 0 && (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/20 bg-white/5 p-8 text-center">
                <div className="rounded-full bg-white/10 p-3">
                  <Tags className="h-6 w-6 text-slate-300" />
                </div>
                {categories.length === 0 ? (
                  <>
                    <p className="text-sm font-medium text-white">No labels yet</p>
                    <p className="text-xs text-slate-400">Create labels to organize your spending and income.</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-white">No matching labels</p>
                    <p className="text-xs text-slate-400">Try adjusting the filters above.</p>
                  </>
                )}
              </div>
            )}
            {filteredCategoryList.slice(0, visibleCategoriesCount).map((category) => (
              <div
                key={category.id}
                className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 font-medium text-white">
                    <span>{category.name}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      {category.type === TransactionType.EXPENSE ? 'Expense' : 'Income'}
                    </span>
                    {category.isHolding && (
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-emerald-200">
                        Holding
                      </span>
                    )}
                    {category.isArchived && (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-300">
                        Archived
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  className="text-xs text-slate-400 hover:bg-slate-100"
                  onClick={() => handleCategoryArchive(category.id, !category.isArchived)}
                >
                  {category.isArchived ? 'Reactivate' : 'Archive'}
                </Button>
              </div>
            ))}
            {filteredCategoryList.length > visibleCategoriesCount && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setVisibleCategoriesCount((prev) => prev + 10)}
              >
                Load more ({filteredCategoryList.length - visibleCategoriesCount} remaining)
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
