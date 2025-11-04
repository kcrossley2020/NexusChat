"""
Bulk Data Loader for HCS Organizations
Loads claims and patient data into Snowflake and generates embeddings
"""

import argparse
import snowflake.connector
from azure.identity import DefaultAzureCredential
from azure.keyvault.secrets import SecretClient
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend
import csv
import os
import logging
from datetime import datetime
from typing import List, Dict

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class HCSDataLoader:
    """Loads HCS data into Snowflake with embeddings for semantic search"""

    def __init__(self, org_id: str):
        self.org_id = org_id
        self.connection = None
        self._connect()

    def _get_snowflake_config(self) -> Dict[str, str]:
        """Fetch Snowflake credentials from Azure Key Vault"""
        key_vault_url = os.getenv('AZURE_KEY_VAULT_URL', 'https://videxa-keyvault.vault.azure.net/')

        try:
            credential = DefaultAzureCredential()
            secret_client = SecretClient(vault_url=key_vault_url, credential=credential)

            config = {
                'account': secret_client.get_secret('snowflake-account').value,
                'user': secret_client.get_secret('snowflake-user').value,
                'warehouse': secret_client.get_secret('snowflake-warehouse').value,
                'role': secret_client.get_secret('snowflake-role').value,
                'private_key_pem': secret_client.get_secret('snowflake-agentnexus-private-key').value
            }

            logger.info(f"Retrieved Snowflake config from Key Vault for user: {config['user']}")
            return config

        except Exception as e:
            logger.error(f"Failed to fetch config from Key Vault: {e}")
            raise

    def _get_private_key_bytes(self, pem_string: str) -> bytes:
        """Convert PEM private key to DER bytes"""
        private_key = serialization.load_pem_private_key(
            pem_string.encode(),
            password=None,
            backend=default_backend()
        )

        return private_key.private_bytes(
            encoding=serialization.Encoding.DER,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        )

    def _connect(self):
        """Establish Snowflake connection"""
        config = self._get_snowflake_config()
        private_key_bytes = self._get_private_key_bytes(config['private_key_pem'])

        try:
            # Get org-specific database and warehouse
            self.connection = snowflake.connector.connect(
                account=config['account'],
                user=config['user'],
                private_key=private_key_bytes,
                warehouse=config['warehouse'],
                role=config['role']
            )

            # Get org details
            cursor = self.connection.cursor()
            cursor.execute(f"""
                SELECT DATABASE_NAME, WAREHOUSE_NAME, ROLE_NAME
                FROM VIDEXA_SHARED.TENANT_MANAGEMENT.ORGANIZATIONS
                WHERE ORG_ID = '{self.org_id}'
            """)
            org_config = cursor.fetchone()
            cursor.close()

            if not org_config:
                raise ValueError(f"Organization {self.org_id} not found in Snowflake")

            self.database = org_config[0]
            self.warehouse = org_config[1]
            self.role = org_config[2]

            # Switch to org context
            cursor = self.connection.cursor()
            cursor.execute(f"USE ROLE {self.role}")
            cursor.execute(f"USE WAREHOUSE {self.warehouse}")
            cursor.execute(f"USE DATABASE {self.database}")
            cursor.close()

            logger.info(f"Connected to Snowflake as {config['user']}, using database {self.database}")

        except Exception as e:
            logger.error(f"Failed to connect to Snowflake: {e}")
            raise

    def load_claims_from_csv(self, csv_file: str, batch_size: int = 1000) -> int:
        """
        Load claims from CSV file into INSURANCE_CLAIMS table

        Expected CSV format:
        claim_id,patient_id,policy_number,claim_date,service_date,provider_name,
        diagnosis_code,procedure_code,claim_amount,approved_amount,paid_amount,
        claim_status,denial_reason,notes
        """
        logger.info(f"Loading claims from {csv_file}...")

        cursor = self.connection.cursor()
        cursor.execute(f"USE SCHEMA CLAIMS")

        loaded_count = 0
        batch = []

        try:
            with open(csv_file, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)

                for row in reader:
                    batch.append(row)

                    if len(batch) >= batch_size:
                        self._insert_claims_batch(cursor, batch)
                        loaded_count += len(batch)
                        logger.info(f"Loaded {loaded_count} claims...")
                        batch = []

                # Insert remaining batch
                if batch:
                    self._insert_claims_batch(cursor, batch)
                    loaded_count += len(batch)

            self.connection.commit()
            logger.info(f"✅ Loaded {loaded_count} claims into {self.database}.CLAIMS.INSURANCE_CLAIMS")

            return loaded_count

        except Exception as e:
            logger.error(f"Failed to load claims: {e}")
            self.connection.rollback()
            raise
        finally:
            cursor.close()

    def _insert_claims_batch(self, cursor, batch: List[Dict]):
        """Insert batch of claims"""
        insert_query = """
            INSERT INTO INSURANCE_CLAIMS (
                CLAIM_ID, PATIENT_ID, POLICY_NUMBER, CLAIM_DATE, SERVICE_DATE,
                PROVIDER_NAME, DIAGNOSIS_CODE, PROCEDURE_CODE,
                CLAIM_AMOUNT, APPROVED_AMOUNT, PAID_AMOUNT, CLAIM_STATUS,
                DENIAL_REASON, NOTES
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        values = []
        for row in batch:
            values.append((
                row['claim_id'],
                row['patient_id'],
                row.get('policy_number'),
                row['claim_date'],
                row.get('service_date'),
                row.get('provider_name'),
                row.get('diagnosis_code'),
                row.get('procedure_code'),
                float(row['claim_amount']) if row.get('claim_amount') else None,
                float(row['approved_amount']) if row.get('approved_amount') else None,
                float(row['paid_amount']) if row.get('paid_amount') else None,
                row.get('claim_status'),
                row.get('denial_reason'),
                row.get('notes')
            ))

        cursor.executemany(insert_query, values)

    def load_patients_from_csv(self, csv_file: str, batch_size: int = 1000) -> int:
        """
        Load patients from CSV file into PATIENT_RECORDS table

        Expected CSV format:
        patient_id,date_of_birth,gender,zip_code,policy_number,
        policy_start_date,policy_end_date,plan_type
        """
        logger.info(f"Loading patients from {csv_file}...")

        cursor = self.connection.cursor()
        cursor.execute(f"USE SCHEMA PATIENTS")

        loaded_count = 0
        batch = []

        try:
            with open(csv_file, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)

                for row in reader:
                    batch.append(row)

                    if len(batch) >= batch_size:
                        self._insert_patients_batch(cursor, batch)
                        loaded_count += len(batch)
                        logger.info(f"Loaded {loaded_count} patients...")
                        batch = []

                # Insert remaining batch
                if batch:
                    self._insert_patients_batch(cursor, batch)
                    loaded_count += len(batch)

            self.connection.commit()
            logger.info(f"✅ Loaded {loaded_count} patients into {self.database}.PATIENTS.PATIENT_RECORDS")

            return loaded_count

        except Exception as e:
            logger.error(f"Failed to load patients: {e}")
            self.connection.rollback()
            raise
        finally:
            cursor.close()

    def _insert_patients_batch(self, cursor, batch: List[Dict]):
        """Insert batch of patients"""
        insert_query = """
            INSERT INTO PATIENT_RECORDS (
                PATIENT_ID, DATE_OF_BIRTH, GENDER, ZIP_CODE, POLICY_NUMBER,
                POLICY_START_DATE, POLICY_END_DATE, PLAN_TYPE
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """

        values = []
        for row in batch:
            values.append((
                row['patient_id'],
                row.get('date_of_birth'),
                row.get('gender'),
                row.get('zip_code'),
                row.get('policy_number'),
                row.get('policy_start_date'),
                row.get('policy_end_date'),
                row.get('plan_type')
            ))

        cursor.executemany(insert_query, values)

    def generate_embeddings(self, batch_size: int = 100) -> int:
        """
        Generate embeddings for all claims using Snowflake Cortex
        This enables semantic search functionality
        """
        logger.info("Generating embeddings for claims...")

        cursor = self.connection.cursor()

        try:
            # Count claims without embeddings
            cursor.execute(f"""
                SELECT COUNT(*)
                FROM {self.database}.CLAIMS.INSURANCE_CLAIMS c
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM {self.database}.CORTEX_DATA.CLAIM_EMBEDDINGS e
                    WHERE e.CLAIM_ID = c.CLAIM_ID
                )
            """)
            total_to_process = cursor.fetchone()[0]

            logger.info(f"Found {total_to_process} claims needing embeddings")

            if total_to_process == 0:
                return 0

            # Process in batches
            cursor.execute(f"""
                INSERT INTO {self.database}.CORTEX_DATA.CLAIM_EMBEDDINGS (
                    CLAIM_ID,
                    CLAIM_TEXT,
                    EMBEDDING
                )
                SELECT
                    c.CLAIM_ID,
                    CONCAT(
                        'Patient ', c.PATIENT_ID, ' ',
                        'claim for ', COALESCE(c.PROCEDURE_CODE, 'unknown procedure'), ' ',
                        'diagnosis ', COALESCE(c.DIAGNOSIS_CODE, 'unknown'), ' ',
                        'by ', COALESCE(c.PROVIDER_NAME, 'unknown provider'), ' ',
                        'status ', c.CLAIM_STATUS, ' ',
                        'billed $', c.CLAIM_AMOUNT, ' ',
                        'approved $', COALESCE(c.APPROVED_AMOUNT, 0)
                    ) AS claim_text,
                    SNOWFLAKE.CORTEX.EMBED_TEXT_768(
                        'snowflake-arctic-embed-m',
                        claim_text
                    )
                FROM {self.database}.CLAIMS.INSURANCE_CLAIMS c
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM {self.database}.CORTEX_DATA.CLAIM_EMBEDDINGS e
                    WHERE e.CLAIM_ID = c.CLAIM_ID
                )
            """)

            self.connection.commit()
            rows_inserted = cursor.rowcount

            logger.info(f"✅ Generated {rows_inserted} embeddings")

            return rows_inserted

        except Exception as e:
            logger.error(f"Failed to generate embeddings: {e}")
            self.connection.rollback()
            raise
        finally:
            cursor.close()

    def validate_data_load(self) -> Dict[str, int]:
        """Validate data loaded correctly"""
        logger.info("Validating data load...")

        cursor = self.connection.cursor()

        try:
            # Count claims
            cursor.execute(f"SELECT COUNT(*) FROM {self.database}.CLAIMS.INSURANCE_CLAIMS")
            claim_count = cursor.fetchone()[0]

            # Count patients
            cursor.execute(f"SELECT COUNT(*) FROM {self.database}.PATIENTS.PATIENT_RECORDS")
            patient_count = cursor.fetchone()[0]

            # Count embeddings
            cursor.execute(f"SELECT COUNT(*) FROM {self.database}.CORTEX_DATA.CLAIM_EMBEDDINGS")
            embedding_count = cursor.fetchone()[0]

            # Check for claims without embeddings
            cursor.execute(f"""
                SELECT COUNT(*)
                FROM {self.database}.CLAIMS.INSURANCE_CLAIMS c
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM {self.database}.CORTEX_DATA.CLAIM_EMBEDDINGS e
                    WHERE e.CLAIM_ID = c.CLAIM_ID
                )
            """)
            missing_embeddings = cursor.fetchone()[0]

            results = {
                'claims': claim_count,
                'patients': patient_count,
                'embeddings': embedding_count,
                'missing_embeddings': missing_embeddings
            }

            logger.info(f"Validation results: {results}")

            return results

        finally:
            cursor.close()

    def close(self):
        """Close Snowflake connection"""
        if self.connection:
            self.connection.close()
            logger.info("Snowflake connection closed")


def main():
    parser = argparse.ArgumentParser(description='Load HCS data into Snowflake')
    parser.add_argument('--org', required=True, help='Organization ID (e.g., HCS0001)')
    parser.add_argument('--claims-file', help='Path to claims CSV file')
    parser.add_argument('--patients-file', help='Path to patients CSV file')
    parser.add_argument('--batch-size', type=int, default=1000, help='Batch size for inserts')
    parser.add_argument('--skip-embeddings', action='store_true', help='Skip embedding generation')

    args = parser.parse_args()

    try:
        loader = HCSDataLoader(args.org)

        # Load claims
        if args.claims_file:
            if not os.path.exists(args.claims_file):
                raise FileNotFoundError(f"Claims file not found: {args.claims_file}")
            loader.load_claims_from_csv(args.claims_file, batch_size=args.batch_size)

        # Load patients
        if args.patients_file:
            if not os.path.exists(args.patients_file):
                raise FileNotFoundError(f"Patients file not found: {args.patients_file}")
            loader.load_patients_from_csv(args.patients_file, batch_size=args.batch_size)

        # Generate embeddings
        if not args.skip_embeddings:
            loader.generate_embeddings()

        # Validate
        results = loader.validate_data_load()

        print("\n" + "="*60)
        print(f"✅ Data load complete for {args.org}")
        print("="*60)
        print(f"Claims loaded:        {results['claims']}")
        print(f"Patients loaded:      {results['patients']}")
        print(f"Embeddings generated: {results['embeddings']}")
        if results['missing_embeddings'] > 0:
            print(f"⚠️  Missing embeddings: {results['missing_embeddings']}")
        print("="*60)

        loader.close()

    except Exception as e:
        logger.error(f"Data load failed: {e}", exc_info=True)
        return 1

    return 0


if __name__ == '__main__':
    exit(main())
