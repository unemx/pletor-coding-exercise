import * as React from 'react'
import type { Image } from '../../../types/image'
import { ImageCard } from './ImageCard'

interface GallerySectionProps {
  images: Image[]
  loading: boolean
  deletingId: number | null
  hasNextPage: boolean
  loadingMore: boolean
  onLoadMore: () => void
  onDeleteImage: (id: number) => void
}

export const GallerySection = ({
  images,
  loading,
  deletingId,
  hasNextPage,
  loadingMore,
  onLoadMore,
  onDeleteImage,
}: GallerySectionProps) => {
  const loadMoreRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!hasNextPage || loadingMore) {
      return
    }

    const loadMoreElement = loadMoreRef.current
    if (!loadMoreElement) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMore()
        }
      },
      { rootMargin: '800px 0px' },
    )

    observer.observe(loadMoreElement)

    return () => {
      observer.disconnect()
    }
  }, [hasNextPage, loadingMore, onLoadMore])

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <p>Loading images...</p>
      </div>
    )
  }

  if (images.length === 0) {
    return <p style={{ color: '#666' }}>No images found. Add one above!</p>
  }

  return (
    <>
      <div
        style={{
          columnWidth: 280,
          columnGap: 12,
          textAlign: 'left',
        }}
      >
        {images.map((image) => (
          <ImageCard
            key={image.id}
            image={image}
            isDeleting={deletingId === image.id}
            onDelete={onDeleteImage}
          />
        ))}
      </div>
      <div ref={loadMoreRef} style={{ minHeight: 1 }} aria-hidden="true" />
      {loadingMore && <p style={{ textAlign: 'center', color: '#666' }}>Loading more images...</p>}
      {!hasNextPage && images.length > 0 && (
        <p style={{ textAlign: 'center', color: '#888', fontSize: 13 }}>End of gallery</p>
      )}
    </>
  )
}
