const mongoose = require('mongoose');
const { createMethods } = require('@librechat/data-schemas');
const methods = createMethods(mongoose);
const { comparePassword } = require('./userMethods');
const {
  findFileById,
  createFile,
  updateFile,
  deleteFile,
  deleteFiles,
  getFiles,
  updateFileUsage,
} = require('./File');
const {
  getMessage,
  getMessages,
  saveMessage,
  recordMessage,
  updateMessage,
  deleteMessagesSince,
  deleteMessages,
} = require('./Message');
const { getConvoTitle, getConvo, saveConvo, deleteConvos } = require('./Conversation');
const { getPreset, getPresets, savePreset, deletePresets } = require('./Preset');
const { File } = require('~/db/models');

// Import Snowflake user service for unified authentication
const SnowflakeUserService = require('~/server/services/SnowflakeUserService');

const seedDatabase = async () => {
  await methods.initializeRoles();
  await methods.seedDefaultRoles();
  await methods.ensureDefaultCategories();
};

// ============================================================================
// Unified User Methods (Snowflake or MongoDB based on configuration)
// ============================================================================

/**
 * Wrapper for findUser that uses Snowflake when enabled
 * Falls back to MongoDB methods when Snowflake is disabled
 */
const findUser = async (searchCriteria, fieldsToSelect = null) => {
  if (SnowflakeUserService.isSnowflakeUsersEnabled()) {
    return SnowflakeUserService.findUser(searchCriteria, fieldsToSelect);
  }
  return methods.findUser(searchCriteria, fieldsToSelect);
};

/**
 * Wrapper for getUserById that uses Snowflake when enabled
 */
const getUserById = async (userId, fieldsToSelect = null) => {
  if (SnowflakeUserService.isSnowflakeUsersEnabled()) {
    return SnowflakeUserService.getUserById(userId, fieldsToSelect);
  }
  return methods.getUserById(userId, fieldsToSelect);
};

/**
 * Wrapper for createUser that uses Snowflake when enabled
 */
const createUser = async (userData, balanceConfig = null, disableTTL = true, returnUser = false) => {
  if (SnowflakeUserService.isSnowflakeUsersEnabled()) {
    return SnowflakeUserService.createUser(userData, balanceConfig, disableTTL, returnUser);
  }
  return methods.createUser(userData, balanceConfig, disableTTL, returnUser);
};

/**
 * Wrapper for updateUser that uses Snowflake when enabled
 */
const updateUser = async (userId, updates) => {
  if (SnowflakeUserService.isSnowflakeUsersEnabled()) {
    return SnowflakeUserService.updateUser(userId, updates);
  }
  return methods.updateUser(userId, updates);
};

/**
 * Wrapper for deleteUserById that uses Snowflake when enabled
 */
const deleteUserById = async (userId) => {
  if (SnowflakeUserService.isSnowflakeUsersEnabled()) {
    return SnowflakeUserService.deleteUserById(userId);
  }
  return methods.deleteUserById(userId);
};

/**
 * Wrapper for countUsers that uses Snowflake when enabled
 */
const countUsers = async (filter = {}) => {
  if (SnowflakeUserService.isSnowflakeUsersEnabled()) {
    return SnowflakeUserService.countUsers(filter);
  }
  return methods.countUsers(filter);
};

// ============================================================================
// Session Wrappers
// ============================================================================

const findSession = async (criteria, options = {}) => {
  if (SnowflakeUserService.isSnowflakeUsersEnabled()) {
    return SnowflakeUserService.findSession(criteria, options);
  }
  return methods.findSession(criteria, options);
};

const createSession = async (userId) => {
  if (SnowflakeUserService.isSnowflakeUsersEnabled()) {
    return SnowflakeUserService.createSession(userId);
  }
  return methods.createSession(userId);
};

const deleteSession = async (criteria) => {
  if (SnowflakeUserService.isSnowflakeUsersEnabled()) {
    return SnowflakeUserService.deleteSession(criteria);
  }
  return methods.deleteSession(criteria);
};

const deleteAllUserSessions = async (criteria) => {
  if (SnowflakeUserService.isSnowflakeUsersEnabled()) {
    return SnowflakeUserService.deleteAllUserSessions(criteria);
  }
  return methods.deleteAllUserSessions(criteria);
};

// ============================================================================
// Token Wrappers (for password reset, email verification)
// ============================================================================

const findToken = async (criteria, options = {}) => {
  if (SnowflakeUserService.isSnowflakeUsersEnabled()) {
    return SnowflakeUserService.findToken(criteria, options);
  }
  return methods.findToken(criteria, options);
};

const createToken = async (tokenData) => {
  if (SnowflakeUserService.isSnowflakeUsersEnabled()) {
    return SnowflakeUserService.createToken(tokenData);
  }
  return methods.createToken(tokenData);
};

const deleteTokens = async (criteria) => {
  if (SnowflakeUserService.isSnowflakeUsersEnabled()) {
    return SnowflakeUserService.deleteTokens(criteria);
  }
  return methods.deleteTokens(criteria);
};

// ============================================================================
// JWT Token Generation Wrappers
// ============================================================================

const generateToken = async (user) => {
  if (SnowflakeUserService.isSnowflakeUsersEnabled()) {
    return SnowflakeUserService.generateToken(user);
  }
  return methods.generateToken(user);
};

const generateRefreshToken = async (session) => {
  if (SnowflakeUserService.isSnowflakeUsersEnabled()) {
    return SnowflakeUserService.generateRefreshToken(session);
  }
  return methods.generateRefreshToken(session);
};

module.exports = {
  // Spread all original methods first (provides defaults)
  ...methods,

  // Override user methods with Snowflake-aware wrappers
  findUser,
  getUserById,
  createUser,
  updateUser,
  deleteUserById,
  countUsers,

  // Override session methods
  findSession,
  createSession,
  deleteSession,
  deleteAllUserSessions,

  // Override token methods
  findToken,
  createToken,
  deleteTokens,

  // Override JWT generation
  generateToken,
  generateRefreshToken,

  // Original methods that don't need Snowflake override
  seedDatabase,
  comparePassword,
  findFileById,
  createFile,
  updateFile,
  deleteFile,
  deleteFiles,
  getFiles,
  updateFileUsage,

  getMessage,
  getMessages,
  saveMessage,
  recordMessage,
  updateMessage,
  deleteMessagesSince,
  deleteMessages,

  getConvoTitle,
  getConvo,
  saveConvo,
  deleteConvos,

  getPreset,
  getPresets,
  savePreset,
  deletePresets,

  Files: File,

  // Export Snowflake service for direct access if needed
  SnowflakeUserService,
};
