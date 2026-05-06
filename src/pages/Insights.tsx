import { useState, useEffect, useCallback, useRef, type ComponentType, type FormEvent, type ReactNode } from 'react'
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  RefreshCw,
  Clock,
  Upload,
  Send,
  Database,
  MapPin,
  BarChart3,
  Plus,
  Archive,
  Trash2,
  Edit3,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import guavaIcon from '@/assets/guava-icon.png'

interface Insight {
  id: string
  text: string
  category: 'trend' | 'warning' | 'tip' | 'highlight'
  generatedAt: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  pending?: boolean
}

interface ChatContextStats {
  transactionCount: number
  locations: number
  topItems: number
  forecasts: number
  contextWindow?: string
}

interface InsightChat {
  _id: string
  title: string
  messages: ChatMessage[]
  contextStats?: ChatContextStats | null
  archived: boolean
  updatedAt: string
  createdAt: string
}

interface AssistantTypingState {
  target: string
  displayed: string
  finishing: boolean
  rafId: number | null
  lastFrameAt: number | null
}

const CATEGORY_CONFIG = {
  trend: { icon: TrendingUp, color: '#4DA63B', bg: '#4DA63B', label: 'Trend' },
  warning: { icon: AlertTriangle, color: '#FFD166', bg: '#FFD166', label: 'Watch' },
  tip: { icon: Lightbulb, color: '#D43D3D', bg: '#D43D3D', label: 'Tip' },
  highlight: { icon: Sparkles, color: '#4A9ECC', bg: '#4A9ECC', label: 'Highlight' },
}

const QUICK_PROMPTS = [
  'What should I prepare more of tomorrow?',
  'Which items are underperforming and why?',
  'Where are my busiest trading windows?',
  'What changed in the last 30 days?',
]

const CHAT_STORAGE_KEY = 'your-guava:insights-chat:v1'
const CHAT_LIST_STORAGE_KEY = 'your-guava:insights-chat-list:v1'
const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: 'Ask me about your sales, items, forecasts, trading hours, locations, or recent transaction patterns.',
}

function withMessageIds(chat: Omit<InsightChat, 'messages'> & { messages?: Array<Partial<ChatMessage>> }): InsightChat {
  return {
    ...chat,
    messages: (chat.messages || [])
      .filter((message) =>
        message &&
        (message.role === 'user' || message.role === 'assistant') &&
        typeof message.content === 'string'
      )
      .map((message, index) => ({
        id: message.id || `${chat._id}-${index}`,
        role: message.role as 'user' | 'assistant',
        content: message.content || '',
        pending: false,
      })),
  }
}

function messagesForApi(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.id !== 'welcome' && message.content.trim())
    .map(({ role, content }) => ({ role, content }))
}

function titleFromMessages(messages: ChatMessage[]) {
  const firstUserMessage = messages.find((message) => message.role === 'user')?.content || ''
  const normalized = firstUserMessage.replace(/\s+/g, ' ').trim()
  return normalized ? normalized.slice(0, 60) : 'New chat'
}

function sortChats(chats: InsightChat[]) {
  return chats
    .slice()
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

function mergeChats(primary: InsightChat[], fallback: InsightChat[]) {
  const byId = new Map<string, InsightChat>()
  fallback.forEach((chat) => byId.set(chat._id, chat))
  primary.forEach((chat) => byId.set(chat._id, chat))
  return sortChats(Array.from(byId.values()))
}

function loadLocalChatList() {
  try {
    const stored = localStorage.getItem(CHAT_LIST_STORAGE_KEY)
    if (!stored) return []
    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed?.chats)) return []
    return parsed.chats.map(withMessageIds)
  } catch {
    return []
  }
}

function isLocalChat(chatId: string | null) {
  return Boolean(chatId?.startsWith('local-'))
}

function createLocalChat(messages: ChatMessage[], stats: ChatContextStats | null = null): InsightChat {
  const now = new Date().toISOString()
  const id = `local-${Date.now()}`
  return {
    _id: id,
    title: titleFromMessages(messages),
    messages: messages.filter((message) => message.id !== 'welcome').map((message, index) => ({
      ...message,
      id: message.id || `${id}-${index}`,
      pending: false,
    })),
    contextStats: stats,
    archived: false,
    createdAt: now,
    updatedAt: now,
  }
}

const MOCK_INSIGHTS: Insight[] = [
  {
    id: '1',
    category: 'trend',
    text: 'Your Flat White sales spike 34% on payday Fridays compared to regular Fridays. Consider preparing an extra 25-30 units this Friday given the upcoming month-end.',
    generatedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    category: 'warning',
    text: 'Croissant sales dropped 18% over the last 3 Sundays. This may indicate a supply consistency issue or changing customer preference on that day.',
    generatedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    category: 'tip',
    text: 'The 08:00-10:00 morning rush generates 36% of your daily revenue. Full staff coverage and prepared ingredients before 07:45 could reduce wait times.',
    generatedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
  },
  {
    id: '4',
    category: 'highlight',
    text: 'Cold Brew sales are trending up 22% month-on-month as Cape Town moves into summer. Increase prep if warm days continue.',
    generatedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
  },
]

function timeAgo(isoDate: string) {
  const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 60000)
  if (diff < 1) return 'just now'
  if (diff < 60) return `${diff} minute${diff === 1 ? '' : 's'} ago`
  const hours = Math.floor(diff / 60)
  return `${hours} hour${hours === 1 ? '' : 's'} ago`
}

function InsightCard({ insight, index }: { insight: Insight; index: number }) {
  const config = CATEGORY_CONFIG[insight.category]
  const Icon = config.icon

  return (
    <div
      className="border-b border-[#242424] last:border-0 py-4"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
          style={{ backgroundColor: `${config.bg}15` }}
        >
          <Icon className="w-4 h-4" style={{ color: config.color }} />
        </div>
        <div className="min-w-0">
          <Badge
            variant="outline"
            className="text-[10px] py-0 h-4 px-2 mb-2"
            style={{ borderColor: `${config.bg}40`, color: config.color }}
          >
            {config.label}
          </Badge>
          <p className="text-[#D0D0D0] text-sm leading-relaxed">{insight.text}</p>
        </div>
      </div>
    </div>
  )
}

function InsightSkeleton() {
  return (
    <div className="py-4 border-b border-[#242424] last:border-0 flex gap-3">
      <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-16 rounded-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  )
}

function Stat({ icon: Icon, label, value }: {
  icon: ComponentType<{ className?: string }>
  label: string
  value: string | number
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <Icon className="w-3.5 h-3.5 text-[#555555]" />
      <span className="text-muted">{label}</span>
      <span className="text-text font-semibold tabular-nums">{value}</span>
    </div>
  )
}

function renderInlineMarkdown(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-semibold text-text">{part.slice(2, -2)}</strong>
    }
    return part
  })
}

function isMarkdownTableSeparator(line: string) {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim())
}

function renderMarkdownTableRow(line: string, index: number, isHeader: boolean) {
  const cells = line.split('|').map((cell) => cell.trim()).filter(Boolean)
  if (cells.length < 2) return null

  return (
    <div
      key={index}
      className={cn(
        'grid overflow-hidden border-x border-b border-border first:rounded-t-lg last:rounded-b-lg',
        isHeader && 'border-t bg-[#202020] text-text'
      )}
      style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}
    >
      {cells.map((cell, cellIndex) => (
        <div
          key={`${index}-${cellIndex}`}
          className={cn(
            'px-3 py-2 text-xs border-r border-border last:border-r-0',
            isHeader ? 'font-semibold text-text' : 'text-[#D8D8D8]'
          )}
        >
          {renderInlineMarkdown(cell)}
        </div>
      ))}
    </div>
  )
}

function MarkdownLite({ text, streaming = false }: { text: string; streaming?: boolean }) {
  const lines = text.split('\n')
  return (
    <div className="space-y-3 text-[15px] leading-7 text-[#E4E4E4]">
      {lines.map((rawLine, index) => {
        const line = rawLine.trim()
        const isFirstContent = lines.slice(0, index).every((previousLine) => !previousLine.trim())
        const headingMargin = isFirstContent ? '' : 'mt-4'
        if (!line) return <div key={index} className="h-1" />
        if (isMarkdownTableSeparator(line)) return null
        if (line.startsWith('|') && line.endsWith('|')) {
          return renderMarkdownTableRow(line, index, isMarkdownTableSeparator(lines[index + 1] || ''))
        }
        if (line.startsWith('### ')) {
          return (
            <h4 key={index} className={cn('text-text text-sm font-semibold', headingMargin)}>
              {renderInlineMarkdown(line.slice(4))}
            </h4>
          )
        }
        if (line.startsWith('## ')) {
          return (
            <h3 key={index} className={cn('text-text text-base font-semibold', headingMargin)}>
              {renderInlineMarkdown(line.slice(3))}
            </h3>
          )
        }
        if (line.startsWith('# ')) {
          return (
            <h2 key={index} className={cn('text-text text-lg font-semibold', headingMargin)}>
              {renderInlineMarkdown(line.slice(2))}
            </h2>
          )
        }
        if (/^[-*]\s+/.test(line)) {
          return (
            <div key={index} className="flex gap-2.5">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-guava-red" />
              <p>{renderInlineMarkdown(line.replace(/^[-*]\s+/, ''))}</p>
            </div>
          )
        }
        if (/^\d+\.\s+/.test(line)) {
          const [num] = line.split('.')
          return (
            <div key={index} className="flex gap-2">
              <span className="text-muted tabular-nums">{num}.</span>
              <p>{renderInlineMarkdown(line.replace(/^\d+\.\s+/, ''))}</p>
            </div>
          )
        }
        return <p key={index}>{renderInlineMarkdown(line)}</p>
      })}
      {streaming && <span className="inline-block h-4 w-0.5 rounded bg-guava-green/80 animate-pulse align-middle ml-1" />}
    </div>
  )
}

function MessageRow({
  message,
  messageRef,
}: {
  message: ChatMessage
  messageRef?: (node: HTMLDivElement | null) => void
}) {
  const isAssistant = message.role === 'assistant'

  if (isAssistant) {
    return (
      <div ref={messageRef} data-message-role="assistant" className="py-5 sm:py-6">
        <div className="max-w-3xl">
          <MarkdownLite text={message.content || 'Thinking...'} streaming={message.pending} />
        </div>
      </div>
    )
  }

  return (
    <div
      ref={messageRef}
      data-message-role="user"
      className="flex justify-end py-4"
    >
      <div className="max-w-[88%] rounded-2xl rounded-tr-md bg-guava-green px-4 py-3 text-white shadow-lg shadow-black/15 sm:max-w-[72%]">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  )
}

function ChatComposer({
  input,
  setInput,
  sendPrompt,
  isChatLoading,
  floating = false,
}: {
  input: string
  setInput: (value: string) => void
  sendPrompt: (prompt: string) => void
  isChatLoading: boolean
  floating?: boolean
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full max-w-215',
        floating && 'absolute bottom-5 left-1/2 z-20 w-[calc(100%-2rem)] -translate-x-1/2'
      )}
    >
      <form
        className={cn(
          'rounded-2xl border border-[#303030] bg-[#151515]/95 shadow-2xl shadow-black/30 backdrop-blur',
          'p-3 transition-all',
          floating ? 'min-h-28' : 'min-h-37.5'
        )}
        onSubmit={(event) => {
          event.preventDefault()
          sendPrompt(input)
        }}
      >
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              sendPrompt(input)
            }
          }}
          rows={floating ? 2 : 3}
          placeholder={floating ? 'Write a message...' : 'How can I help with your cafe today?'}
          className={cn(
            'w-full resize-none border-0 bg-transparent px-2 py-2 text-text placeholder:text-[#777777]',
            'focus-visible:outline-none',
            floating ? 'min-h-12 text-sm' : 'min-h-20 text-base'
          )}
        />
        <div className="flex items-center justify-between px-1 pt-1">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-text"
            aria-label="Add context"
          >
            <Database className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-[#666666] sm:inline">Guava AI business analyst</span>
            <Button type="submit" size="icon" disabled={!input.trim() || isChatLoading} aria-label="Send message">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </form>
      {floating && (
        <p className="mt-2 text-center text-xs text-[#555555]">
          AI can make mistakes. Check important decisions against your source data.
        </p>
      )}
    </div>
  )
}

function ChatHistoryPanel({
  chats,
  activeChatId,
  isLoading,
  notice,
  onNewChat,
  onSelectChat,
  onRenameChat,
  onArchiveChat,
  onDeleteChat,
}: {
  chats: InsightChat[]
  activeChatId: string | null
  isLoading: boolean
  notice: string | null
  onNewChat: () => void
  onSelectChat: (chat: InsightChat) => void
  onRenameChat: (chat: InsightChat) => void
  onArchiveChat: (chat: InsightChat, archived: boolean) => void
  onDeleteChat: (chat: InsightChat) => void
}) {
  const activeChats = chats.filter((chat) => !chat.archived)
  const archivedChats = chats.filter((chat) => chat.archived)

  const renderChat = (chat: InsightChat) => (
    <div
      key={chat._id}
      className={cn(
        'group flex items-center gap-2 rounded-lg border px-2 py-2 transition-colors',
        chat._id === activeChatId
          ? 'border-guava-red/35 bg-guava-red/10'
          : 'border-transparent hover:border-border hover:bg-[#202020]'
      )}
    >
      <button type="button" onClick={() => onSelectChat(chat)} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-medium text-text">{chat.title}</p>
        <p className="text-[11px] text-[#666666]">{timeAgo(chat.updatedAt)}</p>
      </button>
      <div className="flex shrink-0 items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={() => onRenameChat(chat)}
          className="rounded-md p-1.5 text-[#777777] hover:bg-border hover:text-text"
          aria-label="Rename chat"
        >
          <Edit3 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onArchiveChat(chat, !chat.archived)}
          className="rounded-md p-1.5 text-[#777777] hover:bg-border hover:text-text"
          aria-label={chat.archived ? 'Unarchive chat' : 'Archive chat'}
        >
          <Archive className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onDeleteChat(chat)}
          className="rounded-md p-1.5 text-[#777777] hover:bg-border hover:text-guava-red"
          aria-label="Delete chat"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )

  return (
    <Card className="flex max-h-70 min-h-55 flex-col overflow-hidden">
      <CardHeader className="shrink-0 pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Chats</CardTitle>
            <CardDescription>Saved Guava AI conversations.</CardDescription>
          </div>
          <Button type="button" size="sm" onClick={() => onNewChat()}>
            <Plus className="h-3.5 w-3.5" />
            New
          </Button>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-y-auto space-y-3">
        {notice && (
          <p className="rounded-lg border border-guava-green/25 bg-guava-green/10 px-3 py-2 text-xs text-guava-green">
            {notice}
          </p>
        )}
        {isLoading && <Skeleton className="h-10 w-full rounded-lg" />}
        {!isLoading && activeChats.length === 0 && archivedChats.length === 0 && (
          <p className="rounded-lg border border-border px-3 py-3 text-sm text-[#777777]">
            Your saved chats will appear here.
          </p>
        )}
        {activeChats.length > 0 && (
          <div className="space-y-1.5">
            <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-[#666666]">Recent</p>
            {activeChats.map(renderChat)}
          </div>
        )}
        {archivedChats.length > 0 && (
          <div className="space-y-1.5">
            <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-[#666666]">Archived</p>
            {archivedChats.map(renderChat)}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function Insights() {
  const [insights, setInsights] = useState<Insight[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [hasData, setHasData] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const stored = localStorage.getItem(CHAT_STORAGE_KEY)
      if (!stored) return [WELCOME_MESSAGE]
      const parsed = JSON.parse(stored)
      if (!Array.isArray(parsed?.messages)) return [WELCOME_MESSAGE]

      const storedMessages = parsed.messages
        .filter((message: Partial<ChatMessage>) =>
          message &&
          (message.role === 'user' || message.role === 'assistant') &&
          typeof message.content === 'string'
        )
        .slice(-80)
        .map((message: ChatMessage) => ({ ...message, pending: false }))

      return storedMessages.length ? storedMessages : [WELCOME_MESSAGE]
    } catch {
      return [WELCOME_MESSAGE]
    }
  })
  const [input, setInput] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [chats, setChats] = useState<InsightChat[]>(() => loadLocalChatList())
  const [activeChatId, setActiveChatId] = useState<string | null>(() => {
    try {
      const stored = localStorage.getItem(CHAT_STORAGE_KEY)
      if (!stored) return null
      return JSON.parse(stored)?.activeChatId || null
    } catch {
      return null
    }
  })
  const [isChatsLoading, setIsChatsLoading] = useState(false)
  const [contextStats, setContextStats] = useState<ChatContextStats | null>(() => {
    try {
      const stored = localStorage.getItem(CHAT_STORAGE_KEY)
      if (!stored) return null
      const parsed = JSON.parse(stored)
      return parsed?.contextStats || null
    } catch {
      return null
    }
  })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const messageRefs = useRef(new Map<string, HTMLDivElement>())
  const assistantTypingRef = useRef(new Map<string, AssistantTypingState>())
  const scrollTargetMessageIdRef = useRef<string | null>(null)
  const activeChatIdRef = useRef<string | null>(activeChatId)
  const messagesRef = useRef<ChatMessage[]>(messages)
  const contextStatsRef = useRef<ChatContextStats | null>(contextStats)
  const isChatLoadingRef = useRef(false)
  const didInitialChatSelectionRef = useRef(false)
  const hasConversation = messages.some((message) => message.id !== 'welcome')
  const hasConversationRef = useRef(hasConversation)
  const [renameTarget, setRenameTarget] = useState<InsightChat | null>(null)
  const [renameTitle, setRenameTitle] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<InsightChat | null>(null)
  const [chatNotice, setChatNotice] = useState<string | null>(null)

  useEffect(() => {
    activeChatIdRef.current = activeChatId
  }, [activeChatId])

  useEffect(() => {
    messagesRef.current = messages
    hasConversationRef.current = hasConversation
  }, [messages, hasConversation])

  useEffect(() => {
    contextStatsRef.current = contextStats
  }, [contextStats])

  const setActiveChat = useCallback((chatId: string | null) => {
    activeChatIdRef.current = chatId
    setActiveChatId(chatId)
  }, [])

  const setTrackedMessages = useCallback((nextMessages: ChatMessage[]) => {
    messagesRef.current = nextMessages
    hasConversationRef.current = nextMessages.some((message) => message.id !== 'welcome')
    setMessages(nextMessages)
  }, [])

  const updateTrackedMessages = useCallback((updater: (current: ChatMessage[]) => ChatMessage[]) => {
    setMessages((current) => {
      const nextMessages = updater(current)
      messagesRef.current = nextMessages
      hasConversationRef.current = nextMessages.some((message) => message.id !== 'welcome')
      return nextMessages
    })
  }, [])

  const setMessageNode = useCallback((messageId: string, node: HTMLDivElement | null) => {
    if (node) messageRefs.current.set(messageId, node)
    else messageRefs.current.delete(messageId)
  }, [])

  const cancelAssistantTyping = useCallback((messageId?: string) => {
    const targets = messageId
      ? [[messageId, assistantTypingRef.current.get(messageId)] as const]
      : Array.from(assistantTypingRef.current.entries())

    targets.forEach(([id, state]) => {
      if (state?.rafId != null) window.cancelAnimationFrame(state.rafId)
      assistantTypingRef.current.delete(id)
    })
  }, [])

  const applyChat = useCallback((chat: InsightChat) => {
    cancelAssistantTyping()
    const normalized = withMessageIds(chat)
    setActiveChat(normalized._id)
    setTrackedMessages(normalized.messages.length ? normalized.messages : [WELCOME_MESSAGE])
    setContextStats(normalized.contextStats || null)
    setInput('')
  }, [cancelAssistantTyping, setActiveChat, setTrackedMessages])

  const loadInsights = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true)
    else setIsLoading(true)

    try {
      const { data } = await api.get('/forecasts/insights')
      if (data?.insights?.length) {
        const mapped: Insight[] = data.insights.map((text: string, i: number) => ({
          id: String(i + 1),
          text,
          category: (['trend', 'warning', 'tip', 'highlight'] as const)[i % 4],
          generatedAt: data.generatedAt || new Date().toISOString(),
        }))
        setInsights(mapped)
        setHasData(true)
      } else {
        setHasData(false)
      }
      setLastUpdated(new Date().toISOString())
    } catch {
      setInsights(MOCK_INSIGHTS)
      setHasData(true)
      setLastUpdated(new Date().toISOString())
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  const loadChats = useCallback(async () => {
    setIsChatsLoading(true)
    try {
      const { data } = await api.get('/insight-chats', { params: { archived: true } })
      const loadedChats: InsightChat[] = (data.chats || []).map(withMessageIds)
      const mergedChats = mergeChats(loadedChats, loadLocalChatList())
      setChats(mergedChats)

      if (isChatLoadingRef.current) return

      const savedActive = mergedChats.find((chat) => chat._id === activeChatIdRef.current)
      const firstActive = mergedChats.find((chat) => !chat.archived)

      if (!hasConversationRef.current && savedActive) {
        applyChat(savedActive)
      } else if (!didInitialChatSelectionRef.current && !hasConversationRef.current && firstActive) {
        applyChat(firstActive)
      }
      didInitialChatSelectionRef.current = true
    } catch {
      // Local storage keeps the current chat usable if the API is unavailable.
    } finally {
      setIsChatsLoading(false)
    }
  }, [applyChat])

  useEffect(() => {
    loadInsights()
  }, [loadInsights])

  useEffect(() => {
    loadChats()
  }, [loadChats])

  useEffect(() => {
    const targetId = scrollTargetMessageIdRef.current
    if (!targetId) return

    const node = messageRefs.current.get(targetId)
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ behavior: 'smooth', block: 'start' })
      scrollTargetMessageIdRef.current = null
    }
  }, [messages.length])

  useEffect(() => {
    if (messages.some((message) => message.pending)) return

    const storedMessages = messages
      .filter((message) => message.id !== 'welcome' || messages.length === 1)
      .slice(-80)
      .map((message) => ({ ...message, pending: false }))

    localStorage.setItem(
      CHAT_STORAGE_KEY,
      JSON.stringify({
        activeChatId,
        messages: storedMessages,
        contextStats,
        updatedAt: new Date().toISOString(),
      })
    )
  }, [activeChatId, messages, contextStats])

  useEffect(() => {
    localStorage.setItem(
      CHAT_LIST_STORAGE_KEY,
      JSON.stringify({
        chats: chats.slice(0, 80).map((chat) => ({
          ...chat,
          messages: chat.messages.map((message) => ({ ...message, pending: false })),
        })),
        updatedAt: new Date().toISOString(),
      })
    )
  }, [chats])

  useEffect(() => () => {
    cancelAssistantTyping()
  }, [cancelAssistantTyping])

  useEffect(() => {
    if (!chatNotice) return
    const timer = window.setTimeout(() => setChatNotice(null), 3200)
    return () => window.clearTimeout(timer)
  }, [chatNotice])

  useEffect(() => {
    if (!renameTarget && !deleteTarget) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setRenameTarget(null)
      setRenameTitle('')
      setDeleteTarget(null)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [renameTarget, deleteTarget])

  const setAssistantContent = (id: string, content: string, pending: boolean) => {
    updateTrackedMessages((current) =>
      current.map((message) =>
        message.id === id
          ? { ...message, content, pending }
          : message
      )
    )
  }

  const frameSizeForBacklog = (backlog: number, elapsedMs: number) => {
    const charsPerSecond =
      backlog > 1200 ? 420 :
      backlog > 600 ? 320 :
      backlog > 220 ? 240 :
      170
    return Math.max(1, Math.floor((charsPerSecond * Math.max(elapsedMs, 16)) / 1000))
  }

  const scheduleAssistantTyping = (id: string) => {
    const state = assistantTypingRef.current.get(id)
    if (!state || state.rafId != null) return

    state.rafId = window.requestAnimationFrame((timestamp) => {
      const currentState = assistantTypingRef.current.get(id)
      if (!currentState) return

      currentState.rafId = null
      const elapsed = currentState.lastFrameAt == null ? 16 : timestamp - currentState.lastFrameAt
      currentState.lastFrameAt = timestamp

      const remaining = currentState.target.length - currentState.displayed.length
      if (remaining > 0) {
        const nextLength = currentState.displayed.length + Math.min(remaining, frameSizeForBacklog(remaining, elapsed))
        currentState.displayed = currentState.target.slice(0, nextLength)
        setAssistantContent(id, currentState.displayed, true)
      }

      if (currentState.displayed.length < currentState.target.length) {
        scheduleAssistantTyping(id)
        return
      }

      if (currentState.finishing) {
        setAssistantContent(id, currentState.displayed, false)
        assistantTypingRef.current.delete(id)
      }
    })
  }

  const appendAssistantDelta = (id: string, text: string, options: { replace?: boolean; finish?: boolean } = {}) => {
    const existingContent = messagesRef.current.find((message) => message.id === id)?.content || ''
    const existingState = assistantTypingRef.current.get(id)
    const state = existingState || {
      target: existingContent,
      displayed: existingContent,
      finishing: false,
      rafId: null,
      lastFrameAt: null,
    }

    if (options.replace) {
      state.target = text
      state.displayed = ''
      state.lastFrameAt = null
      setAssistantContent(id, '', true)
    } else {
      state.target += text
    }

    if (options.finish) state.finishing = true
    assistantTypingRef.current.set(id, state)
    scheduleAssistantTyping(id)
  }

  const revealAssistantMessage = (id: string, answer: string) => {
    appendAssistantDelta(id, answer, { replace: true, finish: true })
  }

  const finishAssistantMessage = (id: string) => {
    const state = assistantTypingRef.current.get(id)
    if (state) {
      state.finishing = true
      scheduleAssistantTyping(id)
      return
    }
    updateTrackedMessages((current) =>
      current.map((message) =>
        message.id === id ? { ...message, pending: false } : message
      )
    )
  }

  const handleStreamEvent = (rawEvent: string, assistantId: string) => {
    const lines = rawEvent.split('\n')
    const eventName = lines
      .find((line) => line.startsWith('event:'))
      ?.replace('event:', '')
      .trim()
    const dataText = lines
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.replace('data:', '').trimStart())
      .join('\n')

    if (!eventName || !dataText) return

    const data = JSON.parse(dataText)
    if (eventName === 'delta') {
      appendAssistantDelta(assistantId, data.text || '')
    }
    if (eventName === 'done') {
      setContextStats(data.contextStats || null)
      finishAssistantMessage(assistantId)
    }
    if (eventName === 'error') {
      appendAssistantDelta(assistantId, `\n\n${data.message || 'The AI stream stopped unexpectedly.'}`)
      finishAssistantMessage(assistantId)
    }
  }

  const streamAssistantMessage = async (
    assistantId: string,
    payloadMessages: Array<{ role: 'user' | 'assistant'; content: string }>,
    onFirstDelta: () => void
  ) => {
    const token = localStorage.getItem('accessToken')
    const apiBaseUrl = String(api.defaults.baseURL || import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
    const response = await fetch(`${apiBaseUrl}/forecasts/insights/chat/stream`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ messages: payloadMessages }),
    })

    if (!response.ok || !response.body) {
      throw new Error('Streaming chat request failed')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let answer = ''
    let streamedContextStats: ChatContextStats | null = null

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const events = buffer.split('\n\n')
      buffer = events.pop() || ''
      for (const event of events) {
        if (event.includes('event: delta')) onFirstDelta()
        const dataLine = event
          .split('\n')
          .find((line) => line.startsWith('data:'))
          ?.replace('data:', '')
          .trimStart()
        if (dataLine) {
          const parsed = JSON.parse(dataLine)
          if (event.includes('event: delta')) answer += parsed.text || ''
          if (event.includes('event: done')) streamedContextStats = parsed.contextStats || null
        }
        handleStreamEvent(event, assistantId)
      }
    }

    if (buffer.trim()) {
      handleStreamEvent(buffer, assistantId)
    }

    return { answer, contextStats: streamedContextStats }
  }

  const saveChat = async (
    chatId: string | null,
    chatMessages: ChatMessage[],
    stats: ChatContextStats | null = contextStats
  ) => {
    if (!chatId) return

    if (isLocalChat(chatId)) {
      setChats((current) =>
        sortChats(
          current.map((chat) =>
            chat._id === chatId
              ? {
                  ...chat,
                  title: titleFromMessages(chatMessages),
                  messages: chatMessages
                    .filter((message) => message.id !== 'welcome')
                    .map((message) => ({ ...message, pending: false })),
                  contextStats: stats,
                  updatedAt: new Date().toISOString(),
                }
              : chat
          )
        )
      )
      return
    }

    const payload = {
      title: titleFromMessages(chatMessages),
      messages: messagesForApi(chatMessages),
      contextStats: stats || undefined,
    }

    try {
      const { data } = await api.patch(`/insight-chats/${chatId}`, payload)
      const updatedChat = withMessageIds(data.chat)
      setChats((current) =>
        sortChats([updatedChat, ...current.filter((chat) => chat._id !== updatedChat._id)])
      )
    } catch {
      const localChat = createLocalChat(chatMessages, stats)
      setActiveChat(localChat._id)
      setChats((current) => sortChats([localChat, ...current.filter((chat) => chat._id !== chatId)]))
    }
  }

  const ensureActiveChat = async (chatMessages: ChatMessage[]) => {
    if (activeChatIdRef.current) return activeChatIdRef.current

    try {
      const { data } = await api.post('/insight-chats', {
        title: titleFromMessages(chatMessages),
        messages: messagesForApi(chatMessages),
        contextStats: contextStats || undefined,
      })
      const createdChat = withMessageIds(data.chat)
      setChats((current) => sortChats([createdChat, ...current.filter((chat) => chat._id !== createdChat._id)]))
      setActiveChat(createdChat._id)
      return createdChat._id
    } catch {
      const localChat = createLocalChat(chatMessages, contextStats)
      setChats((current) => sortChats([localChat, ...current.filter((chat) => chat._id !== localChat._id)]))
      setActiveChat(localChat._id)
      return localChat._id
    }
  }

  const preserveCurrentChat = async () => {
    if (!hasConversationRef.current) return

    const currentMessages = messagesRef.current.filter((message) => message.id !== 'welcome')
    if (currentMessages.length === 0) return

    if (activeChatIdRef.current) {
      await saveChat(activeChatIdRef.current, currentMessages, contextStatsRef.current)
      return
    }

    const localChat = createLocalChat(currentMessages, contextStatsRef.current)
    setChats((current) => sortChats([localChat, ...current.filter((chat) => chat._id !== localChat._id)]))
  }

  const resetDraftChat = () => {
    cancelAssistantTyping()
    setActiveChat(null)
    setTrackedMessages([WELCOME_MESSAGE])
    setContextStats(null)
    setInput('')
    scrollTargetMessageIdRef.current = null
  }

  const startNewChat = async ({ preserve = true }: { preserve?: boolean } = {}) => {
    if (preserve) await preserveCurrentChat()
    didInitialChatSelectionRef.current = true
    resetDraftChat()
  }

  const requestRenameChat = (chat: InsightChat) => {
    setRenameTarget(chat)
    setRenameTitle(chat.title)
  }

  const confirmRenameChat = async (event: FormEvent) => {
    event.preventDefault()
    const chat = renameTarget
    const title = renameTitle.trim()
    if (!chat || !title) return

    setRenameTarget(null)
    setRenameTitle('')

    if (isLocalChat(chat._id)) {
      setChats((current) =>
        current.map((item) => (item._id === chat._id ? { ...item, title } : item))
      )
      setChatNotice('Chat renamed.')
      return
    }

    try {
      const { data } = await api.patch(`/insight-chats/${chat._id}`, { title })
      const updatedChat = withMessageIds(data.chat)
      setChats((current) => current.map((item) => (item._id === updatedChat._id ? updatedChat : item)))
      if (activeChatIdRef.current === updatedChat._id) {
        setActiveChat(updatedChat._id)
      }
      setChatNotice('Chat renamed.')
    } catch {
      setChats((current) =>
        current.map((item) => (item._id === chat._id ? { ...item, title } : item))
      )
      setChatNotice('Chat renamed locally. Sync will retry when the API is available.')
    }
  }

  const archiveChat = async (chat: InsightChat, archived: boolean) => {
    if (isLocalChat(chat._id)) {
      setChats((current) =>
        current.map((item) => (item._id === chat._id ? { ...item, archived } : item))
      )
      if (archived && activeChatIdRef.current === chat._id) startNewChat({ preserve: false })
      return
    }

    try {
      const { data } = await api.patch(`/insight-chats/${chat._id}`, { archived })
      const updatedChat = withMessageIds(data.chat)
      setChats((current) => current.map((item) => (item._id === updatedChat._id ? updatedChat : item)))
      if (archived && activeChatIdRef.current === chat._id) startNewChat({ preserve: false })
    } catch {
      setChats((current) =>
        current.map((item) => (item._id === chat._id ? { ...item, archived } : item))
      )
      if (archived && activeChatIdRef.current === chat._id) startNewChat({ preserve: false })
    }
  }

  const requestDeleteChat = (chat: InsightChat) => {
    setDeleteTarget(chat)
  }

  const confirmDeleteChat = async () => {
    const chat = deleteTarget
    if (!chat) return

    setDeleteTarget(null)

    if (!isLocalChat(chat._id)) {
      try {
        await api.delete(`/insight-chats/${chat._id}`)
      } catch {
        // Optimistically remove the chat locally either way.
      }
    }

    setChats((current) => current.filter((item) => item._id !== chat._id))
    if (activeChatIdRef.current === chat._id) startNewChat({ preserve: false })
    setChatNotice(`Deleted "${chat.title}".`)
  }

  const sendPrompt = async (prompt: string) => {
    const trimmed = prompt.trim()
    if (!trimmed || isChatLoading) return

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    }
    const assistantId = `assistant-${Date.now()}`
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      pending: true,
    }
    const currentMessages = messagesRef.current
    const nextMessages = [...currentMessages, userMessage]

    scrollTargetMessageIdRef.current = userMessage.id
    setTrackedMessages([...nextMessages, assistantMessage])
    setInput('')
    isChatLoadingRef.current = true
    setIsChatLoading(true)

    try {
      const chatId = await ensureActiveChat(nextMessages)
      const payloadMessages = messagesForApi(nextMessages)
      let streamedAny = false

      try {
        const streamed = await streamAssistantMessage(assistantId, payloadMessages, () => {
          streamedAny = true
        })
        const stats = streamed.contextStats || contextStatsRef.current
        const finalMessages = [
          ...nextMessages,
          { ...assistantMessage, content: streamed.answer || 'I could not generate an answer.', pending: false },
        ]
        await saveChat(chatId, finalMessages, stats)
      } catch {
        if (streamedAny) {
          appendAssistantDelta(assistantId, '\n\nThe AI stream stopped before it finished.')
          finishAssistantMessage(assistantId)
          return
        }

        const { data } = await api.post('/forecasts/insights/chat', { messages: payloadMessages })
        setContextStats(data.contextStats || null)
        revealAssistantMessage(assistantId, data.answer || 'I could not generate an answer.')
        await saveChat(
          chatId,
          [
            ...nextMessages,
            { ...assistantMessage, content: data.answer || 'I could not generate an answer.', pending: false },
          ],
          data.contextStats || null
        )
      }
    } catch {
      revealAssistantMessage(
        assistantId,
        'I could not reach the AI analyst right now. Check that the backend is running and that ANTHROPIC_API_KEY is set.'
      )
    } finally {
      isChatLoadingRef.current = false
      setIsChatLoading(false)
    }
  }

  const actions = (
    <div className="flex items-center gap-3">
      {lastUpdated && (
        <div className="hidden sm:flex items-center gap-1.5 text-[#555555] text-xs">
          <Clock className="w-3 h-3" />
          <span>Updated {timeAgo(lastUpdated)}</span>
        </div>
      )}
      <Button
        variant="secondary"
        size="sm"
        onClick={() => loadInsights(true)}
        disabled={isRefreshing}
      >
        <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin')} />
        {isRefreshing ? 'Refreshing...' : 'Refresh'}
      </Button>
    </div>
  )

  return (
    <>
      <AppLayout
        title={
          <div className="flex items-center gap-2">
            <span>AI Insights</span>
            <Sparkles className="w-4 h-4 text-guava-red" />
          </div>
        }
        actions={actions}
      >
        <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1fr)_420px] 2xl:h-[calc(100vh-113px)] 2xl:min-h-0">
          <Card className="relative flex min-h-140 flex-col overflow-hidden 2xl:h-full 2xl:min-h-0">
            <CardHeader className="pb-3 border-b border-[#242424]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <img src={guavaIcon} alt="" className="h-5 w-5 object-contain" />
                    Ask Your Data
                  </CardTitle>
                  <CardDescription>
                    Business context includes locations, forecasts, events, items, and recent transactions.
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="flex items-center gap-1.5">
                  <img src={guavaIcon} alt="" className="h-3.5 w-3.5 object-contain" />
                  Guava AI
                </Badge>
              </div>
              <div className="flex flex-wrap gap-3 pt-3">
                <Stat icon={Database} label="Transactions" value={contextStats?.transactionCount ?? '-'} />
                <Stat icon={MapPin} label="Locations" value={contextStats?.locations ?? '-'} />
                <Stat icon={BarChart3} label="Forecasts" value={contextStats?.forecasts ?? '-'} />
              </div>
            </CardHeader>

            <CardContent className="flex min-h-0 flex-1 flex-col p-0">
              {!hasConversation ? (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-10">
                  <div className="mb-8 text-center">
                    <div className="mb-4 flex items-center justify-center gap-3">
                      <Sparkles className="h-7 w-7 text-guava-red" />
                      <h2 className="text-3xl font-semibold text-text">Ask your business data</h2>
                    </div>
                    <p className="mx-auto max-w-xl text-sm leading-relaxed text-[#777777]">
                      Query sales, prep, trading windows, locations, forecasts, and recent transactions.
                    </p>
                  </div>
                  <ChatComposer
                    input={input}
                    setInput={setInput}
                    sendPrompt={sendPrompt}
                    isChatLoading={isChatLoading}
                  />
                  <div className="mt-5 flex max-w-215 flex-wrap justify-center gap-2">
                    {QUICK_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => setInput(prompt)}
                        className="text-xs text-muted hover:text-text border border-border hover:border-[#3A3A3A] rounded-lg px-2.5 py-1.5 transition-colors"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div ref={chatScrollRef} className="min-h-0 flex-1 overflow-y-auto px-6 pb-64">
                    {messages
                      .filter((message) => message.id !== 'welcome')
                      .map((message) => (
                        <MessageRow
                          key={message.id}
                          message={message}
                          messageRef={(node) => setMessageNode(message.id, node)}
                        />
                      ))}
                    <div className="pb-10 pt-4">
                      <div className="flex flex-wrap gap-2">
                        {QUICK_PROMPTS.map((prompt) => (
                          <button
                            key={prompt}
                            type="button"
                            onClick={() => setInput(prompt)}
                            className="text-xs text-muted hover:text-text border border-border hover:border-[#3A3A3A] rounded-lg px-2.5 py-1.5 transition-colors"
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div ref={messagesEndRef} className="h-52" />
                  </div>
                  <ChatComposer
                    input={input}
                    setInput={setInput}
                    sendPrompt={sendPrompt}
                    isChatLoading={isChatLoading}
                    floating
                  />
                </>
              )}
            </CardContent>
          </Card>

          <div className="flex min-h-0 flex-col gap-5 2xl:h-full">
            <ChatHistoryPanel
              chats={chats}
              activeChatId={activeChatId}
              isLoading={isChatsLoading}
              notice={chatNotice}
              onNewChat={startNewChat}
              onSelectChat={applyChat}
              onRenameChat={requestRenameChat}
              onArchiveChat={archiveChat}
              onDeleteChat={requestDeleteChat}
            />

            <Card className="flex max-h-180 min-h-90 flex-col overflow-hidden 2xl:min-h-0 2xl:flex-1 2xl:max-h-none">
              <CardHeader className="shrink-0 pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-guava-red" />
                  Auto Analysis
                </CardTitle>
                <CardDescription>Generated from recent sales and upcoming signals.</CardDescription>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-y-auto">
                {!isLoading && !hasData && (
                  <div className="flex flex-col items-center justify-center min-h-65 text-center">
                    <div className="w-12 h-12 rounded-xl bg-[#111111] border border-border flex items-center justify-center mb-4">
                      <Sparkles className="w-6 h-6 text-[#555555]" />
                    </div>
                    <h2 className="text-text text-base font-semibold mb-2">No insights yet</h2>
                    <p className="text-[#555555] text-sm mb-5 max-w-xs">
                      Upload your transaction data to unlock AI-powered sales insights tailored to your cafe.
                    </p>
                    <Link to="/connect">
                      <Button>
                        <Upload className="w-4 h-4" />
                        Upload Sales Data
                      </Button>
                    </Link>
                  </div>
                )}

                {(isLoading || hasData) && (
                  <div>
                    {isLoading
                      ? Array.from({ length: 4 }).map((_, i) => <InsightSkeleton key={i} />)
                      : insights.map((insight, i) => (
                          <InsightCard key={insight.id} insight={insight} index={i} />
                        ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </AppLayout>

      {renameTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rename-chat-title"
        >
          <form
            onSubmit={confirmRenameChat}
            className="w-full max-w-md rounded-2xl border border-border bg-[#151515] p-5 shadow-2xl shadow-black/40"
          >
            <div className="mb-4">
              <h2 id="rename-chat-title" className="text-lg font-semibold text-text">Rename chat</h2>
              <p className="mt-1 text-sm text-muted">Give this conversation a clearer name.</p>
            </div>
            <input
              value={renameTitle}
              onChange={(event) => setRenameTitle(event.target.value)}
              className="w-full rounded-xl border border-border bg-[#101010] px-3 py-2.5 text-sm text-text outline-none transition-colors placeholder:text-[#666666] focus:border-guava-green"
              aria-label="Chat name"
              autoFocus
            />
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setRenameTarget(null)
                  setRenameTitle('')
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!renameTitle.trim()}>
                Save
              </Button>
            </div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-chat-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-[#151515] p-5 shadow-2xl shadow-black/40">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-guava-red/12 text-guava-red">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h2 id="delete-chat-title" className="text-lg font-semibold text-text">Delete chat?</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  Delete "{deleteTarget.title}"? This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button type="button" onClick={confirmDeleteChat} className="bg-guava-red hover:bg-guava-red/90">
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
