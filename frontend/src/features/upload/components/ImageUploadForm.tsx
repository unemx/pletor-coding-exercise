import * as React from 'react'
import Uppy from '@uppy/core'
import type { Meta, UppyFile, UploadResult } from '@uppy/core'
import GoldenRetriever from '@uppy/golden-retriever'
import Dashboard from '@uppy/react/dashboard'
import XHRUpload from '@uppy/xhr-upload'
import '@uppy/core/css/style.min.css'
import '@uppy/dashboard/css/style.min.css'
import { UPLOAD_IMAGE_URL } from '../../../lib/api/images'
import './ImageUploadForm.css'

interface ImageUploadFormProps {
  onUploadComplete: (successfulUploadCount: number) => Promise<void>
  onUploadError: (error: Error) => void
}

interface UploadResponseBody {
  [key: string]: unknown
  id?: number
  url?: string
}

type UploadEventError = {
  message: string
  details?: string
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const MAX_FILE_COUNT = 50
const CONCURRENT_UPLOAD_LIMIT = 4
const RECOVERY_EXPIRY_MS = 24 * 60 * 60 * 1000

const allowedFileTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

const createUploadError = (
  file: UppyFile<Meta, UploadResponseBody> | undefined,
  error: UploadEventError,
) => {
  const prefix = file?.name ? `${file.name}: ` : ''
  return new Error(`${prefix}${error.message}`)
}

const createImageUploader = () => {
  return new Uppy<Meta, UploadResponseBody>({
    id: 'pictoshare-image-uploader',
    autoProceed: false,
    allowMultipleUploadBatches: true,
    restrictions: {
      allowedFileTypes,
      maxFileSize: MAX_FILE_SIZE_BYTES,
      maxNumberOfFiles: MAX_FILE_COUNT,
    },
  })
    .use(GoldenRetriever, {
      expires: RECOVERY_EXPIRY_MS,
      indexedDB: {
        name: 'pictoshare-image-uploads',
      },
    })
    .use(XHRUpload, {
      endpoint: UPLOAD_IMAGE_URL,
      fieldName: 'file',
      formData: true,
      limit: CONCURRENT_UPLOAD_LIMIT,
      method: 'POST',
      timeout: 45_000,
      allowedMetaFields: [],
      shouldRetry: (xhr) => xhr.status === 0 || xhr.status >= 500,
    })
}

export const ImageUploadForm = ({
  onUploadComplete,
  onUploadError,
}: ImageUploadFormProps) => {
  const [uppy] = React.useState(createImageUploader)

  React.useEffect(() => {
    const handleComplete = (result: UploadResult<Meta, UploadResponseBody>) => {
      const successfulUploadCount = result.successful?.length ?? 0

      if (successfulUploadCount <= 0) {
        return
      }

      void onUploadComplete(successfulUploadCount)
    }

    const handleUploadError = (
      file: UppyFile<Meta, UploadResponseBody> | undefined,
      error: UploadEventError,
    ) => {
      onUploadError(createUploadError(file, error))
    }

    const handleRestrictionFailed = (
      file: UppyFile<Meta, UploadResponseBody> | undefined,
      error: Error,
    ) => {
      onUploadError(createUploadError(file, error))
    }

    uppy.on('complete', handleComplete)
    uppy.on('upload-error', handleUploadError)
    uppy.on('restriction-failed', handleRestrictionFailed)

    return () => {
      uppy.off('complete', handleComplete)
      uppy.off('upload-error', handleUploadError)
      uppy.off('restriction-failed', handleRestrictionFailed)
    }
  }, [onUploadComplete, onUploadError, uppy])

  React.useEffect(() => {
    return () => {
      uppy.destroy()
    }
  }, [uppy])

  return (
    <section className="image-upload-form" aria-labelledby="image-upload-title">
      <div className="image-upload-form__header">
        <p className="image-upload-form__eyebrow">Batch uploader</p>
        <h2 id="image-upload-title">Add images</h2>
        <p>
          Drop up to {MAX_FILE_COUNT} images, upload {CONCURRENT_UPLOAD_LIMIT} at a time,
          cancel individual files, and retry failures without restarting the batch.
        </p>
      </div>
      <Dashboard
        uppy={uppy}
        height={420}
        width="100%"
        note="JPEG, PNG, GIF, or WebP. Maximum 10 MB per image."
        proudlyDisplayPoweredByUppy={false}
        showRemoveButtonAfterComplete
        theme="light"
      />
    </section>
  )
}
