import * as React from "react";
import type { Image } from "../../../types/image";

interface ImageCardProps {
  image: Image;
  isDeleting: boolean;
  onDelete: (id: number) => void;
}

export const ImageCard = ({ image, isDeleting, onDelete }: ImageCardProps) => {
  const [hasImageError, setHasImageError] = React.useState(false);
  const aspectRatio =
    image.width > 0 && image.height > 0 ? `${image.width} / ${image.height}` : "4 / 3";
  const srcSet = image.thumbnail_2x_url
    ? `${image.thumbnail_url} 400w, ${image.thumbnail_2x_url} 800w`
    : undefined;

  React.useEffect(() => {
    setHasImageError(false);
  }, [image.thumbnail_url]);

  const handleDelete = () => {
    onDelete(image.id);
  };

  const handleImageError = () => {
    setHasImageError(true);
  };

  return (
    <div
      style={{
        width: "100%",
        display: "inline-block",
        marginBottom: 12,
        background: "#fff",
        borderRadius: 8,
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.08)",
        position: "relative",
        transform: "translateZ(0) rotate(0deg)",
      }}
    >
      <button
        type="button"
        onClick={handleDelete}
        disabled={isDeleting}
        aria-label={`Delete ${image.title}`}
        style={{
          position: "absolute",
          top: 6,
          right: 6,
          width: 22,
          height: 22,
          minWidth: 22,
          minHeight: 22,
          padding: 0,
          borderRadius: "50%",
          border: "none",
          background: "rgba(0,0,0,0.6)",
          color: "#fff",
          fontSize: 16,
          lineHeight: "22px",
          textAlign: "center",
          cursor: isDeleting ? "not-allowed" : "pointer",
          opacity: isDeleting ? 0.5 : 1,
        }}
      >
        &times;
      </button>
      <div style={{ aspectRatio, background: "#f1f3f5" }}>
        {hasImageError ? (
          <div
            role="img"
            aria-label={`Unable to load ${image.title}`}
            style={{
              width: "100%",
              height: "100%",
              color: "#666",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
              boxSizing: "border-box",
              textAlign: "center",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Image unavailable
          </div>
        ) : (
          <img
            src={image.thumbnail_url}
            srcSet={srcSet}
            sizes="(max-width: 640px) calc(100vw - 40px), (max-width: 1280px) 33vw, 400px"
            alt={image.title}
            width={image.width}
            height={image.height}
            loading="lazy"
            decoding="async"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
            onError={handleImageError}
          />
        )}
      </div>
      <div style={{ padding: 8 }}>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 500,
            color: "#333",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {image.title}
        </p>
      </div>
    </div>
  );
};
