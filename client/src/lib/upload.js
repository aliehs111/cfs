// Shared photo/video upload helpers (In the Field posts and Admin → Projects).
// Files go straight from the browser to Supabase Storage through a signed URL
// the server issues, so large files never pass through our API.

const MAX_IMAGE_DIMENSION = 2400

const EXT_TYPES = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
}

export function fileType(file) {
  if (file.type) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase()
  return EXT_TYPES[ext] || ''
}

// Shrink phone photos (often 4000px+, 5–12 MB) before upload so posting
// works on a weak job-site signal. Falls back to the original if the
// browser can't decode it.
export async function prepareImage(file) {
  const type = fileType(file)
  if (type === 'image/gif') return { blob: file, type }
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = reject
      el.src = url
    })
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight))
    if (scale === 1 && file.size < 2.5 * 1024 * 1024) return { blob: file, type }
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    return blob ? { blob, type: 'image/jpeg' } : { blob: file, type }
  } catch {
    return { blob: file, type }
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function putWithProgress(url, blob, type, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', type)
    xhr.setRequestHeader('x-upsert', 'false')
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total)
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`upload ${xhr.status}`)))
    xhr.onerror = () => reject(new Error('network'))
    xhr.send(blob)
  })
}

