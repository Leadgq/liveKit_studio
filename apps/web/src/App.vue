<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import { ConnectionState, Room, RoomEvent, VideoPresets, type Participant } from 'livekit-client'
import { ArrowUpRight, AudioLines, Headphones, LogIn, LogOut, Mic, MicOff, Users, Video, VideoOff, Volume2 } from 'lucide-vue-next'
import ParticipantTile from './components/ParticipantTile.vue'
import RoomChat from './components/RoomChat.vue'

const roomName = ref('learning-room')
const displayName = ref('')
const room = shallowRef<Room>()
const participants = shallowRef<Participant[]>([])
const connectionState = ref<ConnectionState>(ConnectionState.Disconnected)
const joining = ref(false)
const deviceBusy = ref(false)
const audioBlocked = ref(false)
const errorMessage = ref('')
const revision = ref(0)
const connected = computed(() => connectionState.value === ConnectionState.Connected)
const inRoom = computed(() => Boolean(room.value) && !joining.value)
const microphoneEnabled = computed(() => {
  void revision.value
  return room.value?.localParticipant.isMicrophoneEnabled ?? false
})
const cameraEnabled = computed(() => {
  void revision.value
  return room.value?.localParticipant.isCameraEnabled ?? false
})
const statusText = computed(() => {
  if (joining.value) {
    return '正在加入'
  }
  if (connectionState.value === ConnectionState.Reconnecting ||
      connectionState.value === ConnectionState.SignalReconnecting) {
    return '重新连接中'
  }
  return connected.value ? '已连接' : '未连接'
})

function refreshParticipants(current: Room) {
  if (room.value !== current) {
    return
  }
  participants.value = [current.localParticipant, ...current.remoteParticipants.values()]
  revision.value++
}

function readError(error: unknown): string {
  return error instanceof Error ? error.message : '操作失败，请重试'
}

async function joinRoom() {
  if (joining.value || room.value) {
    return
  }
  joining.value = true
  errorMessage.value = ''
  let current: Room | undefined
  try {
    const response = await fetch('/api/rooms/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomName: roomName.value, displayName: displayName.value }),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || '获取入场凭证失败')
    }
    current = new Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: { resolution: VideoPresets.h360.resolution },
    })
    room.value = current
    const activeRoom = current
    const refresh = () => refreshParticipants(activeRoom)
    current.on(RoomEvent.ConnectionStateChanged, state => {
      if (room.value === activeRoom) {
        connectionState.value = state
      }
    })
    current.on(RoomEvent.Disconnected, reason => {
      if (room.value === activeRoom) {
        room.value = undefined
        participants.value = []
        audioBlocked.value = false
        errorMessage.value = '连接已断开，请重新加入。原因代码 ' + String(reason ?? '未知')
      }
    })
    current.on(RoomEvent.AudioPlaybackStatusChanged, () => {
      if (room.value === activeRoom) {
        audioBlocked.value = !activeRoom.canPlaybackAudio
      }
    })
    current.on(RoomEvent.ParticipantConnected, refresh)
    current.on(RoomEvent.ParticipantDisconnected, refresh)
    current.on(RoomEvent.TrackSubscribed, refresh)
    current.on(RoomEvent.TrackUnsubscribed, refresh)
    current.on(RoomEvent.TrackMuted, refresh)
    current.on(RoomEvent.TrackUnmuted, refresh)
    current.on(RoomEvent.LocalTrackPublished, refresh)
    current.on(RoomEvent.LocalTrackUnpublished, refresh)
    const serverUrl = new URL(data.serverUrl, window.location.origin)
    if (serverUrl.protocol === 'http:') {
      serverUrl.protocol = 'ws:'
    } else if (serverUrl.protocol === 'https:') {
      serverUrl.protocol = 'wss:'
    }
    await current.connect(serverUrl.toString(), data.token)
    refresh()
    audioBlocked.value = !current.canPlaybackAudio
  } catch (error) {
    if (room.value === current) {
      room.value = undefined
    }
    await current?.disconnect()
    participants.value = []
    connectionState.value = ConnectionState.Disconnected
    errorMessage.value = readError(error)
  } finally {
    joining.value = false
  }
}

async function leaveRoom() {
  const current = room.value
  room.value = undefined
  participants.value = []
  connectionState.value = ConnectionState.Disconnected
  audioBlocked.value = false
  await current?.disconnect()
}

function assertMediaCaptureAvailable() {
  if (!window.isSecureContext) {
    const mobileUrl = 'https://' + window.location.hostname + ':5174'
    throw new Error('当前页面不是安全上下文，请在 Safari 打开 ' + mobileUrl + '，并安装、完全信任开发证书')
  }
  if (typeof navigator.mediaDevices?.getUserMedia !== 'function') {
    throw new Error('当前浏览器未提供音视频采集能力，请使用 Safari，并检查证书信任及浏览器限制')
  }
}

async function toggleDevice(device: 'microphone' | 'camera') {
  const current = room.value
  if (!current || !connected.value || deviceBusy.value) {
    return
  }
  deviceBusy.value = true
  errorMessage.value = ''
  try {
    const enabled = device === 'microphone'
      ? !current.localParticipant.isMicrophoneEnabled
      : !current.localParticipant.isCameraEnabled
    if (enabled) {
      assertMediaCaptureAvailable()
    }
    if (device === 'microphone') {
      await current.localParticipant.setMicrophoneEnabled(enabled)
    } else {
      await current.localParticipant.setCameraEnabled(enabled)
    }
    refreshParticipants(current)
  } catch (error) {
    errorMessage.value = '设备开启失败：' + readError(error)
  } finally {
    deviceBusy.value = false
  }
}

async function enableAudio() {
  try {
    await room.value?.startAudio()
  } catch (error) {
    errorMessage.value = readError(error)
  }
}

onBeforeUnmount(() => {
  void leaveRoom()
})
</script>

<template>
  <div class="studio">
    <header class="topbar">
      <a class="brand" href="/">
        <span class="brand-mark">
          <AudioLines :size="22" aria-hidden="true" />
        </span>
        <span>LiveKit <strong>Studio</strong></span>
      </a>
      <span class="topbar-caption">通话实验室</span>
      <span class="connection-status" :class="{ online: connected }" role="status">
        <span class="status-dot"></span>
        {{ statusText }}
      </span>
    </header>

    <main class="workspace">
      <aside class="sidebar">
        <div>
          <p class="eyebrow">YOUR SPACE TO CONNECT</p>
          <h1>
            让对话
            <br />
            在这里发生。
          </h1>
          <p class="intro">选择一个房间，邀请另一位参与者，开始你的实时音视频实验。</p>
        </div>

        <form class="join-form" @submit.prevent="joinRoom">
          <label for="room-name">房间名称</label>
          <input
            id="room-name"
            v-model.trim="roomName"
            :disabled="Boolean(room) || joining"
            maxlength="64"
            pattern="[a-zA-Z0-9_-]+"
            title="支持英文、数字、下划线和短横线"
            required
          />
          <label for="display-name">你的称呼</label>
          <input
            id="display-name"
            v-model.trim="displayName"
            :disabled="Boolean(room) || joining"
            placeholder="例如：小林"
            maxlength="32"
            autocomplete="nickname"
            required
          />
          <button class="join-button" type="submit" :disabled="Boolean(room) || joining">
            <LogIn :size="18" aria-hidden="true" />
            <span>{{ joining ? '正在连接…' : inRoom ? '已加入房间' : '加入房间' }}</span>
            <ArrowUpRight :size="18" aria-hidden="true" />
          </button>
        </form>

        <p v-if="errorMessage" class="error-message" role="alert">{{ errorMessage }}</p>

        <div class="sidebar-note">
          <Headphones :size="20" aria-hidden="true" />
          <p>使用耳机体验更佳。加入后可自行开启麦克风和摄像头。</p>
        </div>
      </aside>

      <section class="room-panel" aria-label="通话房间">
        <div class="room-heading">
          <div>
            <p class="eyebrow">ROOM</p>
            <h2>{{ room?.name || roomName || '选择房间' }}</h2>
          </div>
          <span class="participant-count">
            <Users :size="17" aria-hidden="true" />
            {{ participants.length }} 人
          </span>
        </div>

        <div v-if="inRoom" class="participants-grid">
          <ParticipantTile
            v-for="participant in participants"
            :key="participant.identity"
            :participant="participant"
            :local="participant === room?.localParticipant"
            :revision="revision"
          />
          <div v-if="participants.length === 1" class="waiting-tile">
            <Users :size="28" aria-hidden="true" />
            <h3>等待下一位参与者</h3>
            <p>在另一个标签页输入相同房间名称即可加入。</p>
          </div>
        </div>
        <div v-else class="empty-stage">
          <div class="sound-symbol">
            <AudioLines :size="60" :stroke-width="1.4" aria-hidden="true" />
          </div>
          <h2>一个房间，无限可能。</h2>
          <p>从第一次连接开始，探索实时沟通。</p>
        </div>

        <button v-if="audioBlocked" class="audio-prompt" @click="enableAudio">
          <Volume2 :size="18" aria-hidden="true" />
          点击开启声音播放
        </button>

        <RoomChat v-if="inRoom && room" :room="room" :connected="connected" />

        <footer class="controls">
          <div class="control-buttons">
            <button
              class="control-button"
              :class="{ enabled: microphoneEnabled }"
              :disabled="!connected || deviceBusy"
              :aria-pressed="microphoneEnabled"
              :aria-label="microphoneEnabled ? '关闭麦克风' : '开启麦克风'"
              @click="toggleDevice('microphone')"
            >
              <Mic v-if="microphoneEnabled" :size="20" aria-hidden="true" />
              <MicOff v-else :size="20" aria-hidden="true" />
              <span>{{ microphoneEnabled ? '关闭麦克风' : '开启麦克风' }}</span>
            </button>
            <button
              class="control-button"
              :class="{ enabled: cameraEnabled }"
              :disabled="!connected || deviceBusy"
              :aria-pressed="cameraEnabled"
              :aria-label="cameraEnabled ? '关闭摄像头' : '开启摄像头'"
              @click="toggleDevice('camera')"
            >
              <Video v-if="cameraEnabled" :size="20" aria-hidden="true" />
              <VideoOff v-else :size="20" aria-hidden="true" />
              <span>{{ cameraEnabled ? '关闭摄像头' : '开启摄像头' }}</span>
            </button>
          </div>
          <button class="leave-button" :disabled="!inRoom || deviceBusy" @click="leaveRoom">
            <LogOut :size="18" aria-hidden="true" />
            离开房间
          </button>
        </footer>
      </section>
    </main>
  </div>
</template>
