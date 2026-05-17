import "./App.css";
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
    hasNextPage,
    loadingMore,
    loadMoreImages,
    deleteImage,
  } = useImages();
  const {
    error: uploadError,
    showSuccess,
    uploading,
    upload,
    handleUploadError,
  } = useImageUpload();
  const error = uploadError ?? galleryError;

  return (
    <div
      style={{
        margin: "2rem auto",
        fontFamily: "Inter, sans-serif",
        padding: "0 20px",
        width: "100%",
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

      <ImageUploadForm
        isUploading={uploading}
        onUpload={upload}
        onUploadError={handleUploadError}
      />

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
        hasNextPage={hasNextPage}
        loadingMore={loadingMore}
        onLoadMore={loadMoreImages}
        onDeleteImage={deleteImage}
      />
    </div>
  );
};

export default App;
