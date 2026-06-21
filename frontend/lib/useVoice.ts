"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface RecognitionAlternative {
  transcript: string;
}
interface RecognitionEvent {
  results: { 0: { 0: RecognitionAlternative } };
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useVoice() {
  const [listening, setListening] = useState(false);
  const [speakEnabled, setSpeakEnabledState] = useState(true);
  const [sttSupported, setSttSupported] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speakEnabledRef = useRef(true);

  useEffect(() => {
    setSttSupported(getRecognitionCtor() !== null);
    setTtsSupported(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  const setSpeakEnabled = useCallback((v: boolean) => {
    speakEnabledRef.current = v;
    setSpeakEnabledState(v);
    if (!v && typeof window !== "undefined") window.speechSynthesis?.cancel();
  }, []);

  const startListening = useCallback((onResult: (t: string) => void) => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    window.speechSynthesis?.cancel();
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      if (transcript) onResult(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const speak = useCallback((text: string) => {
    if (!speakEnabledRef.current) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 1.05;
    window.speechSynthesis.speak(u);
  }, []);

  return {
    listening,
    startListening,
    stopListening,
    speak,
    speakEnabled,
    setSpeakEnabled,
    sttSupported,
    ttsSupported,
  };
}
