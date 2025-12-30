const axios = require('axios');
const bcrypt = require('bcryptjs');
const { logger } = require('@librechat/data-schemas');
const { errorsToString } = require('librechat-data-provider');
const { isEnabled, checkEmailConfig } = require('@librechat/api');
const { Strategy: PassportLocalStrategy } = require('passport-local');
const { findUser, comparePassword, updateUser, SnowflakeUserService } = require('~/models');
const { loginSchema } = require('./validators');

// Unix timestamp for 2024-06-07 15:20:18 Eastern Time
const verificationEnabledTimestamp = 1717788018;

// Snowflake storage configuration
const USE_SNOWFLAKE_STORAGE = isEnabled(process.env.USE_SNOWFLAKE_STORAGE);
const AGENTNEXUS_API_URL = process.env.AGENTNEXUS_API_URL || 'http://localhost:3050';

async function validateLoginRequest(req) {
  const { error } = loginSchema.safeParse(req.body);
  return error ? errorsToString(error.errors) : null;
}

/**
 * Authenticate user via AgentNexus API (Snowflake backend)
 * Used when USE_SNOWFLAKE_STORAGE is enabled but unified user management is not
 */
async function authenticateViaAgentNexusAPI(email, password) {
  try {
    const response = await axios.post(
      `${AGENTNEXUS_API_URL}/auth/login`,
      { email, password },
      { timeout: 10000 }
    );

    if (response.data && response.data.success) {
      // Convert AgentNexus user format to NexusChat user format
      return {
        _id: response.data.user_id,
        email: email,
        emailVerified: true, // AgentNexus verifies this
        name: response.data.name || email.split('@')[0],
        username: response.data.username || email.split('@')[0],
        avatar: response.data.avatar || null,
        role: response.data.role || 'user',
        provider: 'local',
        // Store the AgentNexus token for future use
        agentNexusToken: response.data.token,
        // Flag to skip MongoDB session creation
        useAgentNexusAuth: true,
      };
    }
    return null;
  } catch (error) {
    if (error.response) {
      // AgentNexus returned an error response
      logger.error(`[AgentNexus Auth] ${error.response.data.detail || 'Authentication failed'}`);
    } else {
      logger.error(`[AgentNexus Auth] Error: ${error.message}`);
    }
    return null;
  }
}

/**
 * Authenticate user via unified Snowflake user management
 * Uses the SnowflakeUserService which calls the NexusChat-specific API endpoints
 */
async function authenticateViaSnowflakeUsers(email, password) {
  try {
    // Find user in Snowflake (includes password hash)
    const user = await SnowflakeUserService.findUserByEmail(email);

    if (!user) {
      logger.warn(`[Snowflake Auth] User not found: ${email}`);
      return null;
    }

    // Check if account is locked
    if (user.accountLocked) {
      const now = new Date();
      if (user.lockedUntil && new Date(user.lockedUntil) > now) {
        logger.warn(`[Snowflake Auth] Account locked: ${email}`);
        return { locked: true, lockedUntil: user.lockedUntil };
      }
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      logger.warn(`[Snowflake Auth] Invalid password for: ${email}`);
      // TODO: Track failed login attempts
      return null;
    }

    // Return user in NexusChat format (already transformed by SnowflakeUserService)
    return {
      _id: user._id,
      id: user._id,
      email: user.email,
      emailVerified: user.emailVerified,
      name: user.name,
      username: user.username,
      avatar: user.avatar,
      role: user.role,
      provider: user.provider || 'local',
      twoFactorEnabled: user.twoFactorEnabled,
      plugins: user.plugins,
      termsAccepted: user.termsAccepted,
      createdAt: user.createdAt,
      // Flag for unified auth
      useSnowflakeAuth: true,
    };
  } catch (error) {
    logger.error(`[Snowflake Auth] Error: ${error.message}`);
    return null;
  }
}

async function passportLogin(req, email, password, done) {
  try {
    const validationError = await validateLoginRequest(req);
    if (validationError) {
      logError('Passport Local Strategy - Validation Error', { reqBody: req.body });
      logger.error(`[Login] [Login failed] [Username: ${email}] [Request-IP: ${req.ip}]`);
      return done(null, false, { message: validationError });
    }

    // Priority 1: Unified Snowflake user management (new architecture)
    if (SnowflakeUserService.isSnowflakeUsersEnabled()) {
      logger.info(`[Login] Using unified Snowflake authentication for ${email}`);
      const result = await authenticateViaSnowflakeUsers(email.trim(), password);

      if (result && result.locked) {
        logger.error(`[Login] [Account locked] [Username: ${email}] [Request-IP: ${req.ip}]`);
        return done(null, false, { message: 'Account is temporarily locked. Please try again later.' });
      }

      if (!result) {
        logger.error(`[Login] [Login failed] [Username: ${email}] [Request-IP: ${req.ip}]`);
        return done(null, false, { message: 'Invalid email or password.' });
      }

      // Check email verification
      const unverifiedAllowed = isEnabled(process.env.ALLOW_UNVERIFIED_EMAIL_LOGIN);
      if (!result.emailVerified && !unverifiedAllowed) {
        logger.error(`[Login] [Email not verified] [Username: ${email}] [Request-IP: ${req.ip}]`);
        return done(null, result, { message: 'Email not verified.' });
      }

      logger.info(`[Login] [Login successful] [Username: ${email}] [Request-IP: ${req.ip}]`);
      return done(null, result);
    }

    // Priority 2: AgentNexus API authentication (Snowflake storage for conversations only)
    if (USE_SNOWFLAKE_STORAGE) {
      logger.info(`[Login] Using Snowflake authentication via AgentNexus API for ${email}`);
      const user = await authenticateViaAgentNexusAPI(email.trim(), password);

      if (!user) {
        logger.error(`[Login] [Login failed] [Username: ${email}] [Request-IP: ${req.ip}]`);
        return done(null, false, { message: 'Invalid email or password.' });
      }

      logger.info(`[Login] [Login successful] [Username: ${email}] [Request-IP: ${req.ip}]`);
      return done(null, user);
    }

    // Priority 3: Legacy MongoDB authentication
    const user = await findUser({ email: email.trim() }, '+password');
    if (!user) {
      logError('Passport Local Strategy - User Not Found', { email });
      logger.error(`[Login] [Login failed] [Username: ${email}] [Request-IP: ${req.ip}]`);
      return done(null, false, { message: 'Email does not exist.' });
    }

    if (!user.password) {
      logError('Passport Local Strategy - User has no password', { email });
      logger.error(`[Login] [Login failed] [Username: ${email}] [Request-IP: ${req.ip}]`);
      return done(null, false, { message: 'Email does not exist.' });
    }

    const isMatch = await comparePassword(user, password);
    if (!isMatch) {
      logError('Passport Local Strategy - Password does not match', { isMatch });
      logger.error(`[Login] [Login failed] [Username: ${email}] [Request-IP: ${req.ip}]`);
      return done(null, false, { message: 'Incorrect password.' });
    }

    const emailEnabled = checkEmailConfig();
    const userCreatedAtTimestamp = Math.floor(new Date(user.createdAt).getTime() / 1000);

    if (
      !emailEnabled &&
      !user.emailVerified &&
      userCreatedAtTimestamp < verificationEnabledTimestamp
    ) {
      await updateUser(user._id, { emailVerified: true });
      user.emailVerified = true;
    }

    const unverifiedAllowed = isEnabled(process.env.ALLOW_UNVERIFIED_EMAIL_LOGIN);
    if (user.expiresAt && unverifiedAllowed) {
      await updateUser(user._id, {});
    }

    if (!user.emailVerified && !unverifiedAllowed) {
      logError('Passport Local Strategy - Email not verified', { email });
      logger.error(`[Login] [Login failed] [Username: ${email}] [Request-IP: ${req.ip}]`);
      return done(null, user, { message: 'Email not verified.' });
    }

    logger.info(`[Login] [Login successful] [Username: ${email}] [Request-IP: ${req.ip}]`);
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}

function logError(title, parameters) {
  const entries = Object.entries(parameters).map(([name, value]) => ({ name, value }));
  logger.error(title, { parameters: entries });
}

module.exports = () =>
  new PassportLocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
      session: false,
      passReqToCallback: true,
    },
    passportLogin,
  );
