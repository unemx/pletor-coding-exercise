import type { Photo } from 'react-photo-album'

export interface GalleryPhoto extends Photo {
  id: number
  originalUrl: string
}
