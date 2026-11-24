<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { ConnectionState, Room, RoomEvent, type RemoteParticipant } from 'livekit-client'
import { FileText, MessageCircle, Paperclip, Send } from 'lucide-vue-next'
import { formatFileSize, isSharedFile, type SharedFile } from '../files'

interface ChatContent {
  text: string
  file?: SharedFile
}

interface ChatMessage extends ChatContent {
  id: string
  sender: string
  own: boolean
}

const props = defineProps<{ room: Room; connected: boolean }>()
const messages = ref<ChatMessage[]>([])
const draft = ref('')
const sending = ref(false)
const uploading = ref(false)
const pendingFile = ref<SharedFile>()
const errorMessage = ref('')
const messageList = ref<HTMLDivElement>()
const fileInput = ref<HTMLInputElement>()
const topic = 'studio-chat'
const encoder = new TextEncoder()
const decoder = new TextDecoder()
let mounted = true
let uploadController: AbortController | undefined

async function appendMessage(message: ChatMessage) {
  messages.value.push(message)
  await nextTick()
  const element = messageList.value
  if (element) {
    element.scrollTop = element.scrollHeight
  }
}

function receiveMessage(
  payload: Uint8Array,
  participant?: RemoteParticipant,
  _kind?: unknown,
  messageTopic?: string,
) {
  if (messageTopic !== topic || !participant || payload.byteLength > 8192) {
    return
  }
  let data: unknown
  try {
    data = JSON.parse(decoder.decode(payload))
  } catch {
    return
  }
  if (!data || typeof data !== 'object') {
    return
  }
  const input = data as Record<string, unknown>
  if (typeof input.id !== 'string' || !input.id || input.id.length > 64) {
    return
  }
  let content: ChatContent
  if (input.type === 'file' && isSharedFile(input.file)) {
    content = { text: input.file.name, file: input.file }
  } else if (input.type !== 'file' && typeof input.text === 'string' &&
      input.text.trim() && input.text.length <= 1000) {
    content = { text: input.text }
  } else {
    return
  }
  void appendMessage({
    ...content,
    id: participant.identity + ':' + input.id,
    sender: participant.name || participant.identity,
    own: false,
  })
}

function canSend() {
  return props.connected && props.room.state === ConnectionState.Connected && !sending.value && !uploading.value
}

async function publishContent(current: Room, content: ChatContent) {
  if (!mounted || props.room !== current || current.state !== ConnectionState.Connected) {
    throw new Error('房间连接已变化，请重新发送')
  }
  const id = crypto.randomUUID()
  const packet = content.file
    ? { id, type: 'file', file: content.file }
    : { id, text: content.text }
  const payload = encoder.encode(JSON.stringify(packet))
  await current.localParticipant.publishData(payload, { reliable: true, topic })
  if (!mounted || props.room !== current) {
    return
  }
  await appendMessage({
    ...content,
    id: current.localParticipant.identity + ':' + id,
    sender: current.localParticipant.name || '我',
    own: true,
  })
}

function showError(error: unknown) {
  const detail = error instanceof Error ? error.message : '请重试'
  errorMessage.value = '发送失败：' + detail
}

async function sendMessage() {
  const current = props.room
  const text = draft.value.trim()
  if (!canSend() || !text) {
    return
  }
  if (text.length > 1000) {
    errorMessage.value = '消息最多可输入 1000 个字符'
    return
  }
  const originalDraft = draft.value
  sending.value = true
  errorMessage.value = ''
  try {
    await publishContent(current, { text })
    if (mounted && props.room === current && draft.value === originalDraft) {
      draft.value = ''
    }
  } catch (error) {
    if (mounted && props.room === current) {
      showError(error)
    }
  } finally {
    if (props.room === current) {
      sending.value = false
    }
  }
}

async function uploadFile(event: Event) {
  const input = event.target as HTMLInputElement
  const selected = input.files?.[0]
  input.value = ''
  if (!selected || !canSend()) {
    return
  }
  if (selected.size > 20 * 1024 * 1024) {
    errorMessage.value = '单个文件最多支持 20MB'
    return
  }
  const current = props.room
  uploading.value = true
  errorMessage.value = ''
  uploadController = new AbortController()
  try {
    const formData = new FormData()
    formData.append('file', selected)
    const response = await fetch('/api/files', {
      method: 'POST',
      body: formData,
      signal: uploadController.signal,
    })
    const result = await response.json()
    if (!response.ok) {
      throw new Error(result.message || '文件上传失败')
    }
    if (!mounted || props.room !== current) {
      return
    }
    if (!isSharedFile(result)) {
      throw new Error('文件信息格式错误')
    }
    pendingFile.value = { id: result.id, name: result.name, size: result.size }
    await publishContent(current, { text: result.name, file: pendingFile.value })
    if (mounted && props.room === current && pendingFile.value?.id === result.id) {
      pendingFile.value = undefined
    }
  } catch (error) {
    if (mounted && props.room === current) {
      showError(error)
    }
  } finally {
    if (props.room === current) {
      uploading.value = false
    }
  }
}

async function retryFile() {
  if (!canSend() || !pendingFile.value) {
    return
  }
  const current = props.room
  const storedFile = pendingFile.value
  sending.value = true
  errorMessage.value = ''
  try {
    await publishContent(current, { text: storedFile.name, file: storedFile })
    if (mounted && props.room === current && pendingFile.value?.id === storedFile.id) {
      pendingFile.value = undefined
    }
  } catch (error) {
    if (mounted && props.room === current) {
      showError(error)
    }
  } finally {
    if (props.room === current) {
      sending.value = false
    }
  }
}

watch(() => props.room, (current, previous) => {
  previous?.off(RoomEvent.DataReceived, receiveMessage)
  uploadController?.abort()
  messages.value = []
  draft.value = ''
  pendingFile.value = undefined
  errorMessage.value = ''
  sending.value = false
  uploading.value = false
  current.on(RoomEvent.DataReceived, receiveMessage)
}, { immediate: true })

onBeforeUnmount(() => {
  mounted = false
  uploadController?.abort()
  props.room.off(RoomEvent.DataReceived, receiveMessage)
})
</script>

<template>
  <section class="room-chat" aria-label="房间聊天">
    <header class="chat-heading">
      <h3>
        <MessageCircle :size="17" aria-hidden="true" />
        房间聊天
      </h3>
      <span>文件上限 20MB · 消息仅保留在本次会话</span>
    </header>
    <div ref="messageList" class="chat-messages" role="log" aria-live="polite" aria-relevant="additions">
      <p v-if="!messages.length" class="chat-empty">发送文字或文件，和房间里的伙伴分享。</p>
      <article
        v-for="message in messages"
        :key="message.id"
        class="chat-message"
        :class="{ own: message.own }"
      >
        <span class="chat-sender">{{ message.sender }}{{ message.own ? '（我）' : '' }}</span>
        <a
          v-if="message.file"
          :href="'/files/' + message.file.id"
          target="_blank"
          rel="noopener noreferrer"
          class="chat-file"
          :aria-label="'在新页面预览 ' + message.file.name"
        >
          <FileText :size="24" aria-hidden="true" />
          <span>
            <strong>{{ message.file.name }}</strong>
            <small>{{ formatFileSize(message.file.size) }} · 点击预览</small>
          </span>
        </a>
        <p v-else>{{ message.text }}</p>
      </article>
    </div>
    <form class="chat-compose" @submit.prevent="sendMessage">
      <input ref="fileInput" type="file" class="visually-hidden" tabindex="-1" @change="uploadFile" />
      <button
        type="button"
        :disabled="!connected || sending || uploading"
        aria-label="选择并分享文件，单个文件最多 20MB"
        title="分享文件"
        @click="fileInput?.click()"
      >
        <Paperclip :size="18" aria-hidden="true" />
        <span v-if="uploading">上传中</span>
      </button>
      <label class="visually-hidden" for="chat-message">聊天消息</label>
      <input
        id="chat-message"
        v-model="draft"
        placeholder="发送消息给房间内的所有人…"
        maxlength="1000"
        autocomplete="off"
        :disabled="!connected"
        aria-describedby="chat-error"
      />
      <button type="submit" :disabled="!connected || sending || uploading || !draft.trim()" aria-label="发送消息">
        <Send :size="17" aria-hidden="true" />
        {{ sending ? '发送中' : '发送' }}
      </button>
    </form>
    <button
      v-if="pendingFile && !uploading"
      class="file-retry"
      :disabled="!connected || sending"
      @click="retryFile"
    >
      重试分享 {{ pendingFile.name }}
    </button>
    <p v-if="errorMessage" id="chat-error" class="chat-error" role="alert">{{ errorMessage }}</p>
  </section>
</template>
