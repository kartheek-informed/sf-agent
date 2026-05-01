const SUGGESTED_PROMPTS = [
  { title: 'Open Pipeline', message: 'What does our open pipeline look like right now?' },
  { title: 'Closing This Month', message: 'Which opportunities are closing this month?' },
  { title: 'Account Count', message: 'How many accounts do we have in Salesforce?' },
  { title: 'Top Deals', message: 'Show me the top 10 open opportunities by amount' },
];

/**
 * Handle assistant_thread_started events by setting suggested prompts.
 * @param {import('@slack/bolt').AllMiddlewareArgs & import('@slack/bolt').SlackEventMiddlewareArgs<'assistant_thread_started'>} args
 * @returns {Promise<void>}
 */
export async function handleAssistantThreadStarted({ client, event, logger }) {
  const { channel_id: channelId, thread_ts: threadTs } = event.assistant_thread;

  try {
    await client.assistant.threads.setSuggestedPrompts({
      channel_id: channelId,
      thread_ts: threadTs,
      title: 'Ask me anything about your Salesforce data',
      prompts: SUGGESTED_PROMPTS,
    });
  } catch (e) {
    logger.error(`Failed to handle assistant thread started: ${e}`);
  }
}
