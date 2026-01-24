export function generateOpenAPIDocument() {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Balance Beacon API',
      version: '1.0.0',
      description:
        'REST API for the Balance Beacon personal finance application. Supports transaction management, budgeting, holdings tracking, and expense sharing.',
    },
    servers: [
      {
        url: '/api/v1',
        description: 'API v1',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT access token. Obtain via POST /auth/login. Token expires in 15 minutes.',
        },
      },
      schemas: {
        // Common
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', description: 'Error message' },
            fields: {
              type: 'object',
              additionalProperties: { type: 'array', items: { type: 'string' } },
              description: 'Validation errors by field',
            },
          },
          required: ['error'],
        },
        SuccessMessage: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [true] },
            data: {
              type: 'object',
              properties: {
                message: { type: 'string' },
              },
              required: ['message'],
            },
          },
          required: ['success', 'data'],
        },
        IdResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [true] },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
              },
              required: ['id'],
            },
          },
          required: ['success', 'data'],
          description: 'Response with created/updated entity ID',
        },
        DeleteResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [true] },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                deleted: { type: 'boolean' },
              },
            },
          },
          required: ['success', 'data'],
        },

        // Enums
        Currency: {
          type: 'string',
          enum: ['USD', 'EUR', 'ILS'],
          description: 'Supported currencies',
        },
        TransactionType: {
          type: 'string',
          enum: ['INCOME', 'EXPENSE'],
          description: 'Transaction type',
        },
        RequestStatus: {
          type: 'string',
          enum: ['PENDING', 'APPROVED', 'REJECTED'],
          description: 'Expense request status',
        },

        // Auth
        LoginRequest: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email', example: 'user@example.com' },
            password: { type: 'string', minLength: 1 },
          },
          required: ['email', 'password'],
        },
        TokenResponse: {
          type: 'object',
          properties: {
            accessToken: { type: 'string', description: 'JWT access token (15 min expiry)' },
            refreshToken: { type: 'string', description: 'JWT refresh token (30 day expiry)' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                displayName: { type: 'string' },
              },
              required: ['id', 'email', 'displayName'],
            },
          },
          required: ['accessToken', 'refreshToken', 'user'],
        },
        RefreshRequest: {
          type: 'object',
          properties: {
            refreshToken: { type: 'string' },
          },
          required: ['refreshToken'],
        },
        LogoutRequest: {
          type: 'object',
          properties: {
            refreshToken: { type: 'string' },
          },
          required: ['refreshToken'],
        },

        // Transaction
        CreateTransaction: {
          type: 'object',
          properties: {
            accountId: { type: 'string', minLength: 1, example: 'clx1234567890abcdef' },
            categoryId: { type: 'string', minLength: 1, example: 'clx1234567890abcdef' },
            type: { $ref: '#/components/schemas/TransactionType' },
            amount: { type: 'number', minimum: 0.01, example: 99.99 },
            currency: { $ref: '#/components/schemas/Currency' },
            date: { type: 'string', format: 'date-time', example: '2026-01-15T00:00:00.000Z' },
            description: { type: 'string', maxLength: 240, nullable: true },
            isRecurring: { type: 'boolean', default: false },
            recurringTemplateId: { type: 'string', nullable: true },
          },
          required: ['accountId', 'categoryId', 'type', 'amount', 'date'],
        },
        UpdateTransaction: {
          allOf: [
            { $ref: '#/components/schemas/CreateTransaction' },
            {
              type: 'object',
              properties: {
                id: { type: 'string', minLength: 1 },
              },
              required: ['id'],
            },
          ],
        },
        Transaction: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            accountId: { type: 'string' },
            categoryId: { type: 'string' },
            type: { $ref: '#/components/schemas/TransactionType' },
            amount: { type: 'string', description: 'Decimal amount as string' },
            currency: { $ref: '#/components/schemas/Currency' },
            date: { type: 'string', format: 'date-time' },
            month: { type: 'string', format: 'date-time' },
            description: { type: 'string', nullable: true },
            isRecurring: { type: 'boolean' },
            recurringTemplateId: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
          required: [
            'id',
            'accountId',
            'categoryId',
            'type',
            'amount',
            'currency',
            'date',
            'month',
            'isRecurring',
            'createdAt',
            'updatedAt',
          ],
        },

        // Expense Request
        CreateExpenseRequest: {
          type: 'object',
          properties: {
            toId: { type: 'string', minLength: 1, description: 'Target account ID' },
            categoryId: { type: 'string', minLength: 1 },
            amount: { type: 'number', minimum: 0.01, example: 50.0 },
            currency: { $ref: '#/components/schemas/Currency' },
            date: { type: 'string', format: 'date-time' },
            description: { type: 'string', maxLength: 240, nullable: true },
          },
          required: ['toId', 'categoryId', 'amount', 'date'],
        },
        ExpenseRequest: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            fromId: { type: 'string' },
            toId: { type: 'string' },
            categoryId: { type: 'string' },
            amount: { type: 'string' },
            currency: { $ref: '#/components/schemas/Currency' },
            date: { type: 'string', format: 'date-time' },
            description: { type: 'string', nullable: true },
            status: { $ref: '#/components/schemas/RequestStatus' },
            createdAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'fromId', 'toId', 'categoryId', 'amount', 'currency', 'date', 'status', 'createdAt'],
        },

        // Budget
        CreateBudget: {
          type: 'object',
          properties: {
            accountId: { type: 'string', minLength: 1 },
            categoryId: { type: 'string', minLength: 1 },
            monthKey: { type: 'string', pattern: '^\\d{4}-\\d{2}$', example: '2026-01' },
            planned: { type: 'number', minimum: 0, example: 500.0 },
            currency: { $ref: '#/components/schemas/Currency' },
            notes: { type: 'string', maxLength: 240, nullable: true },
          },
          required: ['accountId', 'categoryId', 'monthKey', 'planned'],
        },
        Budget: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            accountId: { type: 'string' },
            categoryId: { type: 'string' },
            month: { type: 'string', format: 'date-time' },
            planned: { type: 'string' },
            currency: { $ref: '#/components/schemas/Currency' },
            notes: { type: 'string', nullable: true },
          },
          required: ['id', 'accountId', 'categoryId', 'month', 'planned', 'currency'],
        },

        // Category
        CreateCategory: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 2, example: 'Groceries' },
            type: { $ref: '#/components/schemas/TransactionType' },
            color: { type: 'string', nullable: true, example: '#4CAF50' },
          },
          required: ['name', 'type'],
        },
        ArchiveCategory: {
          type: 'object',
          properties: {
            isArchived: { type: 'boolean' },
          },
          required: ['isArchived'],
        },
        Category: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            type: { $ref: '#/components/schemas/TransactionType' },
            color: { type: 'string', nullable: true },
            isArchived: { type: 'boolean' },
            accountId: { type: 'string' },
          },
          required: ['id', 'name', 'type', 'isArchived', 'accountId'],
        },

        // Holding
        CreateHolding: {
          type: 'object',
          properties: {
            accountId: { type: 'string', minLength: 1 },
            categoryId: { type: 'string', minLength: 1 },
            symbol: { type: 'string', minLength: 1, maxLength: 5, pattern: '^[A-Z]+$', example: 'AAPL' },
            quantity: { type: 'number', minimum: 0.000001, example: 10.5 },
            averageCost: { type: 'number', minimum: 0, example: 150.0 },
            currency: { $ref: '#/components/schemas/Currency' },
            notes: { type: 'string', maxLength: 240, nullable: true },
          },
          required: ['accountId', 'categoryId', 'symbol', 'quantity', 'averageCost'],
        },
        UpdateHolding: {
          type: 'object',
          properties: {
            quantity: { type: 'number', minimum: 0.000001 },
            averageCost: { type: 'number', minimum: 0 },
            notes: { type: 'string', maxLength: 240, nullable: true },
          },
          required: ['quantity', 'averageCost'],
        },
        RefreshHoldingPrices: {
          type: 'object',
          properties: {
            accountId: { type: 'string', minLength: 1 },
          },
          required: ['accountId'],
        },
        Holding: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            accountId: { type: 'string' },
            categoryId: { type: 'string' },
            symbol: { type: 'string' },
            quantity: { type: 'string' },
            averageCost: { type: 'string' },
            currentPrice: { type: 'string', nullable: true },
            currency: { $ref: '#/components/schemas/Currency' },
            notes: { type: 'string', nullable: true },
            lastPriceUpdate: { type: 'string', format: 'date-time', nullable: true },
          },
          required: ['id', 'accountId', 'categoryId', 'symbol', 'quantity', 'averageCost', 'currency'],
        },

        // Recurring
        CreateRecurring: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Include for update, omit for create' },
            accountId: { type: 'string', minLength: 1 },
            categoryId: { type: 'string', minLength: 1 },
            type: { $ref: '#/components/schemas/TransactionType' },
            amount: { type: 'number', minimum: 0.01, example: 100.0 },
            currency: { $ref: '#/components/schemas/Currency' },
            dayOfMonth: { type: 'integer', minimum: 1, maximum: 31, example: 15 },
            description: { type: 'string', maxLength: 240, nullable: true },
            startMonthKey: { type: 'string', pattern: '^\\d{4}-\\d{2}$', example: '2026-01' },
            endMonthKey: { type: 'string', pattern: '^\\d{4}-\\d{2}$', nullable: true },
            isActive: { type: 'boolean', default: true },
          },
          required: ['accountId', 'categoryId', 'type', 'amount', 'dayOfMonth', 'startMonthKey'],
        },
        ToggleRecurring: {
          type: 'object',
          properties: {
            isActive: { type: 'boolean' },
          },
          required: ['isActive'],
        },
        ApplyRecurring: {
          type: 'object',
          properties: {
            monthKey: { type: 'string', pattern: '^\\d{4}-\\d{2}$', example: '2026-01' },
            accountId: { type: 'string', minLength: 1 },
            templateIds: { type: 'array', items: { type: 'string' }, description: 'Optional - defaults to all active' },
          },
          required: ['monthKey', 'accountId'],
        },
        Recurring: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            accountId: { type: 'string' },
            categoryId: { type: 'string' },
            type: { $ref: '#/components/schemas/TransactionType' },
            amount: { type: 'string' },
            currency: { $ref: '#/components/schemas/Currency' },
            dayOfMonth: { type: 'integer' },
            description: { type: 'string', nullable: true },
            startMonth: { type: 'string', format: 'date-time' },
            endMonth: { type: 'string', format: 'date-time', nullable: true },
            isActive: { type: 'boolean' },
          },
          required: ['id', 'accountId', 'categoryId', 'type', 'amount', 'currency', 'dayOfMonth', 'isActive'],
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Authentication', description: 'JWT-based authentication endpoints' },
      { name: 'Transactions', description: 'Income and expense transaction management' },
      { name: 'Expense Requests', description: 'Request other users to share expenses' },
      { name: 'Budgets', description: 'Monthly budget planning by category' },
      { name: 'Categories', description: 'Transaction category management' },
      { name: 'Holdings', description: 'Investment portfolio tracking' },
      { name: 'Recurring', description: 'Recurring transaction templates' },
    ],
    paths: {
      // ========== Auth ==========
      '/auth/login': {
        post: {
          tags: ['Authentication'],
          summary: 'Login',
          description: 'Authenticate with email and password to receive JWT tokens.',
          security: [],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
          },
          responses: {
            '200': {
              description: 'Login successful',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/TokenResponse' } } },
            },
            '401': {
              description: 'Invalid credentials',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '429': {
              description: 'Rate limit exceeded (5 req/min per email)',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
          },
        },
      },
      '/auth/refresh': {
        post: {
          tags: ['Authentication'],
          summary: 'Refresh tokens',
          description: 'Exchange a valid refresh token for a new access/refresh token pair.',
          security: [],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/RefreshRequest' } } },
          },
          responses: {
            '200': {
              description: 'Tokens refreshed',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/TokenResponse' } } },
            },
            '401': {
              description: 'Invalid or expired refresh token',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
          },
        },
      },
      '/auth/logout': {
        post: {
          tags: ['Authentication'],
          summary: 'Logout',
          description: 'Invalidate the refresh token.',
          security: [],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/LogoutRequest' } } },
          },
          responses: {
            '200': {
              description: 'Logged out',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessMessage' } } },
            },
          },
        },
      },

      // ========== Transactions ==========
      '/transactions': {
        post: {
          tags: ['Transactions'],
          summary: 'Create transaction',
          description: 'Create a new income or expense transaction.',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateTransaction' } } },
          },
          responses: {
            '201': {
              description: 'Transaction created',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/IdResponse' } } },
            },
            '400': {
              description: 'Validation error',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '401': {
              description: 'Unauthorized',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
          },
        },
      },
      '/transactions/{id}': {
        put: {
          tags: ['Transactions'],
          summary: 'Update transaction',
          description: 'Update an existing transaction.',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateTransaction' } } },
          },
          responses: {
            '200': {
              description: 'Transaction updated',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/IdResponse' } } },
            },
            '400': {
              description: 'Validation error',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '401': {
              description: 'Unauthorized',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '404': {
              description: 'Not found',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
          },
        },
        delete: {
          tags: ['Transactions'],
          summary: 'Delete transaction',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': {
              description: 'Deleted',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/DeleteResponse' } } },
            },
            '401': {
              description: 'Unauthorized',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '404': {
              description: 'Not found',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
          },
        },
      },

      // ========== Expense Requests ==========
      '/transactions/requests': {
        post: {
          tags: ['Expense Requests'],
          summary: 'Create expense request',
          description: 'Request another user to pay for part of an expense.',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateExpenseRequest' } } },
          },
          responses: {
            '201': {
              description: 'Created',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/IdResponse' } } },
            },
            '400': {
              description: 'Validation error',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '401': {
              description: 'Unauthorized',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
          },
        },
      },
      '/transactions/requests/{id}/approve': {
        post: {
          tags: ['Expense Requests'],
          summary: 'Approve expense request',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': {
              description: 'Approved',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/IdResponse' } } },
            },
            '401': {
              description: 'Unauthorized',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '404': {
              description: 'Not found',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
          },
        },
      },
      '/transactions/requests/{id}/reject': {
        post: {
          tags: ['Expense Requests'],
          summary: 'Reject expense request',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': {
              description: 'Rejected',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/IdResponse' } } },
            },
            '401': {
              description: 'Unauthorized',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '404': {
              description: 'Not found',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
          },
        },
      },

      // ========== Budgets ==========
      '/budgets': {
        post: {
          tags: ['Budgets'],
          summary: 'Create or update budget',
          description: 'Set a budget for account/category/month. Updates if exists.',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateBudget' } } },
          },
          responses: {
            '200': {
              description: 'Budget set',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/IdResponse' } } },
            },
            '400': {
              description: 'Validation error',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '401': {
              description: 'Unauthorized',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
          },
        },
        delete: {
          tags: ['Budgets'],
          summary: 'Delete budget',
          parameters: [
            { name: 'accountId', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'categoryId', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'monthKey', in: 'query', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Deleted',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/DeleteResponse' } } },
            },
            '401': {
              description: 'Unauthorized',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '404': {
              description: 'Not found',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
          },
        },
      },

      // ========== Categories ==========
      '/categories': {
        post: {
          tags: ['Categories'],
          summary: 'Create category',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateCategory' } } },
          },
          responses: {
            '201': {
              description: 'Created',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/IdResponse' } } },
            },
            '400': {
              description: 'Validation error',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '401': {
              description: 'Unauthorized',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
          },
        },
      },
      '/categories/{id}/archive': {
        patch: {
          tags: ['Categories'],
          summary: 'Archive/unarchive category',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ArchiveCategory' } } },
          },
          responses: {
            '200': {
              description: 'Updated',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/IdResponse' } } },
            },
            '401': {
              description: 'Unauthorized',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '404': {
              description: 'Not found',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
          },
        },
      },

      // ========== Holdings ==========
      '/holdings': {
        post: {
          tags: ['Holdings'],
          summary: 'Create holding',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateHolding' } } },
          },
          responses: {
            '201': {
              description: 'Created',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/IdResponse' } } },
            },
            '400': {
              description: 'Validation error',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '401': {
              description: 'Unauthorized',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
          },
        },
      },
      '/holdings/{id}': {
        put: {
          tags: ['Holdings'],
          summary: 'Update holding',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateHolding' } } },
          },
          responses: {
            '200': {
              description: 'Updated',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/IdResponse' } } },
            },
            '400': {
              description: 'Validation error',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '401': {
              description: 'Unauthorized',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '404': {
              description: 'Not found',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
          },
        },
        delete: {
          tags: ['Holdings'],
          summary: 'Delete holding',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': {
              description: 'Deleted',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/DeleteResponse' } } },
            },
            '401': {
              description: 'Unauthorized',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '404': {
              description: 'Not found',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
          },
        },
      },
      '/holdings/refresh': {
        post: {
          tags: ['Holdings'],
          summary: 'Refresh stock prices',
          description: 'Fetch latest prices for all holdings in an account.',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/RefreshHoldingPrices' } } },
          },
          responses: {
            '200': {
              description: 'Prices refreshed',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          updated: { type: 'integer' },
                          skipped: { type: 'integer' },
                          errors: { type: 'array', items: { type: 'string' } },
                        },
                      },
                    },
                  },
                },
              },
            },
            '401': {
              description: 'Unauthorized',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
          },
        },
      },

      // ========== Recurring ==========
      '/recurring': {
        post: {
          tags: ['Recurring'],
          summary: 'Create or update recurring template',
          description: 'Set up a recurring transaction template. Include id to update.',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateRecurring' } } },
          },
          responses: {
            '200': {
              description: 'Template saved',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/IdResponse' } } },
            },
            '400': {
              description: 'Validation error',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '401': {
              description: 'Unauthorized',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
          },
        },
      },
      '/recurring/{id}/toggle': {
        patch: {
          tags: ['Recurring'],
          summary: 'Toggle recurring template',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ToggleRecurring' } } },
          },
          responses: {
            '200': {
              description: 'Toggled',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/IdResponse' } } },
            },
            '401': {
              description: 'Unauthorized',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '404': {
              description: 'Not found',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
          },
        },
      },
      '/recurring/apply': {
        post: {
          tags: ['Recurring'],
          summary: 'Apply recurring templates',
          description: 'Generate transactions from templates for a month.',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApplyRecurring' } } },
          },
          responses: {
            '200': {
              description: 'Applied',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: { created: { type: 'integer' }, skipped: { type: 'integer' } },
                      },
                    },
                  },
                },
              },
            },
            '400': {
              description: 'Validation error',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '401': {
              description: 'Unauthorized',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
          },
        },
      },
    },
  }
}
