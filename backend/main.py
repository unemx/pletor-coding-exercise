import random
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image as PILImage
from PIL import ImageOps, UnidentifiedImageError
from pydantic import BaseModel
from sqlalchemy import Column, DateTime, Integer, String, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Configuration
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
THUMBNAIL_DIR = UPLOAD_DIR / "thumbnails"
THUMBNAIL_DIR.mkdir(exist_ok=True)
API_BASE_URL = "http://localhost:8000"
CARD_THUMBNAIL_WIDTH = 400
HIGH_DENSITY_THUMBNAIL_WIDTH = 800
THUMBNAIL_QUALITY = 82
FAILURE_RATE = 0.15  # 15% random failure rate to simulate real-world conditions

DATABASE_URL = "sqlite+aiosqlite:///./test.db"

engine = create_async_engine(DATABASE_URL, echo=True)
SessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()

class Image(Base):
    __tablename__ = "images"
    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    title = Column(String, nullable=False)
    user = Column(String, nullable=False)
    url = Column(String, nullable=False)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    thumbnail_url = Column(String, nullable=True)
    thumbnail_2x_url = Column(String, nullable=True)

class ImageCreate(BaseModel):
    title: str
    user: str
    url: str
    width: Optional[int] = None
    height: Optional[int] = None

class ImageRead(BaseModel):
    id: int
    created_at: datetime
    title: str
    user: str
    url: str
    original_url: str
    thumbnail_url: str
    thumbnail_2x_url: Optional[str] = None
    width: int
    height: int
    placeholder_hash: Optional[str] = None
    placeholder_type: Optional[str] = None
    class Config:
        orm_mode = True
        from_attributes = True

class ImagePage(BaseModel):
    items: List[ImageRead]
    next_cursor: Optional[int] = None

async def get_db():
    async with SessionLocal() as db:
        yield db

app = FastAPI()

# Serve uploaded files
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Add this after creating the FastAPI app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # or ["*"] for all origins (not recommended for production)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def maybe_fail():
    """Simulate random failures that happen in production"""
    if random.random() < FAILURE_RATE:
        raise HTTPException(status_code=503, detail="Service temporarily unavailable. Please try again.")

async def ensure_image_delivery_columns(conn):
    result = await conn.execute(text("PRAGMA table_info(images)"))
    existing_columns = {row[1] for row in result.fetchall()}
    delivery_columns = {
        "width": "ALTER TABLE images ADD COLUMN width INTEGER",
        "height": "ALTER TABLE images ADD COLUMN height INTEGER",
        "thumbnail_url": "ALTER TABLE images ADD COLUMN thumbnail_url VARCHAR",
        "thumbnail_2x_url": "ALTER TABLE images ADD COLUMN thumbnail_2x_url VARCHAR",
    }

    for column_name, statement in delivery_columns.items():
        if column_name not in existing_columns:
            await conn.execute(text(statement))

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
            "q": "80",
            "auto": "format",
        }
    )

    return urlunparse(parsed_url._replace(query=urlencode(query_params)))

def get_local_upload_path(url: str, *, allow_thumbnails: bool = False) -> Optional[Path]:
    parsed_url = urlparse(url)
    if not parsed_url.path.startswith("/uploads/"):
        return None

    relative_path = Path(parsed_url.path.removeprefix("/uploads/"))
    if (
        not relative_path.parts
        or relative_path.is_absolute()
        or ".." in relative_path.parts
        or (relative_path.parts[0] == "thumbnails" and not allow_thumbnails)
    ):
        return None

    return UPLOAD_DIR / relative_path

def build_upload_url(path: Path) -> str:
    return f"{API_BASE_URL}/uploads/{path.relative_to(UPLOAD_DIR).as_posix()}"

def get_image_dimensions_from_file(file_path: Path) -> tuple[int, int]:
    with PILImage.open(file_path) as image:
        image = ImageOps.exif_transpose(image)
        return image.size

def normalize_thumbnail_image(image: PILImage.Image) -> PILImage.Image:
    if image.mode in ("RGB", "RGBA"):
        return image

    has_alpha = "A" in image.getbands()
    return image.convert("RGBA" if has_alpha else "RGB")

def create_thumbnail(file_path: Path, image: PILImage.Image, target_width: int) -> Path:
    target_variant_width = min(target_width, image.width)
    target_variant_height = max(1, round(target_variant_width * image.height / image.width))
    thumbnail = image.resize(
        (target_variant_width, target_variant_height),
        PILImage.Resampling.LANCZOS,
    )
    thumbnail = normalize_thumbnail_image(thumbnail)
    thumbnail_path = THUMBNAIL_DIR / f"{file_path.stem}-{target_width}.webp"
    thumbnail.save(thumbnail_path, "WEBP", quality=THUMBNAIL_QUALITY, method=6)
    return thumbnail_path

def create_thumbnail_variants(file_path: Path) -> tuple[int, int, str, str]:
    with PILImage.open(file_path) as source_image:
        source_image = ImageOps.exif_transpose(source_image)
        width, height = source_image.size
        thumbnail_path = create_thumbnail(file_path, source_image, CARD_THUMBNAIL_WIDTH)
        thumbnail_2x_path = create_thumbnail(file_path, source_image, HIGH_DENSITY_THUMBNAIL_WIDTH)

    return (
        width,
        height,
        build_upload_url(thumbnail_path),
        build_upload_url(thumbnail_2x_path),
    )

def serialize_image(image: Image) -> dict:
    original_url = image.url
    local_upload_path = get_local_upload_path(original_url)

    if image.width and image.height:
        width, height = image.width, image.height
    elif local_upload_path and local_upload_path.exists():
        width, height = get_image_dimensions_from_file(local_upload_path)
    else:
        width, height = get_dimensions_from_url(original_url)

    if image.thumbnail_url:
        thumbnail_url = image.thumbnail_url
    elif local_upload_path:
        thumbnail_url = original_url
    else:
        thumbnail_url = build_remote_thumbnail_url(original_url, CARD_THUMBNAIL_WIDTH)

    if image.thumbnail_2x_url:
        thumbnail_2x_url = image.thumbnail_2x_url
    elif local_upload_path:
        thumbnail_2x_url = None
    else:
        thumbnail_2x_url = build_remote_thumbnail_url(original_url, HIGH_DENSITY_THUMBNAIL_WIDTH)

    return {
        "id": image.id,
        "created_at": image.created_at,
        "title": image.title,
        "user": image.user,
        "url": original_url,
        "original_url": original_url,
        "thumbnail_url": thumbnail_url,
        "thumbnail_2x_url": thumbnail_2x_url,
        "width": width,
        "height": height,
        "placeholder_hash": None,
        "placeholder_type": None,
    }

@app.on_event("startup")
async def on_startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await ensure_image_delivery_columns(conn)
    # Insert fake data if table is empty
    async with SessionLocal() as db:
        result = await db.execute(select(Image))
        images = result.scalars().all()
        if not images:
            # Large dataset to test performance handling - intentionally causes jank!
            users = ["alice", "bob", "charlie", "diana", "eve", "frank", "grace", "henry", "ivy", "jack"]

            # Unsplash photo IDs for various categories and aspect ratios
            photo_data = [
                # Landscapes (wide)
                ("Sunset Beach", "photo-1506744038136-46273834b3fb"),
                ("Mountain Lake", "photo-1465101046530-73398c7f28ca"),
                ("Forest Path", "photo-1441974231531-c6227db76b6e"),
                ("Ocean Waves", "photo-1505142468610-359e7d316be0"),
                ("Desert Dunes", "photo-1509316785289-025f5b846b35"),
                ("Autumn Forest", "photo-1507003211169-0a1dd7228f2d"),
                ("Snowy Mountains", "photo-1483921020237-2ff51e8e4b22"),
                ("Tropical Beach", "photo-1507525428034-b723cf961d3e"),
                ("Northern Lights", "photo-1531366936337-7c912a4589a7"),
                ("Misty Valley", "photo-1470071459604-3b5ec3a7fe05"),
                # Nature close-ups (various)
                ("Cherry Blossoms", "photo-1522383225653-ed111181a951"),
                ("Autumn Leaves", "photo-1507003211169-0a1dd7228f2d"),
                ("Water Droplets", "photo-1518837695005-2083093ee35b"),
                ("Butterfly Wings", "photo-1452570053594-1b985d6ea890"),
                ("Flower Macro", "photo-1490750967868-88aa4486c946"),
                ("Fern Details", "photo-1459411552884-841db9b3cc2a"),
                ("Moss Texture", "photo-1518882605630-8ed5c74e7534"),
                ("Pine Needles", "photo-1542273917363-3b1817f69a2d"),
                ("Ice Crystals", "photo-1517483000871-1dbf64a6e1c6"),
                ("Dewdrops", "photo-1495616811223-4d98c6e9c869"),
                # Urban/Architecture (tall/portrait)
                ("City Skyline", "photo-1477959858617-67f85cf4f1df"),
                ("Modern Building", "photo-1486325212027-8081e485255e"),
                ("Street Art", "photo-1499781350541-7783f6c6a0c8"),
                ("Neon Signs", "photo-1514525253161-7a46d19cd819"),
                ("Old Town", "photo-1480714378408-67cf0d13bc1b"),
                ("Bridge View", "photo-1449824913935-59a10b8d2000"),
                ("Subway Station", "photo-1474487548417-781cb71495f3"),
                ("Rooftop View", "photo-1514565131-fce0801e5785"),
                ("Window Reflections", "photo-1486406146926-c627a92ad1ab"),
                ("Stairway", "photo-1494522855154-9297ac14b55f"),
                # People/Portraits (square-ish)
                ("Street Portrait", "photo-1507003211169-0a1dd7228f2d"),
                ("Coffee Shop", "photo-1495474472287-4d71bcdd2085"),
                ("Market Scene", "photo-1488459716781-31db52582fe9"),
                ("Festival Crowd", "photo-1429962714451-bb934ecdc4ec"),
                ("Musician", "photo-1493225457124-a3eb161ffa5f"),
                ("Chef Cooking", "photo-1556909114-f6e7ad7d3136"),
                ("Artist Studio", "photo-1460661419201-fd4cecdf8a8b"),
                ("Bookstore", "photo-1521587760476-6c12a4b040da"),
                ("Cafe Interior", "photo-1501339847302-ac426a4a7cbb"),
                ("Workshop", "photo-1452860606245-08befc0ff44b"),
                # Animals
                ("Lion Portrait", "photo-1546182990-dffeafbe841d"),
                ("Elephant Walk", "photo-1557050543-4d5f4e07ef46"),
                ("Bird in Flight", "photo-1444464666168-49d633b86797"),
                ("Underwater Fish", "photo-1544551763-46a013bb70d5"),
                ("Fox in Snow", "photo-1474511320723-9a56873571b7"),
                ("Owl Eyes", "photo-1543549790-8b5f4a028cfb"),
                ("Horse Running", "photo-1553284965-83fd3e82fa5a"),
                ("Penguin Colony", "photo-1551986782-d0169b3f8fa7"),
                ("Deer Forest", "photo-1484406566174-9da000fda645"),
                ("Cat Portrait", "photo-1514888286974-6c03e2ca1dba"),
                # Food (square)
                ("Breakfast Spread", "photo-1504674900247-0877df9cc836"),
                ("Fresh Salad", "photo-1512621776951-a57141f2eefd"),
                ("Coffee Art", "photo-1495474472287-4d71bcdd2085"),
                ("Sushi Platter", "photo-1579871494447-9811cf80d66c"),
                ("Pizza Close-up", "photo-1565299624946-b28f40a0ae38"),
                ("Fruit Bowl", "photo-1490474418585-ba9bad8fd0ea"),
                ("Pasta Dish", "photo-1473093295043-cdd812d0e601"),
                ("Chocolate Dessert", "photo-1551024506-0bccd828d307"),
                ("Ice Cream", "photo-1497034825429-c343d7c6a68f"),
                ("Wine Glass", "photo-1510812431401-41d2bd2722f3"),
                # Abstract/Textures
                ("Paint Splatter", "photo-1541701494587-cb58502866ab"),
                ("Geometric Pattern", "photo-1509909756405-be0199881695"),
                ("Smoke Wisps", "photo-1518837695005-2083093ee35b"),
                ("Light Trails", "photo-1507400492013-162706c8c05e"),
                ("Color Gradient", "photo-1557682250-33bd709cbe85"),
                ("Marble Texture", "photo-1558618666-fcd25c85cd64"),
                ("Wood Grain", "photo-1558618047-f4b511e9a1f4"),
                ("Metal Surface", "photo-1504970717470-e7e5294e8bd0"),
                ("Fabric Folds", "photo-1528459801416-a9e53bbf4e17"),
                ("Glass Reflections", "photo-1509114397022-ed747cca3f65"),
                # Technology
                ("Laptop Setup", "photo-1496181133206-80ce9b88a853"),
                ("Code Screen", "photo-1461749280684-dccba630e2f6"),
                ("Circuit Board", "photo-1518770660439-4636190af475"),
                ("VR Headset", "photo-1592478411213-6153e4ebc07d"),
                ("Drone Shot", "photo-1473968512647-3e447244af8f"),
                ("Camera Gear", "photo-1516035069371-29a1b244cc32"),
                ("Gaming Setup", "photo-1593305841991-05c297ba4575"),
                ("Smart Watch", "photo-1579586337278-3befd40fd17a"),
                ("Headphones", "photo-1505740420928-5e560c06d30e"),
                ("Phone Screen", "photo-1512941937669-90a1b58e7e9c"),
                # Travel
                ("Eiffel Tower", "photo-1502602898657-3e91760cbb34"),
                ("Tokyo Street", "photo-1540959733332-eab4deabeeaf"),
                ("Venice Canal", "photo-1523906834658-6e24ef2386f9"),
                ("Santorini", "photo-1570077188670-e3a8d69ac5ff"),
                ("Machu Picchu", "photo-1526392060635-9d6019884377"),
                ("Grand Canyon", "photo-1474044159687-1ee9f3a51722"),
                ("Great Wall", "photo-1508804185872-d7badad00f7d"),
                ("Safari Sunset", "photo-1516426122078-c23e76319801"),
                ("Maldives", "photo-1514282401047-d79a71a590e8"),
                ("Swiss Alps", "photo-1531366936337-7c912a4589a7"),
            ]

            fake_images = []
            # Different aspect ratios to test gallery layout handling
            aspect_ratios = [
                ("w=2400&h=1350", "landscape"),  # 16:9 landscape
                ("w=1350&h=2400", "portrait"),   # 9:16 portrait
                ("w=2000&h=2000", "square"),     # 1:1 square
                ("w=2400&h=1600", "wide"),       # 3:2 landscape
                ("w=1600&h=2400", "tall"),       # 2:3 portrait
                ("w=2400&h=1000", "ultrawide"),  # 21:9 ultrawide
                ("w=1000&h=2400", "ultratall"),  # 9:21 tall
            ]
            for i in range(2000):  # Create 2000 images for noticeable performance issues
                title, photo_id = photo_data[i % len(photo_data)]
                user = users[i % len(users)]
                # Cycle through different aspect ratios
                aspect_params, _ = aspect_ratios[i % len(aspect_ratios)]
                url = f"https://images.unsplash.com/{photo_id}?{aspect_params}&fit=crop&q=100"
                width, height = get_dimensions_from_url(url)
                fake_images.append(
                    Image(
                        title=f"{title} #{i+1}",
                        user=user,
                        url=url,
                        width=width,
                        height=height,
                        thumbnail_url=build_remote_thumbnail_url(url, CARD_THUMBNAIL_WIDTH),
                        thumbnail_2x_url=build_remote_thumbnail_url(url, HIGH_DENSITY_THUMBNAIL_WIDTH),
                    )
                )

            db.add_all(fake_images)
            await db.commit()

@app.get("/", response_model=dict)
def read_root():
    return {"Hello": "World"}

@app.post("/images/", response_model=ImageRead)
async def create_image(image: ImageCreate, db: AsyncSession = Depends(get_db)):
    maybe_fail()
    width = image.width
    height = image.height

    if not width or not height:
        width, height = get_dimensions_from_url(image.url)

    db_image = Image(
        title=image.title,
        user=image.user,
        url=image.url,
        width=width,
        height=height,
        thumbnail_url=build_remote_thumbnail_url(image.url, CARD_THUMBNAIL_WIDTH),
        thumbnail_2x_url=build_remote_thumbnail_url(image.url, HIGH_DENSITY_THUMBNAIL_WIDTH),
    )
    db.add(db_image)
    await db.commit()
    await db.refresh(db_image)
    return serialize_image(db_image)

@app.post("/images/upload", response_model=ImageRead)
async def upload_image(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    user: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db)
):
    maybe_fail()

    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"File type {file.content_type} not allowed. Use: {', '.join(allowed_types)}")

    # Validate file size (max 10MB)
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB.")

    # Save file with unique name
    ext = Path(file.filename).suffix if file.filename else ".jpg"
    filename = f"{uuid.uuid4()}{ext}"
    file_path = UPLOAD_DIR / filename

    with open(file_path, "wb") as f:
        f.write(contents)

    try:
        width, height, thumbnail_url, thumbnail_2x_url = create_thumbnail_variants(file_path)
    except UnidentifiedImageError:
        file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid image.")

    # Auto-generate title from filename if not provided
    if not title:
        original_name = Path(file.filename).stem if file.filename else "Untitled"
        # Clean up the filename: replace underscores/dashes with spaces, title case
        title = original_name.replace("_", " ").replace("-", " ").title()

    # Create database record
    url = f"{API_BASE_URL}/uploads/{filename}"
    db_image = Image(
        title=title,
        user=user or "Anonymous",
        url=url,
        width=width,
        height=height,
        thumbnail_url=thumbnail_url,
        thumbnail_2x_url=thumbnail_2x_url,
    )
    db.add(db_image)
    await db.commit()
    await db.refresh(db_image)
    return serialize_image(db_image)

@app.get("/images/", response_model=ImagePage)
async def list_images(
    limit: int = Query(50, ge=1, le=100),
    cursor: Optional[int] = Query(None, ge=1),
    db: AsyncSession = Depends(get_db),
):
    statement = select(Image).order_by(Image.id.desc()).limit(limit + 1)
    if cursor:
        statement = statement.where(Image.id < cursor)

    result = await db.execute(statement)
    images = result.scalars().all()
    page_items = images[:limit]
    next_cursor = page_items[-1].id if len(images) > limit and page_items else None

    return {
        "items": [serialize_image(image) for image in page_items],
        "next_cursor": next_cursor,
    }

@app.get("/images/{image_id}", response_model=ImageRead)
async def get_image(image_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Image).where(Image.id == image_id))
    image = result.scalar_one_or_none()
    if image is None:
        raise HTTPException(status_code=404, detail="Image not found")
    return serialize_image(image)

@app.delete("/images/{image_id}", status_code=204)
async def delete_image(image_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Image).where(Image.id == image_id))
    image = result.scalar_one_or_none()
    if image is None:
        raise HTTPException(status_code=404, detail="Image not found")
    local_upload_path = get_local_upload_path(image.url)
    if local_upload_path:
        local_upload_path.unlink(missing_ok=True)
        if image.thumbnail_url:
            thumbnail_path = get_local_upload_path(image.thumbnail_url, allow_thumbnails=True)
            if thumbnail_path:
                thumbnail_path.unlink(missing_ok=True)
        if image.thumbnail_2x_url:
            thumbnail_2x_path = get_local_upload_path(image.thumbnail_2x_url, allow_thumbnails=True)
            if thumbnail_2x_path:
                thumbnail_2x_path.unlink(missing_ok=True)
    await db.delete(image)
    await db.commit()
    return None
