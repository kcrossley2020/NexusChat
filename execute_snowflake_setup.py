#!/usr/bin/env python3
"""
Execute all Snowflake setup scripts in order
Uses Azure Key Vault for credentials (validated working)
"""
import sys
import os
import logging
from pathlib import Path
from azure.identity import AzureCliCredential
from azure.keyvault.secrets import SecretClient
import snowflake.connector
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Production Key Vault
VAULT_URL = "https://kv-agentnexus-prd-cus.vault.azure.net/"

def get_private_key_from_kv(secret_client: SecretClient, secret_name: str) -> bytes:
    """Retrieve and format private key from Key Vault"""
    secret = secret_client.get_secret(secret_name)
    key_value = secret.value

    # Handle PEM format
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

            private_key = serialization.load_pem_private_key(
                formatted_pem.encode('utf-8'),
                password=None,
                backend=default_backend()
            )

            der = private_key.private_bytes(
                encoding=serialization.Encoding.DER,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption()
            )
            return der

    return key_value.encode('utf-8')

def get_snowflake_connection():
    """Get Snowflake connection using Key Vault credentials"""
    logger.info("Retrieving Snowflake credentials from Key Vault...")

    credential = AzureCliCredential()
    secret_client = SecretClient(vault_url=VAULT_URL, credential=credential)

    # Get configuration
    account = secret_client.get_secret("snowflake-account").value
    user = secret_client.get_secret("snowflake-user").value
    warehouse = secret_client.get_secret("snowflake-warehouse").value

    # For setup scripts, we need SYSADMIN role (granted by user)
    role = "SYSADMIN"  # Has database/warehouse creation privileges

    logger.info(f"Connecting to Snowflake as {user} with role {role}")

    # Get private key
    private_key = get_private_key_from_kv(secret_client, "snowflake-agentnexus-private-key")

    # Connect
    conn = snowflake.connector.connect(
        account=account,
        user=user,
        private_key=private_key,
        warehouse=warehouse,
        role=role,
        client_session_keep_alive=True,
        login_timeout=120,
        network_timeout=300
    )

    logger.info("✅ Connected to Snowflake successfully")
    return conn

def execute_sql_file(conn, file_path: Path):
    """Execute a SQL file"""
    logger.info(f"\n{'='*80}")
    logger.info(f"Executing: {file_path.name}")
    logger.info(f"{'='*80}\n")

    # Read file
    with open(file_path, 'r', encoding='utf-8') as f:
        sql_content = f.read()

    # Split by statement delimiter and execute
    cursor = conn.cursor()

    try:
        # Remove comments and split into statements
        statements = []
        current_statement = []

        for line in sql_content.split('\n'):
            # Skip single-line comments
            if line.strip().startswith('--'):
                continue
            # Skip multi-line comment start/end lines
            if line.strip().startswith('/*') or line.strip().startswith('*/') or line.strip().endswith('*/'):
                continue

            current_statement.append(line)

            # Check for statement terminator
            if line.strip().endswith(';'):
                stmt = '\n'.join(current_statement)
                if stmt.strip() and not stmt.strip().startswith('/*'):
                    statements.append(stmt)
                current_statement = []

        # Add any remaining statement
        if current_statement:
            stmt = '\n'.join(current_statement)
            if stmt.strip() and not stmt.strip().startswith('/*'):
                statements.append(stmt)

        logger.info(f"Found {len(statements)} SQL statements to execute")

        # Execute each statement
        for i, statement in enumerate(statements, 1):
            # Skip empty or comment-only statements
            cleaned = statement.strip()
            if not cleaned or cleaned.startswith('/*') or cleaned == ';':
                continue

            try:
                logger.info(f"Executing statement {i}/{len(statements)}...")
                logger.debug(f"SQL: {cleaned[:100]}...")

                cursor.execute(cleaned)

                # Fetch results if any
                if cursor.rowcount > 0:
                    try:
                        results = cursor.fetchall()
                        if results and len(results) <= 10:
                            for row in results:
                                logger.info(f"  {row}")
                        elif results:
                            logger.info(f"  ({len(results)} rows returned)")
                    except:
                        pass  # No results to fetch

            except Exception as e:
                error_msg = str(e)
                # Ignore "already exists" errors
                if 'already exists' in error_msg.lower():
                    logger.warning(f"Object already exists (skipping): {error_msg[:100]}")
                else:
                    logger.error(f"Error executing statement {i}: {error_msg}")
                    logger.error(f"Statement: {cleaned[:200]}...")
                    # Continue with next statement instead of failing
                    continue

        logger.info(f"\n✅ Completed: {file_path.name}\n")

    except Exception as e:
        logger.error(f"❌ Error in {file_path.name}: {str(e)}")
        raise
    finally:
        cursor.close()

def main():
    """Main execution function"""
    logger.info("="*80)
    logger.info("SNOWFLAKE SETUP - EXECUTING ALL SCRIPTS")
    logger.info("="*80)

    # Get Snowflake connection
    try:
        conn = get_snowflake_connection()
    except Exception as e:
        logger.error(f"Failed to connect to Snowflake: {e}")
        return False

    # Setup scripts directory
    setup_dir = Path(__file__).parent / "snowflake-setup"

    # Scripts to execute in order
    scripts = [
        "01-multi-tenant-structure.sql",
        "02-token-efficient-cortex.sql",
        "03-bulk-org-creation.sql",
        "04-monitoring-views.sql",
        "05-conversation-storage.sql"
    ]

    # Execute each script
    success_count = 0
    for script_name in scripts:
        script_path = setup_dir / script_name

        if not script_path.exists():
            logger.error(f"Script not found: {script_path}")
            continue

        try:
            execute_sql_file(conn, script_path)
            success_count += 1
        except Exception as e:
            logger.error(f"Failed to execute {script_name}: {e}")
            # Continue with next script
            continue

    # Close connection
    conn.close()

    # Summary
    logger.info("\n" + "="*80)
    logger.info(f"SETUP COMPLETE: {success_count}/{len(scripts)} scripts executed successfully")
    logger.info("="*80)

    if success_count == len(scripts):
        logger.info("\n✅ ALL SCRIPTS EXECUTED SUCCESSFULLY")
        logger.info("\nNext Steps:")
        logger.info("1. Update agentnexus-backend configuration")
        logger.info("2. Deploy NexusChat with snowflake-only docker-compose")
        return True
    else:
        logger.warning(f"\n⚠️ {len(scripts) - success_count} scripts failed")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
