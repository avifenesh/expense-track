/**
 * Search utilities for FAQ and Help content.
 * Provides fuzzy matching and relevance scoring for search results.
 */

import { type FAQItem, type HelpArticle, FAQ_ITEMS, HELP_ARTICLES } from './help-content'

export interface SearchResult {
  type: 'faq' | 'article'
  item: FAQItem | HelpArticle
  score: number
  matchedFields: string[]
}

/**
 * Normalize text for search comparison.
 * Converts to lowercase and removes extra whitespace.
 */
export function normalizeText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ')
}

/**
 * Tokenize search query into individual words.
 * Filters out very short tokens and common stop words.
 */
export function tokenizeQuery(query: string): string[] {
  const stopWords = new Set([
    'a',
    'an',
    'and',
    'are',
    'as',
    'at',
    'be',
    'by',
    'for',
    'from',
    'has',
    'he',
    'in',
    'is',
    'it',
    'its',
    'of',
    'on',
    'that',
    'the',
    'to',
    'was',
    'were',
    'will',
    'with',
  ])

  const normalized = normalizeText(query)
  const tokens = normalized.split(/\s+/)

  return tokens.filter((token) => {
    // Keep tokens that are at least 2 characters
    if (token.length < 2) return false
    // Filter out stop words
    if (stopWords.has(token)) return false
    return true
  })
}

/**
 * Calculate match score for a text field against search tokens.
 * Returns a score between 0 and 1, with higher meaning better match.
 */
export function calculateFieldScore(text: string, tokens: string[]): number {
  if (tokens.length === 0) return 0

  const normalizedText = normalizeText(text)
  let matchedTokens = 0
  let totalWeight = 0

  for (const token of tokens) {
    // Check for exact word match (higher weight)
    const wordBoundaryRegex = new RegExp(`\\b${escapeRegex(token)}\\b`, 'i')
    if (wordBoundaryRegex.test(normalizedText)) {
      matchedTokens += 1.0
    }
    // Check for partial match (lower weight)
    else if (normalizedText.includes(token)) {
      matchedTokens += 0.5
    }
    totalWeight += 1.0
  }

  return matchedTokens / totalWeight
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Calculate relevance score for a FAQ item.
 */
export function scoreFAQItem(item: FAQItem, tokens: string[]): { score: number; matchedFields: string[] } {
  const matchedFields: string[] = []

  // Score different fields with different weights
  const questionScore = calculateFieldScore(item.question, tokens) * 2.0 // Question is most important
  const answerScore = calculateFieldScore(item.answer, tokens) * 1.0
  const categoryScore = calculateFieldScore(item.category.replace(/-/g, ' '), tokens) * 0.5

  if (questionScore > 0) matchedFields.push('question')
  if (answerScore > 0) matchedFields.push('answer')
  if (categoryScore > 0) matchedFields.push('category')

  // Normalize by max possible weight
  const maxWeight = 2.0 + 1.0 + 0.5
  const score = (questionScore + answerScore + categoryScore) / maxWeight

  return { score, matchedFields }
}

/**
 * Calculate relevance score for a help article.
 */
export function scoreArticle(article: HelpArticle, tokens: string[]): { score: number; matchedFields: string[] } {
  const matchedFields: string[] = []

  // Score different fields with different weights
  const titleScore = calculateFieldScore(article.title, tokens) * 2.5 // Title is most important
  const summaryScore = calculateFieldScore(article.summary, tokens) * 1.5
  const contentScore = calculateFieldScore(article.content, tokens) * 1.0
  const categoryScore = calculateFieldScore(article.category.replace(/-/g, ' '), tokens) * 0.5

  if (titleScore > 0) matchedFields.push('title')
  if (summaryScore > 0) matchedFields.push('summary')
  if (contentScore > 0) matchedFields.push('content')
  if (categoryScore > 0) matchedFields.push('category')

  // Normalize by max possible weight
  const maxWeight = 2.5 + 1.5 + 1.0 + 0.5
  const score = (titleScore + summaryScore + contentScore + categoryScore) / maxWeight

  return { score, matchedFields }
}

/**
 * Search FAQs and return matching items with scores.
 */
export function searchFAQs(query: string): SearchResult[] {
  const tokens = tokenizeQuery(query)
  if (tokens.length === 0) return []

  const results: SearchResult[] = []

  for (const item of FAQ_ITEMS) {
    const { score, matchedFields } = scoreFAQItem(item, tokens)
    if (score > 0) {
      results.push({
        type: 'faq',
        item,
        score,
        matchedFields,
      })
    }
  }

  return results.sort((a, b) => b.score - a.score)
}

/**
 * Search help articles and return matching items with scores.
 */
export function searchArticles(query: string): SearchResult[] {
  const tokens = tokenizeQuery(query)
  if (tokens.length === 0) return []

  const results: SearchResult[] = []

  for (const article of HELP_ARTICLES) {
    const { score, matchedFields } = scoreArticle(article, tokens)
    if (score > 0) {
      results.push({
        type: 'article',
        item: article,
        score,
        matchedFields,
      })
    }
  }

  return results.sort((a, b) => b.score - a.score)
}

/**
 * Search both FAQs and articles, returning combined results.
 */
export function searchAll(query: string): SearchResult[] {
  const tokens = tokenizeQuery(query)
  if (tokens.length === 0) return []

  const faqResults = searchFAQs(query)
  const articleResults = searchArticles(query)

  // Combine and sort by score
  const combined = [...faqResults, ...articleResults]
  return combined.sort((a, b) => b.score - a.score)
}

/**
 * Get suggested search queries based on popular topics.
 */
export function getSuggestedSearches(): string[] {
  return [
    'getting started',
    'add transaction',
    'create budget',
    'recurring',
    'share expense',
    'multi currency',
    'export data',
    'mobile app',
    'cancel subscription',
    'delete account',
  ]
}

/**
 * Highlight matching text in a string for display.
 * Returns an array of segments with highlighted flags.
 */
export function highlightMatches(text: string, query: string): Array<{ text: string; highlighted: boolean }> {
  const tokens = tokenizeQuery(query)
  if (tokens.length === 0) {
    return [{ text, highlighted: false }]
  }

  // Build regex pattern from tokens
  const pattern = tokens.map(escapeRegex).join('|')
  const regex = new RegExp(`(${pattern})`, 'gi')

  const segments: Array<{ text: string; highlighted: boolean }> = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    // Add non-matching segment before this match
    if (match.index > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, match.index),
        highlighted: false,
      })
    }

    // Add the matching segment
    segments.push({
      text: match[0],
      highlighted: true,
    })

    lastIndex = match.index + match[0].length
  }

  // Add remaining text after last match
  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      highlighted: false,
    })
  }

  // If no segments, return original text
  if (segments.length === 0) {
    return [{ text, highlighted: false }]
  }

  return segments
}
