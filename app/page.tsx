"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Archive,
  BarChart3,
  Brain,
  ClipboardCheck,
  Download,
  Eye,
  EyeOff,
  FileText,
  FolderOpen,
  Mic,
  FileSearch,
  Files,
  Gauge,
  ListChecks,
  MessageSquareText,
  Pause,
  PlayCircle,
  RotateCcw,
  Settings,
  ShieldQuestion,
  Sparkles,
  Square,
  Send,
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
  analyzeMeetingArchives,
  analyzeStakeholder,
  analyzeTranscript,
  generateAgendaWorkflow,
  generateDecisionChallenge,
  generateMeetingPreparation,
  generateMeetingSimulation,
  transcribeMeetingAudio
} from "@/lib/aiService";
import {
  AgendaInput,
  AgendaResult,
  DecisionChallengeResult,
  MeetingPatternsResult,
  MeetingArchive,
  MeetingPreparationInput,
  MeetingPreparationResult,
  MeetingScenario,
  MultiMeetingArchiveAnalysisResult,
  StakeholderAnalysisResult,
  TranscriptionResult,
  TranscriptAnalysisResult
} from "@/types/ai";

type MicrophonePermissionState = PermissionState | "unbekannt" | "nicht unterstützt";

type MicrophoneDiagnostics = {
  browserLabel: string;
  origin: string;
  isSecureContext: boolean;
  mediaDevicesAvailable: boolean;
  permissionState: MicrophonePermissionState;
  recommendation: string;
  lastChecked: string;
};

type AreaId =
  | "dashboard"
  | "record"
  | "archives"
  | "agenda"
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
  { id: "archives", label: "Projektakten", icon: Archive },
  { id: "agenda", label: "Agenda planen", icon: ListChecks },
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

const initialAgenda: AgendaInput = {
  title: "",
  meetingGoal: "",
  participants: "",
  duration: "",
  desiredOutcome: "",
  agendaText: "",
  existingAgenda: "",
  comparisonText: ""
};

const WAVEFORM_BAR_COUNT = 86;
const FLAT_WAVEFORM_HEIGHT = 4;
const WAVEFORM_FRAME_SKIP = 3;
const chunkLengthOptions = [1, 5, 10] as const;
const MEETING_ARCHIVE_STORAGE_KEY = "meeting-intelligence-ki.archives.v1";

const createSilentWaveform = () =>
  Array.from({ length: WAVEFORM_BAR_COUNT }, () => FLAT_WAVEFORM_HEIGHT);

function loadSavedArchivesFromStorage() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedArchives = window.localStorage.getItem(MEETING_ARCHIVE_STORAGE_KEY);
    if (!storedArchives) {
      return [];
    }

    const parsedArchives = JSON.parse(storedArchives) as MeetingArchive[];
    return parsedArchives.filter((archive) => archive.schemaVersion === 1 && archive.metadata);
  } catch {
    return [];
  }
}

function detectBrowser(userAgent: string) {
  if (/electron|codex/i.test(userAgent)) {
    return "Codex In-App-Browser / Chromium";
  }
  if (/edg\//i.test(userAgent)) {
    return "Microsoft Edge / Chromium";
  }
  if (/chrome|crios/i.test(userAgent) && !/edg\//i.test(userAgent)) {
    return "Chrome/Chromium-basierter Browser";
  }
  if (/safari/i.test(userAgent) && !/chrome|crios|android/i.test(userAgent)) {
    return "Safari";
  }
  if (/firefox|fxios/i.test(userAgent)) {
    return "Firefox";
  }
  return "Unbekannter Browser";
}

function translatePermissionState(state: MicrophonePermissionState) {
  const labels: Record<MicrophonePermissionState, string> = {
    denied: "blockiert",
    granted: "erlaubt",
    prompt: "fragen",
    unbekannt: "unbekannt",
    "nicht unterstützt": "nicht unterstützt"
  };

  return labels[state];
}

function buildMicrophoneRecommendation(diagnostics: Omit<MicrophoneDiagnostics, "recommendation">) {
  if (!diagnostics.mediaDevicesAvailable) {
    return "Dieser Browser stellt keine Aufnahme-API bereit. Bitte Safari, Chrome oder Edge verwenden und die App über 127.0.0.1 öffnen.";
  }

  if (!diagnostics.isSecureContext) {
    return "Die Seite läuft nicht in einer sicheren Umgebung. Öffne die App über http://127.0.0.1:3000 oder localhost.";
  }

  if (diagnostics.permissionState === "denied") {
    if (diagnostics.browserLabel === "Safari") {
      return "Safari meldet eine blockierte Berechtigung. Stelle Safari → Einstellungen → Websites → Mikrofon für 127.0.0.1 auf Fragen oder Erlauben und prüfe zusätzlich macOS Datenschutz & Sicherheit → Mikrofon.";
    }

    return "Der Browser meldet eine blockierte Berechtigung. Start wurde ausgeführt, aber die Aufnahme kann ohne Mikrofonfreigabe nicht beginnen. Deshalb bleiben Pause, Fortfahren und Stop deaktiviert. Öffne die Website- oder App-Einstellungen, erlaube das Mikrofon und lade die App neu.";
  }

  if (diagnostics.permissionState === "prompt") {
    return "Der Browser sollte beim nächsten Start fragen. Falls die Aufnahme trotzdem verweigert wird, ist wahrscheinlich die macOS-Mikrofonfreigabe für den Browser deaktiviert.";
  }

  if (diagnostics.permissionState === "granted") {
    return "Der Browser meldet Mikrofonzugriff als erlaubt. Wenn kein Pegel sichtbar ist, prüfe das ausgewählte Eingabegerät in den Systemeinstellungen.";
  }

  return "Die Browser-Berechtigung konnte nicht eindeutig gelesen werden. Starte einen kurzen Test und prüfe bei einer Ablehnung Safari/Browser-Einstellungen sowie macOS-Mikrofonfreigabe.";
}

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
  const [recordingMode, setRecordingMode] = useState<"standard" | "long">("standard");
  const [chunkLengthMinutes, setChunkLengthMinutes] = useState<(typeof chunkLengthOptions)[number]>(5);
  const [transcriptionNotice, setTranscriptionNotice] = useState("Noch kein Audio für die Transkription vorhanden.");
  const [microphoneDiagnostics, setMicrophoneDiagnostics] = useState<MicrophoneDiagnostics | null>(null);
  const [transcription, setTranscription] = useState<TranscriptionResult | null>(null);
  const [loadingAction, setLoadingAction] = useState<
    | null
    | "preparation"
    | "agenda"
    | "archiveAnalysis"
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
  const waveformFrameRef = useRef(0);
  const waveformWriteIndexRef = useRef(0);
  const waveformHasSpeechRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [preparationInput, setPreparationInput] = useState(initialPreparation);
  const [preparation, setPreparation] = useState<MeetingPreparationResult | null>(null);
  const [agendaInput, setAgendaInput] = useState(initialAgenda);
  const [agenda, setAgenda] = useState<AgendaResult | null>(null);
  const [agendaFileStatus, setAgendaFileStatus] = useState("Noch keine Agenda-Datei geladen.");
  const [archiveStatus, setArchiveStatus] = useState("Noch keine Projektakte gespeichert oder geladen.");
  const [loadedArchiveNames, setLoadedArchiveNames] = useState<string[]>([]);
  const [savedArchives, setSavedArchives] = useState<MeetingArchive[]>(loadSavedArchivesFromStorage);
  const [archiveAnalysis, setArchiveAnalysis] = useState<MultiMeetingArchiveAnalysisResult | null>(null);
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
  const [apiProvider, setApiProvider] = useState<"anthropic" | "openai">("anthropic");
  const [anthropicApiKey, setAnthropicApiKey] = useState("");
  const [isApiKeyVisible, setIsApiKeyVisible] = useState(false);
  const [anthropicConnectionState, setAnthropicConnectionState] = useState<"disconnected" | "connected" | "error">("disconnected");
  const [anthropicStatusText, setAnthropicStatusText] = useState("Nicht verbunden");

  const dashboardStats = useMemo(
    () => ({
      preparedMeetings: String((preparation ? 1 : 0) + (agenda ? 1 : 0)),
      analyzedTranscripts: transcript ? "1" : "0",
      criticalQuestions: preparation ? String(preparation.criticalQuestions.length) : "0",
      recurringObjections: patterns ? String(patterns.recurringObjections.length) : "0",
      savedArchives: String(savedArchives.length)
    }),
    [agenda, patterns, preparation, savedArchives.length, transcript]
  );

  const pageTitle = navItems.find((item) => item.id === activeArea)?.label ?? "Dashboard";
  const audioSizeLabel = audioBlob ? `${(audioBlob.size / 1024 / 1024).toFixed(2)} MB` : "";
  const activeChunkNumber = recordingMode === "long"
    ? Math.max(1, Math.floor(recordingSeconds / (chunkLengthMinutes * 60)) + 1)
    : 1;
  const completedChunkCount = recordingMode === "long"
    ? Math.max(0, Math.floor(recordingSeconds / (chunkLengthMinutes * 60)))
    : 0;

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

  const readMicrophonePermission = useCallback(async (): Promise<MicrophonePermissionState> => {
    if (!navigator.permissions?.query) {
      return "nicht unterstützt";
    }

    try {
      const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
      return status.state;
    } catch {
      return "nicht unterstützt";
    }
  }, []);

  const refreshMicrophoneDiagnostics = useCallback(async () => {
    const permissionState = await readMicrophonePermission();
    const baseDiagnostics = {
      browserLabel: detectBrowser(navigator.userAgent),
      origin: window.location.origin,
      isSecureContext: window.isSecureContext,
      mediaDevicesAvailable: Boolean(navigator.mediaDevices?.getUserMedia),
      permissionState,
      lastChecked: new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    };

    setMicrophoneDiagnostics({
      ...baseDiagnostics,
      recommendation: buildMicrophoneRecommendation(baseDiagnostics)
    });
  }, [readMicrophonePermission]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshMicrophoneDiagnostics();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [refreshMicrophoneDiagnostics]);

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
    waveformFrameRef.current = 0;
    waveformWriteIndexRef.current = 0;
    waveformHasSpeechRef.current = false;
    setAudioLevel(0);
    setIsSpeaking(false);
    setWaveformBars(createSilentWaveform());
  }

  function startLevelMeter(stream: MediaStream) {
    stopLevelMeter();
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);

    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.58;
    const data = new Uint8Array(analyser.fftSize);
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
      const isVoiceActive = level > 8;
      setIsSpeaking(isVoiceActive);
      waveformFrameRef.current += 1;

      if (waveformFrameRef.current % WAVEFORM_FRAME_SKIP === 0) {
        if (isVoiceActive && !waveformHasSpeechRef.current) {
          waveformHasSpeechRef.current = true;
          waveformWriteIndexRef.current = 0;
          setWaveformBars(createSilentWaveform());
        }

        const nextHeight = isVoiceActive
          ? Math.max(12, Math.min(42, Math.round(10 + level * 0.42)))
          : FLAT_WAVEFORM_HEIGHT;

        setWaveformBars((previousBars) => {
          const nextBars = [...previousBars];
          const writeIndex = waveformWriteIndexRef.current;

          if (writeIndex < WAVEFORM_BAR_COUNT) {
            nextBars[writeIndex] = nextHeight;
            waveformWriteIndexRef.current = writeIndex + 1;
            return nextBars;
          }

          return [...previousBars.slice(1), nextHeight];
        });
      }

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
      setTranscriptionNotice("Aufnahme läuft. Nach Stop kann die Audiodatei transkribiert werden.");
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
      void refreshMicrophoneDiagnostics();
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
      void refreshMicrophoneDiagnostics();
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
    setTranscriptionNotice("Audiodatei ist bereit. Klicke auf „Transkription erzeugen“.");
  }

  async function handleTranscription() {
    if (!audioBlob) {
      setTranscriptionNotice("Bitte zuerst eine Aufnahme stoppen oder eine Audiodatei hochladen.");
      return;
    }
    setLoadingAction("transcription");
    setTranscriptionNotice("Transkription wird erzeugt. Aktuell nutzt die App noch eine Mock-Transkription.");
    try {
      const result = await transcribeMeetingAudio(audioSourceLabel || "Audiodatei", recordingDurationLabel);
      setTranscription(result);
      setTranscriptText(result.transcript);
      setTranscriptionNotice("Transkript wurde erzeugt und zusätzlich in „Transkript analysieren“ übernommen.");
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

  async function handleAgenda(event: FormEvent) {
    event.preventDefault();
    setLoadingAction("agenda");
    try {
      setAgenda(await generateAgendaWorkflow(agendaInput));
    } finally {
      setLoadingAction(null);
    }
  }

  function handleAgendaFileUpload(file: File | null) {
    if (!file) {
      return;
    }

    const isTextFile = file.type.startsWith("text/") || /\.(txt|md|markdown)$/i.test(file.name);

    if (!isTextFile) {
      setAgendaFileStatus("Diese Datei kann noch nicht direkt gelesen werden. Bitte nutze aktuell .txt oder .md oder kopiere den Agenda-Text in das Feld.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setAgendaInput((currentInput) => ({
        ...currentInput,
        existingAgenda: text
      }));
      setAgendaFileStatus(`Agenda-Datei übernommen: ${file.name}`);
    };
    reader.onerror = () => {
      setAgendaFileStatus("Die Agenda-Datei konnte nicht gelesen werden. Bitte kopiere den Inhalt manuell in das Feld.");
    };
    reader.readAsText(file);
  }

  function createCurrentMeetingArchive(): MeetingArchive {
    const title = agendaInput.title || preparationInput.title || "Meeting-Projektakte";
    const hasAnalysis = Boolean(transcript || agenda || preparation || decision || simulation || stakeholder || patterns);
    const status: MeetingArchive["metadata"]["status"] = transcript
      ? "analysiert"
      : transcription
        ? "transkribiert"
        : audioSourceLabel
          ? "aufgenommen"
          : agenda || preparation
            ? "geplant"
            : hasAnalysis
              ? "analysiert"
              : "geplant";

    return {
      schemaVersion: 1,
      id: `meeting-${Date.now()}`,
      savedAt: new Date().toISOString(),
      appVersion: "Meeting Intelligence KI Arbeitsversion",
      metadata: {
        title,
        date: new Date().toISOString().slice(0, 10),
        status,
        participants: agendaInput.participants || preparationInput.participants,
        goal: agendaInput.meetingGoal || preparationInput.goal,
        desiredOutcome: agendaInput.desiredOutcome || preparationInput.desiredOutcome
      },
      agenda: {
        input: agendaInput,
        result: agenda
      },
      preparation: {
        input: preparationInput,
        result: preparation
      },
      audio: {
        sourceLabel: audioSourceLabel,
        fileName: audioFileName,
        durationLabel: recordingDurationLabel,
        note: "Audiodateien werden in dieser Projektakte noch nicht eingebettet. Speichere die Aufnahme zusätzlich separat über den Download."
      },
      transcription: {
        result: transcription,
        rawText: transcriptText
      },
      transcriptAnalysis: transcript,
      decisionChallenge: decision,
      simulation,
      stakeholderAnalysis: stakeholder,
      patternAnalysis: patterns
    };
  }

  function createArchiveFileName(title: string) {
    const date = new Date().toISOString().slice(0, 10);
    const slug = title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 48) || "meeting";

    return `${date}-${slug}.meeting.json`;
  }

  function persistArchives(archives: MeetingArchive[]) {
    setSavedArchives(archives);
    window.localStorage.setItem(MEETING_ARCHIVE_STORAGE_KEY, JSON.stringify(archives));
  }

  function storeArchiveInBrowser(archive: MeetingArchive) {
    const nextArchives = [
      archive,
      ...savedArchives.filter((savedArchive) => savedArchive.id !== archive.id)
    ].slice(0, 50);
    persistArchives(nextArchives);
    setArchiveStatus(`Projektakte lokal im Browser gespeichert: ${archive.metadata.title}`);
  }

  function downloadArchive(archive: MeetingArchive) {
    const blob = new Blob([JSON.stringify(archive, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = createArchiveFileName(archive.metadata.title);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setArchiveStatus(`Projektakte vorbereitet: ${link.download}. Die Datei wird über den Browser-Download gespeichert.`);
  }

  function saveCurrentMeetingInBrowser() {
    storeArchiveInBrowser(createCurrentMeetingArchive());
  }

  function saveAndDownloadCurrentMeetingArchive() {
    const archive = createCurrentMeetingArchive();
    storeArchiveInBrowser(archive);
    downloadArchive(archive);
  }

  function archiveToMarkdown(archive: MeetingArchive) {
    const lines = [
      `# ${archive.metadata.title}`,
      "",
      `Datum: ${archive.metadata.date}`,
      `Status: ${archive.metadata.status}`,
      `Ziel: ${archive.metadata.goal || "nicht erfasst"}`,
      `Gewünschtes Ergebnis: ${archive.metadata.desiredOutcome || "nicht erfasst"}`,
      "",
      "## Teilnehmer",
      archive.metadata.participants || "Nicht erfasst",
      "",
      "## Agenda",
      archive.agenda.input.existingAgenda || archive.agenda.input.agendaText || "Keine Agenda erfasst.",
      "",
      "## Transkript",
      archive.transcription.rawText || "Kein Transkript gespeichert.",
      "",
      "## Management Summary",
      archive.transcriptAnalysis?.managementSummary || "Noch keine Analyse vorhanden.",
      "",
      "## Entscheidungen",
      ...(archive.transcriptAnalysis?.decisions ?? ["Noch keine Entscheidungen gespeichert."]).map((item) => `- ${item}`),
      "",
      "## Maßnahmen",
      ...(archive.transcriptAnalysis?.actionPlan ?? []).map((item) => `- ${item.task} | Owner: ${item.owner} | Frist: ${item.due} | Priorität: ${item.priority}`),
      ...(archive.transcriptAnalysis?.actionPlan.length ? [] : ["Noch keine Maßnahmen gespeichert."]),
      "",
      "## Follow-up",
      archive.transcriptAnalysis?.followUpEmailDraft || "Noch kein Follow-up-Entwurf vorhanden."
    ];

    return lines.join("\n");
  }

  function downloadArchiveMarkdown(archive: MeetingArchive) {
    const blob = new Blob([archiveToMarkdown(archive)], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = createArchiveFileName(archive.metadata.title).replace(".meeting.json", ".md");
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setArchiveStatus(`Markdown-Export vorbereitet: ${link.download}.`);
  }

  function downloadCurrentMeetingMarkdown() {
    downloadArchiveMarkdown(createCurrentMeetingArchive());
  }

  function readTextFile(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden."));
      reader.readAsText(file);
    });
  }

  function applyMeetingArchive(archive: MeetingArchive) {
    setAgendaInput(archive.agenda.input);
    setAgenda(archive.agenda.result);
    setPreparationInput(archive.preparation.input);
    setPreparation(archive.preparation.result);
    setTranscription(archive.transcription.result);
    setTranscriptText(archive.transcription.rawText);
    setTranscript(archive.transcriptAnalysis);
    setDecision(archive.decisionChallenge);
    setSimulation(archive.simulation);
    setStakeholder(archive.stakeholderAnalysis);
    setPatterns(archive.patternAnalysis);
    setAudioSourceLabel(archive.audio.sourceLabel);
    setAudioFileName(archive.audio.fileName);
    setRecordingDurationLabel(archive.audio.durationLabel || "unbekannt");
    setAudioBlob(null);
    clearAudioUrl();
    setAudioUrl("");
    setRecordingState("idle");
    setTranscriptionNotice(archive.transcription.rawText ? "Transkript aus Projektakte geladen." : "Projektakte geladen. Kein Transkript in der Akte enthalten.");
    setArchiveStatus(`Projektakte geladen: ${archive.metadata.title}`);
  }

  async function handleMeetingArchiveUpload(file: File | null) {
    if (!file) {
      return;
    }

    try {
      const text = await readTextFile(file);
      const archive = JSON.parse(text) as MeetingArchive;
      if (archive.schemaVersion !== 1 || !archive.metadata || !archive.agenda || !archive.preparation) {
        throw new Error("Ungültiges Projektaktenformat.");
      }
      applyMeetingArchive(archive);
      storeArchiveInBrowser(archive);
      setLoadedArchiveNames([archive.metadata.title || file.name]);
    } catch {
      setArchiveStatus("Diese Datei konnte nicht als Meeting-Projektakte gelesen werden.");
    }
  }

  async function handleMultipleArchiveAnalysis(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    setLoadingAction("archiveAnalysis");
    try {
      const archives = await Promise.all(
        Array.from(files).map(async (file) => JSON.parse(await readTextFile(file)) as MeetingArchive)
      );
      const validArchives = archives.filter((archive) => archive.schemaVersion === 1 && archive.metadata);
      setLoadedArchiveNames(validArchives.map((archive) => archive.metadata.title));
      if (validArchives.length > 0) {
        const importedIds = new Set(validArchives.map((archive) => archive.id));
        persistArchives([
          ...validArchives,
          ...savedArchives.filter((archive) => !importedIds.has(archive.id))
        ].slice(0, 50));
      }
      setArchiveAnalysis(await analyzeMeetingArchives(validArchives));
      setArchiveStatus(`${validArchives.length} Projektakten für die übergreifende Analyse geladen.`);
    } catch {
      setArchiveStatus("Mindestens eine Datei konnte nicht als Meeting-Projektakte gelesen werden.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function analyzeSavedMeetingArchives() {
    if (savedArchives.length === 0) {
      setArchiveStatus("Noch keine lokal gespeicherten Projektakten für eine Analyse vorhanden.");
      return;
    }

    setLoadingAction("archiveAnalysis");
    try {
      setLoadedArchiveNames(savedArchives.map((archive) => archive.metadata.title));
      setArchiveAnalysis(await analyzeMeetingArchives(savedArchives));
      setArchiveStatus(`${savedArchives.length} lokal gespeicherte Projektakten analysiert.`);
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

  function connectAiProvider() {
    const trimmedKey = anthropicApiKey.trim();
    if (!trimmedKey) {
      setAnthropicConnectionState("error");
      setAnthropicStatusText(`Bitte zuerst einen ${apiProvider === "anthropic" ? "Anthropic" : "OpenAI"} API-Schlüssel eingeben.`);
      return;
    }

    setAnthropicConnectionState("connected");
    setAnthropicStatusText("Verbindung ok");
  }

  function disconnectAnthropic() {
    setAnthropicApiKey("");
    setAnthropicConnectionState("disconnected");
    setAnthropicStatusText("Nicht verbunden");
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
              <MetricCard icon={Archive} label="Gespeicherte Projektakten" value={dashboardStats.savedArchives} detail="lokal im Browser" />
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

        {activeArea === "archives" && (
          <section className="section">
            <PrivacyNotice />
            <div className="archive-intro">
              <article className="card">
                <h2>Projektakte für ein Meeting</h2>
                <p className="lead">
                  Speichere den aktuellen Arbeitsstand als lokale Meeting-Datei. Die Datei enthält Agenda,
                  Vorbereitung, Transkript, Analysen, Entscheidungen, Maßnahmen und Metadaten. Audio wird
                  aktuell nur als Dateihinweis gespeichert und sollte separat heruntergeladen werden.
                </p>
              </article>
              <article className="card">
                <h2>Lokales Prinzip</h2>
                <p className="lead">
                  Es gibt keine Cloud-Datenbank. Die App erzeugt und liest lokale JSON-Projektakten, die du
                  später erneut laden oder gemeinsam auswerten kannst.
                </p>
              </article>
            </div>

            <div className="archive-grid">
              <article className="card archive-card">
                <Download size={24} aria-hidden="true" />
                <div>
                  <h2>Aktuelles Meeting speichern</h2>
                  <p>Speichert den Arbeitsstand im Browser und erzeugt bei Bedarf eine <strong>.meeting.json</strong>-Datei.</p>
                </div>
                <div className="archive-button-stack">
                  <button className="primary-button" onClick={saveCurrentMeetingInBrowser} type="button">
                    <Archive size={17} /> Im Browser speichern
                  </button>
                  <button className="secondary-button" onClick={saveAndDownloadCurrentMeetingArchive} type="button">
                    <Download size={17} /> Speichern und herunterladen
                  </button>
                  <button className="secondary-button" onClick={downloadCurrentMeetingMarkdown} type="button">
                    <FileText size={17} /> Als Markdown exportieren
                  </button>
                </div>
              </article>

              <article className="card archive-card">
                <FolderOpen size={24} aria-hidden="true" />
                <div>
                  <h2>Projektakte laden</h2>
                  <p>Öffnet eine gespeicherte Meeting-Akte und stellt Agenda, Transkript und Analysen wieder her.</p>
                </div>
                <label className="secondary-button archive-file-button">
                  <FolderOpen size={17} aria-hidden="true" />
                  Projektakte auswählen
                  <input accept=".json,.meeting.json,application/json" onChange={(event) => handleMeetingArchiveUpload(event.target.files?.[0] ?? null)} type="file" />
                </label>
              </article>

              <article className="card archive-card">
                <Files size={24} aria-hidden="true" />
                <div>
                  <h2>Viele Meetings analysieren</h2>
                  <p>Lade mehrere Projektakten, um wiederkehrende Einwände, Risiken und Maßnahmenmuster zu erkennen.</p>
                </div>
                <div className="archive-button-stack">
                  <button className="primary-button" disabled={savedArchives.length === 0} onClick={analyzeSavedMeetingArchives} type="button">
                    <Archive size={17} /> Lokale Akten analysieren
                  </button>
                  <label className="secondary-button archive-file-button">
                    <Files size={17} aria-hidden="true" />
                    Mehrere Projektakten auswählen
                    <input accept=".json,.meeting.json,application/json" multiple onChange={(event) => handleMultipleArchiveAnalysis(event.target.files)} type="file" />
                  </label>
                </div>
              </article>
            </div>

            <p className="result-note">{archiveStatus}</p>
            {savedArchives.length > 0 && (
              <section className="result-block result-block--wide">
                <h3>Lokale Meeting-Übersicht</h3>
                <div className="archive-table">
                  {savedArchives.map((archive) => (
                    <article className="archive-row" key={archive.id}>
                      <div>
                        <strong>{archive.metadata.title}</strong>
                        <span>{archive.metadata.date} · Status: {archive.metadata.status}</span>
                      </div>
                      <div>
                        <span>{archive.transcription.rawText ? "Transkript vorhanden" : "ohne Transkript"}</span>
                        <span>{archive.transcriptAnalysis ? "Analyse vorhanden" : "ohne Analyse"}</span>
                      </div>
                      <div className="archive-row__actions">
                        <button className="secondary-button" onClick={() => applyMeetingArchive(archive)} type="button">
                          <FolderOpen size={16} /> Öffnen
                        </button>
                        <button className="secondary-button" onClick={() => downloadArchive(archive)} type="button">
                          <Download size={16} /> JSON
                        </button>
                        <button className="secondary-button" onClick={() => downloadArchiveMarkdown(archive)} type="button">
                          <FileText size={16} /> Markdown
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
            {loadedArchiveNames.length > 0 && (
              <section className="result-block">
                <h3>Geladene Projektakten</h3>
                <ul>
                  {loadedArchiveNames.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              </section>
            )}

            {loadingAction === "archiveAnalysis" && <LoadingIndicator label="KI analysiert mehrere Projektakten ..." />}
            {archiveAnalysis && (
              <div className="analysis-lane">
                <h2>Übergreifende Meeting-Analyse</h2>
                <div className="grid grid--metrics">
                  <MetricCard icon={Archive} label="Geladene Projektakten" value={String(archiveAnalysis.totalMeetings)} detail="lokale Dateien" />
                  <MetricCard icon={MessageSquareText} label="Wiederkehrende Einwände" value={String(archiveAnalysis.recurringObjections.length)} detail="über alle Akten" />
                  <MetricCard icon={AlertTriangle} label="Risikomuster" value={String(archiveAnalysis.repeatedRisks.length)} detail="aus Aktenanalyse" />
                  <MetricCard icon={ClipboardCheck} label="Verbesserungen" value={String(archiveAnalysis.improvementSuggestions.length)} detail="für nächste Meetings" />
                </div>
                <div className="result-grid">
                  <ResultSection title="Wiederkehrende Einwände" items={archiveAnalysis.recurringObjections} />
                  <ResultSection title="Wiederkehrende Risiken" items={archiveAnalysis.repeatedRisks} />
                  <ResultSection title="Vertagte Entscheidungen" items={archiveAnalysis.deferredDecisions} />
                  <ResultSection title="Maßnahmenmuster" items={archiveAnalysis.actionPatterns} />
                  <ResultSection title="Agenda-Treue" items={archiveAnalysis.agendaDiscipline} />
                  <ResultSection title="Verbesserungsvorschläge" items={archiveAnalysis.improvementSuggestions} />
                </div>
              </div>
            )}
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
                <div className="recording-mode-panel" aria-label="Aufnahmeart">
                  <div className="recording-mode-panel__header">
                    <div>
                      <h3>Aufnahmeart</h3>
                      <p>Standard für kurze Gespräche, langer Modus als vorbereitete Struktur für robuste Meeting-Aufnahmen.</p>
                    </div>
                    <span className="mode-badge">{recordingMode === "long" ? "Langes Meeting" : "Standard"}</span>
                  </div>
                  <div className="mode-toggle" role="group" aria-label="Aufnahmeart wählen">
                    <button
                      className={recordingMode === "standard" ? "mode-toggle__button mode-toggle__button--active" : "mode-toggle__button"}
                      onClick={() => setRecordingMode("standard")}
                      type="button"
                    >
                      Standardaufnahme
                    </button>
                    <button
                      className={recordingMode === "long" ? "mode-toggle__button mode-toggle__button--active" : "mode-toggle__button"}
                      onClick={() => setRecordingMode("long")}
                      type="button"
                    >
                      Langes Meeting
                    </button>
                  </div>
                  {recordingMode === "long" && (
                    <div className="chunk-settings">
                      <span>Abschnittslänge</span>
                      <div className="chunk-options" role="group" aria-label="Abschnittslänge wählen">
                        {chunkLengthOptions.map((minutes) => (
                          <button
                            className={chunkLengthMinutes === minutes ? "chunk-option chunk-option--active" : "chunk-option"}
                            key={minutes}
                            onClick={() => setChunkLengthMinutes(minutes)}
                            type="button"
                          >
                            {minutes} Min.
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="chunk-status-grid">
                    <div>
                      <dt>Aktueller Abschnitt</dt>
                      <dd>{recordingMode === "long" ? `Teil ${activeChunkNumber}` : "Einzelaufnahme"}</dd>
                    </div>
                    <div>
                      <dt>Fertige Abschnitte</dt>
                      <dd>{recordingMode === "long" ? completedChunkCount : "0"}</dd>
                    </div>
                    <div>
                      <dt>Speicherprinzip</dt>
                      <dd>{recordingMode === "long" ? "Abschnitte vorbereitet" : "eine Audiodatei"}</dd>
                    </div>
                  </div>
                  <p className="chunk-explainer">
                    Die echte automatische Abschnittsspeicherung ist vorbereitet, aber noch nicht aktiv. Aktuell erzeugt
                    die App nach Stop weiterhin eine lokale Audiodatei; der lange Modus zeigt bereits die spätere Struktur.
                  </p>
                </div>
                <div className="recording-panel">
                  <div className={`recorder-composer recorder-composer--${recordingState}`}>
                    <div className="recorder-waveform" aria-label="Live-Wellenform">
                      {waveformBars.map((height, index) => (
                        <span
                          className={height > FLAT_WAVEFORM_HEIGHT ? "recorder-waveform__bar recorder-waveform__bar--live" : "recorder-waveform__bar"}
                          key={index}
                          style={{ height: `${height}px` }}
                        />
                      ))}
                    </div>
                    <span
                      aria-label={isSpeaking ? "Signal aktiv, Sprache erkannt" : "Signal ruhig"}
                      className={isSpeaking ? "recorder-voice-chip recorder-voice-chip--active" : "recorder-voice-chip"}
                    >
                      Signal
                    </span>
                    <span className="recorder-timer">{formatTimer(recordingSeconds)}</span>
                    <div className="recorder-controls" aria-label="Aufnahmesteuerung">
                      <button
                        aria-label="Aufnahme starten"
                        className="recorder-control-button recorder-control-button--start"
                        disabled={recordingState === "requesting" || recordingState === "recording" || recordingState === "paused"}
                        onClick={startRecording}
                        type="button"
                      >
                        <PlayCircle size={18} aria-hidden="true" />
                        Start
                      </button>
                      <button
                        aria-label="Aufnahme pausieren"
                        className="recorder-control-button"
                        disabled={!recorder || recordingState !== "recording"}
                        onClick={pauseRecording}
                        type="button"
                      >
                        <Pause size={18} aria-hidden="true" />
                        Pause
                      </button>
                      <button
                        aria-label="Aufnahme fortfahren"
                        className="recorder-control-button"
                        disabled={!recorder || recordingState !== "paused"}
                        onClick={resumeRecording}
                        type="button"
                      >
                        <RotateCcw size={18} aria-hidden="true" />
                        Fortfahren
                      </button>
                      <button
                        aria-label="Aufnahme stoppen"
                        className="recorder-control-button recorder-control-button--stop"
                        disabled={!recorder}
                        onClick={stopRecording}
                        type="button"
                      >
                        <Square size={17} aria-hidden="true" />
                        Stop
                      </button>
                    </div>
                    <button
                      aria-label="Aufnahme transkribieren"
                      className="recorder-transcribe-button"
                      disabled={!audioBlob || recordingState === "recording" || loadingAction === "transcription"}
                      onClick={handleTranscription}
                      type="button"
                    >
                      <Sparkles size={16} aria-hidden="true" />
                      Transkribieren
                    </button>
                  </div>
                  <p className="recorder-helper">
                    Start beginnt die Aufnahme. Pause unterbricht sie, Fortfahren setzt sie fort, Stop beendet sie.
                    Transkribieren wird aktiv, sobald eine Aufnahme vorhanden ist.
                  </p>
                  <p className="recording-limit-note">
                    Aufnahmelänge: In dieser lokalen Browser-Version gibt es kein festes App-Limit. Praktisch begrenzen
                    Browser-Speicher, Arbeitsspeicher und Geräteleistung die Dauer; für stabile Arbeit sind kürzere
                    Blöcke bis etwa 60 Minuten sinnvoll.
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
                  <div className="mic-diagnostics">
                    <div className="mic-diagnostics__header">
                      <div>
                        <h3>Mikrofon-Diagnose</h3>
                        <p>Prüft Browser, lokale Adresse und den aktuell gemeldeten Berechtigungsstatus.</p>
                      </div>
                      <button className="secondary-button" onClick={refreshMicrophoneDiagnostics} type="button">
                        <RotateCcw size={16} /> Aktualisieren
                      </button>
                    </div>
                    {microphoneDiagnostics ? (
                      <>
                        <dl className="mic-diagnostics__grid">
                          <div>
                            <dt>Browser / Engine</dt>
                            <dd>{microphoneDiagnostics.browserLabel}</dd>
                          </div>
                          <div>
                            <dt>Adresse</dt>
                            <dd>{microphoneDiagnostics.origin}</dd>
                          </div>
                          <div>
                            <dt>Lokale Sicherheitsfreigabe</dt>
                            <dd>{microphoneDiagnostics.isSecureContext ? "ok" : "nicht sicher"}</dd>
                          </div>
                          <div>
                            <dt>Aufnahme-API</dt>
                            <dd>{microphoneDiagnostics.mediaDevicesAvailable ? "verfügbar" : "nicht verfügbar"}</dd>
                          </div>
                          <div>
                            <dt>Browser-Berechtigung</dt>
                            <dd>{translatePermissionState(microphoneDiagnostics.permissionState)}</dd>
                          </div>
                          <div>
                            <dt>Letzte Prüfung</dt>
                            <dd>{microphoneDiagnostics.lastChecked}</dd>
                          </div>
                        </dl>
                        <p className="mic-diagnostics__engine-note">
                          Die Diagnose erkennt die technische Browser-Engine. Der Codex-In-App-Browser kann deshalb
                          als Chrome/Chromium erscheinen, obwohl du nicht bewusst Chrome geöffnet hast.
                        </p>
                        <p className="mic-diagnostics__recommendation">{microphoneDiagnostics.recommendation}</p>
                      </>
                    ) : (
                      <p className="mic-diagnostics__recommendation">Diagnose wird vorbereitet.</p>
                    )}
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
                          <li>In Chrome oder Edge in der Adresszeile das Schloss- oder Einstellungs-Symbol öffnen.</li>
                          <li>In Safari: Safari → Einstellungen → Websites → Mikrofon öffnen.</li>
                          <li>Für 127.0.0.1 oder localhost Mikrofon auf Fragen oder Erlauben stellen.</li>
                          <li>Falls macOS blockiert: Systemeinstellungen → Datenschutz & Sicherheit → Mikrofon öffnen und den verwendeten Browser aktivieren.</li>
                          <li>Danach die Seite neu laden und erneut auf Start klicken.</li>
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
            <section className="transcription-workspace">
              <div className="transcription-workspace__header">
                <div>
                  <h2>Transkript-Ausgabe</h2>
                  <p>Hier erscheint der transkribierte Text. Er wird zusätzlich in den Bereich „Transkript analysieren“ übernommen.</p>
                </div>
                <span className={transcription ? "transcription-status transcription-status--ready" : "transcription-status"}>
                  {transcription ? "Transkript bereit" : "Wartet auf Audio"}
                </span>
              </div>
              <p className="result-note">
                {transcriptionNotice}
              </p>
              {loadingAction === "transcription" && <LoadingIndicator label="KI arbeitet am Transkript ..." />}
              <div className="transcription-layout">
                <section className="result-block">
                  <h3>Transkriptionsstatus</h3>
                  <p><strong>Quelle:</strong> {transcription?.sourceLabel ?? "keine Audiodatei ausgewählt"}</p>
                  <p><strong>Dauer:</strong> {transcription?.durationLabel ?? "noch unbekannt"}</p>
                  <p><strong>Qualität:</strong> {transcription?.confidence ?? "noch nicht erzeugt"}</p>
                  <p><strong>Hinweis:</strong> Die aktuelle Version erzeugt ein Mock-Transkript. Eine echte Audio-zu-Text-API ist noch nicht angebunden.</p>
                </section>
                <section className="result-block result-block--wide">
                  <h3>Rohtranskript</h3>
                  <pre className="transcript-raw">{transcription?.transcript ?? "Noch kein Transkript vorhanden. Stoppe eine Aufnahme oder lade eine Audiodatei hoch und starte danach die Transkription."}</pre>
                  <button className="secondary-button" disabled={!transcription} onClick={() => setActiveArea("transcript")} type="button">
                    <FileSearch size={17} /> In Transkriptanalyse öffnen
                  </button>
                </section>
              </div>
            </section>
          </section>
        )}

        {activeArea === "agenda" && (
          <section className="section">
            <PrivacyNotice />
            <div className="agenda-intro">
              <article className="card">
                <h2>Agenda als Meeting-Anker</h2>
                <p className="lead">
                  Lege eine neue Agenda an oder füge eine bestehende Agenda ein. Die App prüft Struktur,
                  Entscheidungsreife und Risiken und kann später den tatsächlichen Meeting-Verlauf dagegen abgleichen.
                </p>
              </article>
              <article className="card agenda-flow-card">
                <h2>Workflow</h2>
                <ol>
                  <li>Agenda entwerfen oder bestehende Agenda einpflegen.</li>
                  <li>Vorbereitung, kritische Fragen und Risikosignale erzeugen.</li>
                  <li>Nach dem Meeting Transkript oder Notizen einfügen und mit der Agenda abgleichen.</li>
                </ol>
              </article>
            </div>

            <form className="card form-grid" onSubmit={handleAgenda}>
              <Field label="Meeting-Titel">
                <input value={agendaInput.title} onChange={(event) => setAgendaInput({ ...agendaInput, title: event.target.value })} />
              </Field>
              <Field label="Dauer">
                <input placeholder="z. B. 60 Minuten" value={agendaInput.duration} onChange={(event) => setAgendaInput({ ...agendaInput, duration: event.target.value })} />
              </Field>
              <Field label="Ziel des Meetings">
                <textarea value={agendaInput.meetingGoal} onChange={(event) => setAgendaInput({ ...agendaInput, meetingGoal: event.target.value })} />
              </Field>
              <Field label="Gewünschtes Ergebnis">
                <textarea value={agendaInput.desiredOutcome} onChange={(event) => setAgendaInput({ ...agendaInput, desiredOutcome: event.target.value })} />
              </Field>
              <Field label="Teilnehmer und Rollen">
                <textarea value={agendaInput.participants} onChange={(event) => setAgendaInput({ ...agendaInput, participants: event.target.value })} />
              </Field>
              <Field label="Neue Agenda-Idee">
                <textarea placeholder="Agenda-Punkte grob skizzieren, falls noch keine fertige Agenda existiert." value={agendaInput.agendaText} onChange={(event) => setAgendaInput({ ...agendaInput, agendaText: event.target.value })} />
              </Field>
              <div className="field agenda-upload-field">
                <span>Bestehende Agenda</span>
                <textarea placeholder="Bestehende Agenda hier einfügen oder eine Text-/Markdown-Datei hochladen." value={agendaInput.existingAgenda} onChange={(event) => setAgendaInput({ ...agendaInput, existingAgenda: event.target.value })} />
                <div className="agenda-file-actions">
                  <label className="secondary-button agenda-file-upload">
                    <Upload size={17} aria-hidden="true" />
                    Agenda-Datei hochladen
                    <input accept=".txt,.md,.markdown,text/plain,text/markdown" onChange={(event) => handleAgendaFileUpload(event.target.files?.[0] ?? null)} type="file" />
                  </label>
                  <p>{agendaFileStatus}</p>
                </div>
                <p className="field-help">Aktuell direkt lesbar: .txt und .md. Word- und PDF-Dateien folgen als eigener Ausbauschritt.</p>
              </div>
              <Field label="Transkript oder Ergebnisnotizen für späteren Abgleich">
                <textarea placeholder="Nach dem Meeting Transkript, Rohnotizen oder Ergebnisprotokoll einfügen." value={agendaInput.comparisonText} onChange={(event) => setAgendaInput({ ...agendaInput, comparisonText: event.target.value })} />
              </Field>
              <div className="form-actions agenda-actions">
                <button className="primary-button" type="submit"><ListChecks size={17} /> Agenda prüfen</button>
                <button
                  className="secondary-button"
                  disabled={!transcriptText}
                  onClick={() => setAgendaInput({ ...agendaInput, comparisonText: transcriptText })}
                  type="button"
                >
                  <FileSearch size={17} /> Aktuelles Transkript übernehmen
                </button>
              </div>
            </form>

            {loadingAction === "agenda" && <LoadingIndicator label="KI prüft Agenda und Abgleich ..." />}
            {agenda && (
              <>
                <div className="analysis-lane">
                  <h2>Strukturierte Agenda</h2>
                  <div className="agenda-table">
                    {agenda.refinedAgenda.map((item) => (
                      <article className="agenda-item" key={`${item.topic}-${item.owner}`}>
                        <div>
                          <h3>{item.topic}</h3>
                          <p>{item.goal}</p>
                        </div>
                        <dl>
                          <div>
                            <dt>Owner</dt>
                            <dd>{item.owner}</dd>
                          </div>
                          <div>
                            <dt>Zeit</dt>
                            <dd>{item.timeBudget}</dd>
                          </div>
                          <div>
                            <dt>Erwartetes Ergebnis</dt>
                            <dd>{item.expectedDecision}</dd>
                          </div>
                        </dl>
                      </article>
                    ))}
                  </div>
                </div>

                <div className="result-grid">
                  <ResultSection title="Qualitätsprüfung" items={agenda.qualityChecks} />
                  <ResultSection title="Vorbereitungsfragen" items={agenda.preparationQuestions} />
                  <ResultSection title="Risikosignale" items={agenda.riskSignals} />
                  <section className="result-block">
                    <h3>Sendefähiger Agenda-Entwurf</h3>
                    <pre className="mail-draft">{agenda.sendableAgendaDraft}</pre>
                    <button className="secondary-button" type="button">
                      <Send size={17} /> Versand später anbinden
                    </button>
                  </section>
                </div>

                <div className="analysis-lane">
                  <h2>Agenda-Abgleich nach dem Meeting</h2>
                  <div className="result-grid">
                    <ResultSection title="Behandelte Punkte" items={agenda.comparison.covered} />
                    <ResultSection title="Übersprungene Punkte" items={agenda.comparison.skipped} />
                    <ResultSection title="Neu entstandene Themen" items={agenda.comparison.newTopics} />
                    <ResultSection title="Entscheidungen je Agenda-Punkt" items={agenda.comparison.decisions} />
                    <ResultSection title="Follow-up" items={agenda.comparison.followUps} />
                  </div>
                </div>
              </>
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
                <div className="transcript-analysis-hero">
                  <section className="result-block">
                    <h3>Rohtranskript</h3>
                    <pre className="transcript-raw">{transcriptText}</pre>
                  </section>
                  <section className="result-block">
                    <h3>Management Summary</h3>
                    <p>{transcript.managementSummary}</p>
                  </section>
                  <section className="result-block result-block--wide">
                    <h3>Automatische Zusammenfassung</h3>
                    <p>{transcript.summary}</p>
                  </section>
                </div>
                <div className="analysis-lane">
                  <h2>Entscheidungen</h2>
                  <div className="result-grid">
                    <ResultSection title="Getroffene Entscheidungen" items={transcript.decisions} />
                    <ResultSection title="Vertagte Entscheidungen" items={transcript.deferredDecisions} />
                    <ResultSection title="Entscheidungsgrundlage" items={transcript.decisionBasis} />
                    <ResultSection title="Offene Voraussetzungen" items={transcript.openPoints} />
                  </div>
                </div>
                <div className="analysis-lane">
                  <h2>Nicht Gesagtes & Risiken</h2>
                  <div className="result-grid">
                    <ResultSection title="Was wurde nicht gesagt?" items={transcript.unsaid} />
                    <ResultSection title="Nicht angesprochene Themen" items={transcript.avoidedTopics} />
                    <ResultSection title="Widersprüche" items={transcript.contradictions} />
                    <ResultSection title="Offene Risiken" items={transcript.openRisks} />
                  </div>
                </div>
                <div className="analysis-lane">
                  <h2>Simulation von Gegenargumenten</h2>
                  <div className="result-grid">
                    {Object.entries(transcript.counterArguments).map(([role, items]) => (
                      <ResultSection key={role} title={role} items={items} />
                    ))}
                  </div>
                </div>
                <div className="analysis-lane">
                  <h2>Maßnahmenplan</h2>
                  <div className="action-plan-list">
                    {transcript.actionPlan.map((item) => (
                      <article className="action-plan-item" key={`${item.task}-${item.owner}`}>
                        <div>
                          <h3>{item.task}</h3>
                          <p>{item.risk}</p>
                        </div>
                        <dl>
                          <div>
                            <dt>Owner</dt>
                            <dd>{item.owner}</dd>
                          </div>
                          <div>
                            <dt>Frist</dt>
                            <dd>{item.due}</dd>
                          </div>
                          <div>
                            <dt>Priorität</dt>
                            <dd>{item.priority}</dd>
                          </div>
                        </dl>
                      </article>
                    ))}
                  </div>
                </div>
                <div className="result-grid">
                  <ResultSection title="Was wurde gesagt?" items={transcript.said} />
                  <ResultSection title="Aufgaben / Verantwortliche" items={transcript.tasks} />
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
                <select
                  value={apiProvider}
                  onChange={(event) => {
                    setApiProvider(event.target.value as "anthropic" | "openai");
                    setAnthropicConnectionState("disconnected");
                    setAnthropicStatusText("Nicht verbunden");
                  }}
                >
                  <option value="anthropic">Anthropic</option>
                  <option value="openai">OpenAI</option>
                </select>
              </div>
              <div className="settings-connection-panel">
                <div>
                  <h3>{apiProvider === "anthropic" ? "Anthropic" : "OpenAI"} API-Verbindung</h3>
                  <p>
                    Der Schlüssel wird aktuell nur lokal im Eingabefeld geprüft. Es wird noch keine Anfrage
                    an den Anbieter gesendet.
                  </p>
                </div>
                <div className="setting-row">
                  <span>{apiProvider === "anthropic" ? "Anthropic" : "OpenAI"} API-Schlüssel</span>
                  <div className="api-key-field">
                    <input
                      autoComplete="off"
                      placeholder={apiProvider === "anthropic" ? "sk-ant-..." : "sk-..."}
                      type={isApiKeyVisible ? "text" : "password"}
                      value={anthropicApiKey}
                      onChange={(event) => {
                        setAnthropicApiKey(event.target.value);
                        if (anthropicConnectionState !== "disconnected") {
                          setAnthropicConnectionState("disconnected");
                          setAnthropicStatusText("Nicht verbunden");
                        }
                      }}
                    />
                    <button
                      aria-label={isApiKeyVisible ? "API-Schlüssel ausblenden" : "API-Schlüssel einblenden"}
                      className="api-key-toggle"
                      onClick={() => setIsApiKeyVisible((currentValue) => !currentValue)}
                      type="button"
                    >
                      {isApiKeyVisible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                    </button>
                  </div>
                </div>
                <div className="settings-actions">
                  <button className="primary-button" onClick={connectAiProvider} type="button">
                    <Sparkles size={17} /> Verbinden
                  </button>
                  <button className="secondary-button" onClick={disconnectAnthropic} type="button">
                    <Square size={16} /> Trennen
                  </button>
                  <span className={`connection-state connection-state--${anthropicConnectionState}`}>
                    {anthropicStatusText}
                  </span>
                </div>
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
