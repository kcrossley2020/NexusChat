/**
 * SnowflakeChatService - Snowflake-based Chat Storage Service
 *
 * This service handles conversation and message CRUD operations
 * using Snowflake as the storage backend via the AgentNexus API.
 *
 * Environment Variables:
 * - USE_SNOWFLAKE_STORAGE: Enable Snowflake storage mode
 * - AGENTNEXUS_API_URL: AgentNexus backend URL (default: http://localhost:3050)
 *
 * Tables Used:
 * - AGENTNEXUS_DB.AUTH_SCHEMA.CONVERSATIONS
 * - AGENTNEXUS_DB.AUTH_SCHEMA.MESSAGES
 * - AGENTNEXUS_DB.AUTH_SCHEMA.FILES
 */

const axios = require('axios');
const { logger } = require('@librechat/data-schemas');
const { isEnabled } = require('@librechat/api');

// Configuration
const USE_SNOWFLAKE_STORAGE = isEnabled(process.env.USE_SNOWFLAKE_STORAGE);
const AGENTNEXUS_API_URL = process.env.AGENTNEXUS_API_URL || 'http://localhost:3050';
const API_TIMEOUT = 30000; // 30 seconds

// Storage failure tracking
const STORAGE_FAILURE_WARNING = 'Your message was received but could not be saved to permanent storage. ' +
  'It will only be available in this session. Please contact support if this persists.';
const STORAGE_FAILURE_CODES = {
  CONNECTION_ERROR: 'SNOWFLAKE_CONNECTION_ERROR',
  AUTH_ERROR: 'SNOWFLAKE_AUTH_ERROR',
  TIMEOUT_ERROR: 'SNOWFLAKE_TIMEOUT_ERROR',
  UNKNOWN_ERROR: 'SNOWFLAKE_UNKNOWN_ERROR',
};

/**
 * Determine error type from axios error
 * @param {Error} error - The error object
 * @returns {string} Error code
 */
function getStorageErrorCode(error) {
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return STORAGE_FAILURE_CODES.CONNECTION_ERROR;
  }
  if (error.response?.status === 401 || error.response?.status === 403) {
    return STORAGE_FAILURE_CODES.AUTH_ERROR;
  }
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return STORAGE_FAILURE_CODES.TIMEOUT_ERROR;
  }
  return STORAGE_FAILURE_CODES.UNKNOWN_ERROR;
}

/**
 * Get user-friendly error message
 * @param {string} errorCode - The error code
 * @param {string} operation - The operation that failed
 * @returns {string} User-friendly message
 */
function getUserFriendlyErrorMessage(errorCode, operation) {
  const messages = {
    [STORAGE_FAILURE_CODES.CONNECTION_ERROR]:
      `Unable to connect to storage service. Your ${operation} was not saved permanently.`,
    [STORAGE_FAILURE_CODES.AUTH_ERROR]:
      `Authentication failed with storage service. Your ${operation} was not saved permanently.`,
    [STORAGE_FAILURE_CODES.TIMEOUT_ERROR]:
      `Storage service timed out. Your ${operation} was not saved permanently.`,
    [STORAGE_FAILURE_CODES.UNKNOWN_ERROR]:
      `An error occurred saving your ${operation}. It may not be available after this session.`,
  };
  return messages[errorCode] || messages[STORAGE_FAILURE_CODES.UNKNOWN_ERROR];
}

// Create axios instance with default config
const snowflakeApi = axios.create({
  baseURL: AGENTNEXUS_API_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Check if Snowflake storage is enabled
 * @returns {boolean}
 */
function isSnowflakeEnabled() {
  return USE_SNOWFLAKE_STORAGE;
}

// ============================================================================
// CONVERSATION OPERATIONS
// ============================================================================

/**
 * Create a new conversation in Snowflake
 * @param {Object} params - Conversation parameters
 * @param {string} params.conversationId - Unique conversation ID (UUID)
 * @param {string} params.userId - User ID
 * @param {string} params.title - Conversation title
 * @param {string} params.endpoint - AI endpoint (openAI, anthropic, etc.)
 * @param {string} params.model - AI model name
 * @param {Object} [params.options] - Additional conversation options
 * @param {string} [authToken] - JWT auth token
 * @returns {Promise<Object>} Created conversation
 */
async function createConversation(params, authToken) {
  try {
    const {
      conversationId,
      userId,
      title = 'New Chat',
      endpoint,
      model,
      ...options
    } = params;

    const response = await snowflakeApi.post(
      '/api/chat/conversations',
      {
        conversation_id: conversationId,
        user_id: userId,
        title,
        endpoint,
        model,
        ...options,
      },
      {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      }
    );

    logger.info(`[SnowflakeChatService] Created conversation ${conversationId}`);

    return {
      conversationId: response.data.conversation_id || conversationId,
      user: userId,
      title: response.data.title || title,
      endpoint: response.data.endpoint || endpoint,
      model: response.data.model || model,
      createdAt: response.data.created_at || new Date(),
      updatedAt: response.data.updated_at || new Date(),
      ...response.data,
    };
  } catch (error) {
    const errorCode = getStorageErrorCode(error);
    const userMessage = getUserFriendlyErrorMessage(errorCode, 'conversation');

    logger.error('[SnowflakeChatService] Error creating conversation:', {
      message: error.message,
      code: errorCode,
      conversationId: params.conversationId,
    });

    // Return mock object with storage failure indicators
    return {
      conversationId: params.conversationId,
      user: params.userId,
      title: params.title || 'New Chat',
      endpoint: params.endpoint,
      model: params.model,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      // Storage failure flags - these should be checked by calling code
      _storageFailed: true,
      _storageErrorCode: errorCode,
      _storageError: error.message,
      _storageWarning: userMessage,
    };
  }
}

/**
 * Get a single conversation by ID
 * @param {string} userId - User ID
 * @param {string} conversationId - Conversation ID
 * @param {string} [authToken] - JWT auth token
 * @returns {Promise<Object|null>} Conversation or null
 */
async function getConversation(userId, conversationId, authToken) {
  try {
    const response = await snowflakeApi.get(
      `/api/chat/conversations/${conversationId}`,
      {
        params: { user_id: userId },
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      }
    );

    if (response.data) {
      return {
        conversationId: response.data.conversation_id,
        user: response.data.user_id,
        title: response.data.title,
        endpoint: response.data.endpoint,
        model: response.data.model,
        createdAt: response.data.created_at,
        updatedAt: response.data.updated_at,
        ...response.data,
      };
    }

    return null;
  } catch (error) {
    logger.error('[SnowflakeChatService] Error getting conversation:', error.message);
    return null;
  }
}

/**
 * List user's conversations with pagination
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @param {number} [options.limit=25] - Number of conversations to return
 * @param {string} [options.cursor] - Pagination cursor (updatedAt timestamp)
 * @param {boolean} [options.isArchived=false] - Filter archived conversations
 * @param {string[]} [options.tags] - Filter by tags
 * @param {string} [options.search] - Search term
 * @param {string} [options.order='desc'] - Sort order
 * @param {string} [authToken] - JWT auth token
 * @returns {Promise<{conversations: Object[], nextCursor: string|null}>}
 */
async function listConversations(userId, options = {}, authToken) {
  try {
    const {
      limit = 25,
      cursor,
      isArchived = false,
      tags,
      search,
      order = 'desc',
    } = options;

    const response = await snowflakeApi.get('/api/chat/conversations', {
      params: {
        user_id: userId,
        limit: limit + 1, // Request one extra to determine if there's a next page
        cursor,
        is_archived: isArchived,
        tags: tags ? tags.join(',') : undefined,
        search,
        order,
      },
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    });

    const conversations = response.data.conversations || [];

    // Determine if there's a next page
    let nextCursor = null;
    if (conversations.length > limit) {
      const lastConvo = conversations.pop();
      nextCursor = lastConvo.updated_at || lastConvo.updatedAt;
    }

    // Transform to NexusChat format
    const transformedConversations = conversations.map((conv) => ({
      conversationId: conv.conversation_id || conv.conversationId,
      user: conv.user_id || conv.user,
      title: conv.title,
      endpoint: conv.endpoint,
      model: conv.model,
      isArchived: conv.is_archived || conv.isArchived,
      createdAt: conv.created_at || conv.createdAt,
      updatedAt: conv.updated_at || conv.updatedAt,
      ...conv,
    }));

    return { conversations: transformedConversations, nextCursor };
  } catch (error) {
    logger.error('[SnowflakeChatService] Error listing conversations:', error.message);
    return { conversations: [], nextCursor: null };
  }
}

/**
 * Update a conversation
 * @param {string} userId - User ID
 * @param {string} conversationId - Conversation ID
 * @param {Object} updates - Fields to update
 * @param {string} [authToken] - JWT auth token
 * @returns {Promise<Object>} Updated conversation
 */
async function updateConversation(userId, conversationId, updates, authToken) {
  try {
    const response = await snowflakeApi.put(
      `/api/chat/conversations/${conversationId}`,
      {
        user_id: userId,
        ...updates,
      },
      {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      }
    );

    logger.info(`[SnowflakeChatService] Updated conversation ${conversationId}`);

    return {
      conversationId,
      user: userId,
      ...updates,
      updatedAt: new Date(),
      ...response.data,
    };
  } catch (error) {
    const errorCode = getStorageErrorCode(error);
    const userMessage = getUserFriendlyErrorMessage(errorCode, 'conversation update');

    logger.error('[SnowflakeChatService] Error updating conversation:', {
      message: error.message,
      code: errorCode,
      conversationId,
    });

    return {
      conversationId,
      user: userId,
      ...updates,
      updatedAt: new Date(),
      _storageFailed: true,
      _storageErrorCode: errorCode,
      _storageError: error.message,
      _storageWarning: userMessage,
    };
  }
}

/**
 * Delete a conversation and its messages
 * @param {string} userId - User ID
 * @param {string} conversationId - Conversation ID
 * @param {string} [authToken] - JWT auth token
 * @returns {Promise<{deletedCount: number, messages: {deletedCount: number}}>}
 */
async function deleteConversation(userId, conversationId, authToken) {
  try {
    const response = await snowflakeApi.delete(
      `/api/chat/conversations/${conversationId}`,
      {
        params: { user_id: userId },
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      }
    );

    logger.info(`[SnowflakeChatService] Deleted conversation ${conversationId}`);

    return {
      deletedCount: 1,
      messages: { deletedCount: response.data.messages_deleted || 0 },
    };
  } catch (error) {
    logger.error('[SnowflakeChatService] Error deleting conversation:', error.message);
    throw new Error('Error deleting conversation');
  }
}

// ============================================================================
// MESSAGE OPERATIONS
// ============================================================================

/**
 * Save a message to Snowflake
 * @param {Object} params - Message parameters
 * @param {string} params.messageId - Unique message ID (UUID)
 * @param {string} params.conversationId - Conversation ID
 * @param {string} params.userId - User ID
 * @param {string} params.text - Message text content
 * @param {string} params.sender - Sender type ('User' or 'Assistant')
 * @param {boolean} params.isCreatedByUser - Whether user created this message
 * @param {string} [params.endpoint] - AI endpoint
 * @param {string} [params.model] - AI model
 * @param {number} [params.tokenCount] - Token count
 * @param {string} [params.finishReason] - Finish reason
 * @param {string} [params.parentMessageId] - Parent message ID for threading
 * @param {string} [authToken] - JWT auth token
 * @returns {Promise<Object>} Saved message
 */
async function saveMessage(params, authToken) {
  try {
    const {
      messageId,
      conversationId,
      userId,
      text,
      sender,
      isCreatedByUser,
      endpoint,
      model,
      tokenCount,
      finishReason,
      parentMessageId,
      ...rest
    } = params;

    const response = await snowflakeApi.post(
      '/api/chat/messages',
      {
        message_id: messageId,
        conversation_id: conversationId,
        user_id: userId,
        text,
        sender,
        is_created_by_user: isCreatedByUser,
        endpoint,
        model,
        token_count: tokenCount,
        finish_reason: finishReason,
        parent_message_id: parentMessageId,
        ...rest,
      },
      {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      }
    );

    logger.debug(`[SnowflakeChatService] Saved message ${messageId}`);

    return {
      messageId: response.data.message_id || messageId,
      conversationId: response.data.conversation_id || conversationId,
      user: response.data.user_id || userId,
      text: response.data.text || text,
      sender: response.data.sender || sender,
      isCreatedByUser: response.data.is_created_by_user ?? isCreatedByUser,
      endpoint: response.data.endpoint || endpoint,
      model: response.data.model || model,
      tokenCount: response.data.token_count || tokenCount,
      createdAt: response.data.created_at || new Date(),
      updatedAt: response.data.updated_at || new Date(),
      ...response.data,
    };
  } catch (error) {
    const errorCode = getStorageErrorCode(error);
    const userMessage = getUserFriendlyErrorMessage(errorCode, 'message');

    logger.error('[SnowflakeChatService] Error saving message:', {
      message: error.message,
      code: errorCode,
      messageId: params.messageId,
      conversationId: params.conversationId,
    });

    // Return mock object with storage failure indicators
    // IMPORTANT: The _storageFailed flag should be checked by the caller
    // to notify the user their message was not persisted
    return {
      messageId: params.messageId,
      conversationId: params.conversationId,
      user: params.userId,
      text: params.text,
      sender: params.sender,
      isCreatedByUser: params.isCreatedByUser,
      createdAt: new Date(),
      updatedAt: new Date(),
      // Storage failure flags - these should be checked by calling code
      _storageFailed: true,
      _storageErrorCode: errorCode,
      _storageError: error.message,
      _storageWarning: userMessage,
    };
  }
}

/**
 * Get messages for a conversation
 * @param {string} conversationId - Conversation ID
 * @param {string} userId - User ID
 * @param {Object} [options] - Query options
 * @param {string} [options.select] - Fields to select
 * @param {number} [options.limit] - Maximum messages to return
 * @param {string} [authToken] - JWT auth token
 * @returns {Promise<Object[]>} Array of messages
 */
async function getMessages(conversationId, userId, options = {}, authToken) {
  try {
    const { select, limit } = options;

    const response = await snowflakeApi.get('/api/chat/messages', {
      params: {
        conversation_id: conversationId,
        user_id: userId,
        select,
        limit,
      },
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    });

    const messages = response.data.messages || [];

    // Transform to NexusChat format
    return messages.map((msg) => ({
      messageId: msg.message_id || msg.messageId,
      conversationId: msg.conversation_id || msg.conversationId,
      user: msg.user_id || msg.user,
      parentMessageId: msg.parent_message_id || msg.parentMessageId,
      sender: msg.sender,
      text: msg.text,
      isCreatedByUser: msg.is_created_by_user ?? msg.isCreatedByUser,
      endpoint: msg.endpoint,
      model: msg.model,
      tokenCount: msg.token_count || msg.tokenCount,
      finishReason: msg.finish_reason || msg.finishReason,
      error: msg.error,
      unfinished: msg.unfinished,
      createdAt: msg.created_at || msg.createdAt,
      updatedAt: msg.updated_at || msg.updatedAt,
      ...msg,
    }));
  } catch (error) {
    logger.error('[SnowflakeChatService] Error getting messages:', error.message);
    return [];
  }
}

/**
 * Get a single message by ID
 * @param {string} userId - User ID
 * @param {string} messageId - Message ID
 * @param {string} [authToken] - JWT auth token
 * @returns {Promise<Object|null>} Message or null
 */
async function getMessage(userId, messageId, authToken) {
  try {
    const response = await snowflakeApi.get(`/api/chat/messages/${messageId}`, {
      params: { user_id: userId },
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    });

    if (response.data) {
      return {
        messageId: response.data.message_id || response.data.messageId,
        conversationId: response.data.conversation_id || response.data.conversationId,
        user: response.data.user_id || response.data.user,
        text: response.data.text,
        sender: response.data.sender,
        isCreatedByUser: response.data.is_created_by_user ?? response.data.isCreatedByUser,
        createdAt: response.data.created_at || response.data.createdAt,
        updatedAt: response.data.updated_at || response.data.updatedAt,
        ...response.data,
      };
    }

    return null;
  } catch (error) {
    logger.error('[SnowflakeChatService] Error getting message:', error.message);
    return null;
  }
}

/**
 * Update a message
 * @param {string} userId - User ID
 * @param {string} messageId - Message ID
 * @param {Object} updates - Fields to update
 * @param {string} [authToken] - JWT auth token
 * @returns {Promise<Object>} Updated message
 */
async function updateMessage(userId, messageId, updates, authToken) {
  try {
    const response = await snowflakeApi.put(
      `/api/chat/messages/${messageId}`,
      {
        user_id: userId,
        ...updates,
      },
      {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      }
    );

    logger.debug(`[SnowflakeChatService] Updated message ${messageId}`);

    return {
      messageId,
      user: userId,
      ...updates,
      updatedAt: new Date(),
      ...response.data,
    };
  } catch (error) {
    const errorCode = getStorageErrorCode(error);
    const userMessage = getUserFriendlyErrorMessage(errorCode, 'message update');

    logger.error('[SnowflakeChatService] Error updating message:', {
      message: error.message,
      code: errorCode,
      messageId,
    });

    return {
      messageId,
      user: userId,
      ...updates,
      updatedAt: new Date(),
      _storageFailed: true,
      _storageErrorCode: errorCode,
      _storageError: error.message,
      _storageWarning: userMessage,
    };
  }
}

/**
 * Delete messages by filter
 * @param {Object} filter - Delete filter
 * @param {string} [filter.conversationId] - Conversation ID
 * @param {string} [filter.userId] - User ID
 * @param {string} [authToken] - JWT auth token
 * @returns {Promise<{deletedCount: number}>}
 */
async function deleteMessages(filter, authToken) {
  try {
    const response = await snowflakeApi.delete('/api/chat/messages', {
      params: {
        conversation_id: filter.conversationId,
        user_id: filter.userId,
      },
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    });

    logger.info(`[SnowflakeChatService] Deleted messages for filter:`, filter);

    return { deletedCount: response.data.deleted_count || 0 };
  } catch (error) {
    logger.error('[SnowflakeChatService] Error deleting messages:', error.message);
    return { deletedCount: 0 };
  }
}

/**
 * Delete messages since a specific message (for conversation branching)
 * @param {string} userId - User ID
 * @param {string} messageId - Message ID to delete from
 * @param {string} conversationId - Conversation ID
 * @param {string} [authToken] - JWT auth token
 * @returns {Promise<{deletedCount: number}>}
 */
async function deleteMessagesSince(userId, messageId, conversationId, authToken) {
  try {
    const response = await snowflakeApi.delete('/api/chat/messages/since', {
      params: {
        user_id: userId,
        message_id: messageId,
        conversation_id: conversationId,
      },
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    });

    logger.info(`[SnowflakeChatService] Deleted messages since ${messageId}`);

    return { deletedCount: response.data.deleted_count || 0 };
  } catch (error) {
    logger.error('[SnowflakeChatService] Error deleting messages since:', error.message);
    return { deletedCount: 0 };
  }
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * Bulk save messages
 * @param {Object[]} messages - Array of message objects
 * @param {string} [authToken] - JWT auth token
 * @returns {Promise<{insertedCount: number}>}
 */
async function bulkSaveMessages(messages, authToken) {
  try {
    const response = await snowflakeApi.post(
      '/api/chat/messages/bulk',
      { messages },
      {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      }
    );

    logger.info(`[SnowflakeChatService] Bulk saved ${messages.length} messages`);

    return { insertedCount: response.data.inserted_count || messages.length };
  } catch (error) {
    logger.error('[SnowflakeChatService] Error bulk saving messages:', error.message);
    return { insertedCount: 0 };
  }
}

/**
 * Bulk save conversations
 * @param {Object[]} conversations - Array of conversation objects
 * @param {string} [authToken] - JWT auth token
 * @returns {Promise<{insertedCount: number}>}
 */
async function bulkSaveConversations(conversations, authToken) {
  try {
    const response = await snowflakeApi.post(
      '/api/chat/conversations/bulk',
      { conversations },
      {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      }
    );

    logger.info(`[SnowflakeChatService] Bulk saved ${conversations.length} conversations`);

    return { insertedCount: response.data.inserted_count || conversations.length };
  } catch (error) {
    logger.error('[SnowflakeChatService] Error bulk saving conversations:', error.message);
    return { insertedCount: 0 };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Status
  isSnowflakeEnabled,

  // Error codes for storage failures
  STORAGE_FAILURE_CODES,
  STORAGE_FAILURE_WARNING,

  // Conversations
  createConversation,
  getConversation,
  listConversations,
  updateConversation,
  deleteConversation,
  bulkSaveConversations,

  // Messages
  saveMessage,
  getMessages,
  getMessage,
  updateMessage,
  deleteMessages,
  deleteMessagesSince,
  bulkSaveMessages,
};
