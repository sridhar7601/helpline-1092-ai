import type { Language } from '@/lib/enums';

export function getLanguageCode(language: Language): string {
  const map: Record<Language, string> = {
    KANNADA: 'kn-IN',
    HINDI: 'hi-IN',
    ENGLISH: 'en-IN',
    MARATHI: 'mr-IN',
    TELUGU: 'te-IN'
  };
  return map[language];
}

export function useSpeechRecognition(
  language: Language,
  onResult: (text: string) => void,
  onError?: (error: string) => void
) {
  if (typeof window === 'undefined') return null;
  
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRecognition) {
    onError?.('Speech recognition not supported');
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = getLanguageCode(language);
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onresult = (event: any) => {
    const transcript = event.results[0][0].transcript;
    onResult(transcript);
  };

  recognition.onerror = (event: any) => {
    onError?.(event.error);
  };

  return recognition;
}

export function speak(text: string, language: Language): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject('Not in browser');
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = getLanguageCode(language);
  
  return new Promise((resolve, reject) => {
    utterance.onend = () => resolve();
    utterance.onerror = (e) => reject(e);
    window.speechSynthesis.speak(utterance);
  });
}
