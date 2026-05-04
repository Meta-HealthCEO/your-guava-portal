import { useState, useEffect, useCallback, useRef, type ComponentType, type ReactNode } from 'react'
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  RefreshCw,
  Clock,
  Upload,
  Send,
  User,
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
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
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
      <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
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
      <span className="text-[#888888]">{label}</span>
      <span className="text-[#F0F0F0] font-semibold tabular-nums">{value}</span>
    </div>
  )
}

function renderInlineMarkdown(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-semibold text-[#F0F0F0]">{part.slice(2, -2)}</strong>
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
        'grid overflow-hidden border-x border-b border-[#2A2A2A] first:rounded-t-lg last:rounded-b-lg',
        isHeader && 'border-t bg-[#202020] text-[#F0F0F0]'
      )}
      style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}
    >
      {cells.map((cell, cellIndex) => (
        <div
          key={`${index}-${cellIndex}`}
          className={cn(
            'px-3 py-2 text-xs border-r border-[#2A2A2A] last:border-r-0',
            isHeader ? 'font-semibold text-[#F0F0F0]' : 'text-[#D8D8D8]'
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
    <div className="space-y-2 text-sm leading-relaxed text-[#D8D8D8]">
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
            <h4 key={index} className={cn('text-[#F0F0F0] text-sm font-semibold', headingMargin)}>
              {renderInlineMarkdown(line.slice(4))}
            </h4>
          )
        }
        if (line.startsWith('## ')) {
          return (
            <h3 key={index} className={cn('text-[#F0F0F0] text-base font-semibold', headingMargin)}>
              {renderInlineMarkdown(line.slice(3))}
            </h3>
          )
        }
        if (line.startsWith('# ')) {
          return (
            <h2 key={index} className={cn('text-[#F0F0F0] text-lg font-semibold', headingMargin)}>
              {renderInlineMarkdown(line.slice(2))}
            </h2>
          )
        }
        if (/^[-*]\s+/.test(line)) {
          return (
            <div key={index} className="flex gap-2.5">
              <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-[#D43D3D]" />
              <p>{renderInlineMarkdown(line.replace(/^[-*]\s+/, ''))}</p>
            </div>
          )
        }
        if (/^\d+\.\s+/.test(line)) {
          const [num] = line.split('.')
          return (
            <div key={index} className="flex gap-2">
              <span className="text-[#888888] tabular-nums">{num}.</span>
              <p>{renderInlineMarkdown(line.replace(/^\d+\.\s+/, ''))}</p>
            </div>
          )
        }
        return <p key={index}>{renderInlineMarkdown(line)}</p>
      })}
      {streaming && <span className="inline-block w-1.5 h-4 bg-[#D43D3D] animate-pulse align-middle ml-1" />}
    </div>
  )
}

function MessageRow({ message }: { message: ChatMessage }) {
  const isAssistant = message.role === 'assistant'
  return (
    <div className="grid grid-cols-[32px_1fr] gap-4 py-5 border-b border-[#242424] last:border-0">
      <div
        className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center',
          isAssistant ? 'bg-[#D43D3D]/12 text-[#D43D3D]' : 'bg-[#222222] text-[#888888]'
        )}
      >
        {isAssistant ? (
          <img src={guavaIcon} alt="" className="h-5 w-5 object-contain" />
        ) : (
          <User className="w-4 h-4" />
        )}
      </div>
      <div className="min-w-0 pt-0.5">
        {isAssistant ? (
          <MarkdownLite text={message.content || 'Thinking...'} streaming={message.pending} />
        ) : (
          <p className="text-[#F0F0F0] text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        )}
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
        'mx-auto w-full max-w-[860px]',
        floating && 'absolute bottom-5 left-1/2 z-20 w-[calc(100%-2rem)] -translate-x-1/2'
      )}
    >
      <form
        className={cn(
          'rounded-2xl border border-[#303030] bg-[#151515]/95 shadow-2xl shadow-black/30 backdrop-blur',
          'p-3 transition-all',
          floating ? 'min-h-[112px]' : 'min-h-[150px]'
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
            'w-full resize-none border-0 bg-transparent px-2 py-2 text-[#F0F0F0] placeholder:text-[#777777]',
            'focus-visible:outline-none',
            floating ? 'min-h-[48px] text-sm' : 'min-h-[80px] text-base'
          )}
        />
        <div className="flex items-center justify-between px-1 pt-1">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#888888] transition-colors hover:bg-[#222222] hover:text-[#F0F0F0]"
            aria-label="Add context"
          >
            <Database className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-[#666666] sm:inline">Guava AI business analyst</span>
            <Button type="submit" size="icon" disabled={!input.trim() || isChatLoading}>
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
  onNewChat,
  onSelectChat,
  onRenameChat,
  onArchiveChat,
  onDeleteChat,
}: {
  chats: InsightChat[]
  activeChatId: string | null
  isLoading: boolean
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
          ? 'border-[#D43D3D]/35 bg-[#D43D3D]/10'
          : 'border-transparent hover:border-[#2A2A2A] hover:bg-[#202020]'
      )}
    >
      <button type="button" onClick={() => onSelectChat(chat)} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-medium text-[#F0F0F0]">{chat.title}</p>
        <p className="text-[11px] text-[#666666]">{timeAgo(chat.updatedAt)}</p>
      </button>
      <div className="flex shrink-0 items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={() => onRenameChat(chat)}
          className="rounded-md p-1.5 text-[#777777] hover:bg-[#2A2A2A] hover:text-[#F0F0F0]"
          aria-label="Rename chat"
        >
          <Edit3 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onArchiveChat(chat, !chat.archived)}
          className="rounded-md p-1.5 text-[#777777] hover:bg-[#2A2A2A] hover:text-[#F0F0F0]"
          aria-label={chat.archived ? 'Unarchive chat' : 'Archive chat'}
        >
          <Archive className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onDeleteChat(chat)}
          className="rounded-md p-1.5 text-[#777777] hover:bg-[#2A2A2A] hover:text-[#D43D3D]"
          aria-label="Delete chat"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )

  return (
    <Card className="flex max-h-[280px] min-h-[220px] flex-col overflow-hidden">
      <CardHeader className="shrink-0 pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Chats</CardTitle>
            <CardDescription>Saved Guava AI conversations.</CardDescription>
          </div>
          <Button type="button" size="sm" onClick={onNewChat}>
            <Plus className="h-3.5 w-3.5" />
            New
          </Button>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-y-auto space-y-3">
        {isLoading && <Skeleton className="h-10 w-full rounded-lg" />}
        {!isLoading && activeChats.length === 0 && archivedChats.length === 0 && (
          <p className="rounded-lg border border-[#2A2A2A] px-3 py-3 text-sm text-[#777777]">
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
  const timersRef = useRef<number[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const hasConversation = messages.some((message) => message.id !== 'welcome')

  const applyChat = useCallback((chat: InsightChat) => {
    const normalized = withMessageIds(chat)
    setActiveChatId(normalized._id)
    setMessages(normalized.messages.length ? normalized.messages : [WELCOME_MESSAGE])
    setContextStats(normalized.contextStats || null)
    setInput('')
  }, [])

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

      const savedActive = mergedChats.find((chat) => chat._id === activeChatId)
      const firstActive = mergedChats.find((chat) => !chat.archived)

      if (savedActive) {
        applyChat(savedActive)
      } else if (!hasConversation && firstActive) {
        applyChat(firstActive)
      }
    } catch {
      // Local storage keeps the current chat usable if the API is unavailable.
    } finally {
      setIsChatsLoading(false)
    }
  }, [activeChatId, applyChat, hasConversation])

  useEffect(() => {
    loadInsights()
  }, [loadInsights])

  useEffect(() => {
    loadChats()
  }, [loadChats])

  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    } else if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
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
    timersRef.current.forEach((timer) => window.clearInterval(timer))
  }, [])

  const revealAssistantMessage = (id: string, answer: string) => {
    let idx = 0
    const timer = window.setInterval(() => {
      idx = Math.min(idx + 4, answer.length)
      setMessages((current) =>
        current.map((message) =>
          message.id === id
            ? { ...message, content: answer.slice(0, idx), pending: idx < answer.length }
            : message
        )
      )
      if (idx >= answer.length) {
        window.clearInterval(timer)
      }
    }, 14)
    timersRef.current.push(timer)
  }

  const appendAssistantDelta = (id: string, text: string) => {
    setMessages((current) =>
      current.map((message) =>
        message.id === id
          ? { ...message, content: `${message.content}${text}`, pending: true }
          : message
      )
    )
  }

  const finishAssistantMessage = (id: string) => {
    setMessages((current) =>
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
    const response = await fetch(`${import.meta.env.VITE_API_URL}/forecasts/insights/chat/stream`, {
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
      setActiveChatId(localChat._id)
      setChats((current) => sortChats([localChat, ...current.filter((chat) => chat._id !== chatId)]))
    }
  }

  const ensureActiveChat = async (chatMessages: ChatMessage[]) => {
    if (activeChatId) return activeChatId

    try {
      const { data } = await api.post('/insight-chats', {
        title: titleFromMessages(chatMessages),
        messages: messagesForApi(chatMessages),
        contextStats: contextStats || undefined,
      })
      const createdChat = withMessageIds(data.chat)
      setChats((current) => sortChats([createdChat, ...current.filter((chat) => chat._id !== createdChat._id)]))
      setActiveChatId(createdChat._id)
      return createdChat._id
    } catch {
      const localChat = createLocalChat(chatMessages, contextStats)
      setChats((current) => sortChats([localChat, ...current.filter((chat) => chat._id !== localChat._id)]))
      setActiveChatId(localChat._id)
      return localChat._id
    }
  }

  const preserveCurrentChat = async () => {
    if (!hasConversation) return

    const currentMessages = messages.filter((message) => message.id !== 'welcome')
    if (currentMessages.length === 0) return

    if (activeChatId) {
      await saveChat(activeChatId, currentMessages, contextStats)
      return
    }

    const localChat = createLocalChat(currentMessages, contextStats)
    setChats((current) => sortChats([localChat, ...current.filter((chat) => chat._id !== localChat._id)]))
  }

  const startNewChat = async () => {
    await preserveCurrentChat()
    setActiveChatId(null)
    setMessages([WELCOME_MESSAGE])
    setContextStats(null)
    setInput('')
  }

  const renameChat = async (chat: InsightChat) => {
    const title = window.prompt('Rename chat', chat.title)
    if (!title?.trim()) return

    if (isLocalChat(chat._id)) {
      setChats((current) =>
        current.map((item) => (item._id === chat._id ? { ...item, title: title.trim() } : item))
      )
      return
    }

    try {
      const { data } = await api.patch(`/insight-chats/${chat._id}`, { title: title.trim() })
      const updatedChat = withMessageIds(data.chat)
      setChats((current) => current.map((item) => (item._id === updatedChat._id ? updatedChat : item)))
      if (activeChatId === updatedChat._id) {
        setActiveChatId(updatedChat._id)
      }
    } catch {
      setChats((current) =>
        current.map((item) => (item._id === chat._id ? { ...item, title: title.trim() } : item))
      )
    }
  }

  const archiveChat = async (chat: InsightChat, archived: boolean) => {
    if (isLocalChat(chat._id)) {
      setChats((current) =>
        current.map((item) => (item._id === chat._id ? { ...item, archived } : item))
      )
      if (archived && activeChatId === chat._id) startNewChat()
      return
    }

    try {
      const { data } = await api.patch(`/insight-chats/${chat._id}`, { archived })
      const updatedChat = withMessageIds(data.chat)
      setChats((current) => current.map((item) => (item._id === updatedChat._id ? updatedChat : item)))
      if (archived && activeChatId === chat._id) startNewChat()
    } catch {
      setChats((current) =>
        current.map((item) => (item._id === chat._id ? { ...item, archived } : item))
      )
      if (archived && activeChatId === chat._id) startNewChat()
    }
  }

  const deleteChat = async (chat: InsightChat) => {
    if (!window.confirm(`Delete "${chat.title}"?`)) return

    if (!isLocalChat(chat._id)) {
      try {
        await api.delete(`/insight-chats/${chat._id}`)
      } catch {
        // Optimistically remove the chat locally either way.
      }
    }

    setChats((current) => current.filter((item) => item._id !== chat._id))
    if (activeChatId === chat._id) startNewChat()
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
    const nextMessages = [...messages, userMessage]

    setMessages([...nextMessages, assistantMessage])
    setInput('')
    setIsChatLoading(true)

    try {
      const chatId = await ensureActiveChat(nextMessages)
      const payloadMessages = messagesForApi(nextMessages)
      let streamedAny = false

      try {
        const streamed = await streamAssistantMessage(assistantId, payloadMessages, () => {
          streamedAny = true
        })
        const stats = streamed.contextStats || contextStats
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
    <AppLayout
      title={
        <div className="flex items-center gap-2">
          <span>AI Insights</span>
          <Sparkles className="w-4 h-4 text-[#D43D3D]" />
        </div>
      }
      actions={actions}
    >
      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1fr)_420px] 2xl:h-[calc(100vh-113px)] 2xl:min-h-0">
        <Card className="relative flex min-h-[560px] flex-col overflow-hidden 2xl:h-full 2xl:min-h-0">
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
                    <Sparkles className="h-7 w-7 text-[#D43D3D]" />
                    <h2 className="text-3xl font-semibold text-[#F0F0F0]">Ask your business data</h2>
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
                <div className="mt-5 flex max-w-[860px] flex-wrap justify-center gap-2">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => setInput(prompt)}
                      className="text-xs text-[#888888] hover:text-[#F0F0F0] border border-[#2A2A2A] hover:border-[#3A3A3A] rounded-lg px-2.5 py-1.5 transition-colors"
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
                      <MessageRow key={message.id} message={message} />
                    ))}
                  <div className="pb-10 pt-4">
                    <div className="flex flex-wrap gap-2">
                    {QUICK_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => setInput(prompt)}
                        className="text-xs text-[#888888] hover:text-[#F0F0F0] border border-[#2A2A2A] hover:border-[#3A3A3A] rounded-lg px-2.5 py-1.5 transition-colors"
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
            onNewChat={startNewChat}
            onSelectChat={applyChat}
            onRenameChat={renameChat}
            onArchiveChat={archiveChat}
            onDeleteChat={deleteChat}
          />

          <Card className="flex max-h-[720px] min-h-[360px] flex-col overflow-hidden 2xl:min-h-0 2xl:flex-1 2xl:max-h-none">
            <CardHeader className="shrink-0 pb-3">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#D43D3D]" />
                Auto Analysis
              </CardTitle>
              <CardDescription>Generated from recent sales and upcoming signals.</CardDescription>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-y-auto">
              {!isLoading && !hasData && (
                <div className="flex flex-col items-center justify-center min-h-[260px] text-center">
                  <div className="w-12 h-12 rounded-xl bg-[#111111] border border-[#2A2A2A] flex items-center justify-center mb-4">
                    <Sparkles className="w-6 h-6 text-[#555555]" />
                  </div>
                  <h2 className="text-[#F0F0F0] text-base font-semibold mb-2">No insights yet</h2>
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
  )
}
