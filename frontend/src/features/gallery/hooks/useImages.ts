import { useCallback, useEffect, useState } from 'react'
import { deleteImage, fetchImages } from '../../../lib/api/images'
import type { Image } from '../../../types/image'

const toError = (error: unknown, fallbackMessage: string) => {
  return error instanceof Error ? error : new Error(fallbackMessage)
}

export const useImages = () => {
  const [images, setImages] = useState<Image[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const refreshImages = useCallback(async () => {
    setLoading(true)

    try {
      setImages(await fetchImages())
      setError(null)
    } catch (error) {
      setError(toError(error, 'Failed to fetch images'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshImages()
  }, [refreshImages])

  const handleDeleteImage = async (id: string) => {
    setError(null)
    setDeletingId(id)

    try {
      await deleteImage(id)
      await refreshImages()
    } catch (error) {
      setError(toError(error, 'Delete failed'))
    } finally {
      setDeletingId(null)
    }
  }

  return {
    images,
    loading,
    error,
    deletingId,
    refreshImages,
    deleteImage: handleDeleteImage,
  }
}
