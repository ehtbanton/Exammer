/**
 * Client-side helper functions for dev commands
 */

/**
 * Check if a message is a dev command
 */
export function isDevCommand(message: string): boolean {
  const trimmed = message.trim().toLowerCase();
  const devCommands = ['fullans'];

  // Check exact matches
  if (devCommands.includes(trimmed)) {
    return true;
  }

  // Check if it starts with objans (with or without a number)
  if (trimmed.startsWith('objans')) {
    return true;
  }

  return false;
}

/**
 * Get the list of available dev commands
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
  ];
}
