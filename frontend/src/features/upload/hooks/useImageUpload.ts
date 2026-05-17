import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../../lib/queryKeys'

const SUCCESS_MESSAGE_VISIBLE_MS = 3000

export const useImageUpload = () => {
  const queryClient = useQueryClient()
  const [error, setError] = useState<Error | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [successfulUploadCount, setSuccessfulUploadCount] = useState(0)

  useEffect(() => {
    if (!showSuccess) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setShowSuccess(false)
    }, SUCCESS_MESSAGE_VISIBLE_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [showSuccess])

  const handleUploadComplete = async (uploadedFileCount: number) => {
    if (uploadedFileCount <= 0) {
      return
    }

    setError(null)
    setSuccessfulUploadCount(uploadedFileCount)
    setShowSuccess(true)
    await queryClient.invalidateQueries({ queryKey: queryKeys.images })
  }

  const handleUploadError = (error: Error) => {
    setShowSuccess(false)
    setError(error)
  }

  return {
    error,
    showSuccess,
    successfulUploadCount,
    handleUploadComplete,
    handleUploadError,
  }
}
