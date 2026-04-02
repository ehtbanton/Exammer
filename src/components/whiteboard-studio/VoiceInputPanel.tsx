"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Phone, PhoneOff, Volume2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const TIME_LIMIT_MS = 5 * 60 * 1000;

interface VoiceInputPanelProps {
  question: string;
  solutionObjectives: string[];
  subsection: string;
  onAddMessage: (role: 'user' | 'assistant', content: string) => void;
  onEvaluateAnswer: (userAnswer: string) => Promise<void>;
  disabled?: boolean;
}

export function VoiceInputPanel({
  question,
  solutionObjectives,
  subsection,
  onAddMessage,
  onEvaluateAnswer,
  disabled = false,
}: VoiceInputPanelProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [status, setStatus] = useState('Click to start voice session');
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(TIME_LIMIT_MS);

  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);
  const currentUserTextRef = useRef('');
  const currentAITextRef = useRef('');
  const startTimeRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeLimitTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getTimeColor = (): string => {
    if (timeRemaining <= 30000) return 'text-[var(--s-danger)]';
    if (timeRemaining <= 60000) return 'text-[#ff9500]';
    return 'text-[var(--s-text-muted)]';
  };

  const cleanup = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (timeLimitTimeoutRef.current) {
      clearTimeout(timeLimitTimeoutRef.current);
      timeLimitTimeoutRef.current = null;
    }
    startTimeRef.current = null;
    setTimeRemaining(TIME_LIMIT_MS);

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (playbackContextRef.current) {
      playbackContextRef.current.close();
      playbackContextRef.current = null;
    }
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    currentUserTextRef.current = '';
    currentAITextRef.current = '';
    setIsRecording(false);
    setIsSpeaking(false);
    setStatus('Disconnected');
  }, []);

  const disconnect = useCallback(() => {
    setIsConnected(false);
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    cleanup();
  }, [cleanup]);

  const playAudio = (base64Data: string) => {
    audioQueueRef.current.push(base64Data);
    if (!isPlayingRef.current) {
      playNextChunk();
    }
  };

  const playNextChunk = async () => {
    if (audioQueueRef.current.length === 0) {
      return;
    }

    isPlayingRef.current = true;
    setIsSpeaking(true);

    try {
      if (!playbackContextRef.current) {
        playbackContextRef.current = new AudioContext({ sampleRate: 24000 });
      }

      const base64Data = audioQueueRef.current.shift()!;
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);

      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / (pcm16[i] < 0 ? 0x8000 : 0x7FFF);
      }

      const audioBuffer = playbackContextRef.current.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const source = playbackContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(playbackContextRef.current.destination);

      source.onended = () => {
        if (audioQueueRef.current.length > 0) {
          playNextChunk();
        } else {
          isPlayingRef.current = false;
          setIsSpeaking(false);
        }
      };
      source.start();
    } catch (err) {
      console.error('Playback error:', err);
      if (audioQueueRef.current.length > 0) {
        playNextChunk();
      } else {
        isPlayingRef.current = false;
        setIsSpeaking(false);
      }
    }
  };

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();

    timerIntervalRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const elapsed = Date.now() - startTimeRef.current;
        const remaining = Math.max(0, TIME_LIMIT_MS - elapsed);
        setTimeRemaining(remaining);
      }
    }, 1000);

    timeLimitTimeoutRef.current = setTimeout(() => {
      setStatus('Time limit reached');
      onAddMessage('assistant', '⏰ The 5-minute voice session has ended. You can continue with text input or start a new voice session.');
      disconnect();
    }, TIME_LIMIT_MS);
  }, [disconnect, onAddMessage]);

  const connect = async () => {
    try {
      setStatus('Connecting...');
      setError(null);

      const { GoogleGenAI } = await import('@google/genai');

      const res = await fetch('/api/gemini/live-token');
      if (!res.ok) {
        throw new Error('API key fetch failed: ' + res.status);
      }
      const { apiKey } = await res.json();

      const genai = new GoogleGenAI({ apiKey });

      const session = await genai.live.connect({
        model: 'gemini-2.5-flash-lite',
        config: {
          responseModalities: ['AUDIO'],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: 'You are Xam, a friendly AI tutor helping with: ' + question
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setStatus('Connected - requesting mic');
            startTimer();
            startMic();
          },
          onmessage: (msg: any) => {
            if (msg.serverContent?.modelTurn?.parts) {
              for (const part of msg.serverContent.modelTurn.parts) {
                if (part.inlineData?.mimeType?.startsWith('audio/pcm') && part.inlineData.data) {
                  playAudio(part.inlineData.data);
                }
              }
            }

            if (msg.inputTranscription?.text) {
              currentUserTextRef.current += msg.inputTranscription.text;
            }
            if (msg.outputTranscription?.text) {
              currentAITextRef.current += msg.outputTranscription.text;
            }
            if (msg.serverContent?.inputTranscription?.text) {
              currentUserTextRef.current += msg.serverContent.inputTranscription.text;
            }
            if (msg.serverContent?.outputTranscription?.text) {
              currentAITextRef.current += msg.serverContent.outputTranscription.text;
            }

            if (msg.serverContent?.turnComplete) {
              const userText = currentUserTextRef.current.trim();
              const aiText = currentAITextRef.current.trim();

              if (userText) {
                onAddMessage('user', userText);
              }
              if (aiText) {
                onAddMessage('assistant', aiText);
              } else {
                onAddMessage('assistant', '[Audio response - no text available]');
              }

              if (userText) {
                setIsEvaluating(true);
                onEvaluateAnswer(userText)
                  .finally(() => setIsEvaluating(false));
              }

              currentUserTextRef.current = '';
              currentAITextRef.current = '';
            }
          },
          onerror: (e: any) => {
            setError(e.message);
          },
          onclose: () => {
            setIsConnected(false);
            cleanup();
          }
        }
      });

      sessionRef.current = session;
    } catch (err: any) {
      setError(err.message);
      setStatus('Failed to connect');
    }
  };

  const startMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      mediaStreamRef.current = stream;
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });

      const source = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        if (!sessionRef.current) return;

        const input = e.inputBuffer.getChannelData(0);
        const pcm = new Int16Array(input.length);

        for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i]));
          pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        const b64 = btoa(String.fromCharCode(...new Uint8Array(pcm.buffer)));

        try {
          if (sessionRef.current?.sendRealtimeInput) {
            sessionRef.current.sendRealtimeInput({
              audio: {
                mimeType: 'audio/pcm;rate=16000',
                data: b64
              }
            });
          }
        } catch (err) {
          console.error('Send error:', err);
        }
      };

      source.connect(processor);
      processor.connect(audioContextRef.current.destination);
      processorRef.current = processor;

      setIsRecording(true);
      setStatus('Recording - speak now!');
    } catch (err: any) {
      setError('Microphone: ' + err.message);
    }
  };

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return (
    <div className="space-y-3">
      {/* Main control button */}
      <button
        onClick={isConnected ? disconnect : connect}
        disabled={disabled}
        className={cn(
          "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-[13px] transition-all duration-200",
          isConnected
            ? "bg-[var(--s-danger)] hover:bg-[var(--s-danger)]/90 text-white"
            : "bg-[var(--s-accent)] hover:bg-[var(--s-accent-hover)] text-white",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {isConnected ? (
          <>
            <PhoneOff className="h-4 w-4" />
            End Voice Session
          </>
        ) : (
          <>
            <Phone className="h-4 w-4" />
            Start Voice Session
          </>
        )}
      </button>

      {/* Status row */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          {isRecording && <Mic className="h-4 w-4 animate-pulse text-[var(--s-danger)]" />}
          {isSpeaking && <Volume2 className="h-4 w-4 animate-pulse text-[var(--s-icon-blue)]" />}
          <span className="text-[12px] text-[var(--s-text-muted)]">{status}</span>
          {isEvaluating && <span className="text-[11px] text-[var(--s-text-placeholder)]">(Evaluating...)</span>}
        </div>

        {isConnected && (
          <div className={cn("flex items-center gap-1 text-[12px] font-mono", getTimeColor())}>
            <Clock className="h-3.5 w-3.5" />
            <span>{formatTime(timeRemaining)}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="px-2">
          <span className="text-[11px] text-[var(--s-danger)]">{error}</span>
        </div>
      )}

      {/* Instructions */}
      {!isConnected && (
        <p className="text-[11px] text-[var(--s-text-placeholder)] text-center px-2">
          Voice session allows you to talk through your answer. 5-minute limit per session.
        </p>
      )}
    </div>
  );
}
