import { AccountType, PrismaClient, TransactionType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const accounts = [
    { name: 'Me', type: AccountType.SELF, color: '#6366f1', icon: 'User' },
    { name: 'Partner', type: AccountType.PARTNER, color: '#ec4899', icon: 'Heart' },
    { name: 'Joint', type: AccountType.JOINT, color: '#22c55e', icon: 'Users' },
  ];

  await Promise.all(
    accounts.map((account) =>
      prisma.account.upsert({
        where: { name: account.name },
        update: account,
        create: account,
      }),
    ),
  );

  const categories = [
    { name: 'Salary', type: TransactionType.INCOME, color: '#1d4ed8' },
    { name: 'Side Hustle', type: TransactionType.INCOME, color: '#7c3aed' },
    { name: 'Bonus', type: TransactionType.INCOME, color: '#10b981' },
    { name: 'Rent', type: TransactionType.EXPENSE, color: '#ef4444' },
    { name: 'Groceries', type: TransactionType.EXPENSE, color: '#f97316' },
    { name: 'Utilities', type: TransactionType.EXPENSE, color: '#06b6d4' },
    { name: 'Dining Out', type: TransactionType.EXPENSE, color: '#facc15' },
    { name: 'Entertainment', type: TransactionType.EXPENSE, color: '#a855f7' },
    { name: 'Transportation', type: TransactionType.EXPENSE, color: '#22d3ee' },
    { name: 'Savings', type: TransactionType.EXPENSE, color: '#16a34a' },
    { name: 'Investments', type: TransactionType.EXPENSE, color: '#14b8a6' },
    { name: 'Travel', type: TransactionType.EXPENSE, color: '#fb7185' },
  ];

  await Promise.all(
    categories.map((category) =>
      prisma.category.upsert({
        where: {
          name_type: {
            name: category.name,
            type: category.type,
          },
        },
        update: category,
        create: category,
      }),
    ),
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
