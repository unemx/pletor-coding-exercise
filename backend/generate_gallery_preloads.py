import html
import json
import sqlite3
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIR = ROOT_DIR / "frontend"
DATABASE_PATH = BACKEND_DIR / "test.db"
UPLOAD_DIR = BACKEND_DIR / "uploads"
REMOTE_THUMBNAIL_DIR = UPLOAD_DIR / "remote-thumbnails"
PUBLIC_DIR = FRONTEND_DIR / "public"
INDEX_HTML_PATH = FRONTEND_DIR / "index.html"
MANIFEST_PATH = PUBLIC_DIR / "gallery-preload-manifest.json"

API_BASE_URL = "http://localhost:8000"
CARD_THUMBNAIL_WIDTH = 320
HIGH_DENSITY_THUMBNAIL_WIDTH = 640
PRELOAD_IMAGE_COUNT = 15
PRELOAD_IMAGE_SCAN_LIMIT = 40
START_MARKER = "    <!-- gallery-preload:start -->"
END_MARKER = "    <!-- gallery-preload:end -->"


def get_dimensions_from_url(url: str) -> tuple[int, int]:
    query_params = dict(parse_qsl(urlparse(url).query))

    try:
        width = int(query_params.get("w", "0"))
        height = int(query_params.get("h", "0"))
    except ValueError:
        return CARD_THUMBNAIL_WIDTH, 300

    if width <= 0 or height <= 0:
        return CARD_THUMBNAIL_WIDTH, 300

    return width, height


def build_remote_thumbnail_url(original_url: str, target_width: int) -> str:
    original_width, original_height = get_dimensions_from_url(original_url)
    target_height = max(1, round(target_width * original_height / original_width))
    parsed_url = urlparse(original_url)
    query_params = dict(parse_qsl(parsed_url.query, keep_blank_values=True))
    query_params.update(
        {
            "w": str(target_width),
            "h": str(target_height),
            "fit": query_params.get("fit", "crop"),
            "q": "70",
            "auto": "format",
        }
    )

    return urlunparse(parsed_url._replace(query=urlencode(query_params)))


def build_upload_url(relative_path: str) -> str:
    return f"{API_BASE_URL}/uploads/{relative_path}"


def get_preload_urls(image: sqlite3.Row) -> tuple[str, str | None]:
    original_url = image["url"]
    parsed_url = urlparse(original_url)
    is_local_upload = parsed_url.path.startswith("/uploads/")

    if is_local_upload and image["thumbnail_url"]:
        return image["thumbnail_url"], image["thumbnail_2x_url"]

    remote_thumbnail_path = REMOTE_THUMBNAIL_DIR / f"{image['id']}-{CARD_THUMBNAIL_WIDTH}.webp"
    remote_thumbnail_2x_path = REMOTE_THUMBNAIL_DIR / f"{image['id']}-{HIGH_DENSITY_THUMBNAIL_WIDTH}.webp"

    if remote_thumbnail_path.exists() and remote_thumbnail_2x_path.exists():
        return (
            build_upload_url(f"remote-thumbnails/{remote_thumbnail_path.name}"),
            build_upload_url(f"remote-thumbnails/{remote_thumbnail_2x_path.name}"),
        )

    return (
        build_remote_thumbnail_url(original_url, CARD_THUMBNAIL_WIDTH),
        build_remote_thumbnail_url(original_url, HIGH_DENSITY_THUMBNAIL_WIDTH),
    )


def read_priority_images() -> list[sqlite3.Row]:
    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.row_factory = sqlite3.Row
        return connection.execute(
            """
            SELECT id, title, url, width, height, thumbnail_url, thumbnail_2x_url
            FROM images
            ORDER BY id DESC
            LIMIT ?
            """,
            (PRELOAD_IMAGE_COUNT,),
        ).fetchall()


def read_priority_images_from_api() -> list[dict[str, object]] | None:
    try:
        with urllib.request.urlopen(
            f"{API_BASE_URL}/images/?limit={PRELOAD_IMAGE_SCAN_LIMIT}",
            timeout=10,
        ) as response:
            data = json.load(response)
    except (OSError, urllib.error.URLError, urllib.error.HTTPError):
        return None

    return data.get("items", [])


def is_local_thumbnail_url(url: str) -> bool:
    return url.startswith(f"{API_BASE_URL}/uploads/")


def build_manifest() -> list[dict[str, object]]:
    api_images = read_priority_images_from_api()

    if api_images is not None:
        return [
            {
                "id": image["id"],
                "title": image["title"],
                "href": image["thumbnail_url"],
                "imageSrcSet": (
                    f"{image['thumbnail_url']} {CARD_THUMBNAIL_WIDTH}w, "
                    f"{image['thumbnail_2x_url']} {HIGH_DENSITY_THUMBNAIL_WIDTH}w"
                    if image.get("thumbnail_2x_url")
                    else None
                ),
                "imageSizes": "(max-width: 640px) calc(100vw - 40px), "
                "(max-width: 1280px) calc(100vw - 80px), 1280px",
            }
            for image in api_images
            if is_local_thumbnail_url(str(image["thumbnail_url"]))
        ][:PRELOAD_IMAGE_COUNT]

    manifest = []

    for image in read_priority_images():
        thumbnail_url, thumbnail_2x_url = get_preload_urls(image)
        manifest.append(
            {
                "id": image["id"],
                "title": image["title"],
                "href": thumbnail_url,
                "imageSrcSet": (
                    f"{thumbnail_url} {CARD_THUMBNAIL_WIDTH}w, "
                    f"{thumbnail_2x_url} {HIGH_DENSITY_THUMBNAIL_WIDTH}w"
                    if thumbnail_2x_url
                    else None
                ),
                "imageSizes": "(max-width: 640px) calc(100vw - 40px), "
                "(max-width: 1280px) calc(100vw - 80px), 1280px",
            }
        )

    return manifest


def render_preload_tags(manifest: list[dict[str, object]]) -> str:
    lines = [START_MARKER]

    for item in manifest:
        href = html.escape(str(item["href"]), quote=True)
        image_sizes = html.escape(str(item["imageSizes"]), quote=True)
        lines.append(f'    <link rel="preload" as="image" href="{href}" imagesizes="{image_sizes}" />')

        image_src_set = item.get("imageSrcSet")
        if image_src_set:
            lines[-1] = (
                f'    <link rel="preload" as="image" href="{href}" '
                f'imagesrcset="{html.escape(str(image_src_set), quote=True)}" '
                f'imagesizes="{image_sizes}" />'
            )

    lines.append(END_MARKER)
    return "\n".join(lines)


def replace_or_insert_block(
    content: str,
    *,
    start_marker: str,
    end_marker: str,
    block: str,
    fallback_before: str,
) -> str:
    if start_marker in content and end_marker in content:
        before = content.split(start_marker, 1)[0].rstrip()
        after = content.split(end_marker, 1)[1]
        if after.startswith("\n"):
            after = after[1:]
        return f"{before}\n{block}\n{after}"

    return content.replace(fallback_before, f"{block}\n{fallback_before}")


def remove_legacy_initial_data_block(content: str) -> str:
    start_marker = "    <!-- gallery-initial-data:start -->"
    end_marker = "    <!-- gallery-initial-data:end -->"

    if start_marker not in content or end_marker not in content:
        return content

    before = content.split(start_marker, 1)[0].rstrip()
    after = content.split(end_marker, 1)[1]
    if after.startswith("\n"):
        after = after[1:]

    return f"{before}\n{after}"


def update_index_html(preload_tags: str) -> None:
    index_html = INDEX_HTML_PATH.read_text()
    next_index_html = replace_or_insert_block(
        index_html,
        start_marker=START_MARKER,
        end_marker=END_MARKER,
        block=preload_tags,
        fallback_before='    <meta name="viewport"',
    )
    next_index_html = remove_legacy_initial_data_block(next_index_html)

    INDEX_HTML_PATH.write_text(next_index_html)


def main() -> None:
    PUBLIC_DIR.mkdir(exist_ok=True)
    manifest = build_manifest()
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n")
    update_index_html(render_preload_tags(manifest))
    print(f"Wrote {len(manifest)} gallery preload entries.")


if __name__ == "__main__":
    main()
