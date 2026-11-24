<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { Track, type Participant } from 'livekit-client'
import { MicOff, VideoOff } from 'lucide-vue-next'

const props = defineProps<{ participant: Participant; local: boolean; revision: number }>()
const mediaContainer = ref<HTMLDivElement>()
const hasVideo = ref(false)
let attachments: Array<{ track: Track; element: HTMLMediaElement }> = []

function detachMedia() {
  for (const { track, element } of attachments) {
    track.detach(element)
    element.remove()
  }
  attachments = []
}

function attachMedia() {
  detachMedia()
  const container = mediaContainer.value
  if (!container) {
    return
  }
  hasVideo.value = false
  for (const publication of props.participant.trackPublications.values()) {
    const track = publication.track
    if (!track || publication.isMuted || (props.local && track.kind === Track.Kind.Audio)) {
      continue
    }
    if (track.kind !== Track.Kind.Audio && track.kind !== Track.Kind.Video) {
      continue
    }
    const element = track.attach()
    if (props.local) {
      element.muted = true
    }
    container.appendChild(element)
    attachments.push({ track, element })
    if (track.kind === Track.Kind.Video) {
      hasVideo.value = true
    }
  }
}

watch(() => [props.participant, props.revision, mediaContainer.value], attachMedia, {
  immediate: true,
  flush: 'post',
})
onBeforeUnmount(detachMedia)
</script>

<template>
  <article class="participant-tile">
    <div v-if="!hasVideo" class="avatar-stage">
      <div class="avatar">{{ (participant.name || participant.identity).slice(0, 1).toUpperCase() }}</div>
      <span>摄像头已关闭</span>
    </div>
    <div ref="mediaContainer" class="media-container" :class="{ mirrored: local }"></div>
    <div class="participant-label">
      <span>{{ participant.name || participant.identity }}{{ local ? '（我）' : '' }}</span>
      <MicOff v-if="!participant.isMicrophoneEnabled" :size="15" aria-label="麦克风已关闭" />
      <VideoOff v-if="!hasVideo" :size="15" aria-label="摄像头已关闭" />
    </div>
  </article>
</template>
