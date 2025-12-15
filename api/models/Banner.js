const { logger } = require('@librechat/data-schemas');
const { isEnabled } = require('@librechat/api');
const { Banner } = require('~/db/models');

const USE_SNOWFLAKE_STORAGE = isEnabled(process.env.USE_SNOWFLAKE_STORAGE);

/**
 * Retrieves the current active banner.
 * @returns {Promise<Object|null>} The active banner object or null if no active banner is found.
 */
const getBanner = async (user) => {
  try {
    // Skip MongoDB banners when using Snowflake storage
    if (USE_SNOWFLAKE_STORAGE) {
      logger.debug('[getBanner] Skipping banner fetch - using Snowflake storage');
      return null;
    }

    const now = new Date();
    const banner = await Banner.findOne({
      displayFrom: { $lte: now },
      $or: [{ displayTo: { $gte: now } }, { displayTo: null }],
      type: 'banner',
    }).lean();

    if (!banner || banner.isPublic || user) {
      return banner;
    }

    return null;
  } catch (error) {
    logger.error('[getBanners] Error getting banners', error);
    throw new Error('Error getting banners');
  }
};

module.exports = { getBanner };
