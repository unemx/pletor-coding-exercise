export interface Image {
  id: number
  title: string
  url: string
  original_url: string
  thumbnail_url: string
  thumbnail_2x_url: string | null
  width: number
  height: number
  placeholder_hash: string | null
  placeholder_type: string | null
  created_at: string
}

export interface ImagePage {
  items: Image[]
  next_cursor: number | null
}
