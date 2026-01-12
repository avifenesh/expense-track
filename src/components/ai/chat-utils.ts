export type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export type ChatSession = {
  id: string
  title: string
  messages: Message[]
  createdAt: string
  updatedAt: string
  isCustomTitle: boolean
}

export const OPEN_STATE_KEY = 'balance-ai-chat-open'

export function createTitleFromMessage(message: Message | undefined): string | null {
  if (!message) return null
  const trimmed = message.content.trim()
  if (!trimmed) return null
  return `${trimmed.slice(0, 40)}${trimmed.length > 40 ? '…' : ''}`
}

export function createSession(title: string, isCustomTitle = false): ChatSession {
  return {
    id: crypto.randomUUID?.() ?? `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isCustomTitle,
  }
}

export function loadSessionsFromStorage(storageKey: string): ChatSession[] {
  if (typeof window === 'undefined') {
    return [createSession('Conversation 1')]
  }

  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) {
      return [createSession('Conversation 1')]
    }
    const parsed = JSON.parse(raw) as ChatSession[]
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed
    }
  } catch (error) {
    console.warn('Failed to load chat sessions', error)
  }

  return [createSession('Conversation 1')]
}

export function generateMessageId(): string {
  return crypto.randomUUID?.() ?? `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export const quickPrompts = [
  { label: 'Spending summary', text: 'Show me a summary of my spending this month' },
  { label: 'Budget status', text: 'How am I doing on my budgets?' },
  { label: 'Top expenses', text: 'What are my biggest expenses?' },
  { label: 'Income trends', text: 'How has my income changed over the past 3 months?' },
]
