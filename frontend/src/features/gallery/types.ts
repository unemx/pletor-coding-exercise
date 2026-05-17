import type { Photo } from 'react-photo-album'

export interface GalleryPhoto extends Photo {
  id: number
  isPriority: boolean
  originalUrl: string
}
