/**
 * Client-side helper functions for cheat commands
 */

/**
 * Check if a message is a cheat command
 */
export function isDevCommand(message: string): boolean {
  const trimmed = message.trim().toLowerCase();
  const cheatCommands = ['fullans'];

  // Check exact matches
  if (cheatCommands.includes(trimmed)) {
    return true;
  }

  // Check if it starts with objans (with or without a number)
  if (trimmed.startsWith('objans')) {
    return true;
  }

  return false;
}

/**
 * Get the list of available cheat commands
 */
export function getAvailableDevCommands(): Array<{command: string; description: string}> {
  return [
    {
      command: 'fullans',
      description: 'Generate a complete answer to the current question',
    },
    {
      command: 'objans',
      description: 'Generate an answer for a single objective (defaults to lowest unachieved)',
    },
    {
      command: 'objans N',
      description: 'Generate an answer for the objective at index N',
    },
    {
      command: 'objans a',
      description: 'Generate answers for all unachieved objectives',
    },
  ];
}
