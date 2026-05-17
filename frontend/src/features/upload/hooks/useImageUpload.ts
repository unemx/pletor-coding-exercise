import { useEffect, useState } from 'react'
import { uploadImage } from '../../../lib/api/images'

const SUCCESS_MESSAGE_VISIBLE_MS = 3000

interface UseImageUploadOptions {
  onUploadSuccess: () => Promise<void> | void
}

export const useImageUpload = ({ onUploadSuccess }: UseImageUploadOptions) => {
  const [error, setError] = useState<Error | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)

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

  const upload = async (file: File) => {
    setError(null)
    await uploadImage(file)
    setShowSuccess(true)
    await onUploadSuccess()
  }

  const handleUploadError = (error: Error) => {
    setError(error)
  }

  return {
    error,
    showSuccess,
    upload,
    handleUploadError,
  }
}
