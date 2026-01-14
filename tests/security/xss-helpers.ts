/**
 * XSS Test Validation Helpers
 *
 * Utilities for validating that user content is properly escaped
 * and XSS attacks are prevented in rendered output.
 */

/**
 * Assert that HTML does NOT contain executable scripts, event handlers, or JavaScript URIs
 *
 * @param html - The rendered HTML string to validate
 * @param payload - The original XSS payload that was input
 */
export function assertNoExecutableScript(html: string, payload: string) {
  // Should NOT contain unescaped script tags
  const scriptTagPattern = /<script[^>]*>[\s\S]*?<\/script>/i
  if (scriptTagPattern.test(html)) {
    throw new Error(`HTML contains executable script tag. Payload: ${payload}\nHTML snippet: ${html.substring(0, 200)}`)
  }

  // Should NOT contain event handlers (onerror, onload, onclick, etc.)
  const eventHandlerPattern = /\son\w+\s*=\s*["'][^"']*["']/i
  if (eventHandlerPattern.test(html)) {
    throw new Error(`HTML contains inline event handler. Payload: ${payload}\nHTML snippet: ${html.substring(0, 200)}`)
  }

  // Should NOT contain javascript: URIs
  const javascriptUriPattern = /javascript:/i
  if (javascriptUriPattern.test(html)) {
    throw new Error(`HTML contains javascript: URI. Payload: ${payload}\nHTML snippet: ${html.substring(0, 200)}`)
  }

  // Should NOT contain the raw, unescaped payload
  if (html.includes(payload)) {
    // Exception: If the payload is already HTML entities, it's safe
    const isAlreadyEscaped = payload.includes('&lt;') || payload.includes('&gt;') || payload.includes('&amp;')
    if (!isAlreadyEscaped) {
      throw new Error(`HTML contains unescaped payload. Payload: ${payload}\nHTML snippet: ${html.substring(0, 200)}`)
    }
  }
}

/**
 * Assert that user content is rendered as literal text with proper HTML entity encoding
 *
 * @param html - The rendered HTML string to validate
 * @param originalText - The original user input text
 */
export function assertEscapedContent(html: string, originalText: string) {
  // Generate expected escaped version
  const escaped = htmlEscape(originalText)

  // The HTML should contain the escaped version
  if (!html.includes(escaped)) {
    // Be lenient if using different escaping (e.g., ' vs &#39;)
    const alternativeEscaped = originalText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')

    if (!html.includes(alternativeEscaped)) {
      throw new Error(
        `HTML does not contain properly escaped content.\nOriginal: ${originalText}\nExpected escaped: ${escaped}\nHTML snippet: ${html.substring(0, 200)}`,
      )
    }
  }
}

/**
 * Escape HTML special characters
 *
 * Replicates React's JSX text escaping behavior:
 * - & → &amp;
 * - < → &lt;
 * - > → &gt;
 * - " → &quot;
 * - ' → &#x27; (or &#39;)
 */
export function htmlEscape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

/**
 * Check if a string contains any dangerous XSS patterns
 *
 * Useful for validation that certain strings should be rejected entirely
 */
export function containsDangerousPatterns(text: string): boolean {
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i, // Event handlers
    /<iframe/i,
    /<object/i,
    /<embed/i,
  ]

  return dangerousPatterns.some((pattern) => pattern.test(text))
}

/**
 * Validate that Zod schema properly rejects XSS payloads
 *
 * This is useful for testing that validation schemas catch obviously malicious input
 */
export function shouldBeRejectedByValidation(payload: string): boolean {
  // Payloads that should be rejected by common validation rules
  // (e.g., email format validation, alphanumeric validation)

  // Check if it looks like an email but contains XSS
  if (payload.includes('@') && containsDangerousPatterns(payload)) {
    return true
  }

  // Check if it contains HTML tags (should fail string length or format checks)
  if (/<[^>]+>/i.test(payload)) {
    return true
  }

  return false
}

/**
 * Extract text content from HTML (strips tags)
 *
 * Useful for validating that even if HTML is present, the dangerous parts are removed
 */
export function extractTextContent(html: string): string {
  // Very basic HTML tag removal
  return html.replace(/<[^>]*>/g, '')
}

/**
 * Count XSS attack surfaces in HTML
 *
 * Returns the number of potential XSS vectors found (should be 0 for safe HTML)
 */
export function countXSSVectors(html: string): number {
  let count = 0

  // Count script tags
  const scriptMatches = html.match(/<script[^>]*>/gi)
  if (scriptMatches) count += scriptMatches.length

  // Count event handlers
  const eventHandlerMatches = html.match(/\son\w+\s*=/gi)
  if (eventHandlerMatches) count += eventHandlerMatches.length

  // Count javascript: URIs
  const jsUriMatches = html.match(/javascript:/gi)
  if (jsUriMatches) count += jsUriMatches.length

  return count
}
