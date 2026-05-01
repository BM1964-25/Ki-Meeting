"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUp,
  BarChart3,
  Brain,
  ClipboardCheck,
  Download,
  Mic,
  FileSearch,
  Gauge,
  MessageSquareText,
  PlayCircle,
  Settings,
  ShieldQuestion,
  Sparkles,
  Upload,
  Users
} from "lucide-react";
import { Field } from "@/components/Field";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { MetricCard } from "@/components/MetricCard";
import { PrivacyNotice } from "@/components/PrivacyNotice";
import { ResultSection } from "@/components/ResultSection";
import { RiskBadge } from "@/components/RiskBadge";
import {
  analyzeMeetingPatterns,
  analyzeStakeholder,
  analyzeTranscript,
  generateDecisionChallenge,
  generateMeetingPreparation,
  generateMeetingSimulation,
  transcribeMeetingAudio
} from "@/lib/aiService";
import {
  DecisionChallengeResult,
  MeetingPatternsResult,
  MeetingPreparationInput,
  MeetingPreparationResult,
  MeetingScenario,
  StakeholderAnalysisResult,
  TranscriptionResult,
  TranscriptAnalysisResult
} from "@/types/ai";

type AreaId =
  | "dashboard"
  | "record"
  | "prepare"
  | "decision"
  | "simulate"
  | "transcript"
  | "stakeholder"
  | "patterns"
  | "settings";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: Gauge },
  { id: "record", label: "Audio & Transkription", icon: Mic },
  { id: "prepare", label: "Meeting vorbereiten", icon: ClipboardCheck },
  { id: "decision", label: "Entscheidung prüfen", icon: ShieldQuestion },
  { id: "simulate", label: "Meeting simulieren", icon: PlayCircle },
  { id: "transcript", label: "Transkript analysieren", icon: FileSearch },
  { id: "stakeholder", label: "Stakeholder analysieren", icon: Users },
  { id: "patterns", label: "Meeting-Muster erkennen", icon: BarChart3 },
  { id: "settings", label: "Einstellungen", icon: Settings }
] as const;

const initialPreparation: MeetingPreparationInput = {
  title: "",
  goal: "",
  participants: "",
  roles: "",
  desiredOutcome: "",
  criticalTopics: "",
  ownPosition: ""
};

const createSilentWaveform = () => Array.from({ length: 48 }, () => 8);

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export default function Home() {
  const [activeArea, setActiveArea] = useState<AreaId>("dashboard");
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  const [recordingState, setRecordingState] = useState<"idle" | "requesting" | "recording" | "paused" | "ready">("idle");
  const [microphoneStatus, setMicrophoneStatus] = useState<"unbekannt" | "angefragt" | "erlaubt" | "blockiert" | "nicht verfügbar">("unbekannt");
  const [audioLevel, setAudioLevel] = useState(0);
  const [waveformBars, setWaveformBars] = useState<number[]>(createSilentWaveform);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioSourceLabel, setAudioSourceLabel] = useState("");
  const [audioFileName, setAudioFileName] = useState("");
  const [recordingDurationLabel, setRecordingDurationLabel] = useState("unbekannt");
  const [recordingError, setRecordingError] = useState("");
  const [transcription, setTranscription] = useState<TranscriptionResult | null>(null);
  const [loadingAction, setLoadingAction] = useState<
    | null
    | "preparation"
    | "decision"
    | "simulation"
    | "transcript"
    | "stakeholder"
    | "patterns"
    | "transcription"
  >(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [preparationInput, setPreparationInput] = useState(initialPreparation);
  const [preparation, setPreparation] = useState<MeetingPreparationResult | null>(null);
  const [decisionText, setDecisionText] = useState("");
  const [decision, setDecision] = useState<DecisionChallengeResult | null>(null);
  const [simulationInput, setSimulationInput] = useState({ goal: "", participants: "", conflicts: "" });
  const [simulation, setSimulation] = useState<MeetingScenario[] | null>(null);
  const [transcriptText, setTranscriptText] = useState("");
  const [transcript, setTranscript] = useState<TranscriptAnalysisResult | null>(null);
  const [stakeholderInput, setStakeholderInput] = useState({
    name: "",
    role: "",
    organisation: "",
    interests: "",
    publicStatements: "",
    experience: ""
  });
  const [stakeholder, setStakeholder] = useState<StakeholderAnalysisResult | null>(null);
  const [patternsText, setPatternsText] = useState("");
  const [patterns, setPatterns] = useState<MeetingPatternsResult | null>(null);

  const dashboardStats = useMemo(
    () => ({
      preparedMeetings: preparation ? "1" : "0",
      analyzedTranscripts: transcript ? "1" : "0",
      criticalQuestions: preparation ? String(preparation.criticalQuestions.length) : "0",
      recurringObjections: patterns ? String(patterns.recurringObjections.length) : "0"
    }),
    [patterns, preparation, transcript]
  );

  const pageTitle = navItems.find((item) => item.id === activeArea)?.label ?? "Dashboard";
  const audioSizeLabel = audioBlob ? `${(audioBlob.size / 1024 / 1024).toFixed(2)} MB` : "";

  useEffect(() => {
    if (recordingState !== "recording" || !startedAtRef.current) {
      return;
    }

    const interval = window.setInterval(() => {
      if (startedAtRef.current) {
        setRecordingSeconds(Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)));
      }
    }, 250);

    return () => window.clearInterval(interval);
  }, [recordingState]);

  useEffect(() => {
    return () => {
      stopLevelMeter();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  function clearAudioUrl() {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
  }

  function stopLevelMeter() {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    audioContextRef.current?.close();
    audioContextRef.current = null;
    analyserRef.current = null;
    setAudioLevel(0);
    setIsSpeaking(false);
  }

  function startLevelMeter(stream: MediaStream) {
    stopLevelMeter();
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    const data = new Uint8Array(analyser.fftSize);

    analyser.fftSize = 256;
    source.connect(analyser);
    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    const updateMeter = () => {
      analyser.getByteTimeDomainData(data);
      const sum = data.reduce((total, value) => {
        const normalized = (value - 128) / 128;
        return total + normalized * normalized;
      }, 0);
      const rms = Math.sqrt(sum / data.length);
      const level = Math.min(100, Math.round(rms * 220));

      setAudioLevel(level);
      setWaveformBars((previousBars) => {
        const nextHeight = Math.max(6, Math.min(44, Math.round(level * 0.5) + 6));
        return [...previousBars.slice(1), nextHeight];
      });
      setIsSpeaking(level > 8);
      animationFrameRef.current = requestAnimationFrame(updateMeter);
    };

    updateMeter();
  }

  function createRecordingFileName() {
    const stamp = new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "");
    return `meeting-aufnahme-${stamp}.webm`;
  }

  async function startRecording() {
    try {
      clearAudioUrl();
      stopLevelMeter();
      setTranscription(null);
      setRecordingError("");
      setAudioBlob(null);
      setAudioFileName("");
      setWaveformBars(createSilentWaveform());
      setRecordingSeconds(0);
      setMicrophoneStatus("angefragt");
      setRecordingState("requesting");

      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        setMicrophoneStatus("nicht verfügbar");
        setRecordingState("idle");
        setRecordingError("Dieser Browser unterstützt Aufnahme über Mikrofon nicht. Bitte nutze Safari, Chrome oder Edge mit Mikrofonfreigabe.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicrophoneStatus("erlaubt");
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      const startedAt = Date.now();
      startedAtRef.current = startedAt;
      mediaStreamRef.current = stream;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        stopLevelMeter();
        mediaStreamRef.current = null;
        const blob = new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" });
        const nextUrl = URL.createObjectURL(blob);
        const seconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        const fileName = createRecordingFileName();
        setAudioBlob(blob);
        setAudioUrl(nextUrl);
        setAudioSourceLabel("Browser-Aufnahme");
        setAudioFileName(fileName);
        setRecordingDurationLabel(`${seconds} Sekunden`);
        setRecordingSeconds(seconds);
        setRecordingState("ready");
        setRecorder(null);
        startedAtRef.current = null;
      };

      mediaRecorder.start();
      startLevelMeter(stream);
      setRecorder(mediaRecorder);
      setAudioSourceLabel("Browser-Aufnahme");
      setRecordingState("recording");
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const isPermissionError = /permission|denied|notallowed/i.test(message);
      setMicrophoneStatus(isPermissionError ? "blockiert" : "nicht verfügbar");
      setRecordingError(isPermissionError
        ? "Mikrofonzugriff wurde verweigert oder vom Browser blockiert. Bitte erlaube den Mikrofonzugriff in der Browser- oder Systemeinstellung und klicke danach erneut auf Start."
        : `Aufnahme konnte nicht gestartet werden${message ? `: ${message}` : "."}`);
      setRecordingState("idle");
      startedAtRef.current = null;
      stopLevelMeter();
    }
  }

  function reloadPage() {
    window.location.reload();
  }

  function pauseRecording() {
    if (recorder?.state === "recording") {
      recorder.pause();
      setRecordingState("paused");
      startedAtRef.current = null;
      stopLevelMeter();
    }
  }

  function resumeRecording() {
    if (recorder?.state === "paused") {
      recorder.resume();
      startedAtRef.current = Date.now() - recordingSeconds * 1000;
      if (mediaStreamRef.current) {
        startLevelMeter(mediaStreamRef.current);
      }
      setRecordingState("recording");
    }
  }

  function stopRecording() {
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }

  function handleAudioUpload(file: File | null) {
    if (!file) {
      return;
    }
    clearAudioUrl();
    stopLevelMeter();
    setRecorder(null);
    setAudioBlob(file);
    setAudioUrl(URL.createObjectURL(file));
    setAudioSourceLabel(file.name);
    setAudioFileName(file.name);
    setRecordingDurationLabel("hochgeladene Audiodatei");
    setRecordingSeconds(0);
    setWaveformBars(createSilentWaveform());
    setRecordingState("ready");
    setRecordingError("");
    setTranscription(null);
  }

  async function handleTranscription() {
    if (!audioBlob) {
      return;
    }
    setLoadingAction("transcription");
    try {
      const result = await transcribeMeetingAudio(audioSourceLabel || "Audiodatei", recordingDurationLabel);
      setTranscription(result);
      setTranscriptText(result.transcript);
    } finally {
      setLoadingAction(null);
    }
  }

  async function handlePreparation(event: FormEvent) {
    event.preventDefault();
    setLoadingAction("preparation");
    try {
      setPreparation(await generateMeetingPreparation(preparationInput));
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleDecision(event: FormEvent) {
    event.preventDefault();
    setLoadingAction("decision");
    try {
      setDecision(await generateDecisionChallenge(decisionText));
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleSimulation(event: FormEvent) {
    event.preventDefault();
    setLoadingAction("simulation");
    try {
      setSimulation(await generateMeetingSimulation());
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleTranscript(event: FormEvent) {
    event.preventDefault();
    setLoadingAction("transcript");
    try {
      setTranscript(await analyzeTranscript(transcriptText));
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleStakeholder(event: FormEvent) {
    event.preventDefault();
    setLoadingAction("stakeholder");
    try {
      setStakeholder(await analyzeStakeholder());
    } finally {
      setLoadingAction(null);
    }
  }

  async function handlePatterns(event: FormEvent) {
    event.preventDefault();
    setLoadingAction("patterns");
    try {
      setPatterns(await analyzeMeetingPatterns());
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand__mark">
            <Brain size={24} aria-hidden="true" />
          </div>
          <div>
            <strong>Meeting Intelligence KI</strong>
            <span>Strategie statt Mitschrift</span>
          </div>
        </div>
        <nav className="nav-list" aria-label="Hauptbereiche">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={activeArea === item.id ? "nav-button nav-button--active" : "nav-button"}
                key={item.id}
                onClick={() => setActiveArea(item.id)}
                type="button"
              >
                <span className="nav-button__icon">
                  <Icon size={18} aria-hidden="true" />
                </span>
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Arbeitsversion</p>
            <h1>{pageTitle}</h1>
            <p className="lead">
              Eine lokale Web-App für strategische Meeting-Vorbereitung, Entscheidungsschärfung,
              Simulation und kontinuierliche Verbesserung der eigenen Meeting-Performance.
            </p>
          </div>
          <span className="status-pill">Mock-KI aktiv</span>
        </header>

        {activeArea === "dashboard" && (
          <section className="section">
            <div className="grid grid--metrics">
              <MetricCard icon={ClipboardCheck} label="Vorbereitete Meetings" value={dashboardStats.preparedMeetings} detail="in dieser Session" />
              <MetricCard icon={FileSearch} label="Analysierte Transkripte" value={dashboardStats.analyzedTranscripts} detail="lokale Eingaben" />
              <MetricCard icon={AlertTriangle} label="Offene kritische Fragen" value={dashboardStats.criticalQuestions} detail="aus Vorbereitung" />
              <MetricCard icon={MessageSquareText} label="Wiederkehrende Einwände" value={dashboardStats.recurringObjections} detail="aus Musteranalyse" />
            </div>
            <div className="grid grid--two">
              <article className="card">
                <h2>Letzte Analysen</h2>
                <ul className="plain-list">
                  <li>{preparation ? "Meeting-Vorbereitung erzeugt" : "Noch keine Meeting-Vorbereitung vorhanden"}</li>
                  <li>{decision ? "Devil's-Advocate-Prüfung erzeugt" : "Noch keine Entscheidung geprüft"}</li>
                  <li>{patterns ? "Meeting-Muster ausgewertet" : "Noch keine Musteranalyse vorhanden"}</li>
                </ul>
              </article>
              <article className="card">
                <h2>Nächster sinnvoller Schritt</h2>
                <p className="lead">
                  Beginne mit einer Vorbereitung oder prüfe eine anstehende Entscheidung. Die aktuelle
                  Version nutzt strukturierte Mock-Ergebnisse und ist für spätere KI-APIs vorbereitet.
                </p>
              </article>
            </div>
          </section>
        )}

        {activeArea === "record" && (
          <section className="section">
            <PrivacyNotice />
            <div className="audio-workflow">
              <article className="card">
                <h2>Meeting live aufnehmen</h2>
                <p className="lead">
                  Live-Aufnahme erfolgt lokal im Browser. Vor dem Start fragt der Browser nach Zugriff auf das Mikrofon.
                </p>
                <p className="recording-consent">
                  Vor einer echten Meeting-Aufnahme sollten alle Teilnehmenden informiert sein und die
                  notwendigen Zustimmungen sowie internen Vorgaben geklärt sein.
                </p>
                <div className="recording-panel">
                  <div className={`recorder-composer recorder-composer--${recordingState}`}>
                    <div className="recorder-waveform" aria-label="Live-Wellenform">
                      {waveformBars.map((height, index) => (
                        <span
                          className={recordingState === "recording" ? "recorder-waveform__bar recorder-waveform__bar--live" : "recorder-waveform__bar"}
                          key={`${index}-${height}`}
                          style={{ height: `${height}px` }}
                        />
                      ))}
                    </div>
                    <span className="recorder-timer">{formatTimer(recordingSeconds)}</span>
                    <div className="recorder-controls" aria-label="Aufnahmesteuerung">
                      <button
                        aria-label="Aufnahme starten"
                        className="recorder-control-button recorder-control-button--start"
                        disabled={recordingState === "requesting" || recordingState === "recording" || recordingState === "paused"}
                        onClick={startRecording}
                        type="button"
                      >
                        Start
                      </button>
                      <button
                        aria-label="Aufnahme pausieren"
                        className="recorder-control-button"
                        disabled={!recorder || recordingState !== "recording"}
                        onClick={pauseRecording}
                        type="button"
                      >
                        Pause
                      </button>
                      <button
                        aria-label="Aufnahme fortfahren"
                        className="recorder-control-button"
                        disabled={!recorder || recordingState !== "paused"}
                        onClick={resumeRecording}
                        type="button"
                      >
                        Fortfahren
                      </button>
                      <button
                        aria-label="Aufnahme stoppen"
                        className="recorder-control-button recorder-control-button--stop"
                        disabled={!recorder}
                        onClick={stopRecording}
                        type="button"
                      >
                        Stop
                      </button>
                    </div>
                    <button
                      aria-label="Aufnahme transkribieren"
                      className="recorder-icon-button recorder-icon-button--send"
                      disabled={!audioBlob || recordingState === "recording" || loadingAction === "transcription"}
                      onClick={handleTranscription}
                      type="button"
                    >
                      <ArrowUp size={24} aria-hidden="true" />
                    </button>
                  </div>
                  <p className="recorder-helper">
                    Start beginnt die Aufnahme. Pause unterbricht sie, Fortfahren setzt sie fort, Stop beendet sie.
                    Der Pfeil transkribiert erst, wenn eine Aufnahme vorhanden ist.
                  </p>
                  <div className="recording-header">
                    <span className={`recording-status recording-status--${recordingState}`}>
                      Status: {recordingState === "idle" ? "bereit" : recordingState === "requesting" ? "Mikrofonfreigabe angefragt" : recordingState === "recording" ? "Aufnahme läuft" : recordingState === "paused" ? "pausiert" : "Audio bereit"}
                    </span>
                    <span className={`microphone-status microphone-status--${microphoneStatus.replace(" ", "-")}`}>
                      Mikrofon: {microphoneStatus}
                    </span>
                    <span className={isSpeaking ? "speaking-indicator speaking-indicator--active" : "speaking-indicator"}>
                      {isSpeaking ? "Sprache erkannt" : recordingState === "requesting" ? "Mikrofonfreigabe angefragt" : recordingState === "recording" ? "Warte auf Sprache" : "Kein Live-Signal"}
                    </span>
                  </div>
                  <div className="level-meter" aria-label="Mikrofonpegel">
                    <div className="level-meter__bar" style={{ width: `${audioLevel}%` }} />
                  </div>
                  <ol className="recording-steps">
                    <li className={recordingState !== "idle" || microphoneStatus === "blockiert" ? "recording-steps__done" : ""}>Start drücken und Mikrofonzugriff erlauben.</li>
                    <li className={recordingState === "recording" || recordingState === "paused" || recordingState === "ready" ? "recording-steps__done" : ""}>Sprechen beobachten: Pegel und Hinweis zeigen, ob Ton ankommt.</li>
                    <li className={recordingState === "ready" ? "recording-steps__done" : ""}>Stopp drücken. Danach liegt die Aufnahme temporär im Browser vor.</li>
                    <li className={audioUrl ? "recording-steps__done" : ""}>Mit Download dauerhaft als Datei speichern oder direkt transkribieren.</li>
                  </ol>
                  {recordingError && (
                    <div className="permission-guide">
                      <p className="recording-error">{recordingError}</p>
                      <div className="permission-actions">
                        <button className="primary-button" onClick={startRecording} type="button">
                          <Mic size={17} /> Mikrofon erneut freigeben
                        </button>
                        <button className="secondary-button" onClick={reloadPage} type="button">
                          Seite neu laden
                        </button>
                      </div>
                      <div className="permission-steps">
                        <h3>Mikrofon wieder freigeben</h3>
                        <ol>
                          <li>In der Browser-Adresszeile bei `127.0.0.1` das Schloss- oder Einstellungs-Symbol öffnen.</li>
                          <li>Für diese Seite **Mikrofon erlauben** auswählen.</li>
                          <li>Falls macOS blockiert: Systemeinstellungen → Datenschutz & Sicherheit → Mikrofon öffnen und den verwendeten Browser aktivieren.</li>
                          <li>Danach die Seite neu laden und erneut auf **Start** klicken.</li>
                        </ol>
                      </div>
                    </div>
                  )}
                </div>
                {audioUrl && (
                  <div className="audio-preview">
                    <strong>{audioSourceLabel}</strong>
                    <p>
                      Die Aufnahme wurde nicht automatisch auf der Festplatte gespeichert. Sie liegt
                      temporär im Browser-Speicher dieser Sitzung und kann hier angehört,
                      heruntergeladen oder transkribiert werden.
                    </p>
                    <dl className="file-details">
                      <div>
                        <dt>Dateiname</dt>
                        <dd>{audioFileName || audioSourceLabel}</dd>
                      </div>
                      <div>
                        <dt>Dauer</dt>
                        <dd>{recordingDurationLabel}</dd>
                      </div>
                      <div>
                        <dt>Größe</dt>
                        <dd>{audioSizeLabel}</dd>
                      </div>
                      <div>
                        <dt>Speicherort</dt>
                        <dd>Temporär im Browser; dauerhaft erst nach Download.</dd>
                      </div>
                    </dl>
                    <audio controls src={audioUrl} />
                    <div className="audio-actions">
                      <a className="secondary-button download-link" download={audioFileName || "meeting-aufnahme.webm"} href={audioUrl}>
                        <Download size={17} /> Aufnahme herunterladen
                      </a>
                      <button className="primary-button" onClick={handleTranscription} type="button">
                        <Sparkles size={17} /> Diese Aufnahme transkribieren
                      </button>
                    </div>
                  </div>
                )}
              </article>

              <article className="card">
                <h2>Vorhandene Audiodatei hochladen</h2>
                <p className="lead">
                  Alternativ kann eine bestehende Aufnahme als Audioquelle genutzt werden. Die aktuelle Version erzeugt daraus ein Mock-Transkript.
                </p>
                <label className="upload-box">
                  <Upload size={22} aria-hidden="true" />
                  <span>Audiodatei auswählen</span>
                  <input accept="audio/*" onChange={(event) => handleAudioUpload(event.target.files?.[0] ?? null)} type="file" />
                </label>
                <button className="primary-button" onClick={handleTranscription} type="button" disabled={!audioBlob}>
                  <Sparkles size={17} /> Transkription erzeugen
                </button>
                {loadingAction === "transcription" && <LoadingIndicator label="Transkription wird erzeugt ..." />}
              </article>
            </div>
            {loadingAction === "transcription" && <LoadingIndicator label="KI arbeitet am Transkript ..." />}
            {transcription && (
              <div className="result-grid">
                <section className="result-block">
                  <h3>Transkriptionsstatus</h3>
                  <p><strong>Quelle:</strong> {transcription.sourceLabel}</p>
                  <p><strong>Dauer:</strong> {transcription.durationLabel}</p>
                  <p><strong>Qualität:</strong> {transcription.confidence}</p>
                </section>
                <section className="result-block">
                  <h3>Erzeugtes Transkript</h3>
                  <p className="result-note">
                    Dieses Transkript wird hier angezeigt und wurde automatisch in das Textfeld im Bereich
                    „Transkript analysieren“ übernommen.
                  </p>
                  <p>{transcription.transcript}</p>
                  <button className="secondary-button" onClick={() => setActiveArea("transcript")} type="button">
                    <FileSearch size={17} /> In Transkriptanalyse öffnen
                  </button>
                </section>
              </div>
            )}
          </section>
        )}

        {activeArea === "prepare" && (
          <section className="section">
            <PrivacyNotice />
            <form className="card form-grid" onSubmit={handlePreparation}>
              <Field label="Meeting-Titel">
                <input value={preparationInput.title} onChange={(event) => setPreparationInput({ ...preparationInput, title: event.target.value })} />
              </Field>
              <Field label="Ziel des Meetings">
                <input value={preparationInput.goal} onChange={(event) => setPreparationInput({ ...preparationInput, goal: event.target.value })} />
              </Field>
              <Field label="Teilnehmer">
                <textarea value={preparationInput.participants} onChange={(event) => setPreparationInput({ ...preparationInput, participants: event.target.value })} />
              </Field>
              <Field label="Rollen der Teilnehmer">
                <textarea value={preparationInput.roles} onChange={(event) => setPreparationInput({ ...preparationInput, roles: event.target.value })} />
              </Field>
              <Field label="Gewünschtes Ergebnis">
                <textarea value={preparationInput.desiredOutcome} onChange={(event) => setPreparationInput({ ...preparationInput, desiredOutcome: event.target.value })} />
              </Field>
              <Field label="Kritische Themen">
                <textarea value={preparationInput.criticalTopics} onChange={(event) => setPreparationInput({ ...preparationInput, criticalTopics: event.target.value })} />
              </Field>
              <Field label="Eigene Position">
                <textarea value={preparationInput.ownPosition} onChange={(event) => setPreparationInput({ ...preparationInput, ownPosition: event.target.value })} />
              </Field>
              <div className="form-actions">
                <button className="primary-button" type="submit"><Sparkles size={17} /> Vorbereitung erzeugen</button>
              </div>
            </form>
            {loadingAction === "preparation" && <LoadingIndicator label="KI erstellt die Meeting-Vorbereitung ..." />}
            {preparation && (
              <div className="result-grid">
                <ResultSection title="Zentrale Argumente" items={preparation.arguments} />
                <ResultSection title="Erwartbare Einwände" items={preparation.objections} />
                <ResultSection title="Kritische Fragen" items={preparation.criticalQuestions} />
                <ResultSection title="Antwortstrategien" items={preparation.responseStrategies} />
              </div>
            )}
          </section>
        )}

        {activeArea === "decision" && (
          <section className="section">
            <PrivacyNotice />
            <form className="card form-grid" onSubmit={handleDecision}>
              <Field label="Entscheidung">
                <textarea value={decisionText} onChange={(event) => setDecisionText(event.target.value)} />
              </Field>
              <div className="form-actions">
                <button className="primary-button" type="submit"><ShieldQuestion size={17} /> Devil&apos;s Advocate starten</button>
              </div>
            </form>
            {loadingAction === "decision" && <LoadingIndicator label="KI prüft die Entscheidung kritisch ..." />}
            {decision && (
              <div className="result-grid">
                <section className="result-block">
                  <h3>Risikobewertung</h3>
                  <RiskBadge level={decision.risk.level} />
                  <p>{decision.risk.rationale}</p>
                </section>
                <ResultSection title="10 mögliche Schwachstellen" items={decision.weaknesses} />
                <ResultSection title="5 unbequeme Fragen" items={decision.uncomfortableQuestions} />
                {Object.entries(decision.counterArguments).map(([role, items]) => (
                  <ResultSection key={role} title={`Gegenargumente: ${role}`} items={items} />
                ))}
              </div>
            )}
          </section>
        )}

        {activeArea === "simulate" && (
          <section className="section">
            <PrivacyNotice />
            <form className="card form-grid" onSubmit={handleSimulation}>
              <Field label="Meeting-Ziel">
                <textarea value={simulationInput.goal} onChange={(event) => setSimulationInput({ ...simulationInput, goal: event.target.value })} />
              </Field>
              <Field label="Teilnehmer">
                <textarea value={simulationInput.participants} onChange={(event) => setSimulationInput({ ...simulationInput, participants: event.target.value })} />
              </Field>
              <Field label="Konfliktthemen">
                <textarea value={simulationInput.conflicts} onChange={(event) => setSimulationInput({ ...simulationInput, conflicts: event.target.value })} />
              </Field>
              <div className="form-actions">
                <button className="primary-button" type="submit"><PlayCircle size={17} /> Szenarien erzeugen</button>
              </div>
            </form>
            {loadingAction === "simulation" && <LoadingIndicator label="KI simuliert mögliche Meeting-Verläufe ..." />}
            {simulation && (
              <div className="scenario-grid">
                {simulation.map((scenario) => (
                  <article className="scenario-card" key={scenario.name}>
                    <h3>{scenario.name}</h3>
                    <ResultSection title="Wahrscheinlicher Verlauf" items={scenario.likelyFlow} />
                    <ResultSection title="Mögliche Aussagen" items={scenario.participantStatements} />
                    <ResultSection title="Optimale Antworten" items={scenario.optimalResponses} />
                    <ResultSection title="Kritische Wendepunkte" items={scenario.turningPoints} />
                    <p><strong>Abschluss:</strong> {scenario.closingStatement}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {activeArea === "transcript" && (
          <section className="section">
            <PrivacyNotice />
            <form className="card form-grid" onSubmit={handleTranscript}>
              <Field label="Meeting-Transkript">
                <textarea value={transcriptText} onChange={(event) => setTranscriptText(event.target.value)} />
              </Field>
              <div className="form-actions">
                <button className="primary-button" type="submit"><FileSearch size={17} /> Transkript analysieren</button>
              </div>
            </form>
            {transcriptText && (
              <p className="result-note">
                Der aktuell eingefügte Transkripttext steht in diesem Textfeld und kann hier analysiert werden.
              </p>
            )}
            {loadingAction === "transcript" && <LoadingIndicator label="KI analysiert das Transkript ..." />}
            {transcript && (
              <>
                <div className="grid grid--two">
                  <section className="result-block">
                    <h3>Rohtranskript</h3>
                    <p className="transcript-raw">{transcriptText}</p>
                  </section>
                  <section className="result-block">
                    <h3>KI-Zusammenfassung</h3>
                    <p>{transcript.summary}</p>
                  </section>
                </div>
                <div className="result-grid">
                  <ResultSection title="Was wurde gesagt?" items={transcript.said} />
                  <ResultSection title="Was wurde nicht gesagt?" items={transcript.unsaid} />
                  <ResultSection title="Umgangene Themen" items={transcript.avoidedTopics} />
                  <ResultSection title="Widersprüche" items={transcript.contradictions} />
                  <ResultSection title="Entscheidungen" items={transcript.decisions} />
                  <ResultSection title="Aufgaben / Verantwortliche" items={transcript.tasks} />
                  <ResultSection title="Offene Punkte" items={transcript.openPoints} />
                  <ResultSection title="Offene Risiken" items={transcript.openRisks} />
                  <ResultSection title="Empfohlene Nachfragen" items={transcript.followUpQuestions} />
                  <ResultSection title="Zeitstempel" items={transcript.timestamps.length ? transcript.timestamps.map((item) => `${item.time}: ${item.note}`) : ["Keine Zeitstempel erkannt."]} />
                  <section className="result-block result-block--wide">
                    <h3>Follow-up-Mail-Entwurf</h3>
                    <pre className="mail-draft">{transcript.followUpEmailDraft}</pre>
                  </section>
                </div>
              </>
            )}
          </section>
        )}

        {activeArea === "stakeholder" && (
          <section className="section">
            <PrivacyNotice />
            <form className="card form-grid" onSubmit={handleStakeholder}>
              <Field label="Name"><input value={stakeholderInput.name} onChange={(event) => setStakeholderInput({ ...stakeholderInput, name: event.target.value })} /></Field>
              <Field label="Rolle"><input value={stakeholderInput.role} onChange={(event) => setStakeholderInput({ ...stakeholderInput, role: event.target.value })} /></Field>
              <Field label="Organisation"><input value={stakeholderInput.organisation} onChange={(event) => setStakeholderInput({ ...stakeholderInput, organisation: event.target.value })} /></Field>
              <Field label="Bekannte Interessen"><textarea value={stakeholderInput.interests} onChange={(event) => setStakeholderInput({ ...stakeholderInput, interests: event.target.value })} /></Field>
              <Field label="Öffentliche Aussagen oder Textauszüge"><textarea value={stakeholderInput.publicStatements} onChange={(event) => setStakeholderInput({ ...stakeholderInput, publicStatements: event.target.value })} /></Field>
              <Field label="Bisherige Erfahrungen"><textarea value={stakeholderInput.experience} onChange={(event) => setStakeholderInput({ ...stakeholderInput, experience: event.target.value })} /></Field>
              <div className="form-actions">
                <button className="primary-button" type="submit"><Users size={17} /> Stakeholder analysieren</button>
              </div>
            </form>
            {loadingAction === "stakeholder" && <LoadingIndicator label="KI analysiert den Stakeholder ..." />}
            {stakeholder && (
              <div className="result-grid">
                <ResultSection title="Vermutete Interessen" items={stakeholder.inferredInterests} />
                <ResultSection title="Mögliche Trigger" items={stakeholder.triggers} />
                <ResultSection title="Typische Sprachmuster" items={stakeholder.languagePatterns} />
                <ResultSection title="Gesprächsstrategie" items={stakeholder.conversationStrategy} />
                <ResultSection title="Gut anschließende Formulierungen" items={stakeholder.connectingPhrases} />
                <ResultSection title="Zu vermeidende Formulierungen" items={stakeholder.avoidPhrases} />
              </div>
            )}
          </section>
        )}

        {activeArea === "patterns" && (
          <section className="section">
            <PrivacyNotice />
            <form className="card form-grid" onSubmit={handlePatterns}>
              <Field label="Mehrere Meeting-Zusammenfassungen oder Transkripte">
                <textarea value={patternsText} onChange={(event) => setPatternsText(event.target.value)} />
              </Field>
              <div className="form-actions">
                <button className="primary-button" type="submit"><BarChart3 size={17} /> Muster erkennen</button>
              </div>
            </form>
            {loadingAction === "patterns" && <LoadingIndicator label="KI erkennt wiederkehrende Meeting-Muster ..." />}
            {patterns && (
              <div className="result-grid">
                <ResultSection title="Wiederkehrende Einwände" items={patterns.recurringObjections} />
                <ResultSection title="Eigene argumentative Schwächen" items={patterns.argumentativeWeaknesses} />
                <ResultSection title="Überzeugende Formulierungen" items={patterns.convincingPhrases} />
                <ResultSection title="Unsichere Formulierungen" items={patterns.uncertainPhrases} />
                <ResultSection title="Typische Konfliktmuster" items={patterns.conflictPatterns} />
                <ResultSection title="Verbesserungsvorschläge" items={patterns.improvements} />
              </div>
            )}
          </section>
        )}

        {activeArea === "settings" && (
          <section className="section">
            <article className="card">
              <h2>Einstellungen</h2>
              <div className="setting-row">
                <span>KI-Anbieter</span>
                <select defaultValue="mock"><option value="mock">Mock-Service</option><option>OpenAI</option><option>Claude</option><option>Anderer Anbieter</option></select>
              </div>
              <div className="setting-row">
                <span>API-Key</span>
                <input placeholder="Noch nicht verbunden" type="password" />
              </div>
              <div className="setting-row">
                <span>Datenschutzmodus</span>
                <select defaultValue="local"><option value="local">Nur lokale Eingaben</option><option>API mit Freigabe</option><option>Unternehmensmodus</option></select>
              </div>
              <div className="setting-row">
                <span>Sprache</span>
                <select defaultValue="de"><option value="de">Deutsch</option><option value="en">Englisch</option></select>
              </div>
              <div className="setting-row">
                <span>Exportformat</span>
                <select defaultValue="pdf"><option value="pdf">PDF</option><option value="docx">Word</option><option value="md">Markdown</option></select>
              </div>
            </article>
          </section>
        )}
      </main>
    </div>
  );
}
