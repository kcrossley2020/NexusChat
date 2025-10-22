#!/usr/bin/env python3
"""
Generate Videxa logo assets in all required sizes
Rotates the input image 180 degrees and creates various sizes
"""

from PIL import Image
import os

# Define the sizes we need
SIZES = {
    'favicon-16x16.png': (16, 16),
    'favicon-32x32.png': (32, 32),
    'apple-touch-icon-180x180.png': (180, 180),
    'icon-192x192.png': (192, 192),
    'maskable-icon.png': (512, 512),
}

def create_circular_icon(img, size):
    """Create a circular icon with transparent background"""
    # Create a new image with transparency
    output = Image.new('RGBA', size, (0, 0, 0, 0))

    # Resize the input image to fit
    img_resized = img.resize(size, Image.Resampling.LANCZOS)

    # Create a circular mask
    mask = Image.new('L', size, 0)
    from PIL import ImageDraw
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0) + size, fill=255)

    # Apply the mask
    output.paste(img_resized, (0, 0))
    output.putalpha(mask)

    return output

def main():
    # Input image path (the attached image)
    input_path = 'videxa_logo_original.png'

    if not os.path.exists(input_path):
        print(f"Error: {input_path} not found!")
        print("Please save the attached image as 'videxa_logo_original.png' in this directory")
        return

    # Load the original image
    print(f"Loading {input_path}...")
    original = Image.open(input_path)

    # Convert to RGBA if needed
    if original.mode != 'RGBA':
        original = original.convert('RGBA')

    print(f"Original size: {original.size}")

    # Rotate 180 degrees
    print("Rotating 180 degrees...")
    rotated = original.rotate(180, expand=True)

    # Save the rotated full-size version
    rotated.save('videxa_logo_rotated.png', 'PNG')
    print(f"Saved: videxa_logo_rotated.png")

    # Generate all required sizes
    print("\nGenerating icons...")
    for filename, size in SIZES.items():
        print(f"Creating {filename} ({size[0]}x{size[1]})...")

        # For circular icons (maskable), create circular version
        if 'maskable' in filename:
            icon = create_circular_icon(rotated, size)
        else:
            # Regular resize with anti-aliasing
            icon = rotated.resize(size, Image.Resampling.LANCZOS)

        icon.save(filename, 'PNG', optimize=True)
        print(f"  ✓ Saved: {filename}")

    print("\n✅ All icons generated successfully!")
    print("\nGenerated files:")
    for filename in ['videxa_logo_rotated.png'] + list(SIZES.keys()):
        if os.path.exists(filename):
            size_kb = os.path.getsize(filename) / 1024
            print(f"  - {filename} ({size_kb:.1f} KB)")

if __name__ == '__main__':
    main()
