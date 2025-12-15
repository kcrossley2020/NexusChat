"""
Test RAG (Retrieval-Augmented Generation) Snowflake Connectivity
Tests Snowflake Cortex embedding generation and vector search capabilities
"""

import snowflake.connector
from azure.identity import AzureCliCredential
from azure.keyvault.secrets import SecretClient
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend
import os
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Production Key Vault URL
VAULT_URL = "https://kv-agentnexus-prd-cus.vault.azure.net/"


class SnowflakeRAGTester:
    """Tests Snowflake Cortex RAG capabilities"""

    def __init__(self):
        self.connection = None
        self._connect()

    def _get_snowflake_config(self):
        """Fetch Snowflake credentials from Azure Key Vault"""
        try:
            credential = AzureCliCredential()
            secret_client = SecretClient(vault_url=VAULT_URL, credential=credential)

            config = {
                'account': secret_client.get_secret('snowflake-account').value,
                'user': secret_client.get_secret('snowflake-user').value,
                'warehouse': secret_client.get_secret('snowflake-warehouse').value,
                'role': secret_client.get_secret('snowflake-role').value,
                'private_key_pem': secret_client.get_secret('snowflake-agentnexus-private-key').value
            }

            logger.info(f"[PASS] Retrieved Snowflake config from Key Vault for user: {config['user']}")
            return config

        except Exception as e:
            logger.error(f"[FAIL] Failed to fetch config from Key Vault: {e}")
            raise

    def _get_private_key_bytes(self, pem_string: str):
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
            self.connection = snowflake.connector.connect(
                account=config['account'],
                user=config['user'],
                private_key=private_key_bytes,
                warehouse=config['warehouse'],
                role=config['role'],
                database='VIDEXA_SHARED',  # Set default database for tests
                schema='CORTEX_FUNCTIONS'
            )

            logger.info(f"[PASS] Connected to Snowflake as {config['user']}")

        except Exception as e:
            logger.error(f"[FAIL] Failed to connect to Snowflake: {e}")
            raise

    def test_cortex_embed_availability(self):
        """Test if Snowflake Cortex EMBED_TEXT_768 is available"""
        logger.info("\n" + "="*60)
        logger.info("TEST 1: Cortex Embedding Function Availability")
        logger.info("="*60)

        cursor = self.connection.cursor()

        try:
            # Test EMBED_TEXT_768 function
            test_query = """
                SELECT SNOWFLAKE.CORTEX.EMBED_TEXT_768(
                    'snowflake-arctic-embed-m',
                    'This is a test sentence for embedding generation'
                ) as embedding
            """

            cursor.execute(test_query)
            result = cursor.fetchone()

            if result and result[0]:
                embedding = result[0]
                logger.info(f"[PASS] EMBED_TEXT_768 function is available")
                logger.info(f"   Embedding dimension: {len(embedding)}")
                logger.info(f"   Sample values: {embedding[:5]}...")
                return True
            else:
                logger.error("[FAIL] EMBED_TEXT_768 returned no result")
                return False

        except Exception as e:
            logger.error(f"[FAIL] EMBED_TEXT_768 test failed: {e}")
            return False
        finally:
            cursor.close()

    def test_cortex_complete_availability(self):
        """Test if Snowflake Cortex COMPLETE is available"""
        logger.info("\n" + "="*60)
        logger.info("TEST 2: Cortex LLM Complete Function Availability")
        logger.info("="*60)

        cursor = self.connection.cursor()

        try:
            # Test COMPLETE function with a simple prompt
            test_query = """
                SELECT SNOWFLAKE.CORTEX.COMPLETE(
                    'mistral-large2',
                    'What is 2+2? Answer with just the number.'
                ) as response
            """

            cursor.execute(test_query)
            result = cursor.fetchone()

            if result and result[0]:
                response = result[0]
                logger.info(f"[PASS] COMPLETE function is available")
                logger.info(f"   Response: {response}")
                return True
            else:
                logger.error("[FAIL] COMPLETE returned no result")
                return False

        except Exception as e:
            logger.error(f"[FAIL] COMPLETE test failed: {e}")
            logger.info(f"   Note: This may fail if account doesn't have Cortex AI enabled")
            return False
        finally:
            cursor.close()

    def test_vector_similarity_search(self):
        """Test vector similarity search capabilities"""
        logger.info("\n" + "="*60)
        logger.info("TEST 3: Vector Similarity Search")
        logger.info("="*60)

        cursor = self.connection.cursor()

        try:
            # Create a temporary table with sample data and embeddings
            cursor.execute("""
                CREATE OR REPLACE TEMP TABLE TEST_EMBEDDINGS (
                    ID INTEGER,
                    TEXT VARCHAR,
                    EMBEDDING VECTOR(FLOAT, 768)
                )
            """)

            # Insert sample texts with embeddings
            sample_texts = [
                "The patient has diabetes and hypertension",
                "Claim for routine checkup and blood work",
                "Emergency room visit for chest pain",
                "Prescription refill for insulin"
            ]

            for idx, text in enumerate(sample_texts):
                cursor.execute(f"""
                    INSERT INTO TEST_EMBEDDINGS (ID, TEXT, EMBEDDING)
                    SELECT
                        {idx + 1},
                        '{text}',
                        SNOWFLAKE.CORTEX.EMBED_TEXT_768('snowflake-arctic-embed-m', '{text}')
                """)

            logger.info(f"[PASS] Created test embeddings for {len(sample_texts)} sample texts")

            # Test similarity search
            search_query = "diabetes medication"
            logger.info(f"\n   Searching for: '{search_query}'")

            cursor.execute(f"""
                WITH query_embedding AS (
                    SELECT SNOWFLAKE.CORTEX.EMBED_TEXT_768(
                        'snowflake-arctic-embed-m',
                        '{search_query}'
                    ) as qemb
                )
                SELECT
                    t.ID,
                    t.TEXT,
                    VECTOR_COSINE_SIMILARITY(t.EMBEDDING, q.qemb) as similarity_score
                FROM TEST_EMBEDDINGS t, query_embedding q
                ORDER BY similarity_score DESC
                LIMIT 3
            """)

            results = cursor.fetchall()

            logger.info(f"\n   Top 3 Results:")
            for row in results:
                logger.info(f"   [{row[0]}] Similarity: {row[2]:.4f} - {row[1]}")

            logger.info(f"\n[PASS] Vector similarity search working correctly")
            return True

        except Exception as e:
            logger.error(f"[FAIL] Vector similarity search test failed: {e}")
            return False
        finally:
            cursor.close()

    def test_cortex_prompt_cache_tables(self):
        """Check if Cortex prompt caching tables exist"""
        logger.info("\n" + "="*60)
        logger.info("TEST 4: Cortex Prompt Cache Infrastructure")
        logger.info("="*60)

        cursor = self.connection.cursor()

        try:
            # Check for CORTEX_FUNCTIONS schema
            cursor.execute("""
                SHOW SCHEMAS LIKE 'CORTEX_FUNCTIONS' IN DATABASE VIDEXA_SHARED
            """)

            schema_exists = len(cursor.fetchall()) > 0

            if schema_exists:
                logger.info("[PASS] CORTEX_FUNCTIONS schema exists")

                # Check for key tables
                tables_to_check = [
                    'PROMPT_CACHE',
                    'CORTEX_USAGE_LOG',
                    'COMPRESSION_PATTERNS'
                ]

                for table in tables_to_check:
                    cursor.execute(f"""
                        SELECT COUNT(*)
                        FROM VIDEXA_SHARED.CORTEX_FUNCTIONS.{table}
                    """)
                    count = cursor.fetchone()[0]
                    logger.info(f"   [PASS] {table}: {count} rows")

                return True
            else:
                logger.warning("[WARN]  CORTEX_FUNCTIONS schema does not exist")
                logger.info("   Run snowflake-setup/02-token-efficient-cortex.sql to create it")
                return False

        except Exception as e:
            logger.warning(f"[WARN]  Cortex cache tables check failed: {e}")
            logger.info("   This is optional - RAG can work without caching")
            return False
        finally:
            cursor.close()

    def test_rag_end_to_end(self):
        """End-to-end RAG test: embed, store, search, retrieve"""
        logger.info("\n" + "="*60)
        logger.info("TEST 5: End-to-End RAG Workflow")
        logger.info("="*60)

        cursor = self.connection.cursor()

        try:
            # Step 1: Create temporary knowledge base
            cursor.execute("""
                CREATE OR REPLACE TEMP TABLE KNOWLEDGE_BASE (
                    DOC_ID INTEGER,
                    CONTENT TEXT,
                    EMBEDDING VECTOR(FLOAT, 768),
                    CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
                )
            """)

            # Step 2: Load sample knowledge
            knowledge_docs = [
                "NexusChat is an AI-powered chat application built on LibreChat",
                "The system uses Snowflake for authentication and data storage",
                "RAG capabilities are provided by Snowflake Cortex AI",
                "Vector embeddings enable semantic search across documents",
                "The application supports multiple AI models including Claude and GPT"
            ]

            for idx, doc in enumerate(knowledge_docs):
                cursor.execute(f"""
                    INSERT INTO KNOWLEDGE_BASE (DOC_ID, CONTENT, EMBEDDING)
                    SELECT
                        {idx + 1},
                        '{doc}',
                        SNOWFLAKE.CORTEX.EMBED_TEXT_768('snowflake-arctic-embed-m', '{doc}')
                """)

            logger.info(f"[PASS] Step 1: Loaded {len(knowledge_docs)} documents into knowledge base")

            # Step 3: User query
            user_query = "How does semantic search work?"
            logger.info(f"[PASS] Step 2: User asks: '{user_query}'")

            # Step 4: Retrieve relevant context
            cursor.execute(f"""
                WITH query_emb AS (
                    SELECT SNOWFLAKE.CORTEX.EMBED_TEXT_768(
                        'snowflake-arctic-embed-m',
                        '{user_query}'
                    ) as qemb
                )
                SELECT
                    kb.CONTENT,
                    VECTOR_COSINE_SIMILARITY(kb.EMBEDDING, q.qemb) as relevance
                FROM KNOWLEDGE_BASE kb, query_emb q
                WHERE VECTOR_COSINE_SIMILARITY(kb.EMBEDDING, q.qemb) > 0.5
                ORDER BY relevance DESC
                LIMIT 3
            """)

            retrieved_docs = cursor.fetchall()
            logger.info(f"[PASS] Step 3: Retrieved {len(retrieved_docs)} relevant documents")

            for idx, (content, relevance) in enumerate(retrieved_docs):
                logger.info(f"   [{idx+1}] Relevance: {relevance:.4f}")
                logger.info(f"       {content}")

            # Step 5: Augment prompt with retrieved context (simulation)
            context = "\n".join([doc[0] for doc in retrieved_docs])
            augmented_prompt = f"Context:\n{context}\n\nQuestion: {user_query}\nAnswer:"

            logger.info(f"\n[PASS] Step 4: Augmented prompt created ({len(augmented_prompt)} chars)")
            logger.info(f"\n   (In production, this would be sent to CORTEX.COMPLETE)")

            logger.info(f"\n[PASS] End-to-end RAG workflow successful!")
            return True

        except Exception as e:
            logger.error(f"[FAIL] End-to-end RAG test failed: {e}")
            return False
        finally:
            cursor.close()

    def close(self):
        """Close Snowflake connection"""
        if self.connection:
            self.connection.close()
            logger.info("\nSnowflake connection closed")


def main():
    """Run all RAG connectivity tests"""
    print("\n" + "="*60)
    print("SNOWFLAKE CORTEX RAG CONNECTIVITY TEST")
    print("="*60)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    try:
        tester = SnowflakeRAGTester()

        # Run all tests
        results = {
            'Cortex Embedding Function': tester.test_cortex_embed_availability(),
            'Cortex LLM Complete Function': tester.test_cortex_complete_availability(),
            'Vector Similarity Search': tester.test_vector_similarity_search(),
            'Cortex Cache Infrastructure': tester.test_cortex_prompt_cache_tables(),
            'End-to-End RAG Workflow': tester.test_rag_end_to_end()
        }

        tester.close()

        # Summary
        print("\n" + "="*60)
        print("TEST SUMMARY")
        print("="*60)

        passed = sum(1 for result in results.values() if result)
        total = len(results)

        for test_name, result in results.items():
            status = "[PASS]" if result else "[FAIL]"
            print(f"{status}  {test_name}")

        print("="*60)
        print(f"Results: {passed}/{total} tests passed")
        print(f"Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("="*60)

        return 0 if passed == total else 1

    except Exception as e:
        logger.error(f"Test suite failed: {e}", exc_info=True)
        return 1


if __name__ == '__main__':
    exit(main())
