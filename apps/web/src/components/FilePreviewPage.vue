<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue'
import { ArrowLeft, Download, FileText } from 'lucide-vue-next'
import { formatFileSize, isFileId, type FileInfo } from '../files'

const props = defineProps<{ fileId: string }>()
const file = ref<FileInfo>()
const src = ref('')
const text = ref('')
const loading = ref(true)
const errorMessage = ref('')
const abortController = new AbortController()
let ownedBlobUrl = ''

const DocxPreview = defineAsyncComponent({
  loader: async () => {
    await import('@vue-office/docx/lib/v3/index.css')
    const component = await import('@vue-office/docx/lib/v3/vue-office-docx.mjs')
    return component.default
  },
  onError: (_error, _retry, fail) => {
    renderError()
    fail()
  },
})
const ExcelPreview = defineAsyncComponent({
  loader: async () => {
    await import('@vue-office/excel/lib/v3/index.css')
    const component = await import('@vue-office/excel/lib/v3/vue-office-excel.mjs')
    return component.default
  },
  onError: (_error, _retry, fail) => {
    renderError()
    fail()
  },
})
const PdfPreview = defineAsyncComponent({
  loader: async () => {
    const component = await import('@vue-office/pdf/lib/v3/vue-office-pdf.mjs')
    return component.default
  },
  onError: (_error, _retry, fail) => {
    renderError()
    fail()
  },
})
const PptxPreview = defineAsyncComponent({
  loader: async () => {
    const component = await import('@vue-office/pptx/lib/v3/vue-office-pptx.mjs')
    return component.default
  },
  onError: (_error, _retry, fail) => {
    renderError()
    fail()
  },
})

const imageTypes: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', avif: 'image/avif',
}
const extension = computed(() => file.value?.extension || '')
const image = computed(() => Boolean(imageTypes[extension.value]))
const plainText = computed(() => ['txt', 'md', 'json', 'csv', 'log'].includes(extension.value))
const officeComponent = computed(() => {
  switch (extension.value) {
    case 'docx': return DocxPreview
    case 'xlsx':
    case 'xls': return ExcelPreview
    case 'pdf': return PdfPreview
    case 'pptx': return PptxPreview
    default: return undefined
  }
})
const options = computed(() => ({ xls: extension.value === 'xls' }))

function renderError() {
  if (abortController.signal.aborted) {
    return
  }
  loading.value = false
  errorMessage.value = '文件预览失败，可下载后查看'
}

async function loadFile() {
  if (!isFileId(props.fileId)) {
    errorMessage.value = '文件链接无效'
    loading.value = false
    return
  }
  try {
    const metadataResponse = await fetch('/api/files/' + props.fileId, { signal: abortController.signal })
    if (!metadataResponse.ok) {
      throw new Error('文件不存在或无法访问')
    }
    file.value = await metadataResponse.json()
    document.title = (file.value?.name || '文件') + ' · 文件预览'
    if (!officeComponent.value && !image.value && !plainText.value) {
      loading.value = false
      errorMessage.value = ['doc', 'ppt'].includes(extension.value)
        ? '请转换为 DOCX / PPTX 格式后预览，或下载查看'
        : '此文件类型可下载后查看'
      return
    }
    const contentResponse = await fetch('/api/files/' + props.fileId + '/content', {
      signal: abortController.signal,
    })
    if (!contentResponse.ok) {
      throw new Error('读取文件失败，请重试')
    }
    if (plainText.value) {
      text.value = await contentResponse.text()
      loading.value = false
      return
    }
    const buffer = await contentResponse.arrayBuffer()
    if (abortController.signal.aborted) {
      return
    }
    const blob = new Blob([buffer], { type: imageTypes[extension.value] || 'application/octet-stream' })
    ownedBlobUrl = URL.createObjectURL(blob)
    src.value = ownedBlobUrl
  } catch (error) {
    if (!abortController.signal.aborted) {
      errorMessage.value = error instanceof Error ? error.message : '加载失败'
      loading.value = false
    }
  }
}

onMounted(loadFile)
onBeforeUnmount(() => {
  abortController.abort()
  if (ownedBlobUrl) {
    URL.revokeObjectURL(ownedBlobUrl)
  }
})
</script>

<template>
  <main class="file-preview-page">
    <header class="preview-toolbar">
      <a href="/" class="preview-back">
        <ArrowLeft :size="18" aria-hidden="true" />
        通话首页
      </a>
      <div class="preview-title">
        <h1>{{ file?.name || '文件预览' }}</h1>
        <span v-if="file">{{ formatFileSize(file.size) }}</span>
      </div>
      <a v-if="file" :href="'/api/files/' + file.id + '/content'" class="preview-download" download>
        <Download :size="18" aria-hidden="true" />
        下载
      </a>
    </header>
    <section class="preview-body" aria-label="文件内容">
      <p v-if="loading" class="preview-status" role="status">正在加载文件预览…</p>
      <div v-if="errorMessage" class="preview-status" role="alert">
        <FileText :size="36" aria-hidden="true" />
        <p>{{ errorMessage }}</p>
      </div>
      <component
        :is="officeComponent"
        v-if="src && officeComponent && !errorMessage"
        :src="src"
        :options="options"
        class="office-preview"
        @rendered="loading = false"
        @error="renderError"
      />
      <img
        v-if="src && image && !errorMessage"
        :src="src"
        :alt="file?.name"
        class="image-preview"
        @load="loading = false"
        @error="renderError"
      />
      <pre v-if="plainText && !loading && !errorMessage" class="text-preview">{{ text }}</pre>
    </section>
  </main>
</template>
