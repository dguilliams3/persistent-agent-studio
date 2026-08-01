"""
Video-to-GIF Modal App

@description Main Modal application for converting video to optimized animated GIF.
    Receives video bytes, runs ffmpeg 2-pass palette optimization, returns base64 GIF.
    Uses intelligent size optimization cascade if output exceeds limits.

@upstream Called by: Cloudflare Worker (worker/src/services/video.js)
@downstream Calls: ffmpeg (system binary)

@example
    # Deploy:
    modal deploy modal_app.py

    # Test locally:
    modal serve modal_app.py

    # Call endpoint:
    curl -X POST https://your-username--video-to-gif-convert.modal.run \
        -H "Content-Type: video/mp4" \
        --data-binary @video.mp4

@note Cold starts are ~5 seconds due to container spinup. Warm requests are ~1-3s
    depending on video length.
"""

import modal
from fastapi import Request
import tempfile
import subprocess
import os
import base64
import json

# Define the Modal app
app = modal.App("video-to-gif")

# Define the container image with ffmpeg
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg")
    .pip_install("fastapi")
)

# Size optimization presets - try each in order until under limit
# PRIORITY: More frames > higher resolution (for temporal/motion analysis)
# Claude needs to see the motion, not count pixels. Keep 480px as long as possible.
OPTIMIZATION_PRESETS = [
    # First: reduce fps at 480px width
    {"fps": 10, "width": 480, "label": "480p-10fps"},
    {"fps": 8, "width": 480, "label": "480p-8fps"},
    {"fps": 6, "width": 480, "label": "480p-6fps"},
    {"fps": 5, "width": 480, "label": "480p-5fps"},
    {"fps": 4, "width": 480, "label": "480p-4fps"},
    {"fps": 3, "width": 480, "label": "480p-3fps"},
    {"fps": 2, "width": 480, "label": "480p-2fps"},
    # Then: drop to 360px if still too big
    {"fps": 4, "width": 360, "label": "360p-4fps"},
    {"fps": 3, "width": 360, "label": "360p-3fps"},
    {"fps": 2, "width": 360, "label": "360p-2fps"},
    # Then: 320px
    {"fps": 3, "width": 320, "label": "320p-3fps"},
    {"fps": 2, "width": 320, "label": "320p-2fps"},
    # Last resort: 240px (thumbnail quality but still shows motion)
    {"fps": 2, "width": 240, "label": "240p-2fps"},
]

# Default max output size - 5MB matches Claude's API limit
# Worker can override this via X-Max-Output-Bytes header for smaller limits
DEFAULT_MAX_OUTPUT_SIZE = 5_000_000  # 5MB - Claude's image API limit


def probe_video_duration(video_path: str) -> float:
    """
    @description Get video duration in seconds using ffprobe.

    @param video_path Path to video file
    @returns Duration in seconds, or 0 if probe fails
    """
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                video_path
            ],
            capture_output=True,
            text=True
        )
        return float(result.stdout.strip()) if result.stdout.strip() else 0
    except Exception:
        return 0


def convert_with_params(video_path: str, output_path: str, fps: int, width: int) -> bool:
    """
    @description Run ffmpeg 2-pass palette optimization with given parameters.

    @param video_path Input video path
    @param output_path Output GIF path
    @param fps Frames per second
    @param width Output width (height auto-calculated)
    @returns True if conversion succeeded
    """
    palette_path = output_path.replace(".gif", "_palette.png")

    try:
        # Pass 1: Generate optimal palette for this video's colors
        filter_chain = f"fps={fps},scale={width}:-1:flags=lanczos,palettegen"
        subprocess.run(
            ["ffmpeg", "-y", "-i", video_path, "-vf", filter_chain, palette_path],
            check=True,
            capture_output=True
        )

        # Pass 2: Apply palette using paletteuse for dithering
        filter_chain = f"fps={fps},scale={width}:-1:flags=lanczos[x];[x][1:v]paletteuse"
        subprocess.run(
            [
                "ffmpeg", "-y",
                "-i", video_path,
                "-i", palette_path,
                "-lavfi", filter_chain,
                "-loop", "0",  # Loop forever
                output_path
            ],
            check=True,
            capture_output=True
        )

        return True

    except subprocess.CalledProcessError:
        return False

    finally:
        # Clean up palette
        if os.path.exists(palette_path):
            os.unlink(palette_path)


@app.function(
    image=image,
    timeout=60,     # 60 seconds - generous for short videos
    memory=1024,    # 1GB RAM for video processing
)
@modal.fastapi_endpoint(method="POST")
async def convert(request: Request) -> dict:
    """
    @description Convert video to optimized GIF with automatic size optimization.

    @upstream Called by: HTTP POST from Cloudflare Worker
    @downstream Calls: ffprobe, ffmpeg (2-pass)

    @param request FastAPI Request object containing raw video bytes in body
        Headers:
        - X-Max-Duration: Maximum allowed video duration (default: 15, range: 3-15)
        - X-Target-FPS: Force specific fps (skips cascade if set)
        - X-Target-Width: Force specific width (skips cascade if set)
        - X-Max-Output-Bytes: Maximum output size in bytes (default: 5MB)

    @returns dict with keys:
        - success: bool
        - gif_base64: base64-encoded GIF (if success)
        - gif_size_bytes: output size in bytes
        - input_duration_seconds: original video duration
        - frame_count: approximate number of frames
        - dimensions: output dimensions string
        - quality_preset: which optimization preset was used
        - error: error message (if failed)

    @example
        curl -X POST https://endpoint.modal.run \
            -H "Content-Type: video/mp4" \
            -H "X-Max-Duration: 10" \
            --data-binary @video.mp4
    """
    video_bytes = await request.body()

    if not video_bytes:
        return {"success": False, "error": "No video data received"}

    # Get optional parameters from headers
    max_duration = int(request.headers.get("X-Max-Duration", "15"))
    max_output_bytes = int(request.headers.get("X-Max-Output-Bytes", str(DEFAULT_MAX_OUTPUT_SIZE)))

    # Force specific fps/width if provided (skips cascade)
    force_fps = request.headers.get("X-Target-FPS")
    force_width = request.headers.get("X-Target-Width")

    # Clamp max_duration to allowed range (3-15 seconds)
    max_duration = max(3, min(15, max_duration))

    # Clamp max_output_bytes to reasonable range (100KB - 5MB)
    max_output_bytes = max(100_000, min(5_000_000, max_output_bytes))

    with tempfile.TemporaryDirectory() as tmpdir:
        video_path = os.path.join(tmpdir, "input.mp4")
        gif_path = os.path.join(tmpdir, "output.gif")

        # Write input video
        with open(video_path, "wb") as f:
            f.write(video_bytes)

        # Probe video duration
        duration = probe_video_duration(video_path)

        if duration <= 0:
            return {"success": False, "error": "Could not determine video duration"}

        if duration > max_duration:
            return {
                "success": False,
                "error": f"Video too long: {duration:.1f}s > {max_duration}s max"
            }

        # If both fps and width are forced, try that specific setting first
        if force_fps and force_width:
            fps = int(force_fps)
            width = int(force_width)
            label = f"{width}p-{fps}fps-forced"

            success = convert_with_params(video_path, gif_path, fps, width)
            if success and os.path.exists(gif_path):
                gif_size = os.path.getsize(gif_path)
                if gif_size <= max_output_bytes:
                    with open(gif_path, "rb") as f:
                        gif_bytes = f.read()
                    return {
                        "success": True,
                        "gif_base64": base64.b64encode(gif_bytes).decode("utf-8"),
                        "gif_size_bytes": gif_size,
                        "input_duration_seconds": round(duration, 2),
                        "frame_count": int(duration * fps),
                        "dimensions": f"{width}x(auto)",
                        "quality_preset": label
                    }
                # Forced settings too big - fall through to cascade
                os.unlink(gif_path)

        # Try each optimization preset until we get under the size limit
        smallest_size = None
        smallest_preset = None

        for preset in OPTIMIZATION_PRESETS:
            fps = preset["fps"]
            width = preset["width"]
            label = preset["label"]

            success = convert_with_params(video_path, gif_path, fps, width)

            if not success:
                continue  # Try next preset

            # Check output size
            if not os.path.exists(gif_path):
                continue

            gif_size = os.path.getsize(gif_path)

            # Track smallest achieved
            if smallest_size is None or gif_size < smallest_size:
                smallest_size = gif_size
                smallest_preset = label

            if gif_size <= max_output_bytes:
                # Success! Read and return the GIF
                with open(gif_path, "rb") as f:
                    gif_bytes = f.read()

                return {
                    "success": True,
                    "gif_base64": base64.b64encode(gif_bytes).decode("utf-8"),
                    "gif_size_bytes": gif_size,
                    "input_duration_seconds": round(duration, 2),
                    "frame_count": int(duration * fps),
                    "dimensions": f"{width}x(auto)",
                    "quality_preset": label
                }

            # Too large, try next preset
            os.unlink(gif_path)

        # All presets exhausted - report actual size achieved
        size_mb = smallest_size / (1024 * 1024) if smallest_size else 0
        limit_mb = max_output_bytes / (1024 * 1024)
        return {
            "success": False,
            "error": f"Video still {size_mb:.1f}MB at {smallest_preset} quality (limit: {limit_mb:.1f}MB). Duration: {duration:.1f}s. Video may be too long or complex."
        }


@app.function(image=image)
@modal.fastapi_endpoint(method="GET")
def health() -> dict:
    """
    @description Health check endpoint for monitoring.

    @returns dict with status and version info
    """
    # Verify ffmpeg is available
    try:
        result = subprocess.run(["ffmpeg", "-version"], capture_output=True)
        ffmpeg_ok = result.returncode == 0
    except Exception:
        ffmpeg_ok = False

    return {
        "status": "ok" if ffmpeg_ok else "degraded",
        "version": "1.2.0",  # Configurable output size, more presets
        "capabilities": ["video-to-gif", "palette-optimization", "size-cascade", "r2-storage", "configurable-quality"],
        "ffmpeg_available": ffmpeg_ok,
        "default_max_output_mb": DEFAULT_MAX_OUTPUT_SIZE // (1024 * 1024),
        "presets": [p["label"] for p in OPTIMIZATION_PRESETS]
    }


# For local testing
if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        print("Testing video-to-gif conversion...")
        with open(sys.argv[1], "rb") as f:
            video_bytes = f.read()

        # Create mock request
        class MockRequest:
            headers = {}
            async def body(self):
                return video_bytes

        import asyncio
        result = asyncio.run(convert(MockRequest()))
        print(json.dumps({k: v for k, v in result.items() if k != "gif_base64"}, indent=2))
        if result.get("success"):
            print(f"GIF base64 length: {len(result.get('gif_base64', ''))} chars")
    else:
        print("Usage: python modal_app.py <video_file>")
