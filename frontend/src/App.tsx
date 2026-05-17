import "./App.css";
import React from "react";
import { StatusMessage } from "./components/ui/StatusMessage";
import { GallerySection } from "./features/gallery/components/GallerySection";
import { useImages } from "./features/gallery/hooks/useImages";
import { ImageUploadForm } from "./features/upload/components/ImageUploadForm";
import { useImageUpload } from "./features/upload/hooks/useImageUpload";

const App = () => {
  const {
    images,
    loading,
    error: galleryError,
    deletingId,
    refreshImages,
    deleteImage,
  } = useImages();
  const {
    error: uploadError,
    showSuccess,
    upload,
    handleUploadError,
  } = useImageUpload({
    onUploadSuccess: refreshImages,
  });
  const error = uploadError ?? galleryError;

  return (
    <div
      style={{
        margin: "2rem auto",
        fontFamily: "Inter, sans-serif",
        padding: "0 20px",
      }}
    >
      <h1
        style={{
          textAlign: "center",
          fontSize: "3rem",
          fontWeight: 700,
          marginBottom: 40,
          letterSpacing: "-2px",
          color: "#222",
        }}
      >
        Image Gallery
      </h1>

      <ImageUploadForm onUpload={upload} onUploadError={handleUploadError} />

      {showSuccess && (
        <StatusMessage variant="success">
          Image added successfully!
        </StatusMessage>
      )}
      {error && (
        <StatusMessage variant="error">Error: {error.message}</StatusMessage>
      )}

      <GallerySection
        images={images}
        loading={loading}
        deletingId={deletingId}
        onDeleteImage={deleteImage}
      />
    </div>
  );
};

export default App;
