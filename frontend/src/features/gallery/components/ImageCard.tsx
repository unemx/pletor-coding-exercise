import * as React from 'react'
import type { SyntheticEvent } from 'react'
import type { Image } from '../../../types/image'

interface ImageCardProps {
  image: Image
  isDeleting: boolean
  onDelete: (id: string) => void
}

export const ImageCard = ({ image, isDeleting, onDelete }: ImageCardProps) => {
  const handleDelete = () => {
    onDelete(image.id)
  }

  const handleImageError = (event: SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget.src = 'https://via.placeholder.com/400x300?text=Error'
  }

  return (
    <div
      style={{
        width: 400,
        background: '#fff',
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.08)',
        position: 'relative',
        transform: 'translateZ(0) rotate(0deg)',
      }}
    >
      <button
        type="button"
        onClick={handleDelete}
        disabled={isDeleting}
        aria-label={`Delete ${image.title}`}
        style={{
          position: 'absolute',
          top: 6,
          right: 6,
          width: 22,
          height: 22,
          minWidth: 22,
          minHeight: 22,
          padding: 0,
          borderRadius: '50%',
          border: 'none',
          background: 'rgba(0,0,0,0.6)',
          color: '#fff',
          fontSize: 16,
          lineHeight: '22px',
          textAlign: 'center',
          cursor: isDeleting ? 'not-allowed' : 'pointer',
          opacity: isDeleting ? 0.5 : 1,
        }}
      >
        &times;
      </button>
      <img
        src={image.url}
        alt={image.title}
        loading="eager"
        decoding="sync"
        style={{ width: 400, height: 300, objectFit: 'cover', display: 'block' }}
        onError={handleImageError}
      />
      <div style={{ padding: 8 }}>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 500,
            color: '#333',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {image.title}
        </p>
      </div>
    </div>
  )
}
