import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Use the billed API key for Gemini Live voice interviews
    const apiKey = process.env.GEMINI_API_KEY_BILLED

    if (!apiKey) {
      console.error('GEMINI_API_KEY_BILLED not found in environment variables')
      return NextResponse.json(
        { error: 'API key not configured. Please set GEMINI_API_KEY_BILLED in .env' },
        { status: 503 }
      )
    }

    // Return the billed key for client-side Gemini Live connection
    return NextResponse.json({ apiKey })
  } catch (error) {
    console.error('Error getting API key:', error)
    return NextResponse.json(
      { error: 'Failed to get API key' },
      { status: 500 }
    )
  }
}
