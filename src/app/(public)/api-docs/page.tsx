'use client'

import dynamic from 'next/dynamic'
import 'swagger-ui-react/swagger-ui.css'

// Dynamic import to avoid SSR issues with swagger-ui-react
const SwaggerUI = dynamic(() => import('swagger-ui-react'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-gray-600">Loading API documentation...</div>
    </div>
  ),
})

export default function ApiDocsPage() {
  return (
    <div className="swagger-wrapper">
      <SwaggerUI url="/api/openapi.json" />
      <style jsx global>{`
        .swagger-wrapper {
          min-height: 100vh;
          background: #fafafa;
        }
        .swagger-ui .topbar {
          display: none;
        }
        .swagger-ui .info {
          margin: 30px 0;
        }
        .swagger-ui .info .title {
          font-size: 2rem;
          font-weight: 700;
        }
        .swagger-ui .scheme-container {
          background: #fff;
          box-shadow: 0 1px 2px rgba(0,0,0,0.1);
          padding: 20px;
        }
        .swagger-ui .opblock-tag {
          font-size: 1.25rem;
          border-bottom: 1px solid #e0e0e0;
        }
        .swagger-ui .opblock {
          margin-bottom: 15px;
          border-radius: 4px;
        }
        .swagger-ui .opblock .opblock-summary {
          border-radius: 4px;
        }
        .swagger-ui .btn.authorize {
          border-color: #4990e2;
          color: #4990e2;
        }
        .swagger-ui .btn.authorize svg {
          fill: #4990e2;
        }
      `}</style>
    </div>
  )
}
