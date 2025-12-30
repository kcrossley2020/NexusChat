const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { webcrypto } = require('node:crypto');
const { logger } = require('@librechat/data-schemas');
const { isEnabled, checkEmailConfig, isEmailDomainAllowed } = require('@librechat/api');
const { ErrorTypes, SystemRoles, errorsToString } = require('librechat-data-provider');
const {
  findUser,
  findToken,
  createUser,
  updateUser,
  countUsers,
  getUserById,
  findSession,
  createToken,
  deleteTokens,
  deleteSession,
  createSession,
  generateToken,
  deleteUserById,
  generateRefreshToken,
} = require('~/models');
const { registerSchema } = require('~/strategies/validators');
const { getAppConfig } = require('~/server/services/Config');
const { sendEmail } = require('~/server/utils');

const domains = {
  client: process.env.DOMAIN_CLIENT,
  server: process.env.DOMAIN_SERVER,
  // AgentNexus frontend URL for shared authentication (password reset)
  agentNexusFrontend: process.env.AGENTNEXUS_FRONTEND_URL,
};

const isProduction = process.env.NODE_ENV === 'production';
const genericVerificationMessage = 'Please check your email to verify your email address.';

/**
 * Logout user
 *
 * @param {ServerRequest} req
 * @param {string} refreshToken
 * @returns
 */
const logoutUser = async (req, refreshToken) => {
  try {
    const userId = req.user._id;
    const session = await findSession({ userId: userId, refreshToken });

    if (session) {
      try {
        await deleteSession({ sessionId: session._id });
      } catch (deleteErr) {
        logger.error('[logoutUser] Failed to delete session.', deleteErr);
        return { status: 500, message: 'Failed to delete session.' };
      }
    }

    try {
      req.session.destroy();
    } catch (destroyErr) {
      logger.debug('[logoutUser] Failed to destroy session.', destroyErr);
    }

    return { status: 200, message: 'Logout successful' };
  } catch (err) {
    return { status: 500, message: err.message };
  }
};

/**
 * Creates Token and corresponding Hash for verification
 * @returns {[string, string]}
 */
const createTokenHash = () => {
  const token = Buffer.from(webcrypto.getRandomValues(new Uint8Array(32))).toString('hex');
  const hash = bcrypt.hashSync(token, 10);
  return [token, hash];
};

/**
 * Send Verification Email
 * @param {Partial<IUser>} user
 * @returns {Promise<void>}
 */
const sendVerificationEmail = async (user) => {
  const [verifyToken, hash] = createTokenHash();

  const verificationLink = `${
    domains.client
  }/verify?token=${verifyToken}&email=${encodeURIComponent(user.email)}`;
  await sendEmail({
    email: user.email,
    subject: 'Verify your email',
    payload: {
      appName: process.env.APP_TITLE || 'LibreChat',
      name: user.name || user.username || user.email,
      verificationLink: verificationLink,
      year: new Date().getFullYear(),
    },
    template: 'verifyEmail.handlebars',
  });

  await createToken({
    userId: user._id,
    email: user.email,
    token: hash,
    createdAt: Date.now(),
    expiresIn: 900,
  });

  logger.info(`[sendVerificationEmail] Verification link issued. [Email: ${user.email}]`);
};

/**
 * Verify Email
 * @param {ServerRequest} req
 */
const verifyEmail = async (req) => {
  const { email, token } = req.body;
  const decodedEmail = decodeURIComponent(email);

  const user = await findUser({ email: decodedEmail }, 'email _id emailVerified');

  if (!user) {
    logger.warn(`[verifyEmail] [User not found] [Email: ${decodedEmail}]`);
    return new Error('User not found');
  }

  if (user.emailVerified) {
    logger.info(`[verifyEmail] Email already verified [Email: ${decodedEmail}]`);
    return { message: 'Email already verified', status: 'success' };
  }

  let emailVerificationData = await findToken({ email: decodedEmail }, { sort: { createdAt: -1 } });

  if (!emailVerificationData) {
    logger.warn(`[verifyEmail] [No email verification data found] [Email: ${decodedEmail}]`);
    return new Error('Invalid or expired password reset token');
  }

  const isValid = bcrypt.compareSync(token, emailVerificationData.token);

  if (!isValid) {
    logger.warn(
      `[verifyEmail] [Invalid or expired email verification token] [Email: ${decodedEmail}]`,
    );
    return new Error('Invalid or expired email verification token');
  }

  const updatedUser = await updateUser(emailVerificationData.userId, { emailVerified: true });

  if (!updatedUser) {
    logger.warn(`[verifyEmail] [User update failed] [Email: ${decodedEmail}]`);
    return new Error('Failed to update user verification status');
  }

  await deleteTokens({ token: emailVerificationData.token });
  logger.info(`[verifyEmail] Email verification successful [Email: ${decodedEmail}]`);
  return { message: 'Email verification was successful', status: 'success' };
};

/**
 * Register a new user.
 * @param {IUser} user <email, password, name, username>
 * @param {Partial<IUser>} [additionalData={}]
 * @returns {Promise<{status: number, message: string, user?: IUser}>}
 */
const registerUser = async (user, additionalData = {}) => {
  const { error } = registerSchema.safeParse(user);
  if (error) {
    const errorMessage = errorsToString(error.errors);
    logger.info(
      'Route: register - Validation Error',
      { name: 'Request params:', value: user },
      { name: 'Validation error:', value: errorMessage },
    );

    return { status: 404, message: errorMessage };
  }

  const { email, password, name, username } = user;

  let newUserId;
  try {
    const appConfig = await getAppConfig();
    if (!isEmailDomainAllowed(email, appConfig?.registration?.allowedDomains)) {
      const errorMessage =
        'The email address provided cannot be used. Please use a different email address.';
      logger.error(`[registerUser] [Registration not allowed] [Email: ${user.email}]`);
      return { status: 403, message: errorMessage };
    }

    const existingUser = await findUser({ email }, 'email _id');

    if (existingUser) {
      logger.info(
        'Register User - Email in use',
        { name: 'Request params:', value: user },
        { name: 'Existing user:', value: existingUser },
      );

      // Sleep for 1 second
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return { status: 200, message: genericVerificationMessage };
    }

    //determine if this is the first registered user (not counting anonymous_user)
    const isFirstRegisteredUser = (await countUsers()) === 0;

    const salt = bcrypt.genSaltSync(10);
    const newUserData = {
      provider: 'local',
      email,
      username,
      name,
      avatar: null,
      role: isFirstRegisteredUser ? SystemRoles.ADMIN : SystemRoles.USER,
      password: bcrypt.hashSync(password, salt),
      ...additionalData,
    };

    const emailEnabled = checkEmailConfig();
    const disableTTL = isEnabled(process.env.ALLOW_UNVERIFIED_EMAIL_LOGIN);

    const newUser = await createUser(newUserData, appConfig.balance, disableTTL, true);
    newUserId = newUser._id;
    if (emailEnabled && !newUser.emailVerified) {
      await sendVerificationEmail({
        _id: newUserId,
        email,
        name,
      });
    } else {
      await updateUser(newUserId, { emailVerified: true });
    }

    return { status: 200, message: genericVerificationMessage };
  } catch (err) {
    logger.error('[registerUser] Error in registering user:', err);
    if (newUserId) {
      const result = await deleteUserById(newUserId);
      logger.warn(
        `[registerUser] [Email: ${email}] [Temporary User deleted: ${JSON.stringify(result)}]`,
      );
    }
    return { status: 500, message: 'Something went wrong' };
  }
};

/**
 * Request password reset
 * @param {ServerRequest} req
 *
 * When AGENTNEXUS_FRONTEND_URL and AGENTNEXUS_API_URL are configured,
 * delegates password reset to the AgentNexus backend API for shared authentication.
 * This ensures tokens are stored in Snowflake and validated by the AgentNexus backend.
 */
const requestPasswordReset = async (req) => {
  const { email } = req.body;
  const appConfig = await getAppConfig();
  if (!isEmailDomainAllowed(email, appConfig?.registration?.allowedDomains)) {
    const error = new Error(ErrorTypes.AUTH_FAILED);
    error.code = ErrorTypes.AUTH_FAILED;
    error.message = 'Email domain not allowed';
    return error;
  }

  logger.warn(`[requestPasswordReset] [Password reset request initiated] [Email: ${email}]`);

  // Check if shared authentication is enabled (AgentNexus API configured)
  const agentNexusApiUrl = process.env.AGENTNEXUS_API_URL;
  const agentNexusFrontendUrl = process.env.AGENTNEXUS_FRONTEND_URL;

  if (agentNexusApiUrl && agentNexusFrontendUrl) {
    // Delegate password reset to AgentNexus backend API for shared auth
    logger.info(`[requestPasswordReset] Delegating to AgentNexus API [Email: ${email}]`);
    try {
      const response = await axios.post(
        `${agentNexusApiUrl}/auth/request-password-reset`,
        { email },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000, // 10 second timeout
        },
      );

      logger.info(
        `[requestPasswordReset] AgentNexus API response [Email: ${email}] [Status: ${response.status}] [ResetDomain: ${agentNexusFrontendUrl}]`,
      );

      // Return the same message format as AgentNexus backend
      return {
        message: 'If an account with that email exists, a password reset link has been sent to it.',
      };
    } catch (apiError) {
      logger.error(`[requestPasswordReset] AgentNexus API error [Email: ${email}]`, apiError.message || apiError);
      // Fall through to local handling as backup
      logger.warn(`[requestPasswordReset] Falling back to local password reset [Email: ${email}]`);
    }
  }

  // Local password reset (when shared auth is not configured or API failed)
  const user = await findUser({ email }, 'email _id');
  const emailEnabled = checkEmailConfig();

  if (!user) {
    logger.warn(`[requestPasswordReset] [No user found] [Email: ${email}] [IP: ${req.ip}]`);
    return {
      message: 'If an account with that email exists, a password reset link has been sent to it.',
    };
  }

  await deleteTokens({ userId: user._id });

  const [resetToken, hash] = createTokenHash();

  await createToken({
    userId: user._id,
    token: hash,
    createdAt: Date.now(),
    expiresIn: 900,
  });

  // Use NexusChat client URL for local password reset
  const link = `${domains.client}/reset-password?token=${resetToken}&userId=${user._id}`;

  if (emailEnabled) {
    await sendEmail({
      email: user.email,
      subject: 'Password Reset Request',
      payload: {
        appName: process.env.APP_TITLE || 'LibreChat',
        name: user.name || user.username || user.email,
        link: link,
        year: new Date().getFullYear(),
      },
      template: 'requestPasswordReset.handlebars',
    });
    logger.info(
      `[requestPasswordReset] Link emailed. [Email: ${email}] [ID: ${user._id}] [IP: ${req.ip}] [ResetDomain: ${domains.client}]`,
    );
  } else {
    logger.info(
      `[requestPasswordReset] Link issued. [Email: ${email}] [ID: ${user._id}] [IP: ${req.ip}]`,
    );
    return { link };
  }

  return {
    message: 'If an account with that email exists, a password reset link has been sent to it.',
  };
};

/**
 * Reset Password
 *
 * Handles password reset for both:
 * 1. Unified Snowflake auth (token-only, delegated to AgentNexus API)
 * 2. Legacy local auth (token + userId, stored in MongoDB)
 *
 * @param {String|null} userId - User ID (null/empty for unified auth)
 * @param {String} token - Reset token
 * @param {String} password - New password
 * @returns {Object|Error}
 */
const resetPassword = async (userId, token, password) => {
  // Check if this is a unified Snowflake auth reset (token-only, no userId)
  const agentNexusApiUrl = process.env.AGENTNEXUS_API_URL;
  const useUnifiedAuth = agentNexusApiUrl && process.env.AGENTNEXUS_FRONTEND_URL;

  // If no userId provided and unified auth is configured, delegate to AgentNexus
  if ((!userId || userId === 'undefined' || userId === 'null') && useUnifiedAuth) {
    logger.info('[resetPassword] Delegating to AgentNexus API (unified Snowflake auth)');
    try {
      const response = await axios.post(
        `${agentNexusApiUrl}/auth/reset-password`,
        { token, password },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
        },
      );

      if (response.data && response.data.success) {
        logger.info('[resetPassword] Password reset successful via AgentNexus API');
        return { message: 'Password reset was successful' };
      } else {
        logger.warn('[resetPassword] AgentNexus API returned error:', response.data);
        return new Error(response.data?.detail || 'Password reset failed');
      }
    } catch (apiError) {
      logger.error('[resetPassword] AgentNexus API error:', apiError.response?.data || apiError.message);
      const errorMessage = apiError.response?.data?.detail || 'Invalid or expired password reset token';
      return new Error(errorMessage);
    }
  }

  // Legacy local auth flow (requires userId)
  let passwordResetToken = await findToken(
    {
      userId,
    },
    { sort: { createdAt: -1 } },
  );

  if (!passwordResetToken) {
    return new Error('Invalid or expired password reset token');
  }

  const isValid = bcrypt.compareSync(token, passwordResetToken.token);

  if (!isValid) {
    return new Error('Invalid or expired password reset token');
  }

  const hash = bcrypt.hashSync(password, 10);
  const user = await updateUser(userId, { password: hash });

  if (checkEmailConfig()) {
    await sendEmail({
      email: user.email,
      subject: 'Password Reset Successfully',
      payload: {
        appName: process.env.APP_TITLE || 'LibreChat',
        name: user.name || user.username || user.email,
        year: new Date().getFullYear(),
      },
      template: 'passwordReset.handlebars',
    });
  }

  await deleteTokens({ token: passwordResetToken.token });
  logger.info(`[resetPassword] Password reset successful. [Email: ${user.email}]`);
  return { message: 'Password reset was successful' };
};

/**
 * Set Auth Tokens
 * @param {String | ObjectId} userId
 * @param {ServerResponse} res
 * @param {ISession | null} [session=null]
 * @returns
 */
const setAuthTokens = async (userId, res, _session = null) => {
  try {
    let session = _session;
    let refreshToken;
    let refreshTokenExpires;

    if (session && session._id && session.expiration != null) {
      refreshTokenExpires = session.expiration.getTime();
      refreshToken = await generateRefreshToken(session);
    } else {
      const result = await createSession(userId);
      session = result.session;
      refreshToken = result.refreshToken;
      refreshTokenExpires = session.expiration.getTime();
    }

    const user = await getUserById(userId);
    const token = await generateToken(user);

    res.cookie('refreshToken', refreshToken, {
      expires: new Date(refreshTokenExpires),
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
    });
    res.cookie('token_provider', 'librechat', {
      expires: new Date(refreshTokenExpires),
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
    });
    return token;
  } catch (error) {
    logger.error('[setAuthTokens] Error in setting authentication tokens:', error);
    throw error;
  }
};

/**
 * @function setOpenIDAuthTokens
 * Set OpenID Authentication Tokens
 * //type tokenset from openid-client
 * @param {import('openid-client').TokenEndpointResponse & import('openid-client').TokenEndpointResponseHelpers} tokenset
 * - The tokenset object containing access and refresh tokens
 * @param {Object} res - response object
 * @param {string} [userId] - Optional MongoDB user ID for image path validation
 * @returns {String} - access token
 */
const setOpenIDAuthTokens = (tokenset, res, userId) => {
  try {
    if (!tokenset) {
      logger.error('[setOpenIDAuthTokens] No tokenset found in request');
      return;
    }
    const { REFRESH_TOKEN_EXPIRY } = process.env ?? {};
    const expiryInMilliseconds = REFRESH_TOKEN_EXPIRY
      ? eval(REFRESH_TOKEN_EXPIRY)
      : 1000 * 60 * 60 * 24 * 7; // 7 days default
    const expirationDate = new Date(Date.now() + expiryInMilliseconds);
    if (tokenset == null) {
      logger.error('[setOpenIDAuthTokens] No tokenset found in request');
      return;
    }
    if (!tokenset.access_token || !tokenset.refresh_token) {
      logger.error('[setOpenIDAuthTokens] No access or refresh token found in tokenset');
      return;
    }
    res.cookie('refreshToken', tokenset.refresh_token, {
      expires: expirationDate,
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
    });
    res.cookie('token_provider', 'openid', {
      expires: expirationDate,
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
    });
    if (userId && isEnabled(process.env.OPENID_REUSE_TOKENS)) {
      /** JWT-signed user ID cookie for image path validation when OPENID_REUSE_TOKENS is enabled */
      const signedUserId = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
        expiresIn: expiryInMilliseconds / 1000,
      });
      res.cookie('openid_user_id', signedUserId, {
        expires: expirationDate,
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
      });
    }
    return tokenset.access_token;
  } catch (error) {
    logger.error('[setOpenIDAuthTokens] Error in setting authentication tokens:', error);
    throw error;
  }
};

/**
 * Resend Verification Email
 * @param {Object} req
 * @param {Object} req.body
 * @param {String} req.body.email
 * @returns {Promise<{status: number, message: string}>}
 */
const resendVerificationEmail = async (req) => {
  try {
    const { email } = req.body;
    await deleteTokens({ email });
    const user = await findUser({ email }, 'email _id name');

    if (!user) {
      logger.warn(`[resendVerificationEmail] [No user found] [Email: ${email}]`);
      return { status: 200, message: genericVerificationMessage };
    }

    const [verifyToken, hash] = createTokenHash();

    const verificationLink = `${
      domains.client
    }/verify?token=${verifyToken}&email=${encodeURIComponent(user.email)}`;

    await sendEmail({
      email: user.email,
      subject: 'Verify your email',
      payload: {
        appName: process.env.APP_TITLE || 'LibreChat',
        name: user.name || user.username || user.email,
        verificationLink: verificationLink,
        year: new Date().getFullYear(),
      },
      template: 'verifyEmail.handlebars',
    });

    await createToken({
      userId: user._id,
      email: user.email,
      token: hash,
      createdAt: Date.now(),
      expiresIn: 900,
    });

    logger.info(`[resendVerificationEmail] Verification link issued. [Email: ${user.email}]`);

    return {
      status: 200,
      message: genericVerificationMessage,
    };
  } catch (error) {
    logger.error(`[resendVerificationEmail] Error resending verification email: ${error.message}`);
    return {
      status: 500,
      message: 'Something went wrong.',
    };
  }
};

module.exports = {
  logoutUser,
  verifyEmail,
  registerUser,
  setAuthTokens,
  resetPassword,
  setOpenIDAuthTokens,
  requestPasswordReset,
  resendVerificationEmail,
};
