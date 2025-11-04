#!/usr/bin/env python3
"""
Verify Snowflake structure after script execution
"""
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

logger.info("Connecting to Snowflake...")
credential = AzureCliCredential()
secret_client = SecretClient(vault_url=VAULT_URL, credential=credential)
account = secret_client.get_secret("snowflake-account").value
user = secret_client.get_secret("snowflake-user").value
warehouse = secret_client.get_secret("snowflake-warehouse").value
private_key = get_private_key_from_kv(secret_client, "snowflake-agentnexus-private-key")
conn = snowflake.connector.connect(account=account, user=user, private_key=private_key, warehouse=warehouse, role="SYSADMIN")
logger.info("✅ Connected to Snowflake as SYSADMIN")

cursor = conn.cursor()

# Check VIDEXA_SHARED database
logger.info("\n=== VIDEXA_SHARED Database ===")
cursor.execute("USE DATABASE VIDEXA_SHARED")
cursor.execute("SHOW SCHEMAS")
logger.info("Schemas:")
for row in cursor.fetchall():
    logger.info(f"  {row[1]}")  # Schema name

# Check TENANT_MANAGEMENT schema
logger.info("\n=== TENANT_MANAGEMENT Schema ===")
cursor.execute("USE SCHEMA VIDEXA_SHARED.TENANT_MANAGEMENT")
cursor.execute("SHOW TABLES")
logger.info("Tables:")
tables = cursor.fetchall()
for row in tables:
    logger.info(f"  {row[1]}")  # Table name

# Check stored procedures
logger.info("\n=== Stored Procedures ===")
cursor.execute("SHOW PROCEDURES IN SCHEMA VIDEXA_SHARED.TENANT_MANAGEMENT")
procs = cursor.fetchall()
logger.info(f"Found {len(procs)} stored procedures")
for row in procs:
    logger.info(f"  {row[1]}")  # Procedure name

# Check organization databases (HCS0001_DB through HCS0020_DB)
logger.info("\n=== Organization Databases ===")
cursor.execute("SHOW DATABASES LIKE 'HCS%'")
org_dbs = cursor.fetchall()
logger.info(f"Found {len(org_dbs)} HCS organization databases")
for row in org_dbs[:5]:  # Show first 5
    logger.info(f"  {row[1]}")

cursor.close()
conn.close()
logger.info("\n✅ Verification complete")
