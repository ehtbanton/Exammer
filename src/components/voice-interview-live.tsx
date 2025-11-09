'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Mic, Phone, PhoneOff, Volume2 } from 'lucide-react'

interface VoiceInterviewLiveProps {
  question: string
  solutionObjectives: string[]
  subsection: string
  onAddMessage: (role: 'user' | 'assistant', content: string) => void
  onEvaluateAnswer: (userAnswer: string) => Promise<void>
}

export function VoiceInterviewLive({ question, solutionObjectives, subsection, onAddMessage, onEvaluateAnswer }: VoiceInterviewLiveProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isEvaluating, setIsEvaluating] = useState(false)
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
  const currentUserTextRef = useRef('')
  const currentAITextRef = useRef('')

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
      // Don't set isPlayingRef to false yet - wait for actual audio to finish
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

      source.onended = () => {
        // Check if there are more chunks to play
        if (audioQueueRef.current.length > 0) {
          playNextChunk()
        } else {
          // No more chunks AND this audio finished - NOW we can set to false
          isPlayingRef.current = false
          setIsSpeaking(false)
        }
      }
      source.start()
    } catch (err) {
      console.error('Playback error:', err)
      // On error, try next chunk or mark as finished
      if (audioQueueRef.current.length > 0) {
        playNextChunk()
      } else {
        isPlayingRef.current = false
        setIsSpeaking(false)
      }
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
          inputAudioTranscription: {},
          outputAudioTranscription: {},
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
            // Enhanced logging to see message structure
            log('Message keys: ' + Object.keys(msg).join(', '))
            if (msg.serverContent) {
              log('ServerContent keys: ' + Object.keys(msg.serverContent).join(', '))
            }
            
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
              }
            }
            
            
            // Check for top-level transcription fields (JavaScript SDK structure)
            if (msg.inputTranscription?.text) {
              log('[INPUT] User said (top-level): ' + msg.inputTranscription.text.substring(0, 50))
              currentUserTextRef.current += msg.inputTranscription.text
            }
            
            if (msg.outputTranscription?.text) {
              log('[OUTPUT] AI said (top-level): ' + msg.outputTranscription.text.substring(0, 50))
              currentAITextRef.current += msg.outputTranscription.text
            }
            
            // Check for nested transcription fields (Python SDK structure)
            if (msg.serverContent?.inputTranscription?.text) {
              log('[INPUT] User said (nested): ' + msg.serverContent.inputTranscription.text.substring(0, 50))
              currentUserTextRef.current += msg.serverContent.inputTranscription.text
            }
            
            if (msg.serverContent?.outputTranscription?.text) {
              log('[OUTPUT] AI said (nested): ' + msg.serverContent.outputTranscription.text.substring(0, 50))
              currentAITextRef.current += msg.serverContent.outputTranscription.text
            }
            
            // Check for turn complete
            if (msg.serverContent?.turnComplete) {
              log('Turn complete')
              
              const userText = currentUserTextRef.current.trim()
              const aiText = currentAITextRef.current.trim()
              
              // Add messages to chat immediately (for UI responsiveness)
              if (userText) {
                log('Sending USER message: ' + userText.substring(0, 30))
                onAddMessage('user', userText)
              }
              
              if (aiText) {
                log('Sending AI message: ' + aiText.substring(0, 50))
                onAddMessage('assistant', aiText)
              } else {
                log('No AI text captured, using placeholder')
                onAddMessage('assistant', '[Audio response - no text available]')
              }
              
              // NEW: Trigger background evaluation for objective tracking
              if (userText) {
                log('Evaluating answer for objectives...')
                setIsEvaluating(true)
                onEvaluateAnswer(userText)
                  .then(() => {
                    log('Evaluation complete')
                  })
                  .catch((err) => {
                    console.error('Evaluation failed:', err)
                    log('Evaluation error: ' + err)
                  })
                  .finally(() => {
                    setIsEvaluating(false)
                  })
              }
              
              // Clear buffers after processing
              currentUserTextRef.current = ''
              currentAITextRef.current = ''
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
    setIsConnected(false)
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
    currentUserTextRef.current = ''
    currentAITextRef.current = ''
    setIsRecording(false)
    setIsSpeaking(false)
    setStatus('Disconnected')
  }

  useEffect(() => {
    return () => cleanup()
  }, [])

  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
      <Button
        onClick={isConnected ? disconnect : connect}
        variant={isConnected ? 'destructive' : 'default'}
      >
        {isConnected ? (
          <>
            <PhoneOff className="mr-2 h-4 w-4" />
            Stop talking
          </>
        ) : (
          <>
            <Phone className="mr-2 h-4 w-4" />
            Start talking
          </>
        )}
      </Button>

      <div className="flex items-center gap-2 flex-1">
        {isRecording && <Mic className="h-4 w-4 animate-pulse text-destructive" />}
        {isSpeaking && <Volume2 className="h-4 w-4 animate-pulse text-blue-500" />}
        <span className="text-sm text-muted-foreground">{status}</span>
        {isEvaluating && <span className="text-xs text-muted-foreground ml-2">(Evaluating...)</span>}
      </div>

      {error && (
        <span className="text-xs text-destructive">{error}</span>
      )}
    </div>
  )
}
