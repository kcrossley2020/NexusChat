const jwt = require('jsonwebtoken');
const { logger } = require('@librechat/data-schemas');
const { SystemRoles } = require('librechat-data-provider');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const { getUserById, updateUser } = require('~/models');
const { isEnabled } = require('@librechat/api');

const USE_SNOWFLAKE_STORAGE = isEnabled(process.env.USE_SNOWFLAKE_STORAGE);
const AGENTNEXUS_JWT_SECRET = process.env.AGENTNEXUS_JWT_SECRET || process.env.JWT_SECRET;

// JWT strategy with dynamic secret selection
const jwtLogin = () =>
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKeyProvider: (request, rawJwtToken, done) => {
        // Try to decode the token to see if it's an AgentNexus token
        if (USE_SNOWFLAKE_STORAGE) {
          try {
            const decoded = jwt.decode(rawJwtToken, { complete: false });
            // AgentNexus tokens have 'user_id', NexusChat tokens have 'id'
            if (decoded && decoded.user_id) {
              logger.debug('[jwtLogin] Detected AgentNexus token, using AGENTNEXUS_JWT_SECRET');
              return done(null, AGENTNEXUS_JWT_SECRET);
            }
          } catch (err) {
            logger.debug('[jwtLogin] Error decoding token:', err.message);
          }
        }
        // Default to NexusChat JWT secret
        done(null, process.env.JWT_SECRET);
      },
      passReqToCallback: true,
    },
    async (req, payload, done) => {
      try {
        // Check if this is an AgentNexus token (has user_id instead of id)
        if (payload.user_id && USE_SNOWFLAKE_STORAGE) {
          logger.debug('[jwtLogin] Using AgentNexus token for user:', payload.email);

          // Construct user object from AgentNexus token payload
          const user = {
            _id: payload.user_id,
            id: payload.user_id,
            email: payload.email,
            emailVerified: payload.email_verified || true,
            name: payload.email.split('@')[0],
            username: payload.email.split('@')[0],
            avatar: null,
            role: payload.account_type === 'system_admin' ? SystemRoles.ADMIN : SystemRoles.USER,
            provider: 'local',
          };

          return done(null, user);
        }

        // Legacy MongoDB-based JWT validation
        const user = await getUserById(payload?.id, '-password -__v -totpSecret -backupCodes');
        if (user) {
          user.id = user._id.toString();
          if (!user.role) {
            user.role = SystemRoles.USER;
            await updateUser(user.id, { role: user.role });
          }
          done(null, user);
        } else {
          logger.warn('[jwtLogin] JwtStrategy => no user found: ' + payload?.id);
          done(null, false);
        }
      } catch (err) {
        logger.error('[jwtLogin] JWT verification error:', err);
        done(err, false);
      }
    },
  );

module.exports = jwtLogin;
