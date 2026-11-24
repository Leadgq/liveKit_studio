export interface SharedFile {
  id: string
  name: string
  size: number
}

export interface FileInfo extends SharedFile {
  extension: string
}

export function isFileId(value: unknown): value is string {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function isSharedFile(value: unknown): value is SharedFile {
  if (!value || typeof value !== 'object') {
    return false
  }
  const file = value as Record<string, unknown>
  return isFileId(file.id) && typeof file.name === 'string' && file.name.length > 0 &&
    file.name.length <= 255 && typeof file.size === 'number' &&
    Number.isSafeInteger(file.size) && file.size >= 0 && file.size <= 20 * 1024 * 1024
}

export function formatFileSize(size: number): string {
  if (size < 1024) {
    return size + ' B'
  }
  if (size < 1024 * 1024) {
    return (size / 1024).toFixed(1) + ' KB'
  }
  return (size / (1024 * 1024)).toFixed(1) + ' MB'
}
