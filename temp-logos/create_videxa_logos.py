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

def main():
    # The logo image should be in the same directory
    # User will need to save the attached image as 'videxa_logo_input.png'

    input_files = ['videxa_logo_input.png', 'logo.png', 'videxa.png']
    input_path = None

    for f in input_files:
        if os.path.exists(f):
            input_path = f
            break

    if not input_path:
        print("Error: Logo image not found!")
        print(f"Please save the attached circular 'A' logo as one of: {', '.join(input_files)}")
        print(f"\nCurrent directory: {os.getcwd()}")
        print(f"Files in directory: {os.listdir('.')}")
        return

    # Load the original image
    print(f"Loading {input_path}...")
    original = Image.open(input_path)

    # Convert to RGBA if needed
    if original.mode != 'RGBA':
        original = original.convert('RGBA')

    print(f"Original size: {original.size}")
    print(f"Original mode: {original.mode}")

    # Rotate 180 degrees as requested
    print("\nRotating 180 degrees...")
    rotated = original.rotate(180, expand=True)

    # Save the rotated full-size version
    output_name = 'logo.svg'  # We'll create PNG but keep this for reference
    rotated_png = 'videxa_logo_rotated.png'
    rotated.save(rotated_png, 'PNG', optimize=True)
    print(f"[OK] Saved rotated version: {rotated_png}")

    # Generate all required sizes
    print("\n" + "="*50)
    print("Generating favicon and icon files...")
    print("="*50)

    for filename, size in SIZES.items():
        print(f"\nCreating {filename} ({size[0]}x{size[1]})...")

        # Resize with high-quality resampling
        icon = rotated.resize(size, Image.Resampling.LANCZOS)

        # Save with optimization
        icon.save(filename, 'PNG', optimize=True)

        # Get file size
        size_kb = os.path.getsize(filename) / 1024
        print(f"  [OK] Saved: {filename} ({size_kb:.1f} KB)")

    print("\n" + "="*50)
    print("[SUCCESS] All icons generated successfully!")
    print("="*50)

    print("\nGenerated files:")
    all_files = [rotated_png] + list(SIZES.keys())
    for filename in all_files:
        if os.path.exists(filename):
            size_kb = os.path.getsize(filename) / 1024
            img = Image.open(filename)
            print(f"  [*] {filename:35s} - {img.size[0]:4d}x{img.size[1]:<4d} ({size_kb:6.1f} KB)")

    print("\n[NEXT STEPS]")
    print("1. Review the generated files")
    print("2. Copy them to: client/public/assets/")
    print("3. For logo.svg, you may want to manually create an SVG version")

if __name__ == '__main__':
    main()
