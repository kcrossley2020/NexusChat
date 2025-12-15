const axios = require('axios');
const { logger } = require('@librechat/data-schemas');
const { errorsToString } = require('librechat-data-provider');
const { isEnabled, checkEmailConfig } = require('@librechat/api');
const { Strategy: PassportLocalStrategy } = require('passport-local');
const { findUser, comparePassword, updateUser } = require('~/models');
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
 */
async function authenticateViaAgentNexus(email, password) {
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
        name: email.split('@')[0], // Use email prefix as name
        username: email.split('@')[0],
        avatar: null,
        role: 'user',
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

async function passportLogin(req, email, password, done) {
  try {
    const validationError = await validateLoginRequest(req);
    if (validationError) {
      logError('Passport Local Strategy - Validation Error', { reqBody: req.body });
      logger.error(`[Login] [Login failed] [Username: ${email}] [Request-IP: ${req.ip}]`);
      return done(null, false, { message: validationError });
    }

    // Use AgentNexus API for authentication when in Snowflake mode
    if (USE_SNOWFLAKE_STORAGE) {
      logger.info(`[Login] Using Snowflake authentication via AgentNexus API for ${email}`);
      const user = await authenticateViaAgentNexus(email.trim(), password);

      if (!user) {
        logger.error(`[Login] [Login failed] [Username: ${email}] [Request-IP: ${req.ip}]`);
        return done(null, false, { message: 'Invalid email or password.' });
      }

      logger.info(`[Login] [Login successful] [Username: ${email}] [Request-IP: ${req.ip}]`);
      return done(null, user);
    }

    // Legacy MongoDB authentication
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
