// Finance module - account, category, and transaction request operations
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export async function getAccounts(userId?: string) {
  const where = userId ? { userId } : {}
  return prisma.account.findMany({
    where,
    orderBy: { name: 'asc' },
  })
}

export async function getCategories(userId?: string, includeArchived = false) {
  // Build where clause with clearer logic
  const where: { userId?: string; isArchived?: boolean } = userId ? { userId } : {}
  if (!includeArchived) {
    where.isArchived = false
  }
  return prisma.category.findMany({
    where,
    orderBy: { name: 'asc' },
  })
}

export async function getTransactionRequests({
  accountId,
  status,
}: {
  accountId?: string
  status?: 'PENDING' | 'APPROVED' | 'REJECTED'
} = {}) {
  const where: Prisma.TransactionRequestWhereInput = {}
  if (accountId) {
    where.toId = accountId
  }
  if (status) {
    where.status = status
  }

  return prisma.transactionRequest.findMany({
    where,
    include: {
      from: true,
      category: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  })
}
