#!/usr/bin/env python3
"""
Inject images into Clio's history as art_result (as if she generated them).

Usage:
    python inject-clio-art.py <image_path> [--internal "note"] [--prompt "original prompt"]
    python inject-clio-art.py /path/to/image.png --internal "Creative exploration"
    python inject-clio-art.py /path/to/*.png  # Multiple images

The script:
1. Reads the image file
2. Compresses to JPEG if PNG and > 200KB
3. Posts to /inject-art endpoint
4. Image appears in Clio's gallery as art_result
"""

import sys
import os
import base64
import argparse
import requests
from glob import glob

try:
    from PIL import Image
    import io
    HAS_PIL = True
except ImportError:
    HAS_PIL = False
    print("Note: PIL not installed. Large images won't be compressed.")
    print("Install with: pip install Pillow")

API_URL = "https://your-worker.workers.dev/inject-art"

def compress_image(image_path, max_size=1024, quality=75):
    """Compress image to JPEG, resize if needed, return data URL."""
    if not HAS_PIL:
        # Fallback: just read and encode as-is
        with open(image_path, 'rb') as f:
            data = f.read()
        ext = os.path.splitext(image_path)[1].lower()
        mime = 'image/png' if ext == '.png' else 'image/jpeg'
        b64 = base64.b64encode(data).decode()
        return f'data:{mime};base64,{b64}'

    img = Image.open(image_path)

    # Resize if larger than max_size
    if img.width > max_size or img.height > max_size:
        img.thumbnail((max_size, max_size), Image.LANCZOS)

    # Convert to JPEG
    buffer = io.BytesIO()
    img.convert('RGB').save(buffer, format='JPEG', quality=quality)
    b64 = base64.b64encode(buffer.getvalue()).decode()

    return f'data:image/jpeg;base64,{b64}'

def inject_image(image_path, internal=None, prompt=None):
    """Inject a single image into Clio's history."""
    if not os.path.exists(image_path):
        print(f"  Error: File not found: {image_path}")
        return False

    # Get file size
    file_size = os.path.getsize(image_path)

    # Compress if needed (> 200KB)
    if file_size > 200 * 1024:
        print(f"  Compressing ({file_size // 1024}KB -> JPEG)...")
        data_url = compress_image(image_path)
    else:
        # Read and encode directly
        with open(image_path, 'rb') as f:
            data = f.read()
        ext = os.path.splitext(image_path)[1].lower()
        mime = 'image/png' if ext == '.png' else 'image/jpeg' if ext in ['.jpg', '.jpeg'] else 'image/webp'
        b64 = base64.b64encode(data).decode()
        data_url = f'data:{mime};base64,{b64}'

    # Build payload
    payload = {'image': data_url}
    if internal:
        payload['internal'] = internal
    if prompt:
        payload['prompt'] = prompt

    # Post to API
    try:
        response = requests.post(API_URL, json=payload, timeout=30)
        result = response.json()

        if result.get('success'):
            print(f"  Injected as Clio's art")
            return True
        else:
            print(f"  Error: {result.get('error', 'Unknown error')}")
            return False
    except Exception as e:
        print(f"  Error: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Inject images as Clio's generated art")
    parser.add_argument('images', nargs='+', help='Image file(s) or glob pattern')
    parser.add_argument('--internal', '-i', help='Internal note for the art')
    parser.add_argument('--prompt', '-p', help='Original prompt (used as internal if no internal given)')

    args = parser.parse_args()

    # Expand globs
    image_paths = []
    for pattern in args.images:
        expanded = glob(pattern)
        if expanded:
            image_paths.extend(expanded)
        else:
            image_paths.append(pattern)  # Maybe it's a direct path

    if not image_paths:
        print("No images found")
        sys.exit(1)

    print(f"Injecting {len(image_paths)} image(s) as Clio's art...")

    success_count = 0
    for path in image_paths:
        print(f"\n{os.path.basename(path)}:")
        if inject_image(path, args.internal, args.prompt):
            success_count += 1

    print(f"\nDone: {success_count}/{len(image_paths)} images injected")

    if success_count < len(image_paths):
        sys.exit(1)

if __name__ == '__main__':
    main()
