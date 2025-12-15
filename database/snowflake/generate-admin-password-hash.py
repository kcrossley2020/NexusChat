#!/usr/bin/env python3
"""
Generate bcrypt password hash for system administrator
========================================================
This simple script generates a bcrypt hash for the system admin password.
Run this to get the hash, then manually insert it into Snowflake.

Usage:
    python generate-admin-password-hash.py

Output:
    Bcrypt hash string to use in SQL INSERT statement
"""

import bcrypt

# System Admin Password (GUID)
SYSTEM_ADMIN_PASSWORD = "8a093b79-bee6-4d70-8a98-2bc7657c8e7f"

def generate_hash(password: str) -> str:
    """Generate bcrypt hash with 12 rounds"""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode(), salt).decode()

if __name__ == "__main__":
    print("=" * 70)
    print("SYSTEM ADMINISTRATOR PASSWORD HASH GENERATOR")
    print("=" * 70)
    print(f"Password: {SYSTEM_ADMIN_PASSWORD}")
    print("\nGenerating bcrypt hash (12 rounds)...")

    password_hash = generate_hash(SYSTEM_ADMIN_PASSWORD)

    print("\nHash generated successfully!")
    print("=" * 70)
    print("COPY THIS HASH FOR SQL INSERT:")
    print("=" * 70)
    print(password_hash)
    print("=" * 70)
    print("\nUse this hash in the setup-system-admin-manual.sql script")
    print("Replace 'YOUR_BCRYPT_HASH_HERE' with the hash above")
    print("=" * 70)
