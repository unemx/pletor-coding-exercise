import type { ImagePage } from '../../types/image'

const IMAGES_URL = 'http://localhost:8000/images/'
const UPLOAD_URL = 'http://localhost:8000/images/upload'
const DEFAULT_IMAGE_LIMIT = 50

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

export const fetchImages = async ({
  cursor,
  limit = DEFAULT_IMAGE_LIMIT,
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

  return response.json()
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
