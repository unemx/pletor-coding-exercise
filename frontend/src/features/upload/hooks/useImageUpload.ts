import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { uploadImage } from '../../../lib/api/images'
import { queryKeys } from '../../../lib/queryKeys'

const SUCCESS_MESSAGE_VISIBLE_MS = 3000

const toError = (error: unknown, fallbackMessage: string) => {
  return error instanceof Error ? error : new Error(fallbackMessage)
}

export const useImageUpload = () => {
  const queryClient = useQueryClient()
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

  const uploadImageMutation = useMutation({
    mutationFn: uploadImage,
    onMutate: () => {
      setError(null)
      setShowSuccess(false)
    },
    onSuccess: async () => {
      setShowSuccess(true)
      await queryClient.invalidateQueries({ queryKey: queryKeys.images })
    },
    onError: (error) => {
      setError(toError(error, 'Upload failed'))
    },
  })

  const upload = async (file: File) => {
    await uploadImageMutation.mutateAsync(file)
  }

  const handleUploadError = (error: Error) => {
    setShowSuccess(false)
    setError(error)
  }

  return {
    error,
    showSuccess,
    uploading: uploadImageMutation.isPending,
    upload,
    handleUploadError,
  }
}
