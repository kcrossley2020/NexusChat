/**
 * Snowflake User Service for NexusChat
 *
 * Replaces MongoDB user models with Snowflake-based user management.
 * Uses the AgentNexus backend API for all user operations to maintain
 * single source of truth in AGENTNEXUS_DB.
 *
 * Architecture:
 * - AUTH_SCHEMA.USER_PROFILES: Core auth data (email, password, sessions)
 * - APP_SCHEMA.NEXUSCHAT_USER_PROFILES: NexusChat-specific data (avatar, plugins, 2FA)
 * - APP_SCHEMA.V_NEXUSCHAT_USERS: Combined view for easy querying
 */

const axios = require('axios');
const { logger } = require('@librechat/data-schemas');

// Configuration from environment
const AGENTNEXUS_API_URL = process.env.AGENTNEXUS_API_URL;
const AGENTNEXUS_API_KEY = process.env.AGENTNEXUS_API_KEY;

// Check if Snowflake user storage is enabled
// Explicit USE_SNOWFLAKE_USERS=true OR both AGENTNEXUS URLs configured
const USE_SNOWFLAKE_USERS = process.env.USE_SNOWFLAKE_USERS === 'true' ||
                             (process.env.AGENTNEXUS_API_URL && process.env.AGENTNEXUS_FRONTEND_URL &&
                              process.env.USE_SNOWFLAKE_STORAGE === 'true');

/**
 * Get configured axios instance for AgentNexus API calls
 */
function getApiClient() {
  if (!AGENTNEXUS_API_URL) {
    throw new Error('AGENTNEXUS_API_URL is not configured');
  }

  return axios.create({
    baseURL: AGENTNEXUS_API_URL,
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
      ...(AGENTNEXUS_API_KEY && { 'X-API-Key': AGENTNEXUS_API_KEY }),
    },
  });
}

/**
 * Transform Snowflake user response to NexusChat IUser format
 * Converts UPPER_CASE column names to camelCase
 */
function transformToIUser(snowflakeUser) {
  if (!snowflakeUser) {
    return null;
  }

  return {
    _id: snowflakeUser.USER_ID || snowflakeUser.user_id,
    id: snowflakeUser.USER_ID || snowflakeUser.user_id,
    email: snowflakeUser.EMAIL || snowflakeUser.email,
    emailVerified: snowflakeUser.EMAIL_VERIFIED ?? snowflakeUser.email_verified ?? false,
    password: snowflakeUser.PASSWORD_HASH || snowflakeUser.password_hash,
    name: snowflakeUser.NAME || snowflakeUser.name || snowflakeUser.FULL_NAME || snowflakeUser.full_name,
    username: snowflakeUser.USERNAME || snowflakeUser.username,
    avatar: snowflakeUser.AVATAR || snowflakeUser.avatar,
    provider: snowflakeUser.PROVIDER || snowflakeUser.provider || 'local',
    role: snowflakeUser.ROLE || snowflakeUser.role || 'USER',
    // OAuth IDs
    googleId: snowflakeUser.GOOGLE_ID || snowflakeUser.google_id,
    openidId: snowflakeUser.OPENID_ID || snowflakeUser.openid_id,
    samlId: snowflakeUser.SAML_ID || snowflakeUser.saml_id,
    ldapId: snowflakeUser.LDAP_ID || snowflakeUser.ldap_id,
    githubId: snowflakeUser.GITHUB_ID || snowflakeUser.github_id,
    discordId: snowflakeUser.DISCORD_ID || snowflakeUser.discord_id,
    appleId: snowflakeUser.APPLE_ID || snowflakeUser.apple_id,
    idOnTheSource: snowflakeUser.ID_ON_THE_SOURCE || snowflakeUser.id_on_the_source,
    // 2FA
    twoFactorEnabled: snowflakeUser.TWO_FACTOR_ENABLED ?? snowflakeUser.two_factor_enabled ?? false,
    totpSecret: snowflakeUser.TOTP_SECRET || snowflakeUser.totp_secret,
    backupCodes: snowflakeUser.BACKUP_CODES || snowflakeUser.backup_codes,
    // Preferences
    plugins: snowflakeUser.PLUGINS || snowflakeUser.plugins || [],
    termsAccepted: snowflakeUser.TERMS_ACCEPTED ?? snowflakeUser.terms_accepted ?? false,
    personalization: snowflakeUser.PERSONALIZATION || snowflakeUser.personalization,
    refreshToken: snowflakeUser.REFRESH_TOKENS || snowflakeUser.refresh_tokens || [],
    // Account status
    accountLocked: snowflakeUser.ACCOUNT_LOCKED ?? snowflakeUser.account_locked ?? false,
    lockedUntil: snowflakeUser.LOCKED_UNTIL || snowflakeUser.locked_until,
    failedLoginAttempts: snowflakeUser.FAILED_LOGIN_ATTEMPTS || snowflakeUser.failed_login_attempts || 0,
    // Timestamps
    createdAt: snowflakeUser.CREATED_AT || snowflakeUser.created_at,
    updatedAt: snowflakeUser.UPDATED_AT || snowflakeUser.updated_at,
    expiresAt: snowflakeUser.EXPIRES_AT || snowflakeUser.expires_at,
    lastLogin: snowflakeUser.LAST_LOGIN || snowflakeUser.last_login,
  };
}

/**
 * Check if Snowflake user storage is enabled
 */
function isSnowflakeUsersEnabled() {
  return USE_SNOWFLAKE_USERS;
}

// ============================================================================
// User CRUD Operations (via AgentNexus API)
// ============================================================================

/**
 * Find user by email
 * @param {string} email
 * @param {string} fieldsToSelect - comma-separated fields (ignored for Snowflake, returns all)
 * @returns {Promise<IUser|null>}
 */
async function findUserByEmail(email, fieldsToSelect = null) {
  try {
    const api = getApiClient();
    const response = await api.get(`/api/nexuschat/users/by-email/${encodeURIComponent(email)}`);

    if (response.data && response.data.user) {
      return transformToIUser(response.data.user);
    }
    return null;
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    }
    logger.error('[SnowflakeUserService] findUserByEmail error:', error.message);
    throw error;
  }
}

/**
 * Find user by ID
 * @param {string} userId
 * @param {string} fieldsToSelect - comma-separated fields (ignored for Snowflake)
 * @returns {Promise<IUser|null>}
 */
async function findUserById(userId, fieldsToSelect = null) {
  try {
    const api = getApiClient();
    const response = await api.get(`/api/nexuschat/users/${userId}`);

    if (response.data && response.data.user) {
      return transformToIUser(response.data.user);
    }
    return null;
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    }
    logger.error('[SnowflakeUserService] findUserById error:', error.message);
    throw error;
  }
}

/**
 * Find user by any criteria
 * @param {Object} searchCriteria - { email, googleId, openidId, etc. }
 * @param {string} fieldsToSelect
 * @returns {Promise<IUser|null>}
 */
async function findUser(searchCriteria, fieldsToSelect = null) {
  try {
    // Handle common search patterns
    if (searchCriteria.email) {
      return await findUserByEmail(searchCriteria.email, fieldsToSelect);
    }
    if (searchCriteria._id || searchCriteria.id) {
      return await findUserById(searchCriteria._id || searchCriteria.id, fieldsToSelect);
    }

    // For OAuth lookups
    const api = getApiClient();
    const response = await api.post('/api/nexuschat/users/find', searchCriteria);

    if (response.data && response.data.user) {
      return transformToIUser(response.data.user);
    }
    return null;
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    }
    logger.error('[SnowflakeUserService] findUser error:', error.message);
    throw error;
  }
}

/**
 * Create a new user
 * @param {Object} userData - User data
 * @param {Object} balanceConfig - Optional balance configuration
 * @param {boolean} disableTTL - If false, user expires in 1 week
 * @param {boolean} returnUser - If true, return full user object
 * @returns {Promise<string|IUser>} - User ID or full user object
 */
async function createUser(userData, balanceConfig = null, disableTTL = true, returnUser = false) {
  try {
    const api = getApiClient();
    const response = await api.post('/api/nexuschat/users', {
      ...userData,
      balanceConfig,
      disableTTL,
    });

    if (returnUser && response.data.user) {
      return transformToIUser(response.data.user);
    }
    return response.data.user_id || response.data.userId;
  } catch (error) {
    logger.error('[SnowflakeUserService] createUser error:', error.message);
    throw error;
  }
}

/**
 * Update user by ID
 * @param {string} userId
 * @param {Object} updates
 * @returns {Promise<IUser|null>}
 */
async function updateUser(userId, updates) {
  try {
    const api = getApiClient();
    const response = await api.patch(`/api/nexuschat/users/${userId}`, updates);

    if (response.data && response.data.user) {
      return transformToIUser(response.data.user);
    }
    return null;
  } catch (error) {
    logger.error('[SnowflakeUserService] updateUser error:', error.message);
    throw error;
  }
}

/**
 * Delete user by ID
 * @param {string} userId
 * @returns {Promise<{deletedCount: number, message: string}>}
 */
async function deleteUserById(userId) {
  try {
    const api = getApiClient();
    await api.delete(`/api/nexuschat/users/${userId}`);
    return { deletedCount: 1, message: 'User deleted successfully' };
  } catch (error) {
    logger.error('[SnowflakeUserService] deleteUserById error:', error.message);
    return { deletedCount: 0, message: error.message };
  }
}

/**
 * Count users matching filter
 * @param {Object} filter
 * @returns {Promise<number>}
 */
async function countUsers(filter = {}) {
  try {
    const api = getApiClient();
    const response = await api.post('/api/nexuschat/users/count', filter);
    return response.data.count || 0;
  } catch (error) {
    logger.error('[SnowflakeUserService] countUsers error:', error.message);
    return 0;
  }
}

/**
 * Get user by ID (alias for findUserById with specific fields)
 * @param {string} userId
 * @param {string} fieldsToSelect
 * @returns {Promise<IUser|null>}
 */
async function getUserById(userId, fieldsToSelect = null) {
  return findUserById(userId, fieldsToSelect);
}

// ============================================================================
// Session Operations
// ============================================================================

/**
 * Find session by criteria
 * @param {Object} criteria - { userId, refreshToken }
 * @param {Object} options
 * @returns {Promise<Object|null>}
 */
async function findSession(criteria, options = {}) {
  try {
    const api = getApiClient();
    const response = await api.post('/api/nexuschat/sessions/find', criteria);
    return response.data.session || null;
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    }
    logger.error('[SnowflakeUserService] findSession error:', error.message);
    throw error;
  }
}

/**
 * Create a new session
 * @param {string} userId
 * @returns {Promise<{session: Object, refreshToken: string}>}
 */
async function createSession(userId) {
  try {
    const api = getApiClient();
    const response = await api.post('/api/nexuschat/sessions', { userId });

    // Transform session to match expected ISession format
    const session = response.data.session;
    return {
      session: {
        ...session,
        _id: session._id || session.SESSION_ID,
        expiration: new Date(session.expiration), // Convert ISO string to Date
      },
      refreshToken: response.data.refreshToken,
    };
  } catch (error) {
    logger.error('[SnowflakeUserService] createSession error:', error.message);
    throw error;
  }
}

/**
 * Delete session
 * @param {Object} criteria - { sessionId }
 * @returns {Promise<boolean>}
 */
async function deleteSession(criteria) {
  try {
    const api = getApiClient();
    await api.delete(`/api/nexuschat/sessions/${criteria.sessionId}`);
    return true;
  } catch (error) {
    logger.error('[SnowflakeUserService] deleteSession error:', error.message);
    return false;
  }
}

/**
 * Delete all sessions for a user
 * @param {Object} criteria - { userId }
 * @returns {Promise<number>}
 */
async function deleteAllUserSessions(criteria) {
  try {
    const api = getApiClient();
    const response = await api.delete(`/api/nexuschat/users/${criteria.userId}/sessions`);
    return response.data.deletedCount || 0;
  } catch (error) {
    logger.error('[SnowflakeUserService] deleteAllUserSessions error:', error.message);
    return 0;
  }
}

// ============================================================================
// Token Operations (Password Reset, Email Verification)
// ============================================================================

/**
 * Find token by criteria
 * @param {Object} criteria - { email, userId, token }
 * @param {Object} options - { sort }
 * @returns {Promise<Object|null>}
 */
async function findToken(criteria, options = {}) {
  try {
    const api = getApiClient();
    const response = await api.post('/api/nexuschat/tokens/find', { ...criteria, ...options });
    return response.data.token || null;
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    }
    logger.error('[SnowflakeUserService] findToken error:', error.message);
    throw error;
  }
}

/**
 * Create a token (password reset, email verification)
 * @param {Object} tokenData - { userId, email, token, expiresIn }
 * @returns {Promise<Object>}
 */
async function createToken(tokenData) {
  try {
    const api = getApiClient();
    const response = await api.post('/api/nexuschat/tokens', tokenData);
    return response.data.token;
  } catch (error) {
    logger.error('[SnowflakeUserService] createToken error:', error.message);
    throw error;
  }
}

/**
 * Delete tokens matching criteria
 * @param {Object} criteria - { userId, email, token }
 * @returns {Promise<number>}
 */
async function deleteTokens(criteria) {
  try {
    const api = getApiClient();
    const response = await api.post('/api/nexuschat/tokens/delete', criteria);
    return response.data.deletedCount || 0;
  } catch (error) {
    logger.error('[SnowflakeUserService] deleteTokens error:', error.message);
    return 0;
  }
}

// ============================================================================
// JWT Token Generation (delegated to AgentNexus API)
// ============================================================================

/**
 * Generate JWT token for user
 * @param {Object} user
 * @returns {Promise<string>}
 */
async function generateToken(user) {
  try {
    const api = getApiClient();
    const response = await api.post('/api/nexuschat/auth/generate-token', {
      userId: user._id || user.id || user.USER_ID,
      email: user.email || user.EMAIL,
      emailVerified: user.emailVerified ?? user.EMAIL_VERIFIED ?? true,
    });
    return response.data.token;
  } catch (error) {
    logger.error('[SnowflakeUserService] generateToken error:', error.message);
    throw error;
  }
}

/**
 * Generate refresh token for session
 * @param {Object} session
 * @returns {Promise<string>}
 */
async function generateRefreshToken(session) {
  try {
    const api = getApiClient();
    const response = await api.post('/api/nexuschat/auth/generate-refresh-token', {
      sessionId: session._id || session.SESSION_ID,
      userId: session.userId || session.USER_ID,
    });
    return response.data.refreshToken;
  } catch (error) {
    logger.error('[SnowflakeUserService] generateRefreshToken error:', error.message);
    throw error;
  }
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  // Configuration
  isSnowflakeUsersEnabled,
  USE_SNOWFLAKE_USERS,

  // User operations
  findUser,
  findUserByEmail,
  findUserById,
  createUser,
  updateUser,
  deleteUserById,
  countUsers,
  getUserById,

  // Session operations
  findSession,
  createSession,
  deleteSession,
  deleteAllUserSessions,

  // Token operations
  findToken,
  createToken,
  deleteTokens,

  // JWT operations
  generateToken,
  generateRefreshToken,

  // Transform helper
  transformToIUser,
};
