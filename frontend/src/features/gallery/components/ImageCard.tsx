import * as React from 'react'
import type { RenderImageProps } from 'react-photo-album'
import type { GalleryPhoto } from '../types'

interface ImageCardImageProps {
  imageProps: RenderImageProps
  photo: GalleryPhoto
}

interface ImageCardOverlayProps {
  photo: GalleryPhoto
  isDeleting: boolean
  onDelete: (id: number) => void
}

export const ImageCardImage = ({ imageProps, photo }: ImageCardImageProps) => {
  const [hasImageError, setHasImageError] = React.useState(false)

  React.useEffect(() => {
    setHasImageError(false)
  }, [imageProps.src])

  const handleImageError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    imageProps.onError?.(event)
    setHasImageError(true)
  }

  if (hasImageError) {
    return (
      <div
        className={`${imageProps.className ?? ''} gallery-card__fallback`.trim()}
        role="img"
        aria-label={`Unable to load ${photo.title}`}
      >
        Image unavailable
      </div>
    )
  }

  return (
    <img
      {...imageProps}
      alt={imageProps.alt ?? photo.title}
      decoding="async"
      loading="lazy"
      onError={handleImageError}
    />
  )
}

export const ImageCardOverlay = ({
  photo,
  isDeleting,
  onDelete,
}: ImageCardOverlayProps) => {
  const handleDelete = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    onDelete(photo.id)
  }

  return (
    <>
      <button
        type="button"
        className="gallery-card__delete"
        onClick={handleDelete}
        disabled={isDeleting}
        aria-label={`Delete ${photo.title}`}
      >
        &times;
      </button>
      <p className="gallery-card__title" title={photo.title}>
        {photo.title}
      </p>
    </>
  )
}
