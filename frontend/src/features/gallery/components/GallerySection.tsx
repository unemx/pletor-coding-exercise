import * as React from 'react'
import type { Image } from '../../../types/image'
import { ImageCard } from './ImageCard'

interface GallerySectionProps {
  images: Image[]
  loading: boolean
  deletingId: string | null
  onDeleteImage: (id: string) => void
}

export const GallerySection = ({
  images,
  loading,
  deletingId,
  onDeleteImage,
}: GallerySectionProps) => {
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
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
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
  )
}
