import type { ImagePage } from '../../types/image'

const IMAGES_URL = 'http://localhost:8000/images/'
const UPLOAD_URL = 'http://localhost:8000/images/upload'
const INITIAL_IMAGE_LIMIT = 24
const NEXT_IMAGE_LIMIT = 50
const PRIORITY_IMAGE_COUNT = 4

interface FetchImagesParams {
  cursor?: number
  limit?: number
}

const getErrorMessage = async (response: Response, fallbackMessage: string) => {
  const errorData = await response.json().catch(() => null)

  if (
    errorData &&
    typeof errorData === 'object' &&
    'detail' in errorData &&
    typeof errorData.detail === 'string'
  ) {
    return errorData.detail
  }

  return fallbackMessage
}

const preloadPriorityImages = (imagePage: ImagePage) => {
  if (typeof document === 'undefined') {
    return
  }

  imagePage.items.slice(0, PRIORITY_IMAGE_COUNT).forEach((image) => {
    const preloadId = `gallery-preload-${image.id}`

    if (document.querySelector(`link[data-preload-id="${preloadId}"]`)) {
      return
    }

    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'image'
    link.href = image.thumbnail_url
    link.setAttribute('data-preload-id', preloadId)
    link.setAttribute(
      'imagesizes',
      '(max-width: 640px) calc(100vw - 40px), (max-width: 1280px) calc(100vw - 80px), 1280px',
    )

    if (image.thumbnail_2x_url) {
      link.setAttribute(
        'imagesrcset',
        `${image.thumbnail_url} 320w, ${image.thumbnail_2x_url} 640w`,
      )
    }

    document.head.appendChild(link)
  })
}

export const fetchImages = async ({
  cursor,
  limit = cursor ? NEXT_IMAGE_LIMIT : INITIAL_IMAGE_LIMIT,
}: FetchImagesParams = {}): Promise<ImagePage> => {
  const url = new URL(IMAGES_URL)
  url.searchParams.set('limit', String(limit))

  if (cursor) {
    url.searchParams.set('cursor', String(cursor))
  }

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error('Failed to fetch images')
  }

  const imagePage = await response.json()

  if (!cursor) {
    preloadPriorityImages(imagePage)
  }

  return imagePage
}

export const uploadImage = async (file: File): Promise<void> => {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(UPLOAD_URL, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Failed to upload image'))
  }
}

export const deleteImage = async (id: number): Promise<void> => {
  const response = await fetch(`${IMAGES_URL}${id}`, { method: 'DELETE' })

  if (!response.ok) {
    throw new Error('Failed to delete image')
  }
}
