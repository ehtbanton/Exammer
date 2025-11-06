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
  const [isRecording, setIsRecording] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [status, setStatus] = useState('Click Start to begin')
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  
  const sessionRef = useRef<any>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const playbackContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const audioQueueRef = useRef<string[]>([])
  const isPlayingRef = useRef(false)

  const log = (msg: string) => {
    console.log(msg)
    setLogs(prev => [...prev, msg])
  }


  const playAudio = (base64Data: string) => {
    audioQueueRef.current.push(base64Data)
    if (!isPlayingRef.current) {
      playNextChunk()
    }
  }

  const playNextChunk = async () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false
      setIsSpeaking(false)
      return
    }

    isPlayingRef.current = true
    setIsSpeaking(true)

    try {
      if (!playbackContextRef.current) {
        playbackContextRef.current = new AudioContext({ sampleRate: 24000 })
      }

      const base64Data = audioQueueRef.current.shift()!
      const binaryString = atob(base64Data)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      const pcm16 = new Int16Array(bytes.buffer)
      const float32 = new Float32Array(pcm16.length)

      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / (pcm16[i] < 0 ? 0x8000 : 0x7FFF)
      }

      const audioBuffer = playbackContextRef.current.createBuffer(1, float32.length, 24000)
      audioBuffer.getChannelData(0).set(float32)

      const source = playbackContextRef.current.createBufferSource()
      source.buffer = audioBuffer
      source.connect(playbackContextRef.current.destination)

      source.onended = () => playNextChunk()
      source.start()
    } catch (err) {
      console.error('Playback error:', err)
      playNextChunk()
    }
  }

  const connect = async () => {
    try {
      setStatus('Connecting...')
      setError(null)
      log('Step 1: Importing SDK')
      
      const { GoogleGenAI } = await import('@google/genai')
      log('Step 2: Fetching API key')
      
      const res = await fetch('/api/gemini/live-token')
      if (!res.ok) {
        throw new Error('API key fetch failed: ' + res.status)
      }
      const { apiKey } = await res.json()
      log('Step 3: Connecting to Gemini Live')
      
      const genai = new GoogleGenAI({ apiKey })
      
      const session = await genai.live.connect({
        model: 'gemini-2.0-flash-exp',
        config: {
          responseModalities: ['AUDIO'],
          systemInstruction: 'You are an AI tutor helping with: ' + question
        },
        callbacks: {
          onopen: () => {
            log('Step 4: Connected!')
            setIsConnected(true)
            setStatus('Connected - requesting mic')
            startMic()
          },
          onmessage: (msg: any) => {
            // Log message structure
            console.log('Full message:', msg)
            log('Message type: ' + (msg.serverContent ? Object.keys(msg.serverContent).join(',') : 'no serverContent'))
            
            // Check for audio in serverContent.modelTurn
            if (msg.serverContent?.modelTurn?.parts) {
              log('Got modelTurn with ' + msg.serverContent.modelTurn.parts.length + ' parts')
              for (const part of msg.serverContent.modelTurn.parts) {
                if (part.inlineData) {
                  log('Part has inlineData: ' + part.inlineData.mimeType)
                  if (part.inlineData.mimeType?.startsWith('audio/pcm') && part.inlineData.data) {
                    log('Playing audio (length: ' + part.inlineData.data.length + ')')
                    playAudio(part.inlineData.data)
                  }
                }
                if (part.text) {
                  log('Part has text: ' + part.text.substring(0, 50))
                }
              }
            }
            
            // Check for audio in other possible locations
            if (msg.serverContent?.turnComplete) {
              log('Turn complete')
            }
          },
          onerror: (e: any) => {
            log('Error: ' + e.message)
            setError(e.message)
          },
          onclose: () => {
            log('Session closed')
            setIsConnected(false)
            cleanup()
          }
        }
      })
      
      sessionRef.current = session
      log('Session created successfully')
    } catch (err: any) {
      log('Connection failed: ' + err.message)
      setError(err.message)
      setStatus('Failed')
    }
  }

  const startMic = async () => {
    try {
      log('Step 5: Requesting microphone')
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { 
          sampleRate: 16000, 
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      })
      
      log('Step 6: Mic granted, setting up audio')
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
        
        try {
          if (sessionRef.current && typeof sessionRef.current.sendRealtimeInput === 'function') {
            sessionRef.current.sendRealtimeInput({
              audio: { 
                mimeType: 'audio/pcm;rate=16000', 
                data: b64 
              }
            })
          }
        } catch (err) {
          console.error('Send error:', err)
        }
      }
      
      source.connect(processor)
      processor.connect(audioContextRef.current.destination)
      processorRef.current = processor
      
      setIsRecording(true)
      setStatus('Recording - speak now!')
      log('Step 7: Recording started!')
    } catch (err: any) {
      log('Mic error: ' + err.message)
      setError('Microphone: ' + err.message)
    }
  }

  const disconnect = () => {
    log('Disconnecting...')
    if (sessionRef.current) {
      sessionRef.current.close()
      sessionRef.current = null
    }
    cleanup()
  }

  const cleanup = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop())
      mediaStreamRef.current = null
    }
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    if (playbackContextRef.current) {
      playbackContextRef.current.close()
      playbackContextRef.current = null
    }
    audioQueueRef.current = []
    isPlayingRef.current = false
    setIsRecording(false)
    setIsSpeaking(false)
    setStatus('Disconnected')
  }

  useEffect(() => {
    return () => cleanup()
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Voice Interview (Gemini Live)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
          {isRecording && <Mic className="h-4 w-4 animate-pulse text-destructive" />}
          {isSpeaking && <Volume2 className="h-4 w-4 animate-pulse text-blue-500" />}
          <span className="text-sm">{status}</span>
        </div>
        
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive rounded-lg text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}
        
        <div className="p-4 border rounded-lg">
          <h3 className="font-semibold mb-2 text-sm">Question:</h3>
          <p className="text-sm">{question}</p>
        </div>
        
        <div className="flex justify-center">
          <Button 
            onClick={isConnected ? disconnect : connect} 
            size="lg" 
            variant={isConnected ? 'destructive' : 'default'}
            className="w-48"
          >
            {isConnected ? (
              <>
                <PhoneOff className="mr-2 h-4 w-4" />
                End Interview
              </>
            ) : (
              <>
                <Phone className="mr-2 h-4 w-4" />
                Start Interview
              </>
            )}
          </Button>
        </div>
        
        {logs.length > 0 && (
          <div className="border rounded-lg p-3 max-h-40 overflow-y-auto bg-muted/30">
            <p className="text-xs font-semibold mb-2">Debug Log:</p>
            <div className="space-y-1">
              {logs.map((l, i) => (
                <p key={i} className="text-xs text-muted-foreground font-mono">{l}</p>
              ))}
            </div>
          </div>
        )}
        
        <div className="text-xs text-muted-foreground border-t pt-3 space-y-1">
          <p>• Real-time voice conversation with Gemini AI</p>
          <p>• Speak naturally and the AI will guide you</p>
          <p>• Check debug log above for troubleshooting</p>
        </div>
      </CardContent>
    </Card>
  )
}
