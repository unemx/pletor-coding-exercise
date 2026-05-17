import { useCallback } from 'react'
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { deleteImage as deleteImageRequest, fetchImages } from '../../../lib/api/images'
import { queryKeys } from '../../../lib/queryKeys'
import type { Image, ImagePage } from '../../../types/image'

type ImagesInfiniteData = InfiniteData<ImagePage, number | undefined>

const toError = (error: unknown, fallbackMessage: string) => {
  if (!error) {
    return null
  }

  return error instanceof Error ? error : new Error(fallbackMessage)
}

export const useImages = () => {
  const queryClient = useQueryClient()

  const imagesQuery = useInfiniteQuery({
    queryKey: queryKeys.images,
    queryFn: ({ pageParam }) => fetchImages({ cursor: pageParam }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  })

  const deleteImageMutation = useMutation({
    mutationFn: deleteImageRequest,
    onMutate: async (deletedImageId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.images })

      const previousImages = queryClient.getQueryData<ImagesInfiniteData>(queryKeys.images)

      queryClient.setQueryData<ImagesInfiniteData>(queryKeys.images, (data) => {
        if (!data) {
          return data
        }

        return {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.filter((image) => image.id !== deletedImageId),
          })),
        }
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

  const loadMoreImages = useCallback(async () => {
    if (!imagesQuery.hasNextPage || imagesQuery.isFetchingNextPage) {
      return
    }

    await imagesQuery.fetchNextPage()
  }, [imagesQuery])

  const handleDeleteImage = (id: number) => {
    deleteImageMutation.mutate(id)
  }

  const deletingId =
    deleteImageMutation.isPending && typeof deleteImageMutation.variables === 'number'
      ? deleteImageMutation.variables
      : null
  const error =
    toError(imagesQuery.error, 'Failed to fetch images') ??
    toError(deleteImageMutation.error, 'Delete failed')
  const images: Image[] = imagesQuery.data?.pages.flatMap((page) => page.items) ?? []

  return {
    images,
    loading: imagesQuery.isPending,
    error,
    deletingId,
    hasNextPage: imagesQuery.hasNextPage,
    loadingMore: imagesQuery.isFetchingNextPage,
    refreshImages,
    loadMoreImages,
    deleteImage: handleDeleteImage,
  }
}
