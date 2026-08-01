/**
 * Test Model Summarization with Reasoning
 *
 * Tests summarization quality of different OpenAI models.
 * Saves prompt and response to output directory.
 *
 * Usage:
 *   node scripts/test-summarize-model.cjs <model> [reasoning_effort]
 *
 * Examples:
 *   node scripts/test-summarize-model.cjs gpt-4o-mini
 *   node scripts/test-summarize-model.cjs gpt-5.2 low
 *   node scripts/test-summarize-model.cjs gpt-5.2 medium
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

// Parse args
const model = process.argv[2];
const reasoningEffort = process.argv[3] || null;

if (!model) {
  console.error('Usage: node scripts/test-summarize-model.cjs <model> [reasoning_effort]');
  process.exit(1);
}

// Determine if model supports reasoning
const isReasoningModel = /^(o[134]|gpt-5)/.test(model);

// Summarization prompts
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
  const response = await fetch(`${API_BASE}/history?limit=30`);
  if (!response.ok) {
    throw new Error(`Failed to fetch history: ${response.status}`);
  }
  const data = await response.json();
  return data.history || [];
}

function formatHistoryEntries(entries) {
  return entries.map(entry => {
    let content = entry.content;
    if (content && content.startsWith('data:image')) {
      content = '[base64 image]';
    }
    const timestamp = entry.created_at ? new Date(entry.created_at).toLocaleString('en-US', { timeZone: 'America/New_York' }) : 'unknown';
    return `[ID:${entry.id}] ${entry.type} @ ${timestamp}:\n${content}`;
  }).join('\n\n');
}

async function callModel(prompt, systemPrompt, model, reasoningEffort, maxTokens = 4000) {
  const startTime = Date.now();

  // Build request body based on model type
  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ]
  };

  // Token parameter differs by model
  if (isReasoningModel) {
    body.max_completion_tokens = maxTokens;
    if (reasoningEffort) {
      body.reasoning_effort = reasoningEffort;
    }
  } else {
    body.max_tokens = maxTokens;
  }

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
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  return {
    content: data.choices[0].message.content,
    model: data.model,
    elapsed_ms: elapsed,
    usage: data.usage
  };
}

async function main() {
  // Create output directory
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dirName = reasoningEffort ? `${timestamp}-${model}-${reasoningEffort}` : `${timestamp}-${model}`;
  const outputDir = path.join(__dirname, '..', 'outputs', 'gpt_test_summaries', dirName);
  fs.mkdirSync(outputDir, { recursive: true });

  // Fetch history
  const history = await fetchHistory();
  const toSummarize = history.slice().reverse().slice(0, 20);

  // Format entries
  const entriesText = formatHistoryEntries(toSummarize);

  // Get time range
  const firstDate = toSummarize[0]?.created_at || 'unknown';
  const lastDate = toSummarize[toSummarize.length - 1]?.created_at || 'unknown';
  const timeRange = `${new Date(firstDate).toLocaleString('en-US', { timeZone: 'America/New_York' })} to ${new Date(lastDate).toLocaleString('en-US', { timeZone: 'America/New_York' })}`;

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

  // Save request
  const requestData = {
    model,
    reasoning_effort: reasoningEffort,
    is_reasoning_model: isReasoningModel,
    system_prompt: SYSTEM_PROMPT,
    user_prompt: prompt,
    entry_count: toSummarize.length,
    time_range: timeRange,
    entry_ids: toSummarize.map(e => e.id)
  };
  fs.writeFileSync(path.join(outputDir, 'request.json'), JSON.stringify(requestData, null, 2));

  // Call model
  const result = await callModel(prompt, SYSTEM_PROMPT, model, reasoningEffort);

  // Save response
  const responseData = {
    model_returned: result.model,
    elapsed_ms: result.elapsed_ms,
    usage: result.usage,
    raw_content: result.content
  };

  // Try to parse the JSON response
  try {
    const parsed = JSON.parse(result.content.replace(/```json\n?/g, '').replace(/```\n?/g, ''));
    responseData.parsed = parsed;
  } catch (e) {
    responseData.parse_error = e.message;
  }

  fs.writeFileSync(path.join(outputDir, 'response.json'), JSON.stringify(responseData, null, 2));

  // Print summary for logging
  console.log(`${model}${reasoningEffort ? ` (${reasoningEffort})` : ''}: ${result.elapsed_ms}ms, ${result.usage?.completion_tokens || '?'} tokens → ${outputDir}`);
}

main().catch(err => {
  console.error(`${model}: ERROR - ${err.message}`);
  process.exit(1);
});
