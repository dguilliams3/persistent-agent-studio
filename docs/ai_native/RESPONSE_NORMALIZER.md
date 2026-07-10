# Response Normalization System

## ⚠️ **MANDATORY USAGE NOTICE**

**ALL LLM calls MUST use the response normalization integration layer.** This is the **ONLY approved way** to interact with AI providers in this codebase.

```javascript
// ✅ CORRECT: Always use normalized interface
import { callLLM } from './services/index.js'; // This is the integration layer
const result = await callLLM(opts, env);

// ❌ FORBIDDEN: Direct provider imports
import { callLLM } from './services/llm.js'; // NEVER use this directly
```

**Why?** Ensures consistent behavior, error handling, and data structures across all providers (Anthropic, OpenAI, Local models, etc.).

**Documentation:** See `CLAUDE.md#dry-standards--established-patterns` for complete standards.

---

## Overview

The Response Normalization System provides a DRY, scalable architecture for normalizing responses from different AI models and providers. It ensures consistent data structures, error handling, and behavior regardless of which LLM service is used.

## Architecture

### Core Components

1. **Provider Configurations** (`PROVIDER_CONFIGS`)
   - Define how to extract content, normalize metadata, and handle errors for each provider
   - Extensible: easy to add new providers

2. **Normalization Pipeline**
   - Chainable transformation steps
   - Configurable execution order
   - Error recovery and fallback strategies

3. **Integration Layer**
   - Drop-in replacements for existing functions
   - Backward compatibility
   - Gradual migration support

## Provider Configuration

Each provider defines normalization rules:

```javascript
const PROVIDER_CONFIGS = {
  anthropic: {
    extractContent: (response) => response.content[0].text,
    normalizeMetadata: (response, request) => ({
      provider: 'anthropic',
      tokens: { input: response.usage.input_tokens, ... },
      cost: calculateCost(response.usage, response.model)
    }),
    normalizeError: (error, response) => ({
      code: error.type,
      retryable: isRetryable(error),
      ...
    }),
    quirks: {
      // Provider-specific fixes
      actionFormatting: (content, model) => { /* ... */ }
    }
  }
};
```

## Usage Examples

### Basic LLM Response Normalization

```javascript
import { normalizeLLMResponse } from './services/response-normalizer.js';

// Raw API response from Anthropic
const rawResponse = {
  content: [{ text: '[{"action": "THINK", "content": "Hello"}]' }],
  usage: { input_tokens: 100, output_tokens: 50 },
  model: 'claude-sonnet-4-20250514'
};

const result = normalizeLLMResponse(rawResponse, 'anthropic', { model: 'claude-sonnet-4-20250514' });

if (result.success) {
  console.log('Content:', result.content);
  console.log('Metadata:', result.metadata);
  // Content: '[{"action": "THINK", "content": "Hello"}]'
  // Metadata: { provider: 'anthropic', tokens: { input: 100, output: 50, total: 150 }, cost: 0.015, ... }
}
```

### Action Content Normalization

```javascript
import { normalizeActionContent } from './services/response-normalizer.js';

const rawContent = '[{"action": "THINK", "content": "test"}]';
const result = normalizeActionContent(rawContent, 'anthropic', 'claude-sonnet-4-20250514');

if (result.success) {
  console.log('Actions:', result.actions);
  // Actions: [{ action: 'THINK', content: 'test' }]
}
```

### Error Normalization

```javascript
import { normalizeError } from './services/response-normalizer.js';

const error = { type: 'rate_limit_error', message: 'Rate limited' };
const normalized = normalizeError(error, response, 'anthropic');

console.log(normalized);
// {
//   code: 'rate_limit_error',
//   message: 'Rate limited',
//   provider: 'anthropic',
//   retryable: true,
//   details: { raw: error, statusCode: 429, ... }
// }
```

## Integration with Existing Services

### Primary Integration Layer

**File:** `services/response-normalizer-integration.js`

This is the **ONLY interface** for all AI service interactions. No backward compatibility - this IS the interface.

```javascript
// ⚠️ REQUIRED: Use integration layer for ALL AI service calls
import {
  callLLM,                    // Normalized LLM calls
  parseClaudeResponse,        // Normalized action parsing
  generateImage               // Normalized image generation
} from './services/response-normalizer-integration.js';

// Returns normalized response objects: { content, metadata, usage, success, error }
const result = await callLLM({ provider: 'anthropic', model: 'sonnet' }, env);

// ❌ FORBIDDEN: Direct imports bypass normalization
import { callLLM } from './services/llm.js';  // Banned
```

### Enhanced Versions with Full Normalization

For advanced use cases requiring full control over normalization:

```javascript
import {
  callLLMNormalized,           // Returns full normalized response object
  parseClaudeResponseNormalized,
  generateImageNormalized
} from './services/response-normalizer-integration.js';

// Enhanced versions with normalization
const llmResult = await callLLMNormalized({ provider: 'anthropic', ... }, env);
const parseResult = parseClaudeResponseNormalized(content, { provider: 'anthropic', model: 'sonnet' });
const imageResult = await generateImageNormalized(prompt, env);

// All return consistent structures with metadata and normalized errors
```

### Gradual Migration

```javascript
import { conditional } from './services/response-normalizer-integration.js';

// Feature flag for gradual rollout
const callLLM = conditional.callLLM; // Uses normalized or original based on ENABLE_NORMALIZATION flag

// Compare implementations during migration
import { logNormalizationComparison } from './services/response-normalizer-integration.js';

const originalResult = await originalCallLLM(opts, env);
const normalizedResult = await callLLMNormalized(opts, env);
logNormalizationComparison('callLLM', originalResult, normalizedResult);
```

## Adding New Providers

### Using Templates

```javascript
import { createOpenAICompatibleConfig } from './services/response-normalizer-config.js';

// Quick setup for OpenAI-compatible providers
const customProvider = createOpenAICompatibleConfig('custom-llm', 'https://api.custom.com/v1', customCostCalculator);

// Add to provider configs
PROVIDER_CONFIGS.custom = customProvider;
```

### Full Custom Configuration

```javascript
const customProvider = {
  name: 'custom',
  extractContent: (response) => response.output?.text || null,
  normalizeMetadata: (response, request) => ({
    provider: 'custom',
    tokens: { input: response.tokens_in, output: response.tokens_out, total: response.tokens_total },
    cost: customCostFunction(response.usage, response.model)
  }),
  normalizeError: (error, response) => ({
    code: error.code || 'custom_error',
    message: error.message,
    provider: 'custom',
    retryable: error.code !== 'authentication_failed'
  }),
  quirks: {
    fixEncoding: (content) => content.replace(/\\u00/g, '\\u0020'), // Custom encoding fix
    addMetadata: (content, model, response) => ({
      modelVersion: response.model_version,
      processingTime: response.processing_time_ms
    })
  }
};
```

## Pipeline Customization

### Custom Pipeline Steps

```javascript
import { applyNormalizationPipeline } from './services/response-normalizer.js';

// Define custom steps
function validateBusinessRules(context) {
  if (context.parsed.includes('forbidden content')) {
    throw new Error('Content violates business rules');
  }
  return context;
}

function addCustomMetadata(context) {
  return {
    ...context,
    metadata: {
      ...context.metadata,
      customField: 'value',
      processedAt: new Date().toISOString()
    }
  };
}

// Apply custom pipeline
const result = applyNormalizationPipeline(initialContext, [
  extractContentStep,
  validateBusinessRules,
  applyQuirksStep,
  addCustomMetadata,
  validateContentStep
]);
```

## Error Handling and Recovery

### Fallback Strategies

```javascript
// Pipeline with fallbacks
async function normalizeWithFallback(response, provider, request) {
  try {
    return normalizeLLMResponse(response, provider, request);
  } catch (error) {
    // Try generic normalization
    try {
      return normalizeLLMResponse(response, 'generic', request);
    } catch (fallbackError) {
      // Return structured error
      return {
        success: false,
        error: {
          code: 'normalization_failed',
          message: 'All normalization strategies failed',
          originalError: error.message,
          fallbackError: fallbackError.message
        },
        raw: response
      };
    }
  }
}
```

## Performance Considerations

### Caching Normalized Results

```javascript
// Cache normalized responses to avoid repeated processing
const normalizationCache = new Map();

function getCachedNormalization(key, normalizationFn) {
  if (normalizationCache.has(key)) {
    return normalizationCache.get(key);
  }

  const result = normalizationFn();
  if (result.success) {
    normalizationCache.set(key, result);
  }
  return result;
}
```

### Batch Processing

```javascript
// Process multiple responses efficiently
async function normalizeBatch(responses, provider, request) {
  const results = await Promise.all(
    responses.map(response =>
      normalizeLLMResponse(response, provider, request)
    )
  );

  return {
    successful: results.filter(r => r.success),
    failed: results.filter(r => !r.success),
    summary: {
      total: results.length,
      successRate: results.filter(r => r.success).length / results.length
    }
  };
}
```

## Testing Strategy

### Provider Config Validation

```javascript
import { validateProviderConfig, testProviderConfig } from './services/response-normalizer-config.js';

// Validate config structure
const validation = validateProviderConfig(customProvider);
if (!validation.valid) {
  console.error('Invalid provider config:', validation.errors);
}

// Test with sample data
const testResults = testProviderConfig(customProvider, sampleResponse, sampleRequest);
console.log('Config test results:', testResults);
```

### Integration Testing

```javascript
describe('Normalization Integration', () => {
  it('should maintain backward compatibility', () => {
    const original = originalParseClaudeResponse(content);
    const normalized = parseClaudeResponseNormalized(content);

    // Structure should be compatible
    expect(normalized.success).toBe(original.success);
    expect(normalized.actions).toEqual(original.actions);
  });

  it('should provide additional metadata when normalized', () => {
    const result = parseClaudeResponseNormalized(content, context);

    expect(result.metadata).toBeDefined();
    expect(result.metadata.normalization.applied).toBe(true);
  });
});
```

## Migration Guide

### Phase 1: Add Normalization (No Breaking Changes)

```javascript
// Add normalized versions alongside originals
export { callLLMNormalized } from './response-normalizer-integration.js';
export { callLLM } from './llm.js'; // Original unchanged
```

### Phase 2: Enable Feature Flag

```javascript
// Enable normalization for new code
const ENABLE_NORMALIZATION = true;
export const callLLM = ENABLE_NORMALIZATION ? callLLMNormalized : originalCallLLM;
```

### Phase 3: Full Migration

```javascript
// Replace all imports with normalized versions
export { callLLMNormalized as callLLM } from './response-normalizer-integration.js';
```

## Monitoring and Observability

### Normalization Metrics

```javascript
// Track normalization success rates
const metrics = {
  totalNormalizations: 0,
  successfulNormalizations: 0,
  errorsByProvider: {},
  errorsByType: {}
};

function recordNormalizationMetrics(result, provider) {
  metrics.totalNormalizations++;

  if (result.success) {
    metrics.successfulNormalizations++;
  } else {
    metrics.errorsByProvider[provider] = (metrics.errorsByProvider[provider] || 0) + 1;
    metrics.errorsByType[result.error.code] = (metrics.errorsByType[result.error.code] || 0) + 1;
  }
}
```

### Logging Normalized Responses

```javascript
// Structured logging for debugging
function logNormalizationResult(result, provider, operation) {
  console.log(`[NORMALIZATION] ${operation} - ${provider}`, {
    success: result.success,
    contentLength: result.content?.length || 0,
    metadata: result.metadata,
    error: result.error,
    warnings: result.warnings,
    rawSample: JSON.stringify(result.raw).substring(0, 200) + '...'
  });
}
```

This architecture ensures consistent, reliable response handling across all AI providers while maintaining extensibility and backward compatibility.
