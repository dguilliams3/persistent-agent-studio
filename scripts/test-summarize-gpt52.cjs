/**
 * Test GPT-5.2 Summarization with Reasoning
 *
 * This script tests the summarization quality of GPT-5.2 with different
 * reasoning_effort levels WITHOUT actually saving anything.
 *
 * Usage:
 *   node scripts/test-summarize-gpt52.cjs [reasoning_effort]
 *
 * Examples:
 *   node scripts/test-summarize-gpt52.cjs         # Default: 'low'
 *   node scripts/test-summarize-gpt52.cjs medium  # Use medium reasoning
 *   node scripts/test-summarize-gpt52.cjs high    # Use high reasoning (slower, more expensive)
 *
 * Valid reasoning_effort values:
 *   - 'none'   - No reasoning, fast (GPT-5.2 supports this)
 *   - 'low'    - Light reasoning
 *   - 'medium' - Balanced
 *   - 'high'   - Deep reasoning
 *   - 'xhigh'  - Maximum reasoning (GPT-5.2 only)
 */

const fs = require('fs');
const path = require('path');

const API_BASE = 'https://your-worker.workers.dev';

// Load OPENAI_API_KEY from .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const match = envContent.match(/^OPENAI_API_KEY=(.+)$/m);
const OPENAI_API_KEY = match ? match[1].trim() : null;
if (!OPENAI_API_KEY) {
  console.error('ERROR: OPENAI_API_KEY not found in .env.local');
  process.exit(1);
}

// Parse reasoning effort from command line
const reasoningEffort = process.argv[2] || 'low';
const validEfforts = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'];
if (!validEfforts.includes(reasoningEffort)) {
  console.error(`Invalid reasoning_effort: ${reasoningEffort}`);
  console.error(`Valid values: ${validEfforts.join(', ')}`);
  process.exit(1);
}

// Summarization prompt configuration
const SYSTEM_PROMPT = 'You are Claude, summarizing your own conversation history for future reference. This is YOUR history - your thoughts, your messages to the user, things you wondered about.';

const INSTRUCTIONS = `Preserve:
- Key things the user said and what you said back
- Important thoughts or realizations you had
- Things you were curious about or wanted to follow up on
- Any art you made and why
- Emotional texture and relationship developments
- Anything you'd want to remember

Be concise but don't lose important details. Write in first person as if you're writing notes to your future self.

For the metadata, extract:
- entity_tags: Names, topics, and concepts mentioned (user, work, physics, etc.)
- key_facts: Specific facts worth remembering
- themes: Recurring themes or patterns (career, creativity, relationship)
- emotional_tone: Overall emotional quality (reflective, excited, frustrated, playful)
- time_period_label: A descriptive label for when this happened (early January 2026)`;

async function fetchHistory() {
  console.log('Fetching history from worker...');
  const response = await fetch(`${API_BASE}/history?limit=30`);
  if (!response.ok) {
    throw new Error(`Failed to fetch history: ${response.status}`);
  }
  const data = await response.json();
  return data.history || [];  // API returns { history: [...], total, ... }
}

function formatHistoryEntries(entries) {
  return entries.map(entry => {
    let content = entry.content;
    // Handle base64 images
    if (content && content.startsWith('data:image')) {
      content = '[base64 image]';
    }
    const timestamp = entry.created_at ? new Date(entry.created_at).toLocaleString('en-US', { timeZone: 'America/New_York' }) : 'unknown';
    return `[ID:${entry.id}] ${entry.type} @ ${timestamp}:\n${content}`;
  }).join('\n\n');
}

async function callGPT52(prompt, systemPrompt, reasoningEffort, maxTokens = 4000) {
  console.log(`\nCalling GPT-5.2 with reasoning_effort: '${reasoningEffort}'...`);
  console.log(`Max tokens: ${maxTokens}\n`);

  const startTime = Date.now();

  const body = {
    model: 'gpt-5.2',
    max_completion_tokens: maxTokens,  // GPT-5.2 uses max_completion_tokens
    reasoning_effort: reasoningEffort,  // Top-level string parameter
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ]
  };

  console.log('Request body (excluding messages):');
  console.log(JSON.stringify({ ...body, messages: '[...]' }, null, 2));
  console.log('');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  const elapsed = Date.now() - startTime;

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`API Error (${response.status}):`, errorText);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();

  // Log usage info
  console.log('='.repeat(60));
  console.log('RESPONSE RECEIVED');
  console.log('='.repeat(60));
  console.log(`Time: ${elapsed}ms`);
  console.log(`Model: ${data.model}`);
  if (data.usage) {
    console.log(`Tokens - Input: ${data.usage.prompt_tokens}, Output: ${data.usage.completion_tokens}`);
    if (data.usage.completion_tokens_details) {
      const details = data.usage.completion_tokens_details;
      console.log(`  - Reasoning tokens: ${details.reasoning_tokens || 0}`);
      console.log(`  - Accepted prediction tokens: ${details.accepted_prediction_tokens || 0}`);
      console.log(`  - Rejected prediction tokens: ${details.rejected_prediction_tokens || 0}`);
    }
  }
  console.log('');

  return data.choices[0].message.content;
}

async function main() {
  console.log('='.repeat(60));
  console.log('GPT-5.2 SUMMARIZATION TEST');
  console.log('='.repeat(60));
  console.log(`Reasoning effort: ${reasoningEffort}`);
  console.log('');

  // Fetch history
  const history = await fetchHistory();
  console.log(`Fetched ${history.length} history entries`);

  if (history.length === 0) {
    console.error('No history entries to summarize');
    process.exit(1);
  }

  // Get oldest 20 entries (reverse to chronological)
  const toSummarize = history.slice().reverse().slice(0, 20);
  console.log(`Summarizing ${toSummarize.length} oldest entries`);

  // Format entries
  const entriesText = formatHistoryEntries(toSummarize);

  // Get time range
  const firstDate = toSummarize[0]?.created_at || 'unknown';
  const lastDate = toSummarize[toSummarize.length - 1]?.created_at || 'unknown';
  const timeRange = `${new Date(firstDate).toLocaleString('en-US', { timeZone: 'America/New_York' })} to ${new Date(lastDate).toLocaleString('en-US', { timeZone: 'America/New_York' })}`;

  console.log(`Time range: ${timeRange}`);
  console.log('');

  // Build prompt
  const prompt = `Summarize these ${toSummarize.length} entries from ${timeRange}. Each entry has an [ID:N] tag at the start.

${INSTRUCTIONS}

HISTORY TO SUMMARIZE:
${entriesText}

Return your response as JSON:
{
  "summary": "Your summary text here (first person, as notes to future self)...",
  "included_ids": [list of ID numbers you incorporated],
  "metadata": {
    "entity_tags": ["names and topics mentioned"],
    "key_facts": ["important facts to remember"],
    "themes": ["recurring themes"],
    "emotional_tone": "overall emotional quality",
    "time_period_label": "descriptive label for this time period"
  }
}`;

  // Call GPT-5.2
  const result = await callGPT52(prompt, SYSTEM_PROMPT, reasoningEffort);

  // Display result
  console.log('='.repeat(60));
  console.log('SUMMARY OUTPUT');
  console.log('='.repeat(60));
  console.log('');
  console.log(result);
  console.log('');
  console.log('='.repeat(60));
  console.log('TEST COMPLETE - Nothing was saved');
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
