import * as React from 'react'
import { useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, FormEvent } from 'react'

interface ImageUploadFormProps {
  isUploading: boolean
  onUpload: (file: File) => Promise<void>
  onUploadError: (error: Error) => void
}

export const ImageUploadForm = ({ isUploading, onUpload, onUploadError }: ImageUploadFormProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (file: File) => {
    setSelectedFile(file)

    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setIsDragging(false)

    const file = event.dataTransfer.files[0]

    if (file && file.type.startsWith('image/')) {
      handleFileSelect(file)
    }
  }

  const handleDragOver = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setIsDragging(false)
  }

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (file) {
      handleFileSelect(file)
    }
  }

  const handleClearSelectedFile = () => {
    setSelectedFile(null)
    setPreview(null)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!selectedFile) {
      onUploadError(new Error('Please select an image file'))
      return
    }

    try {
      await onUpload(selectedFile)
      handleClearSelectedFile()
    } catch (error) {
      onUploadError(error instanceof Error ? error : new Error('Upload failed'))
    }
  }

  return (
    <div
      style={{
        background: '#f8f9fa',
        padding: 24,
        borderRadius: 12,
        marginBottom: 40,
        maxWidth: 500,
        margin: '0 auto 40px',
      }}
    >
      <h2 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 600 }}>Add New Image</h2>
      <form onSubmit={handleSubmit}>
        <label
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          style={{
            border: isDragging ? '2px dashed #0066cc' : '2px dashed #ccc',
            borderRadius: 8,
            padding: 24,
            textAlign: 'center',
            cursor: 'pointer',
            background: isDragging ? '#e6f0ff' : '#fff',
            transition: 'all 0.2s ease',
            minHeight: 120,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            position: 'relative',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleFileInputChange}
            aria-label="Select image to upload"
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              opacity: 0,
              cursor: 'pointer',
            }}
          />
          {preview ? (
            <div>
              <img
                src={preview}
                alt="Preview"
                style={{
                  maxWidth: '100%',
                  maxHeight: 180,
                  borderRadius: 6,
                  pointerEvents: 'none',
                }}
              />
              <p style={{ margin: '12px 0 0', fontSize: 13, color: '#333', pointerEvents: 'none' }}>
                {selectedFile?.name}
              </p>
            </div>
          ) : (
            <>
              <p style={{ margin: 0, color: '#666', fontSize: 14, pointerEvents: 'none' }}>
                {isDragging ? 'Drop image here' : 'Drag & drop an image here, or click to select'}
              </p>
              <p style={{ margin: '4px 0 0', color: '#999', fontSize: 12, pointerEvents: 'none' }}>
                Supports: JPEG, PNG, GIF, WebP
              </p>
            </>
          )}
        </label>

        {preview && (
          <button
            type="button"
            onClick={handleClearSelectedFile}
            style={{
              marginTop: 12,
              fontSize: 13,
              color: '#dc3545',
              cursor: 'pointer',
              textDecoration: 'underline',
              background: 'none',
              border: 'none',
              padding: 0,
              display: 'block',
            }}
          >
            Remove selected image
          </button>
        )}

        <button
          type="submit"
          disabled={isUploading || !selectedFile}
          style={{
            marginTop: 16,
            padding: '12px 24px',
            borderRadius: 6,
            background: isUploading || !selectedFile ? '#ccc' : '#222',
            color: 'white',
            fontWeight: 600,
            border: 'none',
            cursor: isUploading || !selectedFile ? 'not-allowed' : 'pointer',
            fontSize: 14,
            width: '100%',
          }}
        >
          {isUploading ? 'Uploading...' : 'Upload Image'}
        </button>
      </form>
    </div>
  )
}
