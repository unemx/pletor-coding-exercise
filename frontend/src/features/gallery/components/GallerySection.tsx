import * as React from 'react'
import { RowsPhotoAlbum } from 'react-photo-album'
import type { Render } from 'react-photo-album'
import 'react-photo-album/rows.css'
import type { Image } from '../../../types/image'
import { useGalleryScrollRestoration } from '../hooks/useGalleryScrollRestoration'
import type { GalleryPhoto } from '../types'
import { ImageCardImage, ImageCardOverlay } from './ImageCard'
import './GallerySection.css'

interface GallerySectionProps {
  images: Image[]
  loading: boolean
  deletingId: number | null
  hasNextPage: boolean
  loadingMore: boolean
  onLoadMore: () => void
  onDeleteImage: (id: number) => void
}

const FALLBACK_WIDTH = 400
const FALLBACK_HEIGHT = 300
const CARD_THUMBNAIL_WIDTH = 320
const HIGH_DENSITY_THUMBNAIL_WIDTH = 640
const PRIORITY_IMAGE_COUNT = 4

const getSafeDimensions = (image: Image) => {
  if (image.width > 0 && image.height > 0) {
    return {
      width: image.width,
      height: image.height,
    }
  }

  return {
    width: FALLBACK_WIDTH,
    height: FALLBACK_HEIGHT,
  }
}

const getResponsiveVariant = (
  src: string,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
) => {
  const width = Math.min(sourceWidth, targetWidth)
  const height = Math.max(1, Math.round((width * sourceHeight) / sourceWidth))

  return {
    src,
    width,
    height,
  }
}

const toGalleryPhoto = (image: Image, index: number): GalleryPhoto => {
  const { width, height } = getSafeDimensions(image)
  const srcSet = [
    getResponsiveVariant(image.thumbnail_url, width, height, CARD_THUMBNAIL_WIDTH),
  ]

  if (image.thumbnail_2x_url) {
    srcSet.push(
      getResponsiveVariant(image.thumbnail_2x_url, width, height, HIGH_DENSITY_THUMBNAIL_WIDTH),
    )
  }

  return {
    id: image.id,
    isPriority: index < PRIORITY_IMAGE_COUNT,
    key: String(image.id),
    src: image.thumbnail_url,
    width,
    height,
    srcSet,
    alt: image.title,
    title: image.title,
    originalUrl: image.original_url,
  }
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
  const photos = React.useMemo(() => images.map(toGalleryPhoto), [images])

  useGalleryScrollRestoration({
    restoreWhen: !loading && photos.length > 0,
  })

  const render = React.useMemo<Render<GalleryPhoto>>(
    () => ({
      image: (imageProps, { photo }) => (
        <ImageCardImage imageProps={imageProps} photo={photo} />
      ),
      extras: (_, { photo }) => (
        <ImageCardOverlay
          photo={photo}
          isDeleting={deletingId === photo.id}
          onDelete={onDeleteImage}
        />
      ),
    }),
    [deletingId, onDeleteImage],
  )

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
      { rootMargin: '400px 0px' },
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
    <section className="gallery-section" aria-label="Image gallery">
      <RowsPhotoAlbum
        photos={photos}
        render={render}
        spacing={(containerWidth) => (containerWidth < 640 ? 8 : 12)}
        padding={0}
        targetRowHeight={(containerWidth) => (containerWidth < 640 ? 180 : 260)}
        rowConstraints={{ minPhotos: 1, singleRowMaxHeight: 320 }}
        sizes={{
          size: 'min(100vw - 40px, 1280px)',
          sizes: [
            {
              viewport: '(max-width: 640px)',
              size: 'calc(100vw - 40px)',
            },
            {
              viewport: '(max-width: 1280px)',
              size: 'calc(100vw - 80px)',
            },
          ],
        }}
        componentsProps={{
          container: {
            className: 'gallery-section__album',
          },
          wrapper: ({ photo }) => ({
            role: 'group',
            'aria-label': photo.title,
          }),
        }}
      />
      <div ref={loadMoreRef} style={{ minHeight: 1 }} aria-hidden="true" />
      {loadingMore && (
        <p className="gallery-section__status" aria-live="polite">
          Loading more images...
        </p>
      )}
      {!hasNextPage && images.length > 0 && (
        <p className="gallery-section__status gallery-section__status--muted">
          End of gallery
        </p>
      )}
    </section>
  )
}
