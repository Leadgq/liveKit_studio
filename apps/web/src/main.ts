import { createApp, defineAsyncComponent } from 'vue'
import App from './App.vue'
import './style.css'

const previewPath = window.location.pathname.match(/^\/files\/([^/]+)$/)
if (previewPath) {
  const FilePreviewPage = defineAsyncComponent(() => import('./components/FilePreviewPage.vue'))
  createApp(FilePreviewPage, { fileId: previewPath[1] }).mount('#app')
} else {
  createApp(App).mount('#app')
}
