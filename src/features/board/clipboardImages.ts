function nameClipboardImage(file: File, mimeType: string, index: number) {
  const type = file.type || mimeType
  const extension = type.split('/')[1]?.split('+')[0]?.replace(/[^a-zA-Z0-9]/g, '') || 'img'
  const name = file.name || `imagen-pegada-${Date.now()}-${index + 1}.${extension}`

  if (file.name === name && file.type === type) return file
  return new File([file], name, { type, lastModified: file.lastModified })
}

export function getClipboardImages(clipboardData: DataTransfer) {
  const imagesFromItems = Array.from(clipboardData.items).flatMap((item, index) => {
    if (item.kind !== 'file') return []

    const file = item.getAsFile()
    const type = file?.type || item.type
    return file && type.startsWith('image/') ? [nameClipboardImage(file, type, index)] : []
  })

  if (imagesFromItems.length > 0) return imagesFromItems

  return Array.from(clipboardData.files).flatMap((file, index) =>
    file.type.startsWith('image/') ? [nameClipboardImage(file, file.type, index)] : [],
  )
}
