import { useEffect, useRef } from 'react'

const GALLERY_SCROLL_STORAGE_KEY = 'pictoshare.gallery.scrollY'

interface UseGalleryScrollRestorationParams {
  restoreWhen: boolean
}

const getStoredScrollY = () => {
  const storedValue = window.sessionStorage.getItem(GALLERY_SCROLL_STORAGE_KEY)

  if (!storedValue) {
    return null
  }

  const scrollY = Number(storedValue)

  if (!Number.isFinite(scrollY) || scrollY < 0) {
    return null
  }

  return scrollY
}

export const useGalleryScrollRestoration = ({
  restoreWhen,
}: UseGalleryScrollRestorationParams) => {
  const hasRestoredRef = useRef(false)

  useEffect(() => {
    if (!restoreWhen || hasRestoredRef.current) {
      return
    }

    const scrollY = getStoredScrollY()
    hasRestoredRef.current = true

    if (scrollY === null) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: scrollY, behavior: 'auto' })
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [restoreWhen])

  useEffect(() => {
    let frameId: number | null = null

    const saveScrollPosition = () => {
      window.sessionStorage.setItem(GALLERY_SCROLL_STORAGE_KEY, String(window.scrollY))
    }

    const handleScroll = () => {
      if (frameId !== null) {
        return
      }

      frameId = window.requestAnimationFrame(() => {
        saveScrollPosition()
        frameId = null
      })
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('pagehide', saveScrollPosition)

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }

      saveScrollPosition()
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('pagehide', saveScrollPosition)
    }
  }, [])
}
