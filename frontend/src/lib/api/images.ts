import type { Image } from '../../types/image'

const IMAGES_URL = 'http://localhost:8000/images/'
const UPLOAD_URL = 'http://localhost:8000/images/upload'

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

export const fetchImages = async (): Promise<Image[]> => {
  const response = await fetch(IMAGES_URL)

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

export const deleteImage = async (id: string): Promise<void> => {
  const response = await fetch(`${IMAGES_URL}${id}`, { method: 'DELETE' })

  if (!response.ok) {
    throw new Error('Failed to delete image')
  }
}
