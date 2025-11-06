'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Mic, Phone, PhoneOff, Volume2 } from 'lucide-react'

interface VoiceInterviewLiveProps {
  question: string
  solutionObjectives: string[]
  subsection: string
}

export function VoiceInterviewLive({ question, solutionObjectives, subsection }: VoiceInterviewLiveProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [status, setStatus] = useState('Click Start to begin')
  const [error, setError] = useState<string | null>(null)
  
  const sessionRef = useRef<any>(null)

  const connect = async () => {
    try {
      setStatus('Connecting...')
      const { GoogleGenAI } = await import('@google/genai')
      const res = await fetch('/api/gemini/live-token')
      const { apiKey } = await res.json()
      const genai = new GoogleGenAI({ apiKey })
      
      const session = await genai.live.connect({
        model: 'gemini-2.0-flash-exp',
        config: {
          responseModalities: ['AUDIO'],
          systemInstruction: `Interview tutor for: ${question}`
        },
        callbacks: {
          onopen: () => { setIsConnected(true); setStatus('Connected!') },
          onerror: (e: any) => setError(e.message)
        }
      })
      sessionRef.current = session
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle><Phone className="h-5 w-5 inline mr-2" />Voice Interview</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-muted rounded-lg text-sm">{status}</div>
        {error && <div className="p-3 bg-destructive/10 text-sm border border-destructive rounded">{error}</div>}
        <div className="p-4 border rounded"><h3 className="font-semibold mb-2">Question:</h3><p className="text-sm">{question}</p></div>
        <Button onClick={isConnected ? () => sessionRef.current?.close() : connect} size="lg" variant={isConnected ? 'destructive' : 'default'}>
          {isConnected ? <><PhoneOff className="mr-2 h-4 w-4" />End</> : <><Phone className="mr-2 h-4 w-4" />Start</>}
        </Button>
      </CardContent>
    </Card>
  )
}
