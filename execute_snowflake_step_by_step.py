#!/usr/bin/env python3
"""
Execute Snowflake SQL step-by-step to identify exact failure point
"""
import sys
import logging
from pathlib import Path
from azure.identity import AzureCliCredential
from azure.keyvault.secrets import SecretClient
import snowflake.connector
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

VAULT_URL = "https://kv-agentnexus-prd-cus.vault.azure.net/"

def get_private_key_from_kv(secret_client, secret_name):
    secret = secret_client.get_secret(secret_name)
    key_value = secret.value
    if "-----BEGIN" in key_value and "-----END" in key_value:
        key_value = key_value.replace(" ", "").replace("\r", "").replace("\n", "")
        start = key_value.find("KEY-----") + 8
        end = key_value.find("-----END")
        if start > 8 and end > start:
            base64_data = key_value[start:end]
            pem_lines = ["-----BEGIN PRIVATE KEY-----"]
            for i in range(0, len(base64_data), 64):
                pem_lines.append(base64_data[i:i+64])
            pem_lines.append("-----END PRIVATE KEY-----")
            formatted_pem = "\n".join(pem_lines)
            private_key = serialization.load_pem_private_key(formatted_pem.encode('utf-8'), password=None, backend=default_backend())
            der = private_key.private_bytes(encoding=serialization.Encoding.DER, format=serialization.PrivateFormat.PKCS8, encryption_algorithm=serialization.NoEncryption())
            return der
    return key_value.encode('utf-8')

def get_snowflake_connection():
    credential = AzureCliCredential()
    secret_client = SecretClient(vault_url=VAULT_URL, credential=credential)
    account = secret_client.get_secret("snowflake-account").value
    user = secret_client.get_secret("snowflake-user").value
    warehouse = secret_client.get_secret("snowflake-warehouse").value
    private_key = get_private_key_from_kv(secret_client, "snowflake-agentnexus-private-key")
    conn = snowflake.connector.connect(account=account, user=user, private_key=private_key, warehouse=warehouse, role="SYSADMIN")
    logger.info("✅ Connected to Snowflake as SYSADMIN")
    return conn

logger.info("Connecting to Snowflake...")
conn = get_snowflake_connection()
cursor = conn.cursor()

# Test basic statements
logger.info("\n1. Testing USE ROLE SYSADMIN")
try:
    cursor.execute("USE ROLE SYSADMIN")
    logger.info("✅ USE ROLE succeeded")
except Exception as e:
    logger.error(f"❌ USE ROLE failed: {e}")

logger.info("\n2. Testing CREATE DATABASE")
try:
    cursor.execute("CREATE DATABASE IF NOT EXISTS VIDEXA_SHARED COMMENT = 'Shared tenant management database'")
    logger.info("✅ CREATE DATABASE succeeded")
except Exception as e:
    logger.error(f"❌ CREATE DATABASE failed: {e}")

logger.info("\n3. Testing USE DATABASE")
try:
    cursor.execute("USE DATABASE VIDEXA_SHARED")
    logger.info("✅ USE DATABASE succeeded")
except Exception as e:
    logger.error(f"❌ USE DATABASE failed: {e}")

logger.info("\n4. Testing CREATE SCHEMA")
try:
    cursor.execute("CREATE SCHEMA IF NOT EXISTS VIDEXA_SHARED.TENANT_MANAGEMENT COMMENT = 'Tenant management schema'")
    logger.info("✅ CREATE SCHEMA succeeded")
except Exception as e:
    logger.error(f"❌ CREATE SCHEMA failed: {e}")

logger.info("\n5. Testing USE SCHEMA")
try:
    cursor.execute("USE SCHEMA VIDEXA_SHARED.TENANT_MANAGEMENT")
    logger.info("✅ USE SCHEMA succeeded")
except Exception as e:
    logger.error(f"❌ USE SCHEMA failed: {e}")

logger.info("\n6. Verifying database exists")
try:
    cursor.execute("SHOW DATABASES LIKE 'VIDEXA_SHARED'")
    rows = cursor.fetchall()
    logger.info(f"Found {len(rows)} database(s)")
    for row in rows:
        logger.info(f"  {row[1]}")  # Database name is in column 1
except Exception as e:
    logger.error(f"❌ SHOW DATABASES failed: {e}")

cursor.close()
conn.close()
logger.info("\n✅ All tests complete")
