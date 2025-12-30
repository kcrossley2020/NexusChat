/**
 * TC-AUTH-006: File Permissions Tests
 *
 * Tests file-level permission functionality including:
 * - Register file
 * - Share file with user
 * - Share file with organization
 * - Create shareable link
 * - Permission level enforcement
 * - Unauthorized access denial
 *
 * Prerequisites:
 * - AgentNexus backend running on http://localhost:3050
 * - ENABLE_TESTING_ENDPOINTS=true in backend .env
 * - Snowflake connection configured
 */

import { test, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3050';
const TEST_TIMEOUT = 30000;

// Generate unique test email
function generateTestEmail(prefix: string): string {
  return `e2e-file-perm-${prefix}-${Date.now()}@example.com`;
}

test.describe('TC-AUTH-006: File Registration', () => {
  const TEST_PASSWORD = 'TestPass123!';
  let ownerEmail: string;
  let ownerToken: string;
  let fileId: string;

  test.beforeAll(async ({ request }) => {
    // Create file owner
    ownerEmail = generateTestEmail('owner');

    await request.post(`${BACKEND_URL}/api/testing/create-user`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        email: ownerEmail,
        password: TEST_PASSWORD,
        organization_name: 'E2E File Test Org',
        account_type: 'trial'
      },
      timeout: TEST_TIMEOUT
    });

    // Login owner
    const loginResponse = await request.post(`${BACKEND_URL}/auth/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: { email: ownerEmail, password: TEST_PASSWORD },
      timeout: TEST_TIMEOUT
    });

    const body = await loginResponse.json();
    ownerToken = body.token;

    console.log(`Setup: Created file owner ${ownerEmail}`);
  });

  test.afterAll(async ({ request }) => {
    if (ownerEmail) {
      try {
        await request.delete(`${BACKEND_URL}/api/testing/delete-user/${ownerEmail}`);
      } catch (error) {
        console.error('Cleanup failed:', error);
      }
    }
  });

  test('TC-AUTH-006-01: Register file in permission system', async ({ request }) => {
    // Step 1: Register file
    fileId = uuidv4();

    const response = await request.post(`${BACKEND_URL}/api/files`, {
      headers: {
        'Authorization': `Bearer ${ownerToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        file_id: fileId,
        filename: 'test-document.pdf',
        content_type: 'application/pdf',
        size_bytes: 1024000,
        blob_path: `uploads/${fileId}/test-document.pdf`
      },
      timeout: TEST_TIMEOUT
    });

    // Step 2: Verify 200 response
    expect(response.status()).toBe(200);

    // Step 3: Verify success
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('registered');

    console.log('TC-AUTH-006-01 PASSED: File registered successfully');
  });

  test('TC-AUTH-006-02: Owner can access their file', async ({ request }) => {
    // Step 1: Get file info
    const response = await request.get(`${BACKEND_URL}/api/files/${fileId}`, {
      headers: { 'Authorization': `Bearer ${ownerToken}` },
      timeout: TEST_TIMEOUT
    });

    // Step 2: Verify 200 response
    expect(response.status()).toBe(200);

    // Step 3: Verify file info
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.file).toBeTruthy();
    expect(body.file.file_id).toBe(fileId);
    expect(body.file.filename).toBe('test-document.pdf');
    expect(body.file.my_permission).toBe('admin'); // Owner has admin

    console.log('TC-AUTH-006-02 PASSED: Owner can access file with admin permission');
  });

  test('TC-AUTH-006-03: List file permissions (owner only)', async ({ request }) => {
    // Step 1: Get permissions
    const response = await request.get(`${BACKEND_URL}/api/files/${fileId}/permissions`, {
      headers: { 'Authorization': `Bearer ${ownerToken}` },
      timeout: TEST_TIMEOUT
    });

    // Step 2: Verify 200 response
    expect(response.status()).toBe(200);

    // Step 3: Verify response structure
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.permissions)).toBe(true);

    console.log('TC-AUTH-006-03 PASSED: File permissions listed');
  });
});

test.describe('TC-AUTH-006: File Sharing', () => {
  const TEST_PASSWORD = 'TestPass123!';
  let ownerEmail: string;
  let ownerToken: string;
  let recipientEmail: string;
  let recipientToken: string;
  let fileId: string;

  test.beforeAll(async ({ request }) => {
    // Create file owner
    ownerEmail = generateTestEmail('share-owner');

    await request.post(`${BACKEND_URL}/api/testing/create-user`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        email: ownerEmail,
        password: TEST_PASSWORD,
        organization_name: 'E2E Share Test Org',
        account_type: 'trial'
      },
      timeout: TEST_TIMEOUT
    });

    // Create recipient user
    recipientEmail = generateTestEmail('share-recipient');

    await request.post(`${BACKEND_URL}/api/testing/create-user`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        email: recipientEmail,
        password: TEST_PASSWORD,
        organization_name: 'E2E Share Test Org',
        account_type: 'trial'
      },
      timeout: TEST_TIMEOUT
    });

    // Login both users
    const ownerLogin = await request.post(`${BACKEND_URL}/auth/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: { email: ownerEmail, password: TEST_PASSWORD },
      timeout: TEST_TIMEOUT
    });
    ownerToken = (await ownerLogin.json()).token;

    const recipientLogin = await request.post(`${BACKEND_URL}/auth/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: { email: recipientEmail, password: TEST_PASSWORD },
      timeout: TEST_TIMEOUT
    });
    recipientToken = (await recipientLogin.json()).token;

    // Register file
    fileId = uuidv4();
    await request.post(`${BACKEND_URL}/api/files`, {
      headers: {
        'Authorization': `Bearer ${ownerToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        file_id: fileId,
        filename: 'shared-document.pdf',
        content_type: 'application/pdf',
        size_bytes: 2048000,
        blob_path: `uploads/${fileId}/shared-document.pdf`
      },
      timeout: TEST_TIMEOUT
    });

    console.log(`Setup: Created owner ${ownerEmail}, recipient ${recipientEmail}, file ${fileId}`);
  });

  test.afterAll(async ({ request }) => {
    for (const email of [ownerEmail, recipientEmail]) {
      if (email) {
        try {
          await request.delete(`${BACKEND_URL}/api/testing/delete-user/${email}`);
        } catch (error) {
          console.error('Cleanup failed:', error);
        }
      }
    }
  });

  test('TC-AUTH-006-04: Unshared file not accessible by other users', async ({ request }) => {
    // Step 1: Recipient tries to access file they don't have access to
    const response = await request.get(`${BACKEND_URL}/api/files/${fileId}`, {
      headers: { 'Authorization': `Bearer ${recipientToken}` },
      timeout: TEST_TIMEOUT
    });

    // Step 2: Verify 404 (access denied appears as not found)
    expect(response.status()).toBe(404);

    console.log('TC-AUTH-006-04 PASSED: Unshared file not accessible');
  });

  test('TC-AUTH-006-05: Share file with user (VIEW permission)', async ({ request }) => {
    // Step 1: Get recipient's user_id from their profile
    // For now, we'll share by email-based lookup in the backend

    // Step 2: Share file
    const response = await request.post(`${BACKEND_URL}/api/files/${fileId}/share`, {
      headers: {
        'Authorization': `Bearer ${ownerToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        share_type: 'user',
        target_id: recipientEmail, // Backend should resolve to user_id
        permission_level: 'view'
      },
      timeout: TEST_TIMEOUT
    });

    // Step 2: Verify 200 response
    expect(response.status()).toBe(200);

    // Step 3: Verify share created
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.share_id).toBeTruthy();

    console.log('TC-AUTH-006-05 PASSED: File shared with user');
  });

  test('TC-AUTH-006-06: Recipient can now access shared file', async ({ request }) => {
    // Step 1: Recipient accesses file
    const response = await request.get(`${BACKEND_URL}/api/files/${fileId}`, {
      headers: { 'Authorization': `Bearer ${recipientToken}` },
      timeout: TEST_TIMEOUT
    });

    // Step 2: Verify 200 response
    expect(response.status()).toBe(200);

    // Step 3: Verify permission level
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.file.my_permission).toBe('view');

    console.log('TC-AUTH-006-06 PASSED: Recipient can access shared file with VIEW permission');
  });

  test('TC-AUTH-006-07: Non-admin cannot manage permissions', async ({ request }) => {
    // Step 1: Recipient (with VIEW) tries to list permissions
    const response = await request.get(`${BACKEND_URL}/api/files/${fileId}/permissions`, {
      headers: { 'Authorization': `Bearer ${recipientToken}` },
      timeout: TEST_TIMEOUT
    });

    // Step 2: Verify 403 (admin required)
    expect(response.status()).toBe(403);

    console.log('TC-AUTH-006-07 PASSED: Non-admin cannot manage permissions');
  });
});

test.describe('TC-AUTH-006: Shareable Links', () => {
  const TEST_PASSWORD = 'TestPass123!';
  let ownerEmail: string;
  let ownerToken: string;
  let fileId: string;
  let shareLink: string;

  test.beforeAll(async ({ request }) => {
    // Create file owner
    ownerEmail = generateTestEmail('link-owner');

    await request.post(`${BACKEND_URL}/api/testing/create-user`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        email: ownerEmail,
        password: TEST_PASSWORD,
        organization_name: 'E2E Link Test Org',
        account_type: 'trial'
      },
      timeout: TEST_TIMEOUT
    });

    // Login owner
    const loginResponse = await request.post(`${BACKEND_URL}/auth/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: { email: ownerEmail, password: TEST_PASSWORD },
      timeout: TEST_TIMEOUT
    });
    ownerToken = (await loginResponse.json()).token;

    // Register file
    fileId = uuidv4();
    await request.post(`${BACKEND_URL}/api/files`, {
      headers: {
        'Authorization': `Bearer ${ownerToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        file_id: fileId,
        filename: 'link-shared.pdf',
        content_type: 'application/pdf',
        size_bytes: 512000,
        blob_path: `uploads/${fileId}/link-shared.pdf`
      },
      timeout: TEST_TIMEOUT
    });

    console.log(`Setup: Created owner ${ownerEmail} with file ${fileId}`);
  });

  test.afterAll(async ({ request }) => {
    if (ownerEmail) {
      try {
        await request.delete(`${BACKEND_URL}/api/testing/delete-user/${ownerEmail}`);
      } catch (error) {
        console.error('Cleanup failed:', error);
      }
    }
  });

  test('TC-AUTH-006-08: Create shareable link', async ({ request }) => {
    // Step 1: Create link share
    const response = await request.post(`${BACKEND_URL}/api/files/${fileId}/share`, {
      headers: {
        'Authorization': `Bearer ${ownerToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        share_type: 'link',
        permission_level: 'view'
      },
      timeout: TEST_TIMEOUT
    });

    // Step 2: Verify 200 response
    expect(response.status()).toBe(200);

    // Step 3: Verify link returned
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.share_link).toBeTruthy();
    expect(body.share_id).toBeTruthy();

    shareLink = body.share_link;

    console.log('TC-AUTH-006-08 PASSED: Shareable link created');
  });

  test('TC-AUTH-006-09: Create password-protected link', async ({ request }) => {
    // Step 1: Create password-protected link
    const response = await request.post(`${BACKEND_URL}/api/files/${fileId}/share`, {
      headers: {
        'Authorization': `Bearer ${ownerToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        share_type: 'link',
        permission_level: 'view',
        password: 'SecretLink123!'
      },
      timeout: TEST_TIMEOUT
    });

    // Step 2: Verify 200 response
    expect(response.status()).toBe(200);

    // Step 3: Verify link created
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.share_link).toBeTruthy();

    console.log('TC-AUTH-006-09 PASSED: Password-protected link created');
  });

  test('TC-AUTH-006-10: Create expiring link', async ({ request }) => {
    // Step 1: Create expiring link (expires in 24 hours)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const response = await request.post(`${BACKEND_URL}/api/files/${fileId}/share`, {
      headers: {
        'Authorization': `Bearer ${ownerToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        share_type: 'link',
        permission_level: 'view',
        expires_at: expiresAt.toISOString()
      },
      timeout: TEST_TIMEOUT
    });

    // Step 2: Verify 200 response
    expect(response.status()).toBe(200);

    // Step 3: Verify expiration set
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.expires_at).toBeTruthy();

    console.log('TC-AUTH-006-10 PASSED: Expiring link created');
  });
});

test.describe('TC-AUTH-006: Permission Revocation', () => {
  const TEST_PASSWORD = 'TestPass123!';
  let ownerEmail: string;
  let ownerToken: string;
  let fileId: string;
  let permissionId: string;

  test.beforeAll(async ({ request }) => {
    // Create file owner
    ownerEmail = generateTestEmail('revoke-owner');

    await request.post(`${BACKEND_URL}/api/testing/create-user`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        email: ownerEmail,
        password: TEST_PASSWORD,
        organization_name: 'E2E Revoke Test Org',
        account_type: 'trial'
      },
      timeout: TEST_TIMEOUT
    });

    // Login owner
    const loginResponse = await request.post(`${BACKEND_URL}/auth/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: { email: ownerEmail, password: TEST_PASSWORD },
      timeout: TEST_TIMEOUT
    });
    ownerToken = (await loginResponse.json()).token;

    // Register file
    fileId = uuidv4();
    await request.post(`${BACKEND_URL}/api/files`, {
      headers: {
        'Authorization': `Bearer ${ownerToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        file_id: fileId,
        filename: 'revoke-test.pdf',
        content_type: 'application/pdf',
        size_bytes: 256000,
        blob_path: `uploads/${fileId}/revoke-test.pdf`
      },
      timeout: TEST_TIMEOUT
    });

    // Create a share to revoke
    const shareResponse = await request.post(`${BACKEND_URL}/api/files/${fileId}/share`, {
      headers: {
        'Authorization': `Bearer ${ownerToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        share_type: 'link',
        permission_level: 'view'
      },
      timeout: TEST_TIMEOUT
    });

    const shareBody = await shareResponse.json();
    permissionId = shareBody.share_id;

    console.log(`Setup: Created owner ${ownerEmail} with file and share`);
  });

  test.afterAll(async ({ request }) => {
    if (ownerEmail) {
      try {
        await request.delete(`${BACKEND_URL}/api/testing/delete-user/${ownerEmail}`);
      } catch (error) {
        console.error('Cleanup failed:', error);
      }
    }
  });

  test('TC-AUTH-006-11: Revoke file permission', async ({ request }) => {
    // Step 1: Revoke permission
    const response = await request.delete(
      `${BACKEND_URL}/api/files/${fileId}/permissions/${permissionId}`,
      {
        headers: { 'Authorization': `Bearer ${ownerToken}` },
        timeout: TEST_TIMEOUT
      }
    );

    // Step 2: Verify 200 response
    expect(response.status()).toBe(200);

    // Step 3: Verify success
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('revoked');

    console.log('TC-AUTH-006-11 PASSED: Permission revoked successfully');
  });

  test('TC-AUTH-006-12: Owner can delete file', async ({ request }) => {
    // Step 1: Delete file
    const response = await request.delete(`${BACKEND_URL}/api/files/${fileId}`, {
      headers: { 'Authorization': `Bearer ${ownerToken}` },
      timeout: TEST_TIMEOUT
    });

    // Step 2: Verify 200 response
    expect(response.status()).toBe(200);

    // Step 3: Verify deletion
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('deleted');

    // Step 4: Verify file no longer accessible
    const checkResponse = await request.get(`${BACKEND_URL}/api/files/${fileId}`, {
      headers: { 'Authorization': `Bearer ${ownerToken}` },
      timeout: TEST_TIMEOUT
    });
    expect(checkResponse.status()).toBe(404);

    console.log('TC-AUTH-006-12 PASSED: File deleted by owner');
  });
});
