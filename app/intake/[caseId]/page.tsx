'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Language } from '@/lib/enums';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getLanguageCode, speak } from '@/lib/speech';
import { countPiiFromSerialized } from '@/lib/pii';
import { Mic, MicOff, Loader2, ArrowLeft, CheckCircle, Type, AlertTriangle } from 'lucide-react';
import type { Classification, DispatchProposal } from '@/lib/ai';

type TurnRow = {
  id: string;
  role: string;
  redactedText: string;
  piiFlags: string | null;
  intent: string | null;
  timestamp: string;
};

export default function IntakePage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.caseId as string;

  const [language, setLanguage] = useState<Language>('KANNADA');
  const [caseNumber, setCaseNumber] = useState('');
  const [turns, setTurns] = useState<TurnRow[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<'network' | 'no-speech' | 'not-allowed' | 'unsupported' | 'other' | null>(null);
  const [showTextFallback, setShowTextFallback] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [classification, setClassification] = useState<Classification | null>(null);
  const [proposed, setProposed] = useState<DispatchProposal | null>(null);
  const recRef = useRef<{ stop: () => void } | null>(null);
  const networkRetryRef = useRef(0);

  const friendlyError = (raw: string): { kind: typeof errorKind; message: string } => {
    if (raw === 'network') return {
      kind: 'network',
      message: 'Speech recognition cannot reach Google\'s service right now (common on IPv6 or strict networks). Use the text fallback below.',
    };
    if (raw === 'no-speech') return { kind: 'no-speech', message: 'No speech detected. Try again, closer to the mic.' };
    if (raw === 'not-allowed') return { kind: 'not-allowed', message: 'Microphone permission denied. Allow it in browser settings.' };
    if (raw === 'aborted') return { kind: 'other', message: 'Recording cancelled.' };
    if (raw === 'audio-capture') return { kind: 'other', message: 'No microphone found. Check your input device.' };
    return { kind: 'other', message: `Speech error: ${raw}. Use the text fallback below.` };
  };

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/cases/${caseId}`);
    if (!res.ok) return;
    const data = await res.json();
    setCaseNumber(data.caseNumber);
    setTurns(data.turns ?? []);
    setLanguage(data.language);
  }, [caseId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const stopRecognition = () => {
    try {
      recRef.current?.stop();
    } catch {
      /* noop */
    }
    recRef.current = null;
    setIsListening(false);
  };

  const sendCallerText = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/cases/${caseId}/turn`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'caller', text: text.trim(), language }),
        });
        if (!res.ok) throw new Error('Turn failed');
        const data = await res.json();
        setClassification(data.classification ?? null);
        setProposed(data.proposedDispatch ?? null);
        await refresh();
      } catch {
        setError('Could not process this turn. Check connection and try again.');
      } finally {
        setBusy(false);
      }
    },
    [caseId, language, refresh]
  );

  useEffect(() => {
    if (!isListening) return;
    const w = window as unknown as Record<string, new () => { stop: () => void; start: () => void }>;
    const SpeechRecognitionCtor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setError('Speech recognition is not supported in this browser. Use the text fallback below.');
      setErrorKind('unsupported');
      setShowTextFallback(true);
      setIsListening(false);
      return;
    }
    const recognition = new SpeechRecognitionCtor() as {
      lang: string;
      continuous: boolean;
      interimResults: boolean;
      onresult: ((event: { results: { 0: { 0?: { transcript?: string } } } }) => void) | null;
      onerror: ((e: { error: string }) => void) | null;
      onend: (() => void) | null;
      start: () => void;
      stop: () => void;
    };
    recognition.lang = getLanguageCode(language);
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event: { results: { 0: { 0?: { transcript?: string } } } }) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      if (transcript.trim()) void sendCallerText(transcript);
    };
    recognition.onerror = (e: { error: string }) => {
      const friendly = friendlyError(e.error);
      setError(friendly.message);
      setErrorKind(friendly.kind);
      // Auto-show text fallback on persistent failures so demo never blocks
      if (e.error === 'network' || e.error === 'audio-capture' || e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setShowTextFallback(true);
      }
      stopRecognition();
    };
    recognition.onend = () => {
      setIsListening(false);
    };
    recRef.current = recognition;
    recognition.start();
    return () => {
      try {
        recognition.stop();
      } catch {
        /* noop */
      }
    };
  }, [isListening, language, sendCallerText]);

  const toggleMic = () => {
    if (isListening) {
      stopRecognition();
    } else {
      setError(null);
      setErrorKind(null);
      networkRetryRef.current = 0;
      setIsListening(true);
    }
  };

  const submitTextInput = async () => {
    const text = textInput.trim();
    if (!text) return;
    await sendCallerText(text);
    setTextInput('');
  };

  const insertSampleUtterance = (utterance: string) => {
    setTextInput(utterance);
  };

  // Pre-canned demo utterances per language — useful when speech fails or for video recording
  const sampleUtterances: Record<Language, { label: string; text: string }[]> = {
    KANNADA: [
      { label: 'Domestic violence + child', text: 'Naanu nanna ganda na-inda adrode aaguttiddene, nanage bhaya aagutte. Nanna magu ide.' },
      { label: 'Missing child', text: 'Nanna magu shaaleyinda hindirugalilla, eeralli illa.' },
      { label: 'Mental health crisis', text: 'Nanage jeevana saaku enisuttiddene, naanu eega ondu maathu kelisa beku.' },
    ],
    HINDI: [
      { label: 'Domestic violence + child', text: 'Mera pati mujhe maar raha hai, mujhe darr lag raha hai. Mera bachcha bhi yahan hai.' },
      { label: 'Harassment', text: 'Koi mujhe roz school ke baad follow karta hai, mujhe dhamkata hai.' },
      { label: 'Medical emergency', text: 'Meri saheli behosh ho gayi hai, sáns nahi le rahi. Ambulance bhejiye.' },
    ],
    ENGLISH: [
      { label: 'Domestic violence + child', text: 'My husband is beating me and I am scared. My child is here too.' },
      { label: 'Trafficking', text: 'I was brought here by an agent for a job and now they will not let me leave.' },
      { label: 'Information', text: 'What are the helpline hours and what kind of cases do you handle?' },
    ],
    MARATHI: [
      { label: 'Domestic violence', text: 'Maza navra mala marato, mala bhiti vaatat aahe. Madat karaa.' },
      { label: 'Missing child', text: 'Maza mulgaa shaalehun ghari aalaa nahi.' },
    ],
    TELUGU: [
      { label: 'Domestic violence', text: 'Naa bharta nannu kotutunnaadu, naaku bhayam ga undi.' },
      { label: 'Mental health', text: 'Naaku jeevitam mida vidugu raavadam ledu, oka counsellor kaavali.' },
    ],
  };

  const finalize = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/finalize`, { method: 'POST' });
      if (!res.ok) throw new Error('finalize');
      router.push(`/verify/${caseId}`);
    } catch {
      setError('Finalize failed.');
    } finally {
      setBusy(false);
    }
  };

  const playQuestion = async (q: string) => {
    try {
      await speak(q, language);
    } catch {
      setError('Speech synthesis blocked or unavailable.');
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Link href="/" className="text-sm text-fuchsia-700 hover:underline inline-flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <select
            className="rounded-md border bg-background px-2 py-1 text-sm"
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
          >
            {(['KANNADA', 'HINDI', 'ENGLISH', 'MARATHI', 'TELUGU'] as const).map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <Card className="lg:col-span-2 border-fuchsia-100">
            <CardHeader>
              <CardTitle className="text-fuchsia-800">Voice intake</CardTitle>
              <p className="text-xs text-muted-foreground">Case {caseNumber || '…'} · Web Speech API</p>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-6 py-6">
              <button
                type="button"
                onClick={toggleMic}
                disabled={busy}
                className={`relative flex h-36 w-36 items-center justify-center rounded-full text-white shadow-lg transition-all ${
                  isListening ? 'bg-rose-500 animate-pulse' : 'bg-fuchsia-600 hover:bg-fuchsia-700'
                } disabled:opacity-50`}
              >
                {isListening ? <MicOff className="h-14 w-14" /> : <Mic className="h-14 w-14" />}
              </button>
              <p className="text-center text-sm text-muted-foreground max-w-xs">
                {isListening ? 'Listening… tap again to stop.' : 'Tap the microphone and speak. Tap again to stop.'}
              </p>
              {isListening && (
                <div className="w-full rounded-lg border bg-background p-3 text-sm min-h-[3rem] text-muted-foreground">
                  Listening for one utterance…
                </div>
              )}

              {/* Friendly error display */}
              {error && (
                <div className="w-full rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Text fallback toggle */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowTextFallback((v) => !v)}
                className="w-full"
              >
                <Type className="h-3.5 w-3.5 mr-2" />
                {showTextFallback ? 'Hide text fallback' : 'Use text fallback (when mic / network fails)'}
              </Button>

              {/* Text input fallback */}
              {showTextFallback && (
                <div className="w-full space-y-2 rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Type or paste caller utterance ({language}). Same intake pipeline — PII redaction + classification + dispatch.
                  </p>
                  <textarea
                    className="w-full rounded-md border bg-background p-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-fuchsia-300"
                    placeholder={`Type the caller's utterance in ${language}…`}
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    disabled={busy}
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      onClick={submitTextInput}
                      disabled={busy || !textInput.trim()}
                      size="sm"
                      className="bg-fuchsia-600 hover:bg-fuchsia-700 flex-1"
                    >
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Submit utterance'}
                    </Button>
                  </div>

                  {/* Sample utterances for the active language */}
                  <div className="space-y-1.5 pt-2 border-t">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                      Demo samples ({language})
                    </p>
                    <div className="space-y-1">
                      {(sampleUtterances[language] ?? []).map((s) => (
                        <button
                          key={s.label}
                          type="button"
                          onClick={() => insertSampleUtterance(s.text)}
                          className="w-full text-left rounded border bg-background px-2 py-1.5 text-xs hover:bg-fuchsia-50 hover:border-fuchsia-200 transition-colors"
                        >
                          <span className="font-medium text-fuchsia-700">{s.label}</span>
                          <span className="block text-muted-foreground text-[11px] mt-0.5 line-clamp-1">{s.text}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <Button onClick={finalize} disabled={busy || turns.length < 2} className="w-full bg-fuchsia-700">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Finalize call
              </Button>
            </CardContent>
          </Card>

          <div className="lg:col-span-3 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Transcript</CardTitle>
                <p className="text-xs text-muted-foreground">Caller lines are PII-redacted in the UI.</p>
              </CardHeader>
              <CardContent className="max-h-[320px] overflow-y-auto space-y-2">
                {turns.map((t) => (
                  <div
                    key={t.id}
                    className={`rounded-lg border p-3 text-sm ${
                      t.role === 'agent' ? 'bg-fuchsia-50/80 border-fuchsia-100' : 'bg-background'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-xs font-semibold uppercase text-muted-foreground">{t.role}</span>
                      {t.role === 'caller' && t.piiFlags && (
                        <Badge variant="outline" className="text-[10px]">
                          {countPiiFromSerialized(t.piiFlags)} PII fields touched
                        </Badge>
                      )}
                      {t.intent && <Badge variant="secondary">{t.intent}</Badge>}
                    </div>
                    <p>{t.redactedText}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-fuchsia-100">
              <CardHeader>
                <CardTitle>Live classification</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!classification ? (
                  <p className="text-sm text-muted-foreground">Speak as the caller to populate mock AI output.</p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <Badge>{classification.intent.replace(/_/g, ' ')}</Badge>
                      <Badge variant="destructive">{classification.urgency.replace(/_/g, ' ')}</Badge>
                      <span className="text-xs text-muted-foreground self-center">
                        confidence {(classification.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-fuchsia-600 transition-all"
                        style={{ width: `${Math.min(100, classification.confidence * 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{classification.reasoning}</p>
                    <div>
                      <p className="text-xs font-medium mb-1">Flags</p>
                      <div className="flex flex-wrap gap-1">
                        {classification.flags.length === 0 ? (
                          <span className="text-xs text-muted-foreground">None</span>
                        ) : (
                          classification.flags.map((f) => (
                            <Badge key={f.label} variant="outline">
                              {f.label}
                            </Badge>
                          ))
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium mb-1">Suggested questions</p>
                      <div className="flex flex-wrap gap-1">
                        {classification.suggestedQuestions.map((q, i) => (
                          <button
                            key={i}
                            type="button"
                            className="text-left"
                            onClick={() => void playQuestion(q)}
                          >
                            <Badge variant="secondary" className="cursor-pointer hover:bg-fuchsia-100">
                              {q}
                            </Badge>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {proposed && (
              <Card>
                <CardHeader>
                  <CardTitle>Proposed dispatch</CardTitle>
                  <p className="text-xs text-muted-foreground">Shown after enough turns (demo threshold).</p>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">{proposed.reason}</p>
                  <ul className="list-disc pl-4 space-y-1">
                    {proposed.contacts.map((c) => (
                      <li key={c.department}>
                        <strong>{c.department.replace(/_/g, ' ')}</strong> — {c.contactInfo}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
