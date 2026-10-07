import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from '@google/genai';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import type { TranscriptTurn } from '../types/interview';
import { AudioPlayer, INPUT_SAMPLE_RATE, arrayBufferToBase64, base64ToFloat32 } from '../utils/audio';

const SPEECH_RMS = 0.015;

export type Phase = 'idle' | 'connecting' | 'live' | 'saving' | 'ended' | 'error';
export type Speaker = TranscriptTurn['speaker'];

interface LiveTokenResponse {
  token: string;
  model: string;
  maxSeconds: number;
}

// apiBase is '/interviews' for signed-in users and '/demo/interviews' for demo visitors.
export function useLiveInterview(interviewId: string, apiBase = '/interviews') {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [activeSpeaker, setActiveSpeaker] = useState<Speaker | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);

  const sessionRef = useRef<Session | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const turnsRef = useRef<TranscriptTurn[]>([]);
  // When each turn started and last got text, to estimate how long the candidate spoke.
  const timingRef = useRef<{ first: number; last: number }[]>([]);
  const mutedRef = useRef(false);
  const startedAtRef = useRef(0);
  // Milliseconds of real speech picked up by the mic while the interviewer is quiet.
  const speechMsRef = useRef(0);
  const endingRef = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);

  const pushText = useCallback((speaker: Speaker, text: string) => {
    if (!text) return;
    const list = turnsRef.current;
    const timing = timingRef.current;
    const now = Date.now();
    const last = list[list.length - 1];
    if (last && last.speaker === speaker) {
      list[list.length - 1] = { speaker, text: last.text + text };
      timing[timing.length - 1].last = now;
    } else {
      list.push({ speaker, text });
      timing.push({ first: now, last: now });
    }
    setTurns([...list]);
    setActiveSpeaker(speaker);
  }, []);

  const releaseAudio = useCallback(() => {
    window.clearInterval(timerRef.current);
    sessionRef.current?.close();
    sessionRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void micCtxRef.current?.close();
    micCtxRef.current = null;
    playerRef.current?.close();
    playerRef.current = null;
  }, []);

  const end = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;

    const durationSec = Math.min(720, Math.round((Date.now() - startedAtRef.current) / 1000));
    releaseAudio();
    setActiveSpeaker(null);
    setPhase('saving');

    try {
      const transcript = turnsRef.current
        .map((t, i) => ({ ...t, durationMs: timingRef.current[i] ? timingRef.current[i].last - timingRef.current[i].first : 0 }))
        .filter((t) => t.text.trim());
      if (transcript.length) {
        await api(`${apiBase}/${interviewId}/transcript`, { method: 'PUT', body: { transcript } });
      }
      await api(`${apiBase}/${interviewId}/finish`, { method: 'POST', body: { durationSec, speechMs: Math.round(speechMsRef.current) } });
      setPhase('ended');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the interview');
      setPhase('error');
    }
  }, [apiBase, interviewId, releaseAudio]);

  const handleMessage = useCallback(
    (message: LiveServerMessage) => {
      const content = message.serverContent;
      if (!content) return;

      if (content.interrupted) playerRef.current?.stop();

      for (const part of content.modelTurn?.parts ?? []) {
        if (part.inlineData?.data) playerRef.current?.enqueue(base64ToFloat32(part.inlineData.data));
      }

      if (content.inputTranscription?.text) pushText('candidate', content.inputTranscription.text);
      if (content.outputTranscription?.text) pushText('interviewer', content.outputTranscription.text);
      if (content.turnComplete) setActiveSpeaker(null);
    },
    [pushText],
  );

  const start = useCallback(async () => {
    setError('');
    setPhase('connecting');
    endingRef.current = false;
    turnsRef.current = [];
    timingRef.current = [];
    speechMsRef.current = 0;
    setTurns([]);

    try {
      // Ask for the mic first so a denied permission fails before we spend a token.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      const player = new AudioPlayer();
      await player.resume();
      playerRef.current = player;

      const { token, model, maxSeconds } = await api<LiveTokenResponse>(`${apiBase}/${interviewId}/live-token`, {
        method: 'POST',
      });

      const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: 'v1alpha' } });
      const session = await ai.live.connect({
        model,
        config: { responseModalities: [Modality.AUDIO] },
        callbacks: {
          onmessage: handleMessage,
          onerror: () => {
            if (!endingRef.current) setError('The voice connection had a problem.');
          },
          onclose: () => {
            if (!endingRef.current && sessionRef.current) {
              setError('The connection closed. You can save what you have so far.');
              setPhase('error');
              releaseAudio();
            }
          },
        },
      });
      sessionRef.current = session;

      const micCtx = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
      micCtxRef.current = micCtx;
      await micCtx.audioWorklet.addModule('/pcm-capture-worklet.js');
      const node = new AudioWorkletNode(micCtx, 'pcm-capture');
      node.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        if (mutedRef.current) return;
        const samples = new Int16Array(event.data);
        let sum = 0;
        for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
        const rms = Math.sqrt(sum / samples.length) / 32768;
        if (rms > SPEECH_RMS && !playerRef.current?.playing) {
          speechMsRef.current += (samples.length / INPUT_SAMPLE_RATE) * 1000;
        }
        sessionRef.current?.sendRealtimeInput({
          audio: { data: arrayBufferToBase64(event.data), mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}` },
        });
      };
      micCtx.createMediaStreamSource(stream).connect(node);

      startedAtRef.current = Date.now();
      setSecondsLeft(maxSeconds);
      timerRef.current = window.setInterval(() => {
        const left = maxSeconds - Math.round((Date.now() - startedAtRef.current) / 1000);
        setSecondsLeft(Math.max(0, left));
        if (left <= 0) void end();
      }, 1000);

      setPhase('live');
      session.sendRealtimeInput({ text: 'Begin the interview now.' });
    } catch (err) {
      releaseAudio();
      const denied = err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
      setError(
        denied
          ? 'Microphone access was blocked. Allow the microphone in your browser and try again.'
          : err instanceof Error
            ? err.message
            : 'Could not start the interview',
      );
      setPhase('error');
    }
  }, [apiBase, end, handleMessage, interviewId, releaseAudio]);

  const toggleMute = useCallback(() => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
  }, []);

  // Loudness of the interviewer's voice, read by the avatar every frame without re-rendering.
  const getLevel = useCallback(() => playerRef.current?.level() ?? 0, []);

  useEffect(() => {
    return () => {
      endingRef.current = true;
      releaseAudio();
    };
  }, [releaseAudio]);

  return { phase, error, turns, activeSpeaker, secondsLeft, muted, start, end, toggleMute, getLevel };
}
