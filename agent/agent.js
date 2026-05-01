import { createAgent, createFollowUpRun, streamRunResponse } from './cursor-client.js';

const CURSOR_API_KEY = process.env.CURSOR_API_KEY;
const CURSOR_REPO_URL = process.env.CURSOR_REPO_URL;
const CURSOR_REPO_BRANCH = process.env.CURSOR_REPO_BRANCH || 'main';
const CURSOR_MODEL = process.env.CURSOR_MODEL || 'composer-2';

/**
 * @typedef {Object} AgentDeps
 * @property {import('@slack/web-api').WebClient} client
 * @property {string} userId
 * @property {string} channelId
 * @property {string} threadTs
 * @property {string} messageTs
 * @property {string} [userToken]
 */

/**
 * Add an emoji reaction to the user's message.
 * Picks a contextual emoji based on simple keyword matching.
 * @param {AgentDeps} deps
 */
async function addReaction(deps) {
  const emojis = ['eyes', 'mag', 'chart_with_upwards_trend', 'salesforce', 'thinking_face', 'zap', 'rocket'];
  const emoji = emojis[Math.floor(Math.random() * emojis.length)];
  try {
    await deps.client.reactions.add({
      channel: deps.channelId,
      timestamp: deps.messageTs,
      name: emoji,
    });
  } catch {
    // Reaction failed (e.g. already_reacted) — not critical
  }
}

/**
 * Build the prompt sent to the Cursor Cloud Agent, including context
 * about the Slack user and conversation.
 * @param {string} text - The user's message.
 * @param {string} userId
 * @returns {string}
 */
function buildPrompt(text, userId) {
  return [
    'You are responding DIRECTLY to a Slack user. Your response text will be posted',
    'as a Slack message automatically — do NOT wrap it in a draft, do NOT say',
    '"here\'s a Slack-ready reply", do NOT address yourself in third person.',
    'Just respond naturally and concisely as if you are chatting with the user.',
    '',
    'Follow the instructions in .cursor/rules/salesforce-agent.md.',
    'If the user asks about Salesforce data,',
    'run `node scripts/sf-query.js "<SOQL>"` to fetch live data and summarize it.',
    '',
    `User <@${userId}> says: ${text}`,
  ].join('\n');
}

/**
 * Run the agent with the given text and optional agent ID for follow-up.
 * @param {string} text - The user's message text.
 * @param {string} [agentId] - An existing agent ID to send a follow-up run.
 * @param {AgentDeps} [deps] - Dependencies for Slack API access.
 * @returns {Promise<{responseText: string, agentId: string | null}>}
 */
export async function runAgent(text, agentId = undefined, deps = undefined) {
  if (!CURSOR_API_KEY) {
    throw new Error('CURSOR_API_KEY is not set. Get one from cursor.com/dashboard/integrations');
  }
  if (!CURSOR_REPO_URL) {
    throw new Error('CURSOR_REPO_URL is not set. Set it to your GitHub repo URL.');
  }

  if (deps) {
    addReaction(deps);
  }

  let newAgentId;
  let runId;

  if (agentId) {
    try {
      const result = await createFollowUpRun({
        apiKey: CURSOR_API_KEY,
        agentId,
        prompt: buildPrompt(text, deps?.userId || 'unknown'),
      });
      newAgentId = agentId;
      runId = result.runId;
    } catch {
      // Agent may have expired or be busy — fall back to creating a new one
      const result = await createAgent({
        apiKey: CURSOR_API_KEY,
        prompt: buildPrompt(text, deps?.userId || 'unknown'),
        repoUrl: CURSOR_REPO_URL,
        branch: CURSOR_REPO_BRANCH,
        model: CURSOR_MODEL,
      });
      newAgentId = result.agentId;
      runId = result.runId;
    }
  } else {
    const result = await createAgent({
      apiKey: CURSOR_API_KEY,
      prompt: buildPrompt(text, deps?.userId || 'unknown'),
      repoUrl: CURSOR_REPO_URL,
      branch: CURSOR_REPO_BRANCH,
      model: CURSOR_MODEL,
    });
    newAgentId = result.agentId;
    runId = result.runId;
  }

  const responseText = await streamRunResponse({
    apiKey: CURSOR_API_KEY,
    agentId: newAgentId,
    runId,
  });

  return { responseText: responseText || '_The agent completed but produced no text output._', agentId: newAgentId };
}
