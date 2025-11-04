#!/usr/bin/env python3
"""
Execute Snowflake SQL with proper multi-statement handling
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

def execute_sql_file_multi(conn, file_path):
    """Execute SQL file using Snowflake's multi-statement support"""
    logger.info(f"\n{'='*80}\nExecuting: {file_path.name}\n{'='*80}")

    with open(file_path, 'r', encoding='utf-8') as f:
        sql_content = f.read()

    cursor = conn.cursor()

    try:
        # Use Snowflake's multi-statement execution
        # cursor.execute with num_statements=0 returns a generator of cursors
        statement_count = 0
        for cur in cursor.execute(sql_content, num_statements=0):
            statement_count += 1
            # cur is a SnowflakeCursor for each statement
            # Just silently consume results - we don't need to log every statement

        logger.info(f"✅ Completed: {file_path.name} ({statement_count} statements executed)")
        return True
    except Exception as e:
        logger.error(f"❌ Error in {file_path.name}: {str(e)}")
        return False
    finally:
        cursor.close()

logger.info("Connecting to Snowflake...")
conn = get_snowflake_connection()

# Execute all 5 SQL scripts in order
scripts = [
    Path("C:/videxa-repos/NexusChat/snowflake-setup/01-multi-tenant-structure.sql"),
    Path("C:/videxa-repos/NexusChat/snowflake-setup/02-token-efficient-cortex.sql"),
    Path("C:/videxa-repos/NexusChat/snowflake-setup/03-bulk-org-creation.sql"),
    Path("C:/videxa-repos/NexusChat/snowflake-setup/04-monitoring-views.sql"),
    Path("C:/videxa-repos/NexusChat/snowflake-setup/05-conversation-storage.sql"),
]

all_success = True
for script in scripts:
    if not script.exists():
        logger.error(f"❌ Script not found: {script}")
        all_success = False
        continue

    success = execute_sql_file_multi(conn, script)
    if not success:
        logger.error(f"❌ Failed to execute {script.name}, stopping execution")
        all_success = False
        break

conn.close()

if all_success:
    logger.info("\n" + "="*80)
    logger.info("✅ All Snowflake setup scripts executed successfully!")
    logger.info("="*80)
else:
    logger.error("\n" + "="*80)
    logger.error("❌ Snowflake setup failed - see errors above")
    logger.error("="*80)

sys.exit(0 if all_success else 1)
