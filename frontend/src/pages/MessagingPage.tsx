import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Mail, Send, Archive, Search, Pencil, X, Reply, Ban } from 'lucide-react'
import { useAppTitle } from '@/hooks/useAppTitle'
import { useMessaging, Message, MessageFolder, ComposeData } from '@/hooks/useMessaging'
import { useWallet } from '@/context/WalletContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate } from '@/lib/helpers'

function ComposeModal({
  initial,
  onSend,
  onClose
}: {
  initial?: Partial<ComposeData>
  onSend: (data: ComposeData) => Promise<void>
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [to, setTo] = useState(initial?.to ?? '')
  const [subject, setSubject] = useState(initial?.subject ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    if (!to.trim() || !subject.trim() || !body.trim()) return
    setSending(true)
    try {
      await onSend({
        to: to.trim(),
        subject: subject.trim(),
        body: body.trim(),
        threadId: initial?.threadId
      })
      onClose()
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold">{t('messaging.composeMessage')}</h2>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-3 p-4">
          <input
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder={t('messaging.toAddress')}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <input
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder={t('messaging.subject')}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <textarea
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            rows={5}
            placeholder={t('messaging.messagePlaceholder')}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSend} disabled={sending || !to || !subject || !body}>
              <Send className="mr-2 h-4 w-4" />{' '}
              {sending ? t('messaging.sending') : t('messaging.send')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MessageRow({
  msg,
  onSelect,
  onArchive,
  onBlock
}: {
  msg: Message
  onSelect: (m: Message) => void
  onArchive: (id: string) => void
  onBlock: (addr: string) => void
}) {
  return (
    <div
      className={`flex cursor-pointer items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted/50 ${!msg.read ? 'font-medium' : ''}`}
      onClick={() => onSelect(msg)}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {!msg.read && <span className="h-2 w-2 rounded-full bg-primary" />}
          <span className="truncate">{msg.subject}</span>
        </div>
        <p className="truncate text-xs text-muted-foreground">{msg.from}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <span className="text-xs text-muted-foreground">{formatDate(msg.createdAt / 1000)}</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation()
            onArchive(msg.id)
          }}
        >
          <Archive className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation()
            onBlock(msg.from)
          }}
        >
          <Ban className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}

export function MessagingPage() {
  const { t } = useTranslation()
  useAppTitle(t('messaging.title'))
  const { address } = useWallet()
  const {
    isLoading,
    unreadCount,
    getFolder,
    sendMessage,
    markRead,
    archiveMessage,
    blockUser,
    searchMessages
  } = useMessaging(address)

  const [folder, setFolder] = useState<MessageFolder>('inbox')
  const [selected, setSelected] = useState<Message | null>(null)
  const [composing, setComposing] = useState<Partial<ComposeData> | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<Message[] | null>(null)

  const handleSelect = async (msg: Message) => {
    setSelected(msg)
    if (!msg.read) await markRead(msg.id)
  }

  const handleSearch = async () => {
    const results = await searchMessages(searchTerm)
    setSearchResults(results)
  }

  const handleReply = () => {
    if (!selected) return
    setComposing({
      to: selected.from,
      subject: t('messaging.replySubject', { subject: selected.subject }),
      threadId: selected.threadId
    })
  }

  const messages = searchResults ?? getFolder(folder)

  if (!address) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        {t('messaging.connectWallet')}
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">{t('messaging.title')}</h1>
          {unreadCount > 0 && <Badge>{t('messaging.unreadCount', { count: unreadCount })}</Badge>}
        </div>
        <Button onClick={() => setComposing({})}>
          <Pencil className="mr-2 h-4 w-4" /> {t('messaging.compose')}
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
          placeholder={t('messaging.searchPlaceholder')}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value)
            if (!e.target.value) setSearchResults(null)
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button variant="outline" onClick={handleSearch}>
          <Search className="h-4 w-4" />
        </Button>
        {searchResults && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearchResults(null)
              setSearchTerm('')
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        {/* Folder sidebar */}
        <div className="w-36 shrink-0 space-y-1">
          {(['inbox', 'sent', 'archived'] as MessageFolder[]).map((f) => (
            <button
              key={f}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm capitalize transition-colors ${folder === f && !searchResults ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              onClick={() => {
                setFolder(f)
                setSearchResults(null)
                setSearchTerm('')
              }}
            >
              {f === 'inbox' && <Mail className="h-4 w-4" />}
              {f === 'sent' && <Send className="h-4 w-4" />}
              {f === 'archived' && <Archive className="h-4 w-4" />}
              {t(`messaging.folders.${f}`)}
            </button>
          ))}
        </div>

        {/* Message list */}
        <Card className="flex min-h-0 flex-1 flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm capitalize">
              {searchResults
                ? t('messaging.searchResults', { count: searchResults.length })
                : t(`messaging.folders.${folder}`)}
            </CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-y-auto space-y-2">
            {isLoading && (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded bg-muted" />
                ))}
              </div>
            )}
            {!isLoading && messages.length === 0 && (
              <EmptyState
                icon={Mail}
                title={t('messaging.noMessages')}
                description={t('messaging.nothingHere')}
              />
            )}
            {messages.map((msg) => (
              <MessageRow
                key={msg.id}
                msg={msg}
                onSelect={handleSelect}
                onArchive={archiveMessage}
                onBlock={blockUser}
              />
            ))}
          </CardContent>
        </Card>

        {/* Message detail */}
        {selected && (
          <Card className="flex min-h-0 w-96 shrink-0 flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-sm">{selected.subject}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {t('messaging.from', { address: selected.from })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(selected.createdAt / 1000)}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-y-auto">
              <p className="whitespace-pre-wrap text-sm">{selected.body}</p>
            </CardContent>
            <div className="border-t p-3">
              <Button size="sm" onClick={handleReply}>
                <Reply className="mr-2 h-3 w-3" /> {t('messaging.reply')}
              </Button>
            </div>
          </Card>
        )}
      </div>

      {composing !== null && (
        <ComposeModal initial={composing} onSend={sendMessage} onClose={() => setComposing(null)} />
      )}
    </div>
  )
}
