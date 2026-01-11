'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Sparkles, X, Send, Plus, Trash2, Pencil } from 'lucide-react'
import { Currency } from '@prisma/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

type ChatSession = {
  id: string
  title: string
  messages: Message[]
  createdAt: string
  updatedAt: string
  isCustomTitle: boolean
}

interface ChatWidgetProps {
  accountId: string
  monthKey: string
  preferredCurrency?: Currency
}

const OPEN_STATE_KEY = 'balance-ai-chat-open'

function createTitleFromMessage(message: Message | undefined) {
  if (!message) return null
  const trimmed = message.content.trim()
  if (!trimmed) return null
  return `${trimmed.slice(0, 40)}${trimmed.length > 40 ? '…' : ''}`
}

export function ChatWidget({ accountId, monthKey, preferredCurrency }: ChatWidgetProps) {
  const storageKey = useMemo(() => `balance-ai-sessions::${accountId}::${monthKey}`, [accountId, monthKey])
  const activeSessionKey = useMemo(() => `balance-ai-active-session::${accountId}::${monthKey}`, [accountId, monthKey])

  const [isOpen, setIsOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  const createSession = useCallback(
    (title: string, isCustomTitle = false): ChatSession => ({
      id: crypto.randomUUID?.() ?? `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isCustomTitle,
    }),
    [],
  )

  const loadSessions = useCallback((): ChatSession[] => {
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
  }, [createSession, storageKey])

  const [sessions, setSessions] = useState<ChatSession[]>([])

  const [activeSessionId, setActiveSessionId] = useState('')

  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const timer = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(timer)
  }, [isOpen])

  // Hydrate open state from localStorage on mount, then persist changes
  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(OPEN_STATE_KEY)
    if (stored === 'true') setIsOpen(true)
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !hydrated) return
    window.localStorage.setItem(OPEN_STATE_KEY, isOpen ? 'true' : 'false')
  }, [isOpen, hydrated])

  // Hydrate sessions on mount to avoid SSR/client mismatch
  useEffect(() => {
    setSessions(loadSessions())
  }, [loadSessions])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const restoredSessions = loadSessions()
    setSessions(restoredSessions)

    const savedActiveId = window.localStorage.getItem(activeSessionKey)
    if (savedActiveId && restoredSessions.some((session) => session.id === savedActiveId)) {
      setActiveSessionId(savedActiveId)
    } else if (restoredSessions[0]?.id) {
      const fallbackId = restoredSessions[0].id
      setActiveSessionId(fallbackId)
      window.localStorage.setItem(activeSessionKey, fallbackId)
    }
  }, [activeSessionKey, loadSessions])

  const setSessionsWithPersist = useCallback(
    (updater: (prev: ChatSession[]) => ChatSession[]) => {
      setSessions((prev) => {
        const next = updater(prev)
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(storageKey, JSON.stringify(next))
        }
        return next
      })
    },
    [storageKey],
  )

  const updateActiveSessionId = useCallback(
    (sessionId: string) => {
      setActiveSessionId(sessionId)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(activeSessionKey, sessionId)
      }
    },
    [activeSessionKey],
  )

  const currentSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? sessions[0],
    [sessions, activeSessionId],
  )

  const messages = useMemo(() => currentSession?.messages ?? [], [currentSession])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const applyMessagesUpdate = useCallback(
    (sessionId: string, transformer: (messages: Message[], session: ChatSession) => Message[]) => {
      setSessionsWithPersist((prev) =>
        prev.map((session) => {
          if (session.id !== sessionId) return session
          const updatedMessages = transformer(session.messages, session)
          const derivedTitle = createTitleFromMessage(updatedMessages.find((message) => message.role === 'user'))
          return {
            ...session,
            title: !session.isCustomTitle && derivedTitle ? derivedTitle : session.title,
            isCustomTitle: session.isCustomTitle || Boolean(derivedTitle && derivedTitle !== session.title),
            messages: updatedMessages,
            updatedAt: new Date().toISOString(),
          }
        }),
      )
    },
    [setSessionsWithPersist],
  )

  const renameSession = useCallback(
    (session: ChatSession) => {
      const proposed = window.prompt('Rename conversation', session.title)
      if (!proposed) return
      const trimmed = proposed.trim()
      if (!trimmed) return

      setSessionsWithPersist((prev) =>
        prev.map((item) =>
          item.id === session.id
            ? {
                ...item,
                title: trimmed.slice(0, 64),
                isCustomTitle: true,
              }
            : item,
        ),
      )
    },
    [setSessionsWithPersist],
  )

  const deleteSession = useCallback(
    (sessionId: string) => {
      setSessionsWithPersist((prev) => {
        if (prev.length <= 1) return prev
        const next = prev.filter((session) => session.id !== sessionId)
        if (!next.length) return prev

        if (sessionId === activeSessionId) {
          const fallbackId = next[0].id
          queueMicrotask(() => updateActiveSessionId(fallbackId))
        }

        return next
      })
    },
    [activeSessionId, setSessionsWithPersist, updateActiveSessionId],
  )

  const createNewSession = useCallback(() => {
    const newSession = createSession(`Conversation ${sessions.length + 1}`)
    setSessionsWithPersist((prev) => [...prev, newSession])
    updateActiveSessionId(newSession.id)
    queueMicrotask(() => inputRef.current?.focus())
  }, [createSession, sessions.length, setSessionsWithPersist, updateActiveSessionId])

  const quickPrompts = [
    'Summarize this month in 3 bullets',
    'Where did our grocery spend land?',
    'Suggest ways to stay on budget next month',
  ]

  const handlePromptClick = (prompt: string) => {
    setInput(prompt)
    inputRef.current?.focus()
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!input.trim() || isLoading || !currentSession) return

    const baseMessages = currentSession.messages
    const sessionId = currentSession.id

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    }

    applyMessagesUpdate(sessionId, (existing) => [...existing, userMessage])
    setInput('')
    setIsLoading(true)

    // Set up abort controller for cancellable streaming
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...baseMessages, userMessage].map((message) => ({
            role: message.role,
            content: message.content,
          })),
          accountId,
          monthKey,
          preferredCurrency,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        let errText = ''
        try {
          errText = await response.text()
        } catch {
          // Ignore - errText stays empty
        }
        console.error('[ChatWidget] /api/chat HTTP', response.status, errText)
        applyMessagesUpdate(sessionId, (existing) => [
          ...existing,
          {
            id: Date.now().toString(),
            role: 'assistant',
            content: `Server error (HTTP ${response.status}). ${errText || 'No error body.'}`,
          },
        ])
        return
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ''

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
      }

      applyMessagesUpdate(sessionId, (existing) => [...existing, assistantMessage])

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter((line) => line.trim())

        // Surface any non-protocol diagnostics from the server
        const diag = lines.filter((l) => !l.startsWith('0:')).join('\n')
        if (diag) {
          console.debug('[ChatWidget] diag:', diag)
        }

        // Handle AI SDK structured events if present
        let handledStructured = false
        for (const line of lines) {
          if (!line.startsWith('0:')) continue
          try {
            const data = JSON.parse(line.slice(2))
            if (data.type === 'text-delta' && data.textDelta) {
              assistantContent += data.textDelta
              const latest = assistantContent
              applyMessagesUpdate(sessionId, (existing) =>
                existing.map((message) =>
                  message.id === assistantMessage.id ? { ...message, content: latest } : message,
                ),
              )
              handledStructured = true
            }
          } catch {
            // ignore malformed tool chunks
          }
        }

        // Detect Bedrock throttling message and re-run with fallback model
        if (!handledStructured && /Too many tokens|ThrottlingException/i.test(diag)) {
          try {
            reader.cancel()
          } catch {
            // Ignore cancel errors
          }

          const retryResp = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [...baseMessages, userMessage].map((m) => ({ role: m.role, content: m.content })),
              accountId,
              monthKey,
              preferredCurrency,
            }),
            signal: controller.signal,
          })

          const retryReader = retryResp.body?.getReader()
          if (retryReader) {
            while (true) {
              const { done: done2, value: value2 } = await retryReader.read()
              if (done2) break
              const chunk2 = decoder.decode(value2)
              const lines2 = chunk2.split('\n').filter((line) => line.trim())
              for (const line2 of lines2) {
                if (!line2.startsWith('0:')) continue
                try {
                  const data2 = JSON.parse(line2.slice(2))
                  if (data2.type === 'text-delta' && data2.textDelta) {
                    assistantContent += data2.textDelta
                    const latest2 = assistantContent
                    applyMessagesUpdate(sessionId, (existing) =>
                      existing.map((message) =>
                        message.id === assistantMessage.id ? { ...message, content: latest2 } : message,
                      ),
                    )
                  }
                } catch {
                  // Ignore JSON parse errors for malformed stream lines
                }
              }
            }
          }
          // Stop processing the original stream once fallback is used
          break
        }

        // Fallback: append raw text chunks when no structured parts are present
        if (!handledStructured && diag) {
          assistantContent += diag
          const latest = assistantContent
          applyMessagesUpdate(sessionId, (existing) =>
            existing.map((message) => (message.id === assistantMessage.id ? { ...message, content: latest } : message)),
          )
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        applyMessagesUpdate(sessionId, (existing) => [
          ...existing,
          {
            id: Date.now().toString(),
            role: 'assistant',
            content: 'Generation stopped.',
          },
        ])
      } else {
        console.error('Chat error:', error)
        applyMessagesUpdate(sessionId, (existing) => [
          ...existing,
          {
            id: Date.now().toString(),
            role: 'assistant',
            content: 'Sorry, I encountered an error. Please try again.',
          },
        ])
      }
    } finally {
      abortRef.current = null
      setIsLoading(false)
    }
  }

  const handleStop = useCallback(() => {
    try {
      abortRef.current?.abort()
    } catch {
      // Ignore abort errors
    }
  }, [])

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm font-medium text-slate-100 shadow-2xl shadow-slate-950/40 backdrop-blur-xl transition hover:border-white/30 hover:bg-white/15 hover:shadow-slate-950/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60"
        aria-label="Open AI Assistant"
      >
        <Sparkles className="h-5 w-5 text-sky-300" />
        <span className="hidden sm:inline">Ask Balance AI</span>
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[min(360px,calc(100vw-2.5rem))] sm:w-96">
      <div className="flex h-[520px] flex-col overflow-hidden rounded-3xl border border-white/15 bg-slate-950/80 shadow-2xl shadow-slate-950/60 backdrop-blur-xl sm:h-[600px]">
        <div className="flex items-start justify-between border-b border-white/10 bg-gradient-to-r from-sky-500/20 via-slate-950/30 to-transparent px-5 py-4">
          <div className="flex items-center gap-3 text-slate-100">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20 text-sky-200 shadow-inner shadow-slate-950/40">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="flex flex-col">
              <h3 className="text-sm font-semibold text-white">Balance AI Advisor</h3>
              <p className="text-xs text-slate-300">Insights grounded in your accounts and budgets.</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-full border border-white/10 bg-white/5 p-1.5 text-slate-200 transition hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/50"
            aria-label="Close chat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-white/10 bg-slate-950/60 px-5 py-2">
          <div className="flex items-center gap-3">
            <div className="flex flex-1 items-center gap-2 overflow-x-auto">
              {sessions.map((session) => {
                const isActive = session.id === currentSession?.id
                return (
                  <div
                    key={session.id}
                    className={cn(
                      'group flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition',
                      isActive
                        ? 'border-sky-400/40 bg-sky-500/20 text-white shadow-slate-950/40'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:text-white',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        updateActiveSessionId(session.id)
                        queueMicrotask(() => inputRef.current?.focus())
                      }}
                      onDoubleClick={() => renameSession(session)}
                      className="max-w-[160px] truncate text-left"
                    >
                      {session.title}
                    </button>
                    <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => renameSession(session)}
                        className="rounded-full border border-white/10 bg-white/5 p-1 text-slate-200 hover:border-white/20 hover:bg-white/10"
                        aria-label={`Rename ${session.title}`}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      {sessions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => deleteSession(session.id)}
                          className="rounded-full border border-white/10 bg-white/5 p-1 text-slate-200 hover:border-white/20 hover:bg-white/10"
                          aria-label={`Delete ${session.title}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <button
              type="button"
              onClick={createNewSession}
              className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200 transition hover:border-sky-300/40 hover:bg-sky-500/20 hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              New
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-slate-100">
          {messages.length === 0 && (
            <div className="mt-6 space-y-6 rounded-2xl border border-white/10 bg-white/5 p-5 text-center text-sm text-slate-300">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sky-500/20 text-sky-200">
                <Sparkles className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-medium text-white">Ask anything about this workspace.</p>
                <p className="text-xs text-slate-400">
                  Balance AI can summarize trends, explain variances, and draft next steps.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 text-xs">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handlePromptClick(prompt)}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-200 transition hover:border-sky-300/40 hover:bg-sky-500/10 hover:text-white"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn('flex w-full', message.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow shadow-slate-950/30 backdrop-blur',
                  message.role === 'user'
                    ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white'
                    : 'bg-white/8 text-slate-100 ring-1 ring-white/10',
                )}
              >
                <div className="whitespace-pre-wrap text-[13px]">{message.content}</div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-4 py-2">
                <span className="h-2 w-2 animate-bounce rounded-full bg-sky-300" style={{ animationDelay: '0ms' }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-sky-300" style={{ animationDelay: '120ms' }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-sky-300" style={{ animationDelay: '240ms' }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="border-t border-white/10 bg-slate-950/60 px-5 py-4">
          <div className="flex items-end gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about your finances..."
              className="flex-1 text-sm"
              disabled={isLoading}
            />
            {isLoading && (
              <Button
                type="button"
                variant="secondary"
                onClick={handleStop}
                className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-slate-200 hover:bg-white/15"
                aria-label="Stop generation"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            <Button
              type="submit"
              variant="secondary"
              className="rounded-xl border border-sky-400/40 bg-sky-500/40 px-4 py-2 text-white shadow-slate-950/40 hover:bg-sky-500/60"
              disabled={isLoading || !input.trim()}
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            AI answers stay private to your browser session and reference the selected account context.
          </p>
        </form>
      </div>
    </div>
  )
}
