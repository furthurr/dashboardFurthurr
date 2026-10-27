export function getStorageObjectPath(fileUrl: string): string | null {
  try {
    const pathname = new URL(fileUrl).pathname
    const bucketMarker = '/task-attachments/'
    const bucketIndex = pathname.indexOf(bucketMarker)
    if (bucketIndex < 0) return null
    return decodeURIComponent(pathname.slice(bucketIndex + bucketMarker.length)) || null
  } catch {
    return null
  }
}
