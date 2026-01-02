import { PrismaPg } from '@prisma/adapter-pg';
import { AccountType, Currency, PrismaClient, TransactionType } from '@prisma/client';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const adapter = new PrismaPg(new Pool({ connectionString: DATABASE_URL }));
const prisma = new PrismaClient({ adapter });

async function main() {
  const accounts = [
    { name: 'Avi', type: AccountType.SELF, preferredCurrency: Currency.ILS, color: '#0ea5e9', icon: 'User' },
    { name: 'Serena', type: AccountType.PARTNER, preferredCurrency: Currency.EUR, color: '#f472b6', icon: 'Heart' },
    { name: 'Joint', type: AccountType.JOINT, preferredCurrency: Currency.USD, color: '#22c55e', icon: 'Users' },
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
    { name: 'Pegasus (Dog)', type: TransactionType.EXPENSE, color: '#fb7185' },
    { name: 'House - New Furnitures', type: TransactionType.EXPENSE, color: '#c084fc' },
    { name: 'Rent', type: TransactionType.EXPENSE, color: '#ef4444' },
    { name: 'Electricity', type: TransactionType.EXPENSE, color: '#fde047' },
    { name: 'Gas', type: TransactionType.EXPENSE, color: '#fbbf24' },
    { name: 'Water', type: TransactionType.EXPENSE, color: '#38bdf8' },
    { name: 'Arnona taxes', type: TransactionType.EXPENSE, color: '#94a3b8' },
    { name: 'Groceries', type: TransactionType.EXPENSE, color: '#84cc16' },
    { name: 'Travels', type: TransactionType.EXPENSE, color: '#6366f1' },
    { name: 'Eat outside', type: TransactionType.EXPENSE, color: '#f97316' },
    { name: 'Weddings', type: TransactionType.EXPENSE, color: '#f9a8d4' },
    { name: 'Accommodations', type: TransactionType.EXPENSE, color: '#f59e0b' },
    { name: 'Therapy', type: TransactionType.EXPENSE, color: '#a78bfa' },
    { name: 'Couple Therapy', type: TransactionType.EXPENSE, color: '#f472b6' },
    { name: 'Going out', type: TransactionType.EXPENSE, color: '#22d3ee' },
    { name: 'Vacations', type: TransactionType.EXPENSE, color: '#10b981' },
    { name: 'Computing', type: TransactionType.EXPENSE, color: '#60a5fa' },
    { name: 'Other taxes', type: TransactionType.EXPENSE, color: '#facc15' },
    { name: 'Others', type: TransactionType.EXPENSE, color: '#e5e7eb' },
    { name: 'Nails', type: TransactionType.EXPENSE, color: '#f472b6' },
    { name: 'Shopping', type: TransactionType.EXPENSE, color: '#d946ef' },
    { name: 'Army bonus', type: TransactionType.INCOME, color: '#14b8a6' },
    { name: 'Army returns', type: TransactionType.INCOME, color: '#0ea5e9' },
    { name: 'Salary', type: TransactionType.INCOME, color: '#1d4ed8' },
    { name: 'Secondary salary', type: TransactionType.INCOME, color: '#7c3aed' },
    { name: 'Savings', type: TransactionType.EXPENSE, color: '#16a34a', isHolding: true },
    { name: 'Stocks', type: TransactionType.EXPENSE, color: '#0f172a', isHolding: true },
    { name: 'ETF', type: TransactionType.EXPENSE, color: '#0ea5e9', isHolding: true },
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
