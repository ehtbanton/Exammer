'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Mic, Phone, PhoneOff } from 'lucide-react'

interface VoiceInterviewLiveProps {
  question: string
  solutionObjectives: string[]
  subsection: string
}

export function VoiceInterviewLive({ question, solutionObjectives, subsection }: VoiceInterviewLiveProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [status, setStatus] = useState('Click Start')
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  
  const sessionRef = useRef<any>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)

  const log = (msg: string) => {
    console.log(msg)
    setLogs(prev => [...prev, msg])
  }

  const connect = async () => {
    try {
      setStatus('Connecting...')
      setError(null)
      log('Importing SDK...')
      
      const { GoogleGenAI } = await import('@google/genai')
      log('Fetching API key...')
      
      const res = await fetch('/api/gemini/live-token')
      if (!res.ok) throw new Error(\)
      const { apiKey } = await res.json()
      log('Connecting to Gemini...')
      
      const genai = new GoogleGenAI({ apiKey })
      
      const session = await genai.live.connect({
        model: 'gemini-2.0-flash-exp',
        config: {
          responseModalities: ['AUDIO'],
          systemInstruction: \
        },
        callbacks: {
          onopen: () => {
            log('Connected!')
            setIsConnected(true)
            setStatus('Connected')
            startMic()
          },
          onmessage: (msg: any) => {
            log(\)
          },
          onerror: (e: any) => {
            log(\)
            setError(e.message)
          },
          onclose: () => {
            log('Closed')
            setIsConnected(false)
            cleanup()
          }
        }
      })
      
      sessionRef.current = session
    } catch (err: any) {
      log(\)
      setError(err.message)
    }
  }

  const startMic = async () => {
    try {
      log('Requesting mic...')
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1 }
      })
      
      mediaStreamRef.current = stream
      audioContextRef.current = new AudioContext({ sampleRate: 16000 })
      
      const source = audioContextRef.current.createMediaStreamSource(stream)
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1)
      
      processor.onaudioprocess = (e) => {
        if (!sessionRef.current) return
        const input = e.inputBuffer.getChannelData(0)
        const pcm = new Int16Array(input.length)
        for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i]))
          pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
        }
        const b64 = btoa(String.fromCharCode(...new Uint8Array(pcm.buffer)))
        sessionRef.current.send({
          realtimeInput: { mediaChunks: [{ mimeType: 'audio/pcm', data: b64 }] }
        })
      }
      
      source.connect(processor)
      processor.connect(audioContextRef.current.destination)
      processorRef.current = processor
      
      setIsRecording(true)
      setStatus('Speak now!')
      log('Recording started')
    } catch (err: any) {
      log(\)
      setError(err.message)
    }
  }

  const disconnect = () => {
    sessionRef.current?.close()
    cleanup()
  }

  const cleanup = () => {
    mediaStreamRef.current?.getTracks().forEach(t => t.stop())
    processorRef.current?.disconnect()
    audioContextRef.current?.close()
    setIsRecording(false)
    setStatus('Disconnected')
  }

  useEffect(() => () => cleanup(), [])

  return (
    <Card>
      <CardHeader><CardTitle><Phone className="h-5 w-5 inline mr-2" />Voice Interview</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-muted rounded flex items-center gap-2">
          {isRecording && <Mic className="h-4 w-4 animate-pulse text-destructive" />}
          <span className="text-sm">{status}</span>
        </div>
        {error && <div className="p-3 bg-destructive/10 border border-destructive rounded text-sm">Error: {error}</div>}
        <div className="p-4 border rounded"><h3 className="font-semibold mb-2">Question:</h3><p className="text-sm">{question}</p></div>
        <Button onClick={isConnected ? disconnect : connect} size="lg" variant={isConnected ? 'destructive' : 'default'} className="w-full">
          {isConnected ? <><PhoneOff className="mr-2 h-4 w-4" />End</> : <><Phone className="mr-2 h-4 w-4" />Start</>}
        </Button>
        {logs.length > 0 && (
          <div className="border rounded p-3 max-h-32 overflow-y-auto">
            <p className="text-xs font-semibold mb-1">Debug Log:</p>
            {logs.map((l, i) => <p key={i} className="text-xs text-muted-foreground">{l}</p>)}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
