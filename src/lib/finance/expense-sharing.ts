// Finance module - expense sharing operations
import type { Prisma } from '@prisma/client'
import { Currency, PaymentStatus, SplitType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { decimalToNumber } from './utils'
import type {
  SharedExpenseSummary,
  ExpenseParticipationSummary,
  SettlementBalance,
  PaymentHistoryItem,
  PaginationOptions,
  PaginatedResult,
  SharedExpensePaginationOptions,
  ParticipantPaginationOptions,
} from './types'
import { DEFAULT_PAGINATION_LIMIT } from './types'

// Maximum items per page
const MAX_LIMIT = 100

// Type for shared expense query result with includes
type SharedExpenseWithIncludes = Prisma.SharedExpenseGetPayload<{
  include: {
    transaction: {
      include: {
        category: true
      }
    }
    participants: {
      include: {
        participant: {
          select: {
            id: true
            email: true
            displayName: true
          }
        }
      }
    }
  }
}>

// Type for expense participation query result with includes
type ExpenseParticipationWithIncludes = Prisma.ExpenseParticipantGetPayload<{
  include: {
    sharedExpense: {
      include: {
        transaction: {
          include: {
            category: true
          }
        }
        owner: {
          select: {
            id: true
            email: true
            displayName: true
          }
        }
      }
    }
  }
}>

/**
 * Transform a Prisma SharedExpense record into a SharedExpenseSummary.
 * This helper is used by both getSharedExpenses and getSharedExpensesPaginated.
 */
function transformSharedExpense(expense: SharedExpenseWithIncludes): SharedExpenseSummary {
  const totalAmount = decimalToNumber(expense.totalAmount)
  const participants = expense.participants.map((p) => ({
    id: p.id,
    shareAmount: decimalToNumber(p.shareAmount),
    sharePercentage: p.sharePercentage ? decimalToNumber(p.sharePercentage) : null,
    status: p.status,
    paidAt: p.paidAt,
    reminderSentAt: p.reminderSentAt,
    participant: p.participant,
  }))

  const totalOwed = participants
    .filter((p) => p.status === PaymentStatus.PENDING)
    .reduce((sum, p) => sum + p.shareAmount, 0)
  const totalPaid = participants
    .filter((p) => p.status === PaymentStatus.PAID)
    .reduce((sum, p) => sum + p.shareAmount, 0)
  const allSettled = participants.every((p) => p.status !== PaymentStatus.PENDING)

  return {
    id: expense.id,
    transactionId: expense.transactionId,
    splitType: expense.splitType,
    totalAmount,
    currency: expense.currency,
    description: expense.description,
    createdAt: expense.createdAt,
    transaction: {
      id: expense.transaction.id,
      date: expense.transaction.date,
      description: expense.transaction.description,
      category: {
        id: expense.transaction.category.id,
        name: expense.transaction.category.name,
      },
    },
    participants,
    totalOwed,
    totalPaid,
    allSettled,
  }
}

/**
 * Transform a Prisma ExpenseParticipant record into an ExpenseParticipationSummary.
 * This helper is used by both getExpensesSharedWithMe and getExpensesSharedWithMePaginated.
 */
function transformExpenseParticipation(p: ExpenseParticipationWithIncludes): ExpenseParticipationSummary {
  return {
    id: p.id,
    shareAmount: decimalToNumber(p.shareAmount),
    sharePercentage: p.sharePercentage ? decimalToNumber(p.sharePercentage) : null,
    status: p.status,
    paidAt: p.paidAt,
    sharedExpense: {
      id: p.sharedExpense.id,
      splitType: p.sharedExpense.splitType,
      totalAmount: decimalToNumber(p.sharedExpense.totalAmount),
      currency: p.sharedExpense.currency,
      description: p.sharedExpense.description,
      createdAt: p.sharedExpense.createdAt,
      transaction: {
        id: p.sharedExpense.transaction.id,
        date: p.sharedExpense.transaction.date,
        description: p.sharedExpense.transaction.description,
        category: {
          id: p.sharedExpense.transaction.category.id,
          name: p.sharedExpense.transaction.category.name,
        },
      },
      owner: p.sharedExpense.owner,
    },
  }
}

/**
 * Get expenses shared by a user with others.
 * Supports cursor-based pagination for efficient loading of large lists.
 *
 * @param userId - The user who shared the expenses
 * @param options - Optional pagination options (cursor, limit)
 * @returns Paginated result with shared expenses
 */
export async function getSharedExpenses(
  userId: string,
  options?: PaginationOptions,
): Promise<PaginatedResult<SharedExpenseSummary>> {
  const limit = options?.limit ?? DEFAULT_PAGINATION_LIMIT

  const sharedExpenses = await prisma.sharedExpense.findMany({
    where: { ownerId: userId },
    include: {
      transaction: {
        include: {
          category: true,
        },
      },
      participants: {
        include: {
          participant: {
            select: {
              id: true,
              email: true,
              displayName: true,
            },
          },
        },
      },
    },
    // Order by createdAt then id for stable cursor pagination across tied timestamps
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1, // Fetch one extra to check if more exist
    ...(options?.cursor && {
      cursor: { id: options.cursor },
      skip: 1, // Skip the cursor itself
    }),
  })

  const hasMore = sharedExpenses.length > limit
  const results = hasMore ? sharedExpenses.slice(0, limit) : sharedExpenses
  const items = results.map(transformSharedExpense)

  return {
    items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
    hasMore,
  }
}

/**
 * Offset-based paginated result type for API endpoints
 */
export type OffsetPaginatedResult<T> = {
  items: T[]
  total: number
  hasMore: boolean
}

/**
 * Get expenses shared by a user with others (API version).
 * Supports offset-based pagination and status filtering for REST API.
 * Uses Prisma relation filters (some/none) and DB-side pagination.
 *
 * @param userId - The user who shared the expenses
 * @param options - Optional pagination and filtering options
 * @returns Paginated result with shared expenses and total count
 */
export async function getSharedExpensesPaginated(
  userId: string,
  options?: SharedExpensePaginationOptions,
): Promise<OffsetPaginatedResult<SharedExpenseSummary>> {
  const limit = Math.min(options?.limit ?? DEFAULT_PAGINATION_LIMIT, MAX_LIMIT)
  const offset = options?.offset ?? 0
  const statusFilter = options?.status ?? 'all'

  // Build where clause with status filtering using Prisma relation filters
  // "pending" = at least one participant is PENDING (some)
  // "settled" = no participants are PENDING (none)
  const where: Prisma.SharedExpenseWhereInput = { ownerId: userId }
  if (statusFilter === 'pending') {
    where.participants = { some: { status: PaymentStatus.PENDING } }
  } else if (statusFilter === 'settled') {
    where.participants = { none: { status: PaymentStatus.PENDING } }
  }

  // Use transaction for atomicity of count + fetch
  const [total, sharedExpenses] = await prisma.$transaction([
    prisma.sharedExpense.count({ where }),
    prisma.sharedExpense.findMany({
      where,
      include: {
        transaction: {
          include: {
            category: true,
          },
        },
        participants: {
          include: {
            participant: {
              select: {
                id: true,
                email: true,
                displayName: true,
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: offset,
      take: limit,
    }),
  ])

  const items = sharedExpenses.map(transformSharedExpense)
  const hasMore = offset + items.length < total

  return { items, total, hasMore }
}

/**
 * Get expenses shared with a user by others.
 * Supports cursor-based pagination for efficient loading of large lists.
 *
 * @param userId - The user who participates in the shared expenses
 * @param options - Optional pagination options (cursor, limit)
 * @returns Paginated result with expense participations
 */
export async function getExpensesSharedWithMe(
  userId: string,
  options?: PaginationOptions,
): Promise<PaginatedResult<ExpenseParticipationSummary>> {
  const limit = options?.limit ?? DEFAULT_PAGINATION_LIMIT

  const participations = await prisma.expenseParticipant.findMany({
    where: { userId },
    include: {
      sharedExpense: {
        include: {
          transaction: {
            include: {
              category: true,
            },
          },
          owner: {
            select: {
              id: true,
              email: true,
              displayName: true,
            },
          },
        },
      },
    },
    // Order by createdAt then id for stable cursor pagination across tied timestamps
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1, // Fetch one extra to check if more exist
    ...(options?.cursor && {
      cursor: { id: options.cursor },
      skip: 1, // Skip the cursor itself
    }),
  })

  const hasMore = participations.length > limit
  const results = hasMore ? participations.slice(0, limit) : participations
  const items = results.map(transformExpenseParticipation)

  return {
    items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
    hasMore,
  }
}

/**
 * Get expenses shared with a user by others (API version).
 * Supports offset-based pagination and status filtering for REST API.
 *
 * @param userId - The user who participates in the shared expenses
 * @param options - Optional pagination and filtering options
 * @returns Paginated result with expense participations and total count
 */
export async function getExpensesSharedWithMePaginated(
  userId: string,
  options?: ParticipantPaginationOptions,
): Promise<OffsetPaginatedResult<ExpenseParticipationSummary>> {
  const limit = Math.min(options?.limit ?? DEFAULT_PAGINATION_LIMIT, MAX_LIMIT)
  const offset = options?.offset ?? 0
  const statusFilter = options?.status ?? 'all'

  const where: Prisma.ExpenseParticipantWhereInput = { userId }
  if (statusFilter === 'pending') {
    where.status = PaymentStatus.PENDING
  } else if (statusFilter === 'paid') {
    where.status = PaymentStatus.PAID
  } else if (statusFilter === 'declined') {
    where.status = PaymentStatus.DECLINED
  }

  // Use transaction for atomicity of count + fetch
  const [total, participations] = await prisma.$transaction([
    prisma.expenseParticipant.count({ where }),
    prisma.expenseParticipant.findMany({
      where,
      include: {
        sharedExpense: {
          include: {
            transaction: {
              include: {
                category: true,
              },
            },
            owner: {
              select: {
                id: true,
                email: true,
                displayName: true,
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: offset,
      take: limit,
    }),
  ])

  const items = participations.map(transformExpenseParticipation)
  const hasMore = offset + items.length < total

  return { items, total, hasMore }
}

/**
 * Calculate share amounts for expense sharing based on split type.
 * Pure utility function - no database interaction.
 */
export function calculateShares(
  splitType: SplitType,
  totalAmount: number,
  participants: Array<{ email: string; shareAmount?: number; sharePercentage?: number }>,
  validEmails: string[],
): Map<string, { amount: number; percentage: number | null }> {
  const shares = new Map<string, { amount: number; percentage: number | null }>()
  const numParticipants = validEmails.length

  switch (splitType) {
    case SplitType.EQUAL: {
      const equalShare = Math.round((totalAmount / (numParticipants + 1)) * 100) / 100
      for (const email of validEmails) {
        shares.set(email.toLowerCase(), { amount: equalShare, percentage: null })
      }
      break
    }

    case SplitType.PERCENTAGE: {
      for (const p of participants) {
        const email = p.email.toLowerCase()
        if (!validEmails.some((e) => e.toLowerCase() === email)) continue

        const percentage = p.sharePercentage ?? 0
        const amount = Math.round(totalAmount * (percentage / 100) * 100) / 100
        shares.set(email, { amount, percentage })
      }
      break
    }

    case SplitType.FIXED: {
      for (const p of participants) {
        const email = p.email.toLowerCase()
        if (!validEmails.some((e) => e.toLowerCase() === email)) continue

        const amount = p.shareAmount ?? 0
        shares.set(email, { amount, percentage: null })
      }
      break
    }
  }

  return shares
}

/**
 * Calculate settlement balances between the user and everyone they share expenses with.
 * Balances are grouped by user AND currency to avoid mixing different currencies.
 */
export async function getSettlementBalance(userId: string): Promise<SettlementBalance[]> {
  // Get what others owe the user (expenses user shared)
  const sharedByUser = await prisma.expenseParticipant.findMany({
    where: {
      sharedExpense: { ownerId: userId },
      status: PaymentStatus.PENDING,
    },
    include: {
      participant: {
        select: {
          id: true,
          email: true,
          displayName: true,
        },
      },
      sharedExpense: {
        select: {
          currency: true,
        },
      },
    },
  })

  // Get what user owes others (expenses shared with user)
  const sharedWithUser = await prisma.expenseParticipant.findMany({
    where: {
      userId,
      status: PaymentStatus.PENDING,
    },
    include: {
      sharedExpense: {
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              displayName: true,
            },
          },
        },
      },
    },
  })

  // Aggregate balances by user AND currency
  const balanceMap = new Map<string, SettlementBalance>()

  // Create composite key for user + currency
  const getKey = (otherUserId: string, currency: Currency) => `${otherUserId}:${currency}`

  // Others owe user
  for (const p of sharedByUser) {
    const currency = p.sharedExpense.currency
    const key = getKey(p.participant.id, currency)
    const existing = balanceMap.get(key) || {
      userId: p.participant.id,
      userEmail: p.participant.email,
      userDisplayName: p.participant.displayName,
      currency,
      youOwe: 0,
      theyOwe: 0,
      netBalance: 0,
    }
    existing.theyOwe += decimalToNumber(p.shareAmount)
    existing.netBalance = existing.theyOwe - existing.youOwe
    balanceMap.set(key, existing)
  }

  // User owes others
  for (const p of sharedWithUser) {
    const owner = p.sharedExpense.owner
    const currency = p.sharedExpense.currency
    const key = getKey(owner.id, currency)
    const existing = balanceMap.get(key) || {
      userId: owner.id,
      userEmail: owner.email,
      userDisplayName: owner.displayName,
      currency,
      youOwe: 0,
      theyOwe: 0,
      netBalance: 0,
    }
    existing.youOwe += decimalToNumber(p.shareAmount)
    existing.netBalance = existing.theyOwe - existing.youOwe
    balanceMap.set(key, existing)
  }

  return Array.from(balanceMap.values()).sort((a, b) => Math.abs(b.netBalance) - Math.abs(a.netBalance))
}

export async function getPaymentHistory(userId: string, limit = 10): Promise<PaymentHistoryItem[]> {
  const paymentsReceived = await prisma.expenseParticipant.findMany({
    where: {
      sharedExpense: { ownerId: userId },
      status: PaymentStatus.PAID,
      paidAt: { not: null },
    },
    include: {
      participant: {
        select: {
          id: true,
          email: true,
          displayName: true,
        },
      },
      sharedExpense: {
        select: {
          currency: true,
        },
      },
    },
    orderBy: { paidAt: 'desc' },
    take: limit,
  })

  const paymentsMade = await prisma.expenseParticipant.findMany({
    where: {
      userId,
      status: PaymentStatus.PAID,
      paidAt: { not: null },
    },
    include: {
      sharedExpense: {
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              displayName: true,
            },
          },
        },
      },
    },
    orderBy: { paidAt: 'desc' },
    take: limit,
  })

  const historyItems: PaymentHistoryItem[] = [
    ...paymentsReceived.map((p) => ({
      participantId: p.id,
      userDisplayName: p.participant.displayName,
      userEmail: p.participant.email,
      amount: decimalToNumber(p.shareAmount),
      currency: p.sharedExpense.currency,
      paidAt: p.paidAt!,
      direction: 'received' as const,
    })),
    ...paymentsMade.map((p) => ({
      participantId: p.id,
      userDisplayName: p.sharedExpense.owner.displayName,
      userEmail: p.sharedExpense.owner.email,
      amount: decimalToNumber(p.shareAmount),
      currency: p.sharedExpense.currency,
      paidAt: p.paidAt!,
      direction: 'paid' as const,
    })),
  ]

  return historyItems.sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime()).slice(0, limit)
}
