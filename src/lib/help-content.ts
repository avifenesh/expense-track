/**
 * Static FAQ and Help Article content for the Help Center.
 * Content is organized by category for easy navigation.
 */

export type FAQCategory =
  | 'getting-started'
  | 'transactions'
  | 'budgets'
  | 'categories'
  | 'recurring'
  | 'holdings'
  | 'sharing'
  | 'currency'
  | 'subscription'
  | 'privacy'
  | 'mobile'
  | 'account-management'

export interface FAQItem {
  id: string
  question: string
  answer: string
  category: FAQCategory
}

export interface HelpArticle {
  slug: string
  title: string
  summary: string
  content: string
  category: FAQCategory
  relatedFaqs?: string[]
}

export const FAQ_CATEGORY_LABELS: Record<FAQCategory, string> = {
  'getting-started': 'Getting Started',
  transactions: 'Transactions',
  budgets: 'Budgets',
  categories: 'Categories',
  recurring: 'Recurring Transactions',
  holdings: 'Investments',
  sharing: 'Expense Sharing',
  currency: 'Multi-Currency',
  subscription: 'Subscription & Billing',
  privacy: 'Privacy & Security',
  mobile: 'Mobile App',
  'account-management': 'Account Management',
}

export const FAQ_CATEGORY_ORDER: FAQCategory[] = [
  'getting-started',
  'transactions',
  'budgets',
  'categories',
  'recurring',
  'holdings',
  'sharing',
  'currency',
  'subscription',
  'privacy',
  'mobile',
  'account-management',
]

export const FAQ_ITEMS: FAQItem[] = [
  // Getting Started (5 items)
  {
    id: 'gs-1',
    question: 'How do I create my first account?',
    answer:
      'After signing up, you will be prompted to create your first financial account. Go to the dashboard, and your default account will be created automatically. You can rename it or create additional accounts from the settings.',
    category: 'getting-started',
  },
  {
    id: 'gs-2',
    question: 'What is the difference between accounts and categories?',
    answer:
      'Accounts represent your real-world financial accounts (bank accounts, credit cards, cash). Categories classify your transactions by type (groceries, rent, salary). Each transaction belongs to one account and one category.',
    category: 'getting-started',
  },
  {
    id: 'gs-3',
    question: 'How do I navigate between different months?',
    answer:
      'Use the month selector at the top of your dashboard. Click the left arrow to go to previous months or the right arrow for future months. Your data is organized by month for easy tracking.',
    category: 'getting-started',
  },
  {
    id: 'gs-4',
    question: 'Can I import data from other apps?',
    answer:
      'Currently, Balance Beacon does not support direct import from other applications. However, you can manually add transactions or use the recurring transaction feature to quickly set up regular expenses and income.',
    category: 'getting-started',
  },
  {
    id: 'gs-5',
    question: 'What does the Overview tab show?',
    answer:
      'The Overview tab displays a summary of your financial health including income vs expenses, budget progress, and a historical chart of your cash flow. It gives you a quick snapshot of your finances in 30 seconds.',
    category: 'getting-started',
  },

  // Transactions (5 items)
  {
    id: 'tx-1',
    question: 'How do I add a new transaction?',
    answer:
      'Go to the Transactions tab, fill in the form with the type (expense or income), select an account and category, enter the amount, date, and optional description. Click "Save transaction" to record it.',
    category: 'transactions',
  },
  {
    id: 'tx-2',
    question: 'Can I edit or delete transactions?',
    answer:
      'Yes! In the transaction list, click "Edit" to modify any transaction details or "Delete" to remove it. Changes are saved immediately and your totals will update automatically.',
    category: 'transactions',
  },
  {
    id: 'tx-3',
    question: 'How do I search for specific transactions?',
    answer:
      'Use the search field in the Transactions tab to find transactions by description or category name. You can also filter by type (income/expense) and by account.',
    category: 'transactions',
  },
  {
    id: 'tx-4',
    question: 'What is the CSV export feature?',
    answer:
      'The "Export CSV" button downloads all transactions for the current month and filters as a spreadsheet file. This is useful for record-keeping, tax preparation, or importing into other tools.',
    category: 'transactions',
  },
  {
    id: 'tx-5',
    question: 'Why does my transaction show a different amount?',
    answer:
      'If you use multiple currencies, transactions are converted to your preferred currency for display. The original amount and currency are preserved. Exchange rates are updated regularly from reliable sources.',
    category: 'transactions',
  },

  // Budgets (4 items)
  {
    id: 'bg-1',
    question: 'How do I create a budget?',
    answer:
      'Go to the Budgets tab, select a category and account, enter your budget amount, and save. Budgets are set per category per month, helping you track spending against your goals.',
    category: 'budgets',
  },
  {
    id: 'bg-2',
    question: 'What happens when I exceed my budget?',
    answer:
      'When you exceed a budget, the progress bar turns red and shows the overage amount. This visual indicator helps you quickly identify categories where spending needs attention.',
    category: 'budgets',
  },
  {
    id: 'bg-3',
    question: 'Can I set budgets for income categories?',
    answer:
      'Yes, you can set income goals just like expense budgets. This helps track if you are meeting your income targets from various sources like salary, freelance work, or investments.',
    category: 'budgets',
  },
  {
    id: 'bg-4',
    question: 'Do budgets carry over to the next month?',
    answer:
      'Budgets do not automatically carry over. Each month starts fresh with zero spending against your budgets. However, you can copy budget settings from previous months when setting up new ones.',
    category: 'budgets',
  },

  // Categories (4 items)
  {
    id: 'cat-1',
    question: 'How do I create a new category?',
    answer:
      'Go to the Labels tab and click "Add Category." Choose whether it is for expenses or income, give it a name, and save. The new category will be available when adding transactions.',
    category: 'categories',
  },
  {
    id: 'cat-2',
    question: 'Can I delete a category?',
    answer:
      'Categories are archived rather than deleted to preserve historical data. Archived categories will not appear in new transaction forms but existing transactions keep their category assignment.',
    category: 'categories',
  },
  {
    id: 'cat-3',
    question: 'What are the default categories?',
    answer:
      'Balance Beacon provides common categories like Groceries, Rent, Utilities, Salary, and others. You can use these as-is, rename them, or create your own custom categories.',
    category: 'categories',
  },
  {
    id: 'cat-4',
    question: 'How do I organize my categories?',
    answer:
      'Categories are automatically organized by type (expense or income). Within each type, they appear in the order you created them. Use clear, descriptive names for easy identification.',
    category: 'categories',
  },

  // Recurring (4 items)
  {
    id: 'rec-1',
    question: 'What are recurring transactions?',
    answer:
      'Recurring transactions are templates for regular expenses or income that repeat on a schedule. Set them up once and transactions are automatically created each month on the specified day.',
    category: 'recurring',
  },
  {
    id: 'rec-2',
    question: 'How do I create a recurring transaction?',
    answer:
      'When adding a transaction, check the "Recurring" checkbox. A template will be created that generates transactions on the same day each month. You can also go to the Auto-repeat tab to manage templates directly.',
    category: 'recurring',
  },
  {
    id: 'rec-3',
    question: 'Can I stop a recurring transaction?',
    answer:
      'Yes, go to the Auto-repeat tab and delete the recurring template. This stops future transactions from being created. Past transactions are not affected.',
    category: 'recurring',
  },
  {
    id: 'rec-4',
    question: 'When are recurring transactions created?',
    answer:
      'Recurring transactions are generated on the day of the month you specified when creating the template. If that day does not exist in a month (e.g., 31st in February), it is created on the last day.',
    category: 'recurring',
  },

  // Holdings (4 items)
  {
    id: 'hld-1',
    question: 'What are holdings?',
    answer:
      'Holdings track your investments like stocks, ETFs, or other assets. You can record the quantity and purchase price, and Balance Beacon helps you monitor your portfolio value over time.',
    category: 'holdings',
  },
  {
    id: 'hld-2',
    question: 'How do I add a holding?',
    answer:
      'Go to the Investments tab, click to add a holding, enter the ticker symbol, quantity, and purchase price. Your holdings list will show the current value and gains/losses.',
    category: 'holdings',
  },
  {
    id: 'hld-3',
    question: 'Are stock prices updated automatically?',
    answer:
      'Stock prices are fetched from financial data providers and updated periodically. The last update time is shown in the interface. Manual refresh may be available depending on your subscription.',
    category: 'holdings',
  },
  {
    id: 'hld-4',
    question: 'Can I track cryptocurrency?',
    answer:
      'Yes, you can track cryptocurrency holdings by entering the symbol and quantity. Price data availability depends on the asset and data provider coverage.',
    category: 'holdings',
  },

  // Sharing (5 items)
  {
    id: 'shr-1',
    question: 'How does expense sharing work?',
    answer:
      'You can share expenses with other Balance Beacon users. When you share an expense, the other person receives a request to accept their share. Once accepted, it appears in their transactions.',
    category: 'sharing',
  },
  {
    id: 'shr-2',
    question: 'How do I share an expense?',
    answer:
      'On any expense transaction, click the share icon. Enter the email of the person you want to share with, specify their share amount, and send the request.',
    category: 'sharing',
  },
  {
    id: 'shr-3',
    question: 'Can I split an expense with multiple people?',
    answer:
      'Yes, you can share an expense with multiple people. Each person receives their own request for their portion of the expense.',
    category: 'sharing',
  },
  {
    id: 'shr-4',
    question: 'What happens when someone declines a shared expense?',
    answer:
      'If someone declines, the shared expense request is removed. The original expense remains in your account unchanged. You can try sharing again or handle the split differently.',
    category: 'sharing',
  },
  {
    id: 'shr-5',
    question: 'How do I see expenses shared with me?',
    answer:
      'Go to the Sharing tab to see all expense sharing activity. Pending requests appear at the top, and you can accept or decline each one. Accepted shares appear in your transactions.',
    category: 'sharing',
  },

  // Currency (4 items)
  {
    id: 'cur-1',
    question: 'What currencies are supported?',
    answer:
      'Balance Beacon supports USD (US Dollar), EUR (Euro), and ILS (Israeli Shekel). You can record transactions in any of these currencies and set your preferred display currency.',
    category: 'currency',
  },
  {
    id: 'cur-2',
    question: 'How are exchange rates determined?',
    answer:
      'Exchange rates are fetched from the Frankfurter API, which provides reliable rates from the European Central Bank. Rates are cached and updated regularly.',
    category: 'currency',
  },
  {
    id: 'cur-3',
    question: 'Can I refresh exchange rates manually?',
    answer:
      'Yes, there is a refresh button in the dashboard header that updates exchange rates to the latest available. This ensures your converted amounts reflect current market rates.',
    category: 'currency',
  },
  {
    id: 'cur-4',
    question: 'How do multi-currency reports work?',
    answer:
      'All amounts are converted to your preferred currency for totals and charts. Each transaction retains its original currency and amount. Hover over amounts to see original values.',
    category: 'currency',
  },

  // Subscription (5 items)
  {
    id: 'sub-1',
    question: 'How much does Balance Beacon cost?',
    answer:
      'Balance Beacon costs $3 per month after a 14-day free trial. No credit card is required to start your trial. The subscription includes all features and future updates.',
    category: 'subscription',
  },
  {
    id: 'sub-2',
    question: 'What is included in the free trial?',
    answer:
      'The 14-day free trial includes almost all features with a limit of 50 transactions. This gives you time to explore the app and decide if it meets your needs.',
    category: 'subscription',
  },
  {
    id: 'sub-3',
    question: 'How do I upgrade to a paid subscription?',
    answer:
      'Click the "Upgrade" button in your dashboard or go to the subscription settings. You will be taken to our secure payment provider to complete the subscription.',
    category: 'subscription',
  },
  {
    id: 'sub-4',
    question: 'Can I cancel my subscription?',
    answer:
      'Yes, you can cancel anytime from your account settings. You will retain access until the end of your current billing period. No partial refunds are given.',
    category: 'subscription',
  },
  {
    id: 'sub-5',
    question: 'Is there a money-back guarantee?',
    answer:
      'Yes, we offer a 30-day money-back guarantee for new subscribers. If you are not satisfied within the first 30 days of your paid subscription, contact support for a full refund.',
    category: 'subscription',
  },

  // Privacy (4 items)
  {
    id: 'prv-1',
    question: 'How is my financial data protected?',
    answer:
      'Your data is encrypted in transit and at rest. We use industry-standard security practices including HTTPS, secure authentication, and regular security audits.',
    category: 'privacy',
  },
  {
    id: 'prv-2',
    question: 'Does Balance Beacon connect to my bank?',
    answer:
      'No, Balance Beacon does not connect to your bank accounts. All data is entered manually, giving you full control over what information is stored.',
    category: 'privacy',
  },
  {
    id: 'prv-3',
    question: 'Can I export all my data?',
    answer:
      'Yes, you can export all your data at any time from the account settings. This includes transactions, budgets, categories, and other information in a portable format.',
    category: 'privacy',
  },
  {
    id: 'prv-4',
    question: 'How do I delete my account?',
    answer:
      'Go to account settings and select "Delete account." This permanently removes all your data from our servers. This action cannot be undone, so export your data first if needed.',
    category: 'privacy',
  },

  // Mobile (4 items)
  {
    id: 'mob-1',
    question: 'Is there a mobile app?',
    answer:
      'Yes, Balance Beacon has mobile apps for both iOS and Android. Download from the App Store or Google Play. The mobile app syncs with your web account.',
    category: 'mobile',
  },
  {
    id: 'mob-2',
    question: 'Can I use Balance Beacon offline?',
    answer:
      'The mobile app requires an internet connection to sync data. You can view cached data offline, but adding or editing transactions requires connectivity.',
    category: 'mobile',
  },
  {
    id: 'mob-3',
    question: 'Is my data synced across devices?',
    answer:
      'Yes, all data is synced in real-time across all your devices. Changes made on mobile appear on web and vice versa within seconds.',
    category: 'mobile',
  },
  {
    id: 'mob-4',
    question: 'How do I log in on mobile?',
    answer:
      'Open the mobile app and sign in with the same email and password you use on the web. Your data will sync automatically after logging in.',
    category: 'mobile',
  },

  // Account Management (4 items)
  {
    id: 'acc-1',
    question: 'How do I change my email address?',
    answer:
      'Currently, email changes require contacting support. We verify your identity and update the email associated with your account securely.',
    category: 'account-management',
  },
  {
    id: 'acc-2',
    question: 'How do I reset my password?',
    answer:
      'On the login page, click "Forgot password" and enter your email. You will receive a link to create a new password. The link expires after 24 hours for security.',
    category: 'account-management',
  },
  {
    id: 'acc-3',
    question: 'Can I have multiple financial accounts?',
    answer:
      'Yes, you can create multiple accounts within Balance Beacon to represent different real-world accounts like checking, savings, credit cards, or cash.',
    category: 'account-management',
  },
  {
    id: 'acc-4',
    question: 'How do I set my preferred currency?',
    answer:
      'Your preferred currency is set based on your first account. All totals and charts display amounts converted to this currency for consistent reporting.',
    category: 'account-management',
  },
]

export const HELP_ARTICLES: HelpArticle[] = [
  // Getting Started (3 articles)
  {
    slug: 'quick-start-guide',
    title: 'Quick Start Guide',
    summary: 'Get up and running with Balance Beacon in under 5 minutes.',
    category: 'getting-started',
    content: `
# Quick Start Guide

Welcome to Balance Beacon! This guide will help you set up your personal finance tracking in just a few minutes.

## Step 1: Your First Account

After signing up, you will have a default account created. This represents your primary financial account. You can rename it to match your actual bank account name.

## Step 2: Add Your First Transaction

1. Go to the **Transactions** tab
2. Select whether it is an expense or income
3. Choose a category (like Groceries or Salary)
4. Enter the amount and date
5. Click **Save transaction**

## Step 3: Set Up a Budget

1. Navigate to the **Budgets** tab
2. Select a category you want to track
3. Enter your monthly budget amount
4. Watch your spending progress throughout the month

## Step 4: Explore the Overview

The Overview tab shows your financial snapshot:
- Income vs expenses for the current month
- Budget progress across all categories
- Historical trends over time

## Tips for Success

- **Be consistent**: Log transactions as they happen
- **Use categories**: They help you understand spending patterns
- **Check weekly**: Review your progress regularly
- **Set realistic budgets**: Start with actual spending, then optimize
    `.trim(),
    relatedFaqs: ['gs-1', 'gs-2', 'gs-5'],
  },
  {
    slug: 'understanding-dashboard',
    title: 'Understanding Your Dashboard',
    summary: 'Learn how to read and use the dashboard effectively.',
    category: 'getting-started',
    content: `
# Understanding Your Dashboard

The Balance Beacon dashboard is designed to give you financial clarity in 30 seconds. Here is what each section tells you.

## The Header Section

At the top, you will find:
- **Month selector**: Navigate between months to view historical data
- **Cash flow snapshot**: A visual chart of your income and expenses over recent months
- **Quick stats**: Net flow, income, and expense totals for the current month

## Navigation Tabs

Switch between different views:
- **Overview**: Summary of your financial health
- **Transactions**: Add and manage individual transactions
- **Budgets**: Set and track spending limits
- **Auto-repeat**: Manage recurring transactions
- **Labels**: Organize with categories
- **Investments**: Track your portfolio
- **Sharing**: Split expenses with others

## Stat Cards

The colored cards show key metrics:
- **Green borders**: Positive indicators (income, savings)
- **Red borders**: Attention needed (overspending)
- **Click to expand**: See detailed breakdowns by category

## The Settings Menu

Access account options from the gear icon:
- Export your data
- Sign out
- Delete your account
    `.trim(),
    relatedFaqs: ['gs-3', 'gs-5'],
  },
  {
    slug: 'setting-up-accounts',
    title: 'Setting Up Multiple Accounts',
    summary: 'How to organize finances across different accounts.',
    category: 'getting-started',
    content: `
# Setting Up Multiple Accounts

Balance Beacon lets you track multiple financial accounts in one place.

## Why Multiple Accounts?

Real-world finances are spread across:
- Checking accounts
- Savings accounts
- Credit cards
- Cash
- Investment accounts

Tracking each separately gives you a clearer picture.

## Creating Additional Accounts

Currently, accounts are created through your initial setup. Contact support if you need to add more accounts.

## Switching Between Accounts

Use the account filter in the Transactions tab to:
- View transactions for a specific account
- Filter reports by account
- Set budgets per account

## Best Practices

- **Name accounts clearly**: "Chase Checking" is better than "Account 1"
- **Match real accounts**: Each Balance Beacon account should represent one real account
- **Track credit cards**: Record credit card spending as expenses when incurred
- **Review regularly**: Check each account monthly for accuracy
    `.trim(),
    relatedFaqs: ['acc-3', 'gs-2'],
  },

  // Transactions (3 articles)
  {
    slug: 'tracking-transactions',
    title: 'Tracking Transactions Effectively',
    summary: 'Best practices for recording and categorizing transactions.',
    category: 'transactions',
    content: `
# Tracking Transactions Effectively

Accurate transaction tracking is the foundation of personal finance management.

## Recording Transactions

For each transaction, you will enter:
- **Type**: Is it an expense (money out) or income (money in)?
- **Account**: Which account was affected?
- **Category**: What kind of expense/income is it?
- **Amount**: How much?
- **Date**: When did it occur?
- **Description**: Optional notes for context

## Categorization Tips

Good categorization helps you understand spending patterns:
- Be specific but not too granular
- "Groceries" works better than "Food" or "Whole Foods Tuesday"
- Use consistent categories over time
- Create custom categories when defaults do not fit

## Descriptions Matter

Write useful descriptions:
- "Monthly rent payment" instead of "Rent"
- "Birthday dinner at Giovanni's" instead of "Restaurant"
- These help when searching later

## Daily vs Weekly Tracking

**Daily tracking** (recommended):
- More accurate
- Takes 2 minutes
- Builds the habit

**Weekly tracking**:
- Requires reviewing bank statements
- Higher risk of forgetting cash transactions
- Better than not tracking at all
    `.trim(),
    relatedFaqs: ['tx-1', 'tx-2', 'tx-3'],
  },
  {
    slug: 'using-transaction-filters',
    title: 'Using Transaction Filters',
    summary: 'Find and organize transactions with powerful filters.',
    category: 'transactions',
    content: `
# Using Transaction Filters

Filters help you find specific transactions and analyze spending patterns.

## Available Filters

### Type Filter
- **All**: View everything
- **Expense**: Only outgoing transactions
- **Income**: Only incoming transactions

### Account Filter
- View transactions from a specific account
- Useful for reconciling with bank statements

### Search
- Find transactions by description
- Search by category name
- Partial matches work (searching "gro" finds "Groceries")

## Combining Filters

Filters work together. For example:
1. Select "Expense" type
2. Choose your checking account
3. Search for "restaurant"

This shows all restaurant expenses from your checking account.

## Export Filtered Results

The CSV export respects your current filters:
- Filter first, then export
- Great for tax-related expenses
- Share specific transactions with accountants
    `.trim(),
    relatedFaqs: ['tx-3', 'tx-4'],
  },
  {
    slug: 'handling-refunds',
    title: 'Handling Refunds and Corrections',
    summary: 'How to record refunds, returns, and correct mistakes.',
    category: 'transactions',
    content: `
# Handling Refunds and Corrections

Real financial life includes refunds, returns, and mistakes. Here is how to handle them.

## Recording Refunds

A refund is money coming back to you:
1. Create a new transaction
2. Set type to **Income**
3. Use the same category as the original expense
4. Enter the refund amount
5. Note the original transaction in the description

Example: "Refund for returned shoes"

## Partial Refunds

For partial refunds, record only the amount refunded as income. The original expense stays as-is.

## Correcting Mistakes

### Wrong Amount
- Edit the transaction and update the amount
- No need to delete and recreate

### Wrong Category
- Edit and select the correct category
- Budget tracking updates automatically

### Duplicate Entry
- Delete the duplicate transaction
- Only keep one record per real transaction

## Reimbursements

When someone pays you back:
1. Record as income
2. Use a category like "Reimbursement" or the original expense category
3. Note who reimbursed you

For shared expenses, use the Sharing feature instead.
    `.trim(),
    relatedFaqs: ['tx-2', 'tx-5'],
  },

  // Budgets (2 articles)
  {
    slug: 'creating-effective-budgets',
    title: 'Creating Effective Budgets',
    summary: 'Set realistic budgets that help you reach financial goals.',
    category: 'budgets',
    content: `
# Creating Effective Budgets

Budgets transform tracking into actionable financial management.

## Starting Your Budget

### Use Real Numbers
Before setting budgets, track spending for one month without limits. This shows your actual patterns.

### Categorize by Priority
- **Essential**: Rent, utilities, groceries
- **Important**: Transportation, healthcare
- **Flexible**: Dining out, entertainment

## Setting Budget Amounts

### The 50/30/20 Rule
A common framework:
- 50% for needs (essentials)
- 30% for wants (flexible)
- 20% for savings

Adjust based on your situation.

### Start Realistic
- Set budgets slightly below current spending
- Tight budgets lead to frustration
- Gradually reduce over months

## Monitoring Progress

The Budgets tab shows:
- Progress bar for each category
- Amount spent vs budget
- Warning colors when approaching limit
- Red alert when exceeded

## Adjusting Over Time

Review budgets monthly:
- Consistently under budget? Lower it or redirect savings
- Always over budget? Increase it or find ways to reduce spending
- Seasonal changes? Adjust temporarily
    `.trim(),
    relatedFaqs: ['bg-1', 'bg-2', 'bg-4'],
  },
  {
    slug: 'budget-tracking-tips',
    title: 'Budget Tracking Tips',
    summary: 'Advanced strategies for staying on budget.',
    category: 'budgets',
    content: `
# Budget Tracking Tips

These strategies help you maintain healthy spending habits.

## Weekly Check-ins

Set a weekly reminder to:
- Review the past week's transactions
- Check budget progress
- Plan for upcoming expenses

## The Envelope Method

Mentally divide your budget:
- Week 1: 25% of monthly budget
- Week 2: 50% total
- Week 3: 75% total
- Week 4: Use the remainder

If you have used 60% by week 2, slow down.

## Handle Irregular Expenses

Some expenses are not monthly:
- Annual subscriptions
- Quarterly insurance
- Holiday spending

Set aside monthly amounts for these or budget in the month they occur.

## When You Go Over Budget

Do not panic. Instead:
1. Identify why (unexpected expense? Poor planning?)
2. See if other categories have room
3. Adjust next month's plan
4. Learn and improve

## Celebrate Wins

When you stay under budget:
- Acknowledge the achievement
- Consider directing savings to goals
- Maintain the behavior that worked
    `.trim(),
    relatedFaqs: ['bg-2', 'bg-3', 'bg-4'],
  },

  // Categories (2 articles)
  {
    slug: 'organizing-categories',
    title: 'Organizing Your Categories',
    summary: 'Create a category system that works for you.',
    category: 'categories',
    content: `
# Organizing Your Categories

A well-organized category system makes tracking easier and insights clearer.

## Default Categories

Balance Beacon provides common categories:
- **Expenses**: Groceries, Rent, Utilities, Transportation, Dining, Entertainment
- **Income**: Salary, Freelance, Investments, Other Income

Start with these and customize as needed.

## Creating Custom Categories

Add categories that match your life:
- Specific hobbies (Photography, Gaming)
- Family expenses (Kids Activities, Pet Care)
- Work expenses (Home Office, Professional Development)

## Category Best Practices

### Keep It Simple
- 10-15 categories is usually enough
- Too many creates decision fatigue
- Too few loses useful detail

### Be Consistent
- Pick a naming convention and stick with it
- "Dining Out" vs "Restaurants" - choose one
- Future you will thank you

### Think About Reports
Categories should answer questions:
- "How much do I spend on food?" (Groceries + Dining)
- "What are my fixed costs?" (Rent + Utilities + Insurance)

## Archiving Categories

When a category is no longer needed:
- Archive it instead of deleting
- Historical data is preserved
- It will not appear in new transaction forms
    `.trim(),
    relatedFaqs: ['cat-1', 'cat-2', 'cat-3', 'cat-4'],
  },
  {
    slug: 'expense-vs-income-categories',
    title: 'Expense vs Income Categories',
    summary: 'Understand the difference and when to use each.',
    category: 'categories',
    content: `
# Expense vs Income Categories

Categories are separated by type for clearer financial tracking.

## Expense Categories

Track money going out:
- Regular bills (Rent, Utilities, Insurance)
- Variable spending (Groceries, Dining, Shopping)
- Periodic costs (Medical, Car Maintenance)

## Income Categories

Track money coming in:
- Employment (Salary, Bonuses)
- Side income (Freelance, Gig Work)
- Passive income (Investments, Rental)
- Other (Refunds, Gifts)

## Why Separate Them?

### Cleaner Reports
Income and expenses have different patterns. Separating them provides clearer analysis.

### Better Budgeting
- Set expense budgets to limit spending
- Set income goals to track earnings

### Accurate Net Calculations
Balance Beacon calculates:
- Total Income
- Total Expenses
- Net (Income - Expenses)

Mixed categories would confuse this.

## Edge Cases

### Reimbursements
If you are paid back for an expense:
- Record as income with a "Reimbursement" category
- Or use the Sharing feature for split expenses

### Transfers
Moving money between your own accounts:
- Not an expense or income
- Currently, do not record transfers to avoid double-counting
    `.trim(),
    relatedFaqs: ['cat-1', 'cat-3', 'bg-3'],
  },

  // Recurring (2 articles)
  {
    slug: 'setting-up-recurring',
    title: 'Setting Up Recurring Transactions',
    summary: 'Automate regular expenses and income tracking.',
    category: 'recurring',
    content: `
# Setting Up Recurring Transactions

Recurring transactions save time and ensure consistent tracking.

## What to Make Recurring

Common recurring transactions:
- Rent or mortgage
- Utility bills
- Subscription services
- Salary deposits
- Loan payments

## Creating a Recurring Transaction

### Method 1: From a Transaction
1. Add a new transaction
2. Check the **Recurring** checkbox
3. Save the transaction

A template is created automatically using the transaction date.

### Method 2: From Auto-repeat Tab
1. Go to the Auto-repeat tab
2. Create a new template
3. Set all the details

## How It Works

- Templates generate transactions on the specified day each month
- If day 31 does not exist, it uses the last day of the month
- Generated transactions appear with a "Recurring" badge

## Managing Templates

In the Auto-repeat tab:
- View all recurring templates
- Edit amounts or categories
- Delete templates to stop future transactions
- Past transactions remain unaffected
    `.trim(),
    relatedFaqs: ['rec-1', 'rec-2', 'rec-3', 'rec-4'],
  },
  {
    slug: 'managing-recurring',
    title: 'Managing Recurring Templates',
    summary: 'Edit, pause, or remove recurring transaction templates.',
    category: 'recurring',
    content: `
# Managing Recurring Templates

Keep your recurring transactions up to date.

## Viewing Templates

The Auto-repeat tab shows all templates with:
- Description and category
- Amount and account
- Day of month for generation
- Next occurrence date

## Editing Templates

Changes you can make:
- Update the amount (rent increased?)
- Change the category
- Modify the description
- Adjust the day of month

Changes apply to future transactions only. Past transactions are unchanged.

## Deleting Templates

When a recurring expense ends:
1. Go to Auto-repeat tab
2. Find the template
3. Click Delete

Future transactions will not be created. Historical transactions remain for your records.

## Template vs Transaction

Remember the difference:
- **Template**: The rule that creates transactions
- **Transaction**: The actual record for a specific month

Edit the template to change future behavior.
Edit individual transactions to fix specific months.

## Handling Changes

### Price Increase
Edit the template amount. The new amount applies going forward.

### One-time Skip
Delete the generated transaction for that month. The template continues normally.

### Ended Service
Delete the template. Old transactions stay in your history.
    `.trim(),
    relatedFaqs: ['rec-2', 'rec-3', 'rec-4'],
  },

  // Holdings (2 articles)
  {
    slug: 'tracking-investments',
    title: 'Tracking Your Investments',
    summary: 'Monitor your portfolio with the holdings feature.',
    category: 'holdings',
    content: `
# Tracking Your Investments

The Investments tab helps you monitor your portfolio alongside regular finances.

## What You Can Track

- Stocks
- ETFs
- Mutual funds
- Cryptocurrency
- Other assets with ticker symbols

## Adding Holdings

1. Go to the **Investments** tab
2. Click to add a holding
3. Enter:
   - Ticker symbol (e.g., AAPL, VTI)
   - Number of shares/units
   - Purchase price per share
4. Save the holding

## Understanding the Display

For each holding, you will see:
- Current price (when available)
- Total value (shares x current price)
- Gain/loss amount and percentage
- Your original investment

## Limitations

Balance Beacon is not a full brokerage:
- Prices update periodically, not real-time
- Some assets may not have price data
- Dividends are not automatically tracked
- For detailed investment tracking, use your brokerage's tools

## Why Track Here?

Having investments in Balance Beacon lets you:
- See total net worth in one place
- Understand your complete financial picture
- Balance liquid assets against investments
    `.trim(),
    relatedFaqs: ['hld-1', 'hld-2', 'hld-3'],
  },
  {
    slug: 'portfolio-overview',
    title: 'Understanding Your Portfolio',
    summary: 'Make sense of your investment data.',
    category: 'holdings',
    content: `
# Understanding Your Portfolio

Learn to read and use your portfolio information effectively.

## Portfolio Summary

The Investments tab shows:
- Total portfolio value
- Overall gain/loss
- Individual holding performance

## Reading Individual Holdings

Each holding displays:
- **Symbol**: The ticker (AAPL, TSLA, etc.)
- **Quantity**: How many shares you own
- **Current Price**: Latest available price
- **Market Value**: Quantity x Current Price
- **Cost Basis**: What you paid originally
- **Gain/Loss**: Difference between value and cost

## Performance Colors

- **Green**: Holding is profitable (current value > cost)
- **Red**: Holding is at a loss (current value < cost)

## Price Updates

Stock prices come from financial data providers:
- Updates occur periodically
- Last update time is shown
- May not reflect real-time trading prices

## Using This Information

Portfolio tracking helps you:
- See if investments are growing
- Understand asset allocation
- Make informed decisions about rebalancing
- Include investments in your net worth calculations

Note: Balance Beacon does not provide investment advice. Consult a financial advisor for investment decisions.
    `.trim(),
    relatedFaqs: ['hld-2', 'hld-3', 'hld-4'],
  },

  // Sharing (2 articles)
  {
    slug: 'sharing-expenses',
    title: 'Sharing Expenses with Others',
    summary: 'Split costs with roommates, partners, or friends.',
    category: 'sharing',
    content: `
# Sharing Expenses with Others

The expense sharing feature simplifies splitting costs.

## When to Use Sharing

Common scenarios:
- Roommates splitting utilities
- Partners sharing grocery costs
- Friends splitting a dinner bill
- Group trip expenses

## How to Share an Expense

1. Record the full expense in your transactions
2. Click the share icon on the transaction
3. Enter the other person's Balance Beacon email
4. Specify their share amount
5. Send the request

## What Happens Next

The other person:
1. Receives a notification
2. Reviews the expense details
3. Accepts or declines
4. If accepted, it appears in their transactions

## Share Amounts

You decide how to split:
- **Equal split**: Divide by number of people
- **Custom amounts**: Different shares for different people
- **Percentage**: Calculate based on income or usage

Enter the amount the other person owes.

## Settlement

The Sharing tab tracks:
- Who owes you money
- Who you owe
- Running balances
- Payment history

Settle up outside the app, then record settlements to clear balances.
    `.trim(),
    relatedFaqs: ['shr-1', 'shr-2', 'shr-3'],
  },
  {
    slug: 'managing-shared-expenses',
    title: 'Managing Shared Expenses',
    summary: 'Track, settle, and organize shared costs.',
    category: 'sharing',
    content: `
# Managing Shared Expenses

Keep track of shared expenses and balances.

## The Sharing Tab

Your sharing overview shows:
- **Shared by me**: Expenses you have shared with others
- **Shared with me**: Expense requests from others
- **Balances**: Net amounts owed between you and others
- **History**: Record of settlements

## Handling Requests

When someone shares an expense with you:
1. Review the details (amount, description, date)
2. Accept to add it to your transactions
3. Or decline if it is incorrect

## Tracking Balances

Balances show net amounts:
- Positive: They owe you
- Negative: You owe them

Balances update automatically as expenses are shared and settled.

## Recording Settlements

When money changes hands:
1. Go to Sharing tab
2. Record a settlement
3. Enter amount and with whom
4. Balances adjust accordingly

## Best Practices

- Share expenses promptly while details are fresh
- Include clear descriptions
- Settle regularly to avoid large balances
- Communicate about disputed expenses outside the app
    `.trim(),
    relatedFaqs: ['shr-4', 'shr-5'],
  },

  // Currency (2 articles)
  {
    slug: 'multi-currency-tracking',
    title: 'Multi-Currency Tracking',
    summary: 'Handle finances in different currencies.',
    category: 'currency',
    content: `
# Multi-Currency Tracking

Balance Beacon supports multiple currencies for international users.

## Supported Currencies

Currently available:
- **USD** - US Dollar
- **EUR** - Euro
- **ILS** - Israeli Shekel

## Recording Multi-Currency Transactions

When adding a transaction:
1. Enter the amount
2. Select the currency from the dropdown
3. The transaction is stored in that currency

## Preferred Currency

Your preferred currency is used for:
- Totals and summaries
- Budget tracking
- Charts and reports
- Stat cards

All amounts are converted for consistent display.

## How Conversion Works

1. Exchange rates are fetched from Frankfurter API
2. Rates are cached and updated regularly
3. Conversions use the rate from the transaction date
4. Original amounts are preserved

## Viewing Original Amounts

Transaction records keep both:
- Original amount and currency
- Converted amount for display

This ensures accuracy while providing consistency in reports.
    `.trim(),
    relatedFaqs: ['cur-1', 'cur-2', 'cur-4'],
  },
  {
    slug: 'exchange-rates',
    title: 'Understanding Exchange Rates',
    summary: 'How currency conversion works in Balance Beacon.',
    category: 'currency',
    content: `
# Understanding Exchange Rates

Exchange rates are essential for multi-currency tracking.

## Rate Source

Balance Beacon uses the Frankfurter API:
- Based on European Central Bank rates
- Reliable and widely used
- Updated daily on business days

## Rate Caching

To ensure performance:
- Rates are cached in the database
- Updates happen periodically
- Manual refresh is available

## Refreshing Rates

To get the latest rates:
1. Look for the rates timestamp in the header
2. Click the refresh button
3. Wait for confirmation

This updates all rate data to current values.

## Rate Application

When converting:
- Each transaction uses rates from around its date
- Historical transactions maintain accuracy
- Totals use current rates for consistency

## Currency Fluctuations

Exchange rates change constantly. This means:
- Converted totals may vary slightly over time
- Historical reports reflect rates at the time
- Large currency swings can affect perceived spending

For the most accurate picture, track in your primary currency when possible.
    `.trim(),
    relatedFaqs: ['cur-2', 'cur-3', 'cur-4'],
  },

  // Subscription (2 articles)
  {
    slug: 'subscription-plans',
    title: 'Subscription Plans Explained',
    summary: 'Understand what you get with Balance Beacon.',
    category: 'subscription',
    content: `
# Subscription Plans Explained

Balance Beacon offers simple, transparent pricing.

## Free Trial

Every new user gets:
- 14 days to explore all features
- Up to 50 transactions
- No credit card required
- Full functionality (within limits)

## Premium Subscription

After trial, subscribe for:
- **$3 per month**
- Unlimited transactions
- All features included
- Priority support
- Future updates

## What is Included

Both trial and premium include:
- Transaction tracking
- Budget management
- Multi-currency support
- Recurring transactions
- Investment tracking
- Expense sharing
- Data export
- Mobile app access

## Premium Only

- Unlimited transactions (trial has 50 limit)
- Priority support response
- Early access to new features

## No Hidden Fees

The price is straightforward:
- No setup fees
- No annual contracts
- No feature tiers
- No surprise charges
    `.trim(),
    relatedFaqs: ['sub-1', 'sub-2', 'sub-3'],
  },
  {
    slug: 'billing-cancellation',
    title: 'Billing and Cancellation',
    summary: 'Manage your subscription and billing.',
    category: 'subscription',
    content: `
# Billing and Cancellation

Manage your Balance Beacon subscription easily.

## Billing Cycle

- Subscriptions bill monthly
- Charged on the same day you subscribed
- Automatic renewal unless cancelled

## Payment Methods

Payments are processed securely through Paddle:
- Credit and debit cards
- Some regional payment methods
- Invoices available in your Paddle account

## Cancelling Your Subscription

To cancel:
1. Go to your account settings
2. Select subscription management
3. Choose to cancel
4. Access continues until period ends

## After Cancellation

When your subscription ends:
- You keep read-only access to your data
- Export functionality remains available
- You cannot add new transactions
- Resubscribe anytime to restore full access

## Money-Back Guarantee

Not satisfied within 30 days:
- Contact support
- Request a full refund
- No questions asked

## Price Changes

If pricing changes:
- 30 days advance notice via email
- Current rate locked until renewal
- Option to cancel before new rate applies
    `.trim(),
    relatedFaqs: ['sub-3', 'sub-4', 'sub-5'],
  },

  // Privacy (2 articles)
  {
    slug: 'data-security',
    title: 'Data Security Practices',
    summary: 'How we protect your financial information.',
    category: 'privacy',
    content: `
# Data Security Practices

Your financial data security is our priority.

## Encryption

All data is protected:
- **In transit**: HTTPS/TLS encryption
- **At rest**: Database encryption
- **Passwords**: Securely hashed (never stored in plain text)

## Authentication

Account security features:
- Secure password requirements
- Session management
- Automatic logout on inactivity
- Password reset verification

## Infrastructure

Our systems are:
- Hosted on secure cloud providers
- Regularly updated and patched
- Monitored for unusual activity
- Backed up regularly

## What We Do NOT Do

- Connect to your bank accounts
- Store credit card numbers (payments via Paddle)
- Share data with advertisers
- Sell your information

## Your Responsibilities

Help keep your account secure:
- Use a strong, unique password
- Do not share your login
- Log out on shared devices
- Report suspicious activity
    `.trim(),
    relatedFaqs: ['prv-1', 'prv-2'],
  },
  {
    slug: 'data-export-deletion',
    title: 'Exporting and Deleting Your Data',
    summary: 'Your data belongs to you. Here is how to manage it.',
    category: 'privacy',
    content: `
# Exporting and Deleting Your Data

You have full control over your data.

## Exporting Data

### CSV Export
From the Transactions tab:
- Filter to desired transactions
- Click "Export CSV"
- Download spreadsheet file

### Full Data Export
From account settings:
- Export all your data
- Includes transactions, budgets, categories
- Portable format for your records

## Why Export?

- Personal backup
- Tax preparation
- Moving to another service
- Record keeping

## Deleting Your Account

When you delete your account:
1. All data is permanently removed
2. This action cannot be undone
3. You lose access immediately
4. We cannot recover your data

### Before Deleting

We recommend:
- Export all your data first
- Cancel any active subscription
- Settle shared expenses

### How to Delete

1. Go to account settings
2. Click "Delete account"
3. Confirm your email
4. Acknowledge the warning
5. Confirm deletion

## Data Retention

After deletion:
- Your data is removed from active databases
- Backups are purged on their regular schedule
- We retain no personally identifiable information
    `.trim(),
    relatedFaqs: ['prv-3', 'prv-4'],
  },

  // Mobile (2 articles)
  {
    slug: 'getting-started-mobile',
    title: 'Getting Started with Mobile',
    summary: 'Set up and use the Balance Beacon mobile app.',
    category: 'mobile',
    content: `
# Getting Started with Mobile

Take Balance Beacon with you wherever you go.

## Downloading the App

Available on:
- **iOS**: App Store
- **Android**: Google Play Store

Search for "Balance Beacon" or follow links from our website.

## Signing In

Use your existing account:
1. Open the app
2. Enter your email
3. Enter your password
4. You are in!

Your data syncs automatically.

## Mobile Features

The mobile app includes:
- Add transactions on the go
- View recent transactions
- Check budget progress
- See financial overview
- Manage categories

## Mobile vs Web

Both platforms sync in real-time. The mobile app is optimized for:
- Quick transaction entry
- Checking balances
- Basic management

The web app is better for:
- Detailed reports
- Complex management
- Data export
- Settings changes

## Notifications

The app may send notifications for:
- Shared expense requests
- Budget alerts
- Important account updates

Manage notification preferences in your device settings.
    `.trim(),
    relatedFaqs: ['mob-1', 'mob-3', 'mob-4'],
  },
  {
    slug: 'mobile-tips',
    title: 'Mobile App Tips',
    summary: 'Get the most out of the mobile experience.',
    category: 'mobile',
    content: `
# Mobile App Tips

Make mobile tracking efficient and effective.

## Quick Entry Habits

The best time to log a transaction is right after it happens:
- Standing at the checkout? Log it
- Left the restaurant? Log it
- Paid a bill? Log it

This takes seconds and prevents forgetting.

## Using Categories

The mobile app shows your categories for quick selection:
- Tap the category field
- Scroll or search
- Select and continue

Create categories on the web, use them on mobile.

## Offline Considerations

The app needs internet to:
- Sync new transactions
- Update balances
- Send shared expenses

Plan to sync when connected.

## Battery and Data

The app is designed to be efficient:
- Minimal background activity
- Small data transfers
- Quick sync operations

Normal usage should not significantly impact battery or data.

## Troubleshooting

If the app is not working:
1. Check your internet connection
2. Try closing and reopening
3. Log out and back in
4. Update to the latest version
5. Contact support if issues persist
    `.trim(),
    relatedFaqs: ['mob-2', 'mob-3', 'mob-4'],
  },

  // Account Management (2 articles)
  {
    slug: 'account-settings',
    title: 'Managing Account Settings',
    summary: 'Update your profile and preferences.',
    category: 'account-management',
    content: `
# Managing Account Settings

Customize Balance Beacon to work for you.

## Accessing Settings

Click the settings icon in the dashboard header to find:
- Export data option
- Sign out
- Delete account

## Profile Information

Your account includes:
- Email address (used for login)
- Password (change via forgot password flow)

## Changing Email

Currently, email changes require support assistance:
1. Contact support
2. Verify your identity
3. We update your email securely

## Changing Password

If you know your current password:
1. Log out
2. Use "Forgot password" on login page
3. Reset to a new password

If you have forgotten your password:
1. Click "Forgot password"
2. Enter your email
3. Check email for reset link
4. Create new password

## Preferences

Some preferences are set automatically:
- Preferred currency (based on accounts)
- Default account (last selected)

These may be configurable in future updates.
    `.trim(),
    relatedFaqs: ['acc-1', 'acc-2', 'acc-4'],
  },
  {
    slug: 'multiple-accounts',
    title: 'Working with Multiple Accounts',
    summary: 'Track different financial accounts effectively.',
    category: 'account-management',
    content: `
# Working with Multiple Accounts

Organize your finances across different accounts.

## Account Types

Common accounts to track:
- **Checking**: Daily transactions
- **Savings**: Less frequent, larger amounts
- **Credit Card**: Track spending before paying
- **Cash**: Physical money transactions
- **Investment**: Track separately or use Holdings

## Switching Accounts

In the dashboard:
- Use account filter in Transactions
- Budgets can be set per account
- Overview shows combined totals

## Account-Specific Budgets

Set different limits per account:
- Credit card dining budget
- Checking account bills budget
- This provides granular control

## Cross-Account Views

Some views combine all accounts:
- Total income and expenses
- Overall budget progress
- Net worth calculations

## Best Practices

- **Clear naming**: "Chase Checking" not "Main"
- **Match reality**: One Balance Beacon account per real account
- **Regular review**: Check each account monthly
- **Consistent use**: Always select the correct account

## Adding Accounts

Currently, new accounts are added through setup. Contact support to add additional accounts to your profile.
    `.trim(),
    relatedFaqs: ['acc-3', 'gs-2'],
  },
]

/**
 * Get FAQs grouped by category
 */
export function getFAQsByCategory(): Record<FAQCategory, FAQItem[]> {
  const grouped = {} as Record<FAQCategory, FAQItem[]>

  for (const category of FAQ_CATEGORY_ORDER) {
    grouped[category] = FAQ_ITEMS.filter((item) => item.category === category)
  }

  return grouped
}

/**
 * Get all articles for a specific category
 */
export function getArticlesByCategory(category: FAQCategory): HelpArticle[] {
  return HELP_ARTICLES.filter((article) => article.category === category)
}

/**
 * Get an article by its slug
 */
export function getArticleBySlug(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((article) => article.slug === slug)
}

/**
 * Get all unique categories that have content
 */
export function getCategoriesWithContent(): FAQCategory[] {
  return FAQ_CATEGORY_ORDER.filter((category) => {
    const hasFAQs = FAQ_ITEMS.some((item) => item.category === category)
    const hasArticles = HELP_ARTICLES.some((article) => article.category === category)
    return hasFAQs || hasArticles
  })
}
