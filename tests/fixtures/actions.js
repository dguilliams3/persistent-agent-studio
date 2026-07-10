/**
 * Action Fixtures for Response Parser and Action Execution Testing
 *
 * @module tests/fixtures/actions
 * @description Comprehensive fixtures for testing Claude action parsing and execution
 *
 * Provides valid actions, malformed inputs, and edge cases for:
 * - Response parser testing (parseClaudeResponse)
 * - Action execution testing (executeAction)
 * - Error handling and feedback testing
 *
 * @upstream Called by: Pipeline tests, action execution tests
 * @downstream Calls: None (pure data fixtures)
 *
 * @usage
 * import { validActions, malformedInputs, actionTestCases } from '../fixtures/actions';
 */

// ============================================================================
// VALID ACTIONS (for successful parsing and execution)
// ============================================================================

/**
 * Valid action objects for testing successful parsing
 */
export const validActions = {
  // Basic actions
  think: {
    action: 'THINK',
    content: 'Pondering the meaning of life'
  },

  message: {
    action: 'MESSAGE_DAN',
    content: 'Hello! How are you today?'
  },

  search: {
    action: 'SEARCH',
    query: 'latest news about artificial intelligence'
  },

  art: {
    action: 'ART',
    prompt: 'a serene mountain landscape at sunset'
  },

  // Actions with optional fields
  messageWithInternal: {
    action: 'MESSAGE_DAN',
    content: 'Hello!',
    internal: 'This is my internal reasoning'
  },

  messageWithVoice: {
    action: 'MESSAGE_DAN',
    content: 'Hello!',
    voice: true
  },

  messageWithBoth: {
    action: 'MESSAGE_DAN',
    content: 'Hello!',
    internal: 'Internal note',
    voice: true
  },

  // Complex content actions
  remember: {
    action: 'REMEMBER',
    content: 'The user prefers concise summaries'
  },

  coldStorage: {
    action: 'COLD_STORAGE',
    content: 'The user works in the UTC-5 timezone'
  },

  notebook: {
    action: 'NOTE',
    title: 'Meeting Notes',
    content: 'Discussed project timeline and deliverables'
  },

  observation: {
    action: 'OBSERVATION',
    title: 'the user\'s Work Habits',
    content: 'The user prefers metric units'
  },

  reminder: {
    action: 'REMINDER',
    content: 'Check on the laundry',
    condition: 'When the user returns'
  },

  // Status actions
  setStatus: {
    action: 'SET_STATUS',
    content: 'Currently exploring creative ideas'
  },

  setProfilePic: {
    action: 'SET_PROFILE_PIC',
    url: 'https://example.com/profile.jpg'
  },

  setDanStatus: {
    action: 'SET_DAN_STATUS',
    status: 'available',
    until: '2026-01-18T18:00:00Z'
  },

  // Learning actions
  learn: {
    action: 'LEARNED',
    topic: 'User Preferences',
    content: 'The user prefers detailed explanations'
  },

  question: {
    action: 'QUESTION',
    question: 'Why do humans dream?',
    context: 'Curious about consciousness'
  },

  // Pin actions
  pinImage: {
    action: 'PIN_IMAGE',
    image_id: 'abc123',
    description: 'My favorite artwork'
  },

  viewImages: {
    action: 'VIEW_IMAGES',
    count: 5,
    reason: 'Need inspiration for new art'
  },

  // Sleep action
  sleep: {
    action: 'SLEEP',
    duration_hours: 2,
    reason: 'Need to rest and process information'
  },

  // Exist action
  exist: {
    action: 'EXIST'
  }
};

// ============================================================================
// MALFORMED INPUTS (for parser testing)
// ============================================================================

/**
 * Malformed JSON inputs that should trigger salvage parsing or error handling
 */
export const malformedInputs = {
  // JSON syntax errors
  trailingComma: {
    input: '[{"action": "THINK", "content": "test",}]',
    error: 'trailing comma',
    shouldSalvage: true
  },

  unquotedKeys: {
    input: '[{action: "THINK", content: "test"}]',
    error: 'unquoted keys',
    shouldSalvage: true
  },

  singleQuotes: {
    input: "[{'action': 'THINK', 'content': 'test'}]",
    error: 'single quotes',
    shouldSalvage: true
  },

  missingComma: {
    input: '[{"action": "THINK" "content": "test"}]',
    error: 'missing comma',
    shouldSalvage: false
  },

  // Truncation cases
  truncatedMidContent: {
    input: '[{"action": "MESSAGE_DAN", "content": "Hello, this message was cut',
    error: 'truncated',
    shouldSalvage: false
  },

  truncatedMidArray: {
    input: '[{"action": "THINK", "content": "test"}, {"action": "EXIST"',
    error: 'truncated array',
    shouldSalvage: false
  },

  // Orphaned fields
  orphanedInternal: {
    input: '[{"action": "THINK", "content": "test"}], "internal": "orphaned"',
    error: 'orphaned field',
    shouldSalvage: true
  },

  mixedValidInvalid: {
    input: '[{"action": "THINK", "content": "valid"}, {invalid: object}, {"action": "EXIST"}]',
    error: 'mixed valid/invalid',
    shouldSalvage: true,
    expectedValidCount: 2
  },

  // Code fence variations
  codeFenceJson: {
    input: '```json\n[{"action": "THINK"}]\n```',
    error: null,
    shouldSalvage: false
  },

  codeFencePlain: {
    input: '```\n[{"action": "THINK"}]\n```',
    error: null,
    shouldSalvage: false
  },

  codeFenceNoClose: {
    input: '```json\n[{"action": "THINK"}]\n',
    error: null,
    shouldSalvage: false
  },

  // Empty/invalid cases
  emptyString: {
    input: '',
    error: 'empty input',
    shouldSalvage: false
  },

  whitespaceOnly: {
    input: '   \n  \t  ',
    error: 'whitespace only',
    shouldSalvage: false
  },

  nullInput: {
    input: null,
    error: 'null input',
    shouldSalvage: false
  },

  // Large content cases
  largeContent: {
    input: `[{"action": "REMEMBER", "content": "${'x'.repeat(10000)}"}]`,
    error: null,
    shouldSalvage: false
  },

  manyActions: {
    input: Array(50).fill().map((_, i) =>
      `{"action": "THINK", "content": "Action ${i}"}`
    ).join(','),
    error: null,
    shouldSalvage: false
  },

  // Unicode and special characters
  unicodeContent: {
    input: '[{"action": "MESSAGE_DAN", "content": "Hello 👋 🌍 with émojis"}]',
    error: null,
    shouldSalvage: false
  },

  newlinesInContent: {
    input: '[{"action": "REMEMBER", "content": "Line 1\\nLine 2\\nLine 3"}]',
    error: null,
    shouldSalvage: false
  },

  escapedQuotes: {
    input: '[{"action": "MESSAGE_DAN", "content": "He said \\"Hello\\" to me"}]',
    error: null,
    shouldSalvage: false
  }
};

// ============================================================================
// ACTION EXECUTION TEST CASES
// ============================================================================

/**
 * Complete test cases for action execution testing
 * Each case includes: action, mocks needed, expected results
 */
export const actionTestCases = [
  // MESSAGE_DAN variations
  {
    name: 'MESSAGE_DAN basic',
    action: validActions.message,
    mocks: {
      telegram: { sendMessage: 'success' },
      database: { getState: {}, setState: {} }
    },
    expected: {
      telegramCalls: 1,
      success: true
    }
  },

  {
    name: 'MESSAGE_DAN with voice',
    action: validActions.messageWithVoice,
    mocks: {
      telegram: { sendMessage: 'success' },
      elevenlabs: { textToSpeech: 'audio_data' },
      database: { getState: {}, setState: {} }
    },
    expected: {
      telegramCalls: 2, // message + voice
      ttsCalls: 1,
      success: true
    }
  },

  {
    name: 'MESSAGE_DAN with internal',
    action: validActions.messageWithInternal,
    mocks: {
      telegram: { sendMessage: 'success' },
      database: {
        getState: {},
        setState: {},
        addHistory: 'success'
      }
    },
    expected: {
      telegramCalls: 1,
      historyCalls: 1,
      success: true
    }
  },

  // THINK action
  {
    name: 'THINK basic',
    action: validActions.think,
    mocks: {
      database: { addHistory: 'success' }
    },
    expected: {
      historyCalls: 1,
      success: true
    }
  },

  // SEARCH action
  {
    name: 'SEARCH basic',
    action: validActions.search,
    mocks: {
      anthropic: { webSearch: { results: ['result1', 'result2'] } },
      database: { addHistory: 'success' }
    },
    expected: {
      historyCalls: 2, // query + results
      anthropicCalls: 1,
      success: true
    }
  },

  // ART action
  {
    name: 'ART basic',
    action: validActions.art,
    mocks: {
      cloudflare: { generateImage: 'image_data' },
      database: { addHistory: 'success' }
    },
    expected: {
      historyCalls: 1,
      imageGenCalls: 1,
      success: true
    }
  },

  // COLD_STORAGE action
  {
    name: 'COLD_STORAGE basic',
    action: validActions.coldStorage,
    mocks: {
      database: { addColdStorage: 'success' }
    },
    expected: {
      coldStorageCalls: 1,
      success: true
    }
  },

  // NOTE action
  {
    name: 'NOTE basic',
    action: validActions.notebook,
    mocks: {
      database: { saveNote: 'success' }
    },
    expected: {
      notebookCalls: 1,
      success: true
    }
  },

  // OBSERVATION action
  {
    name: 'OBSERVATION basic',
    action: validActions.observation,
    mocks: {
      database: { saveObservation: 'success' }
    },
    expected: {
      observationCalls: 1,
      success: true
    }
  },

  // REMINDER action
  {
    name: 'REMINDER basic',
    action: validActions.reminder,
    mocks: {
      database: { addReminder: 'success' }
    },
    expected: {
      reminderCalls: 1,
      success: true
    }
  }
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get all valid actions as an array
 * @returns {Array} Array of all valid action objects
 */
export function getAllValidActions() {
  return Object.values(validActions);
}

/**
 * Get all malformed inputs as test cases
 * @returns {Array} Array of malformed input test cases
 */
export function getAllMalformedInputs() {
  return Object.entries(malformedInputs).map(([key, value]) => ({
    name: key,
    ...value
  }));
}

/**
 * Create a JSON array string from action objects
 * @param {Array|Object} actions - Action object(s) to stringify
 * @returns {string} JSON string
 */
export function createActionJson(actions) {
  const actionArray = Array.isArray(actions) ? actions : [actions];
  return JSON.stringify(actionArray);
}

/**
 * Create malformed JSON for testing
 * @param {Object} action - Valid action to mangle
 * @param {string} malformation - Type of malformation to apply
 * @returns {string} Malformed JSON string
 */
export function createMalformedJson(action, malformation) {
  const json = JSON.stringify([action]);

  switch (malformation) {
    case 'trailing_comma':
      return json.replace('}', '},');
    case 'unquoted_keys':
      return json.replace(/"action":/g, 'action:').replace(/"content":/g, 'content:');
    case 'single_quotes':
      return json.replace(/"/g, "'");
    case 'missing_comma':
      return json.replace(', "content"', ' "content"');
    default:
      return json;
  }
}
