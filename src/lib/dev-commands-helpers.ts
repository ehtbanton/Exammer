/**
 * Client-side helper functions for dev commands
 */

/**
 * Check if a message is a dev command
 */
export function isDevCommand(message: string): boolean {
  const devCommands = ['fullans'];
  return devCommands.includes(message.trim().toLowerCase());
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
  ];
}
