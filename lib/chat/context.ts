import crypto from 'node:crypto'

import { prisma } from '@/lib/db/prisma'
import { saveDocumentBase64, saveImageBase64 } from '@/lib/files/storage'
import { extractAttachmentSummary } from '@/lib/attachments/extract'
import type { ChatRequestInput } from '@/lib/chat/schema'
import { ContentPart, deserializeContent, partsToPlainText, serializeContent } from '@/lib/chat/messages'
import { HttpError } from '@/lib/http/errors'
import type { ConversationTurn } from '@/lib/agent/runner'

const ATTACHMENT_CONTEXT_LIMIT = 5
const FALLBACK_ATTACHMENT_NOTE = 'متن استخراج نشد.'

export interface AttachmentMeta {
  name?: string | null
  mime?: string | null
  size?: number | null
  summary?: string | null
}

export interface PreparedChatContext {
  sessionChatId: string
  history: ConversationTurn[]
  userPlainText: string
  attachmentContext: AttachmentMeta[]
}

function ensureParts(parts: ContentPart[]) {
  if (!parts.length) {
    throw new HttpError(400, 'لطفاً پیام یا فایل ارسال کنید.')
  }
}

async function summarizeAttachments(userId: string, chatId: string): Promise<AttachmentMeta[]> {
  const records = await prisma.chatAttachment.findMany({
    where: { userId, chatId },
    orderBy: { createdAt: 'desc' },
    take: ATTACHMENT_CONTEXT_LIMIT,
  })
  return records.map((att) => ({
    name: att.fileName,
    mime: att.mimeType,
    size: att.sizeBytes,
    summary: att.summary || FALLBACK_ATTACHMENT_NOTE,
  }))
}

export async function prepareChatContext(userId: string, body: ChatRequestInput): Promise<PreparedChatContext> {
  const session = await prisma.chatSession.upsert({
    where: { userId_chatId: { userId, chatId: body.chat_id } },
    update: {},
    create: { userId, chatId: body.chat_id },
  })

  const existingMessages = await prisma.message.findMany({
    where: { userId, chatId: body.chat_id },
    orderBy: { timestamp: 'asc' },
  })

  const parts: ContentPart[] = []
  if (body.message && body.message.trim()) {
    parts.push({ type: 'text', text: body.message.trim() })
  }

  if (body.images) {
    for (const image of body.images) {
      if (image?.base64) {
        const saved = saveImageBase64(image.base64, image.mime_type)
        parts.push({ type: 'image_url', image_url: { url: saved.url } })
      } else if (image?.url) {
        parts.push({ type: 'image_url', image_url: { url: image.url } })
      }
    }
  }

  if (body.attachments) {
    for (const attachment of body.attachments) {
      if (attachment?.base64) {
        const saved = saveDocumentBase64(attachment.base64, attachment.mime_type)
        const record = await prisma.chatAttachment.create({
          data: {
            id: crypto.randomUUID(),
            userId,
            chatId: session.chatId,
            fileName: attachment.filename || saved.filename,
            mimeType: saved.mime,
            fileUrl: saved.url,
            sizeBytes: saved.size,
          },
        })
        const summary = await extractAttachmentSummary(saved.absolutePath, saved.mime)
        if (summary) {
          await prisma.chatAttachment.update({ where: { id: record.id }, data: { summary } })
        }
        parts.push({
          type: 'file',
          url: saved.url,
          name: attachment.filename || saved.filename,
          mime_type: saved.mime,
        })
      } else if (attachment?.url) {
        parts.push({ type: 'file', url: attachment.url, name: attachment.filename, mime_type: attachment.mime_type })
      }
    }
  }

  ensureParts(parts)

  await prisma.message.create({
    data: {
      id: crypto.randomUUID(),
      userId,
      chatId: body.chat_id,
      role: 'user',
      content: serializeContent(parts),
    },
  })

  const history: ConversationTurn[] = existingMessages.map((msg) => ({
    role: msg.role === 'assistant' ? 'assistant' : 'user',
    content: partsToPlainText(deserializeContent(msg.content)),
  }))

  return {
    sessionChatId: session.chatId,
    history,
    userPlainText: partsToPlainText(parts),
    attachmentContext: await summarizeAttachments(userId, session.chatId),
  }
}
