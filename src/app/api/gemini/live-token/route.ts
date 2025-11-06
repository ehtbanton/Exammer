import { NextResponse } from 'next/server'
import { geminiApiKeyManager } from '@root/gemini-api-key-manager'

export async function GET() {
  try {
    const apiKey = await geminiApiKeyManager.acquireKey()
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'No API keys available' },
        { status: 503 }
      )
    }

    return NextResponse.json({ apiKey })
  } catch (error) {
    console.error('Error getting API key:', error)
    return NextResponse.json(
      { error: 'Failed to get API key' },
      { status: 500 }
    )
  }
}
