import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteImage as deleteImageRequest, fetchImages } from '../../../lib/api/images'
import { queryKeys } from '../../../lib/queryKeys'
import type { Image } from '../../../types/image'

const toError = (error: unknown, fallbackMessage: string) => {
  if (!error) {
    return null
  }

  return error instanceof Error ? error : new Error(fallbackMessage)
}

export const useImages = () => {
  const queryClient = useQueryClient()

  const imagesQuery = useQuery({
    queryKey: queryKeys.images,
    queryFn: fetchImages,
  })

  const deleteImageMutation = useMutation({
    mutationFn: deleteImageRequest,
    onMutate: async (deletedImageId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.images })

      const previousImages = queryClient.getQueryData<Image[]>(queryKeys.images)

      queryClient.setQueryData<Image[]>(queryKeys.images, (images) => {
        if (!images) {
          return images
        }

        return images.filter((image) => image.id !== deletedImageId)
      })

      return { previousImages }
    },
    onError: (_error, _deletedImageId, context) => {
      if (!context?.previousImages) {
        return
      }

      queryClient.setQueryData(queryKeys.images, context.previousImages)
    },
  })

  const refreshImages = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.images })
  }

  const handleDeleteImage = (id: string) => {
    deleteImageMutation.mutate(id)
  }

  const deletingId =
    deleteImageMutation.isPending && typeof deleteImageMutation.variables === 'string'
      ? deleteImageMutation.variables
      : null
  const error =
    toError(imagesQuery.error, 'Failed to fetch images') ??
    toError(deleteImageMutation.error, 'Delete failed')

  return {
    images: imagesQuery.data ?? [],
    loading: imagesQuery.isPending,
    error,
    deletingId,
    refreshImages,
    deleteImage: handleDeleteImage,
  }
}
