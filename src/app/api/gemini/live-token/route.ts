import { NextResponse } from 'next/server'
import { geminiApiKeyManager } from '@root/gemini-api-key-manager'

export async function GET() {
  try {
    // Get keys directly without acquire/release since this is for client-side WebSocket usage
    // The key manager's acquire/release pattern is for server-side API calls
    const keys = geminiApiKeyManager.getAllKeys()

    if (!keys || keys.length === 0) {
      return NextResponse.json(
        { error: 'No API keys available' },
        { status: 503 }
      )
    }

    // Return the first available key for client-side Gemini Live connection
    return NextResponse.json({ apiKey: keys[0] })
  } catch (error) {
    console.error('Error getting API key:', error)
    return NextResponse.json(
      { error: 'Failed to get API key' },
      { status: 500 }
    )
  }
}
