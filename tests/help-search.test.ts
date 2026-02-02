import { describe, expect, it } from 'vitest'
import {
  normalizeText,
  tokenizeQuery,
  calculateFieldScore,
  scoreFAQItem,
  scoreArticle,
  searchFAQs,
  searchArticles,
  searchAll,
  getSuggestedSearches,
  highlightMatches,
} from '@/lib/help-search'
import { FAQ_ITEMS, HELP_ARTICLES, type FAQItem, type HelpArticle } from '@/lib/help-content'

describe('help-search', () => {
  describe('normalizeText', () => {
    it('should convert text to lowercase', () => {
      expect(normalizeText('Hello World')).toBe('hello world')
    })

    it('should trim whitespace', () => {
      expect(normalizeText('  hello  ')).toBe('hello')
    })

    it('should collapse multiple spaces', () => {
      expect(normalizeText('hello    world')).toBe('hello world')
    })

    it('should handle empty string', () => {
      expect(normalizeText('')).toBe('')
    })

    it('should handle string with only whitespace', () => {
      expect(normalizeText('   ')).toBe('')
    })
  })

  describe('tokenizeQuery', () => {
    it('should split query into tokens', () => {
      expect(tokenizeQuery('hello world')).toEqual(['hello', 'world'])
    })

    it('should filter out short tokens', () => {
      expect(tokenizeQuery('a to do')).toEqual(['do'])
    })

    it('should filter out stop words', () => {
      expect(tokenizeQuery('the quick and brown')).toEqual(['quick', 'brown'])
    })

    it('should normalize tokens', () => {
      expect(tokenizeQuery('HELLO World')).toEqual(['hello', 'world'])
    })

    it('should handle empty query', () => {
      expect(tokenizeQuery('')).toEqual([])
    })

    it('should handle query with only stop words', () => {
      expect(tokenizeQuery('the a an')).toEqual([])
    })
  })

  describe('calculateFieldScore', () => {
    it('should return 1 for exact match', () => {
      const score = calculateFieldScore('hello world', ['hello', 'world'])
      expect(score).toBe(1)
    })

    it('should return 0 for no match', () => {
      const score = calculateFieldScore('hello world', ['foo', 'bar'])
      expect(score).toBe(0)
    })

    it('should return partial score for partial match', () => {
      const score = calculateFieldScore('hello world', ['hello', 'foo'])
      expect(score).toBe(0.5)
    })

    it('should give lower score for substring match', () => {
      const score = calculateFieldScore('helloworld', ['hello'])
      expect(score).toBe(0.5) // Partial match, not word boundary
    })

    it('should give higher score for word boundary match', () => {
      const score = calculateFieldScore('hello world', ['hello'])
      expect(score).toBe(1) // Full match on word boundary
    })

    it('should handle empty tokens', () => {
      const score = calculateFieldScore('hello world', [])
      expect(score).toBe(0)
    })
  })

  describe('scoreFAQItem', () => {
    const testFAQ: FAQItem = {
      id: 'test-1',
      question: 'How do I create a budget?',
      answer: 'Go to the Budgets tab and click create.',
      category: 'budgets',
    }

    it('should score question matches higher', () => {
      const result = scoreFAQItem(testFAQ, ['budget'])
      expect(result.score).toBeGreaterThan(0)
      expect(result.matchedFields).toContain('question')
    })

    it('should include answer matches', () => {
      const result = scoreFAQItem(testFAQ, ['click'])
      expect(result.score).toBeGreaterThan(0)
      expect(result.matchedFields).toContain('answer')
    })

    it('should include category matches', () => {
      const result = scoreFAQItem(testFAQ, ['budgets'])
      expect(result.score).toBeGreaterThan(0)
      expect(result.matchedFields).toContain('category')
    })

    it('should return zero for no matches', () => {
      const result = scoreFAQItem(testFAQ, ['xyz123'])
      expect(result.score).toBe(0)
      expect(result.matchedFields).toHaveLength(0)
    })
  })

  describe('scoreArticle', () => {
    const testArticle: HelpArticle = {
      slug: 'test-article',
      title: 'Creating Effective Budgets',
      summary: 'Learn to set realistic budgets.',
      content: 'This guide shows you how to create budgets that work.',
      category: 'budgets',
    }

    it('should score title matches highest', () => {
      const result = scoreArticle(testArticle, ['effective'])
      expect(result.score).toBeGreaterThan(0)
      expect(result.matchedFields).toContain('title')
    })

    it('should include summary matches', () => {
      const result = scoreArticle(testArticle, ['realistic'])
      expect(result.score).toBeGreaterThan(0)
      expect(result.matchedFields).toContain('summary')
    })

    it('should include content matches', () => {
      const result = scoreArticle(testArticle, ['guide'])
      expect(result.score).toBeGreaterThan(0)
      expect(result.matchedFields).toContain('content')
    })

    it('should return zero for no matches', () => {
      const result = scoreArticle(testArticle, ['xyz123'])
      expect(result.score).toBe(0)
      expect(result.matchedFields).toHaveLength(0)
    })
  })

  describe('searchFAQs', () => {
    it('should return empty array for empty query', () => {
      const results = searchFAQs('')
      expect(results).toEqual([])
    })

    it('should return empty array for stop-word-only query', () => {
      const results = searchFAQs('the a an')
      expect(results).toEqual([])
    })

    it('should find FAQs matching query', () => {
      const results = searchFAQs('budget')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].type).toBe('faq')
    })

    it('should sort results by score descending', () => {
      const results = searchFAQs('transaction')
      expect(results.length).toBeGreaterThan(1)
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score)
      }
    })

    it('should match multiple search terms', () => {
      const results = searchFAQs('create budget')
      expect(results.length).toBeGreaterThan(0)
    })
  })

  describe('searchArticles', () => {
    it('should return empty array for empty query', () => {
      const results = searchArticles('')
      expect(results).toEqual([])
    })

    it('should find articles matching query', () => {
      const results = searchArticles('getting started')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].type).toBe('article')
    })

    it('should sort results by score descending', () => {
      const results = searchArticles('budget')
      expect(results.length).toBeGreaterThan(1)
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score)
      }
    })
  })

  describe('searchAll', () => {
    it('should return empty array for empty query', () => {
      const results = searchAll('')
      expect(results).toEqual([])
    })

    it('should combine FAQ and article results', () => {
      const results = searchAll('budget')
      const hasFAQ = results.some((r) => r.type === 'faq')
      const hasArticle = results.some((r) => r.type === 'article')
      expect(hasFAQ).toBe(true)
      expect(hasArticle).toBe(true)
    })

    it('should sort combined results by score', () => {
      const results = searchAll('subscription')
      expect(results.length).toBeGreaterThan(1)
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score)
      }
    })
  })

  describe('getSuggestedSearches', () => {
    it('should return an array of suggestions', () => {
      const suggestions = getSuggestedSearches()
      expect(Array.isArray(suggestions)).toBe(true)
      expect(suggestions.length).toBeGreaterThan(0)
    })

    it('should contain common topics', () => {
      const suggestions = getSuggestedSearches()
      expect(suggestions).toContain('getting started')
      expect(suggestions).toContain('create budget')
    })
  })

  describe('highlightMatches', () => {
    it('should return original text when no query', () => {
      const result = highlightMatches('Hello world', '')
      expect(result).toEqual([{ text: 'Hello world', highlighted: false }])
    })

    it('should highlight matching terms', () => {
      const result = highlightMatches('Hello world', 'world')
      expect(result).toContainEqual({ text: 'world', highlighted: true })
    })

    it('should preserve non-matching text', () => {
      const result = highlightMatches('Hello world', 'world')
      expect(result).toContainEqual({ text: 'Hello ', highlighted: false })
    })

    it('should handle multiple matches', () => {
      const result = highlightMatches('hello world hello', 'hello')
      const highlightedSegments = result.filter((s) => s.highlighted)
      expect(highlightedSegments.length).toBe(2)
    })

    it('should handle case-insensitive matching', () => {
      const result = highlightMatches('HELLO world', 'hello')
      expect(result).toContainEqual({ text: 'HELLO', highlighted: true })
    })

    it('should handle no matches', () => {
      const result = highlightMatches('Hello world', 'xyz')
      expect(result).toEqual([{ text: 'Hello world', highlighted: false }])
    })
  })

  describe('integration with actual content', () => {
    it('should have FAQs for all categories', () => {
      const categories = new Set(FAQ_ITEMS.map((f) => f.category))
      expect(categories.size).toBe(12)
    })

    it('should have articles for all categories', () => {
      const categories = new Set(HELP_ARTICLES.map((a) => a.category))
      expect(categories.size).toBeGreaterThanOrEqual(10)
    })

    it('should find results for common search terms', () => {
      const commonTerms = ['budget', 'transaction', 'account', 'recurring', 'share']
      for (const term of commonTerms) {
        const results = searchAll(term)
        expect(results.length).toBeGreaterThan(0)
      }
    })

    it('should return relevant results for multi-word queries', () => {
      const results = searchAll('create recurring transaction')
      expect(results.length).toBeGreaterThan(0)
      // Top result should be related to recurring
      const topResult = results[0]
      const item = topResult.item
      const itemText =
        topResult.type === 'faq'
          ? `${(item as FAQItem).question} ${(item as FAQItem).answer}`
          : `${(item as HelpArticle).title} ${(item as HelpArticle).summary}`
      expect(itemText.toLowerCase()).toMatch(/recurring/)
    })
  })
})
