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
  HardDrive,
  ListChecks,
  Menu,
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
  AiResultMeta,
  AiServiceConfig,
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
  AiQualityReview,
  DecisionChallengeResult,
  MeetingPatternsResult,
  MeetingArchive,
  MeetingActionHistoryEvent,
  MeetingArchiveTimelineEvent,
  MeetingPreparationInput,
  MeetingPreparationResult,
  MeetingType,
  MeetingScenario,
  MultiMeetingArchiveAnalysisResult,
  StakeholderAnalysisResult,
  TranscriptionResult,
  TranscriptAnalysisResult
} from "@/types/ai";

type MicrophonePermissionState = PermissionState | "unbekannt" | "nicht unterstützt";

type FileSystemWritableFileStream = WritableStream & {
  write: (data: BlobPart) => Promise<void>;
  close: () => Promise<void>;
};

type FileSystemFileHandle = {
  kind: "file";
  name: string;
  getFile: () => Promise<File>;
  createWritable: () => Promise<FileSystemWritableFileStream>;
};

type FileSystemDirectoryHandle = {
  kind: "directory";
  name: string;
  values: () => AsyncIterable<FileSystemFileHandle | FileSystemDirectoryHandle>;
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<FileSystemFileHandle>;
};

type FileSystemAccessWindow = Window & {
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
};

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
  | "workflow"
  | "record"
  | "archives"
  | "projects"
  | "reports"
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
  { id: "workflow", label: "Meeting starten", icon: PlayCircle },
  { id: "record", label: "Audio & Transkription", icon: Mic },
  { id: "archives", label: "Projektakten", icon: Archive },
  { id: "projects", label: "Maßnahmen & Projekte", icon: ListChecks },
  { id: "reports", label: "Reporting & Export", icon: FileText },
  { id: "agenda", label: "Agenda planen", icon: ListChecks },
  { id: "prepare", label: "Meeting vorbereiten", icon: ClipboardCheck },
  { id: "decision", label: "Entscheidung prüfen", icon: ShieldQuestion },
  { id: "simulate", label: "Meeting simulieren", icon: PlayCircle },
  { id: "transcript", label: "Transkript analysieren", icon: FileSearch },
  { id: "stakeholder", label: "Stakeholder analysieren", icon: Users },
  { id: "patterns", label: "Meeting-Muster erkennen", icon: BarChart3 },
  { id: "settings", label: "Einstellungen", icon: Settings }
] as const;

const navGroups = [
  {
    label: "Start",
    items: ["dashboard", "workflow"]
  },
  {
    label: "Vorbereiten",
    items: ["agenda", "prepare", "simulate", "decision", "stakeholder"]
  },
  {
    label: "Durchführen",
    items: ["record", "transcript"]
  },
  {
    label: "Steuern & Reporting",
    items: ["archives", "projects", "patterns", "reports", "settings"]
  }
] as const satisfies Array<{ label: string; items: readonly AreaId[] }>;

const meetingStartTypeTemplates: Record<MeetingStartType, {
  label: string;
  focus: string;
  prompts: string[];
  agendaHint: string;
  preparationHint: string;
}> = {
  entscheidung: {
    label: "Entscheidung",
    focus: "Beschlussreife, Entscheidungsoptionen, Risiken und klare Verantwortlichkeiten.",
    prompts: [
      "Welche Entscheidung soll am Ende verbindlich getroffen werden?",
      "Welche Alternativen stehen realistisch zur Auswahl?",
      "Welche Risiken oder Abhängigkeiten könnten die Entscheidung kippen?"
    ],
    agendaHint: "Optionen, Entscheidungskriterien, Risiken, Beschlussvorschlag und Verantwortlichkeiten explizit einplanen.",
    preparationHint: "Devil's Advocate vorbereiten, Entscheidungsgrundlage schärfen und Gegenargumente aus Governance-Sicht antizipieren."
  },
  eskalation: {
    label: "Eskalation",
    focus: "Blockaden, Verantwortungsfragen, Entscheidungsbedarf und Deeskalation.",
    prompts: [
      "Welche Blockade muss konkret gelöst werden?",
      "Welche Parteien sehen die Lage unterschiedlich?",
      "Welche Entscheidung oder Ressource wird zur Lösung benötigt?"
    ],
    agendaHint: "Sachlage, Konfliktlinien, Entscheidungsbedarf, Lösungsoptionen und verbindliche nächste Schritte trennen.",
    preparationHint: "Fakten von Bewertungen trennen, Eskalationslogik begründen und deeskalierende Formulierungen vorbereiten."
  },
  status: {
    label: "Status",
    focus: "Fortschritt, Abweichungen, Risiken, offene Punkte und nächste Maßnahmen.",
    prompts: [
      "Welche Fortschritte müssen berichtet werden?",
      "Wo gibt es Planabweichungen oder Risiken?",
      "Welche offenen Punkte benötigen Entscheidungen oder Owner?"
    ],
    agendaHint: "Status, Abweichungen, Risiken, Entscheidungen und Maßnahmen nacheinander prüfen.",
    preparationHint: "Ampellogik, klare Abweichungsbegründung und präzise Maßnahmenvorschläge vorbereiten."
  },
  verhandlung: {
    label: "Verhandlung",
    focus: "Interessen, Konzessionen, Verhandlungsgrenzen und Anschlussfähigkeit.",
    prompts: [
      "Was ist das gewünschte Verhandlungsergebnis?",
      "Welche rote Linie darf nicht überschritten werden?",
      "Welche Gegenleistung oder Konzession ist realistisch?"
    ],
    agendaHint: "Interessen, Positionen, Optionen, Grenzen und Abschlussformulierung sauber strukturieren.",
    preparationHint: "Stakeholder-Interessen, Trigger, rote Linien und anschlussfähige Formulierungen vorbereiten."
  },
  strategie: {
    label: "Strategie",
    focus: "Zielbild, Optionen, Prioritäten, Trade-offs und strategische Konsequenzen.",
    prompts: [
      "Welches strategische Zielbild soll geschärft werden?",
      "Welche Optionen oder Szenarien stehen im Raum?",
      "Welche langfristigen Konsequenzen sind kritisch?"
    ],
    agendaHint: "Zielbild, strategische Optionen, Bewertungskriterien, Trade-offs und nächste Entscheidungsstufe einplanen.",
    preparationHint: "Szenarien, Gegenargumente, strategische Risiken und klare Entscheidungshypothesen vorbereiten."
  }
};

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
const AI_SETTINGS_STORAGE_KEY = "meeting-intelligence-ki.ai-settings.v1";
const MEETING_SUGGESTIONS_STORAGE_KEY = "meeting-intelligence-ki.suggestions.v1";
const OPENAI_AUDIO_UPLOAD_LIMIT_MB = 25;

type AiProvider = "anthropic" | "openai";
type AiMode = "mock" | "api";
type MeetingStatus = "geplant" | "aufgenommen" | "transkribiert" | "analysiert" | "abgeschlossen";
type MeetingStartType = MeetingType;

type MeetingMetadataForm = {
  title: string;
  project: string;
  date: string;
  participants: string;
  goal: string;
  desiredOutcome: string;
  status: MeetingStatus;
};

type MeetingStartDraft = {
  meetingType: MeetingStartType;
  title: string;
  project: string;
  context: string;
  goal: string;
  participants: string;
  desiredOutcome: string;
  criticalTopics: string;
  ownPosition: string;
  duration: string;
  typeSpecificNotes: string;
};

type AiConsentDialog = {
  title: string;
  description: string;
  providerLabel: string;
  resolve: (approved: boolean) => void;
};

type StoredAiSettings = {
  provider: AiProvider;
  mode: AiMode;
  apiKey: string;
};

type MeetingSuggestionKey = "titles" | "projects" | "goals" | "participants" | "outcomes" | "criticalTopics" | "ownPositions" | "durations";
type MeetingSuggestions = Record<MeetingSuggestionKey, string[]>;

type ExportKind = "management" | "actions" | "decision" | "full";
type ActionPlanItem = TranscriptAnalysisResult["actionPlan"][number];
type ActionPlanStatus = NonNullable<ActionPlanItem["status"]>;

const createInitialMeetingMetadata = (): MeetingMetadataForm => ({
  title: "Neue Meeting-Akte",
  project: "",
  date: new Date().toISOString().slice(0, 10),
  participants: "",
  goal: "",
  desiredOutcome: "",
  status: "geplant"
});

const createInitialMeetingStartDraft = (): MeetingStartDraft => ({
  meetingType: "entscheidung",
  title: "",
  project: "",
  context: "",
  goal: "",
  participants: "",
  desiredOutcome: "",
  criticalTopics: "",
  ownPosition: "",
  duration: "60 Minuten",
  typeSpecificNotes: ""
});

const createEmptyMeetingSuggestions = (): MeetingSuggestions => ({
  titles: [],
  projects: [],
  goals: [],
  participants: [],
  outcomes: [],
  criticalTopics: [],
  ownPositions: [],
  durations: []
});

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

function loadAiSettingsFromStorage(): StoredAiSettings {
  if (typeof window === "undefined") {
    return { provider: "anthropic", mode: "mock", apiKey: "" };
  }

  try {
    const storedSettings = window.localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
    if (!storedSettings) {
      return { provider: "anthropic", mode: "mock", apiKey: "" };
    }

    const parsedSettings = JSON.parse(storedSettings) as Partial<StoredAiSettings>;
    const provider = parsedSettings.provider === "openai" ? "openai" : "anthropic";
    const mode = parsedSettings.mode === "api" ? "api" : "mock";
    return {
      provider,
      mode,
      apiKey: parsedSettings.apiKey ?? ""
    };
  } catch {
    return { provider: "anthropic", mode: "mock", apiKey: "" };
  }
}

function loadMeetingSuggestionsFromStorage(): MeetingSuggestions {
  if (typeof window === "undefined") {
    return createEmptyMeetingSuggestions();
  }

  try {
    const storedSuggestions = window.localStorage.getItem(MEETING_SUGGESTIONS_STORAGE_KEY);
    if (!storedSuggestions) {
      return createEmptyMeetingSuggestions();
    }

    const parsedSuggestions = JSON.parse(storedSuggestions) as Partial<MeetingSuggestions>;
    const emptySuggestions = createEmptyMeetingSuggestions();
    return Object.fromEntries(
      Object.keys(emptySuggestions).map((key) => {
        const suggestionKey = key as MeetingSuggestionKey;
        return [suggestionKey, Array.isArray(parsedSuggestions[suggestionKey]) ? parsedSuggestions[suggestionKey]!.filter(Boolean).slice(0, 12) : []];
      })
    ) as MeetingSuggestions;
  } catch {
    return createEmptyMeetingSuggestions();
  }
}

type SuggestedFieldProps = {
  label: string;
  suggestionKey: MeetingSuggestionKey;
  suggestions: string[];
  value: string;
  onChange: (value: string) => void;
  onDeleteSuggestion: (key: MeetingSuggestionKey, value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  inputType?: string;
};

function SuggestedField({
  label,
  suggestionKey,
  suggestions,
  value,
  onChange,
  onDeleteSuggestion,
  placeholder,
  multiline = false,
  inputType = "text"
}: SuggestedFieldProps) {
  return (
    <div className="field suggested-field">
      <span>{label}</span>
      {multiline ? (
        <textarea placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input placeholder={placeholder} type={inputType} value={value} onChange={(event) => onChange(event.target.value)} />
      )}
      {suggestions.length > 0 && (
        <div className="suggestion-controls">
          <select aria-label={`${label} aus Vorschlägen übernehmen`} value="" onChange={(event) => event.target.value && onChange(event.target.value)}>
            <option value="">Vorschlag übernehmen</option>
            {suggestions.map((suggestion) => (
              <option key={suggestion} value={suggestion}>{suggestion}</option>
            ))}
          </select>
          <div className="suggestion-chips" aria-label={`${label} Vorschläge verwalten`}>
            {suggestions.slice(0, 5).map((suggestion) => (
              <span className="suggestion-chip" key={suggestion}>
                <button onClick={() => onChange(suggestion)} title={suggestion} type="button">{suggestion}</button>
                <button aria-label={`Vorschlag ${suggestion} löschen`} onClick={() => onDeleteSuggestion(suggestionKey, suggestion)} type="button">x</button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
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

function hasMeaningfulText(value: string | undefined, minLength = 8) {
  return Boolean(value && value.trim().length >= minLength);
}

function getMeetingTypeLabel(type?: MeetingType) {
  return type ? meetingStartTypeTemplates[type]?.label ?? "nicht klassifiziert" : "nicht klassifiziert";
}

function classifyDueDate(due: string, status: ActionPlanStatus) {
  if (status === "Erledigt") {
    return { label: "erledigt", level: "done" as const };
  }

  const normalized = due.trim().toLowerCase();
  const explicitDate = normalized.match(/(\d{4}-\d{2}-\d{2})|(\d{1,2}\.\d{1,2}\.\d{2,4})/);
  let date: Date | null = null;

  if (explicitDate?.[1]) {
    date = new Date(explicitDate[1]);
  } else if (explicitDate?.[2]) {
    const [day, month, year] = explicitDate[2].split(".");
    date = new Date(Number(year.length === 2 ? `20${year}` : year), Number(month) - 1, Number(day));
  }

  if (!date || Number.isNaN(date.getTime())) {
    return { label: "ohne klare Frist", level: "unknown" as const };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  const days = Math.round((date.getTime() - today.getTime()) / 86400000);

  if (days < 0) {
    return { label: `${Math.abs(days)} Tage überfällig`, level: "overdue" as const };
  }
  if (days <= 3) {
    return { label: `${days} Tage`, level: "soon" as const };
  }

  return { label: `${days} Tage`, level: "planned" as const };
}

export default function Home() {
  const initialAiSettings = useMemo(() => loadAiSettingsFromStorage(), []);
  const [activeArea, setActiveArea] = useState<AreaId>("dashboard");
  const [meetingMetadata, setMeetingMetadata] = useState<MeetingMetadataForm>(createInitialMeetingMetadata);
  const [meetingStartDraft, setMeetingStartDraft] = useState<MeetingStartDraft>(createInitialMeetingStartDraft);
  const [meetingSuggestions, setMeetingSuggestions] = useState<MeetingSuggestions>(loadMeetingSuggestionsFromStorage);
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
  const [transcriptionError, setTranscriptionError] = useState("");
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
  const [currentArchiveId, setCurrentArchiveId] = useState(() => `meeting-${Date.now()}`);
  const [archiveSearch, setArchiveSearch] = useState("");
  const [archiveProjectFilter, setArchiveProjectFilter] = useState("alle");
  const [archiveStatusFilter, setArchiveStatusFilter] = useState<MeetingStatus | "alle">("alle");
  const [archiveMeetingTypeFilter, setArchiveMeetingTypeFilter] = useState<MeetingType | "alle" | "nicht klassifiziert">("alle");
  const [actionSearch, setActionSearch] = useState("");
  const [actionProjectFilter, setActionProjectFilter] = useState("alle");
  const [actionStatusFilter, setActionStatusFilter] = useState<ActionPlanStatus | "alle">("alle");
  const [actionPriorityFilter, setActionPriorityFilter] = useState<ActionPlanItem["priority"] | "alle">("alle");
  const [selectedArchiveId, setSelectedArchiveId] = useState<string | null>(null);
  const [fileSystemDirectoryHandle, setFileSystemDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [fileSystemStatus, setFileSystemStatus] = useState("Noch kein lokaler Ordner verbunden.");
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
  const [apiProvider, setApiProvider] = useState<AiProvider>(initialAiSettings.provider);
  const [aiMode, setAiMode] = useState<AiMode>(initialAiSettings.mode);
  const [anthropicApiKey, setAnthropicApiKey] = useState(initialAiSettings.apiKey);
  const [isApiKeyVisible, setIsApiKeyVisible] = useState(false);
  const [anthropicConnectionState, setAnthropicConnectionState] = useState<"disconnected" | "connected" | "error">(initialAiSettings.apiKey ? "connected" : "disconnected");
  const [anthropicStatusText, setAnthropicStatusText] = useState(initialAiSettings.apiKey ? "Verbindung ok" : "Nicht verbunden");
  const [aiSettingsStatus, setAiSettingsStatus] = useState(initialAiSettings.apiKey ? "Gespeicherter Schlüssel lokal geladen." : "Noch kein API-Schlüssel lokal gespeichert.");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [aiConsentDialog, setAiConsentDialog] = useState<AiConsentDialog | null>(null);
  const [lastAiResultMeta, setLastAiResultMeta] = useState<AiResultMeta | null>(null);
  const meetingStartTemplate = meetingStartTypeTemplates[meetingStartDraft.meetingType];

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
  const currentMeetingTitle = meetingMetadata.title.trim() || "Neue Meeting-Akte";
  const aiStatusLabel = aiMode === "api" && anthropicConnectionState === "connected"
    ? `${apiProvider === "anthropic" ? "Anthropic" : "OpenAI"} bereit`
    : "Mock-KI aktiv";
  const activeAiConfig: AiServiceConfig = {
    mode: aiMode,
    provider: aiMode === "api" ? apiProvider : "mock",
    apiKey: anthropicApiKey.trim(),
    onResultMeta: setLastAiResultMeta
  };
  const audioSizeLabel = audioBlob ? `${(audioBlob.size / 1024 / 1024).toFixed(2)} MB` : "";
  const activeChunkNumber = recordingMode === "long"
    ? Math.max(1, Math.floor(recordingSeconds / (chunkLengthMinutes * 60)) + 1)
    : 1;
  const completedChunkCount = recordingMode === "long"
    ? Math.max(0, Math.floor(recordingSeconds / (chunkLengthMinutes * 60)))
    : 0;
  const isFileSystemAccessSupported = typeof window !== "undefined" && "showDirectoryPicker" in window;
  const archiveProjects = useMemo(() => {
    const projects = savedArchives
      .map((archive) => archive.metadata.project?.trim())
      .filter((project): project is string => Boolean(project));
    return Array.from(new Set(projects)).sort((first, second) => first.localeCompare(second, "de"));
  }, [savedArchives]);
  const archiveMeetingTypes = useMemo(() => {
    const types = savedArchives
      .map((archive) => archive.metadata.meetingType)
      .filter((type): type is MeetingType => Boolean(type));
    return Array.from(new Set(types)).sort((first, second) => getMeetingTypeLabel(first).localeCompare(getMeetingTypeLabel(second), "de"));
  }, [savedArchives]);
  const filteredArchives = useMemo(() => {
    const query = archiveSearch.trim().toLowerCase();

    return savedArchives.filter((archive) => {
      const project = archive.metadata.project?.trim() || "";
      const statusMatches = archiveStatusFilter === "alle" || archive.metadata.status === archiveStatusFilter;
      const projectMatches = archiveProjectFilter === "alle" || project === archiveProjectFilter;
      const meetingTypeMatches = archiveMeetingTypeFilter === "alle"
        || archive.metadata.meetingType === archiveMeetingTypeFilter
        || (archiveMeetingTypeFilter === "nicht klassifiziert" && !archive.metadata.meetingType);
      const searchText = [
        archive.metadata.title,
        project,
        getMeetingTypeLabel(archive.metadata.meetingType),
        archive.metadata.date,
        archive.metadata.status,
        archive.metadata.participants,
        archive.metadata.goal,
        archive.metadata.desiredOutcome,
        archive.transcription.rawText,
        archive.transcriptAnalysis?.managementSummary,
        archive.transcriptAnalysis?.decisions.join(" "),
        archive.transcriptAnalysis?.openPoints.join(" "),
        archive.transcriptAnalysis?.actionPlan.map((item) => `${item.task} ${item.owner} ${item.risk}`).join(" ")
      ].filter(Boolean).join(" ").toLowerCase();
      const queryMatches = !query || searchText.includes(query);

      return statusMatches && projectMatches && meetingTypeMatches && queryMatches;
    });
  }, [archiveMeetingTypeFilter, archiveProjectFilter, archiveSearch, archiveStatusFilter, savedArchives]);
  const allArchiveActions = useMemo(() => savedArchives.flatMap((archive) => (
    archive.transcriptAnalysis?.actionPlan.map((action, index) => ({
      ...action,
      status: action.status ?? "Offen" as ActionPlanStatus,
      dueState: classifyDueDate(action.due, action.status ?? "Offen"),
      archiveId: archive.id,
      archiveTitle: archive.metadata.title,
      archiveDate: archive.metadata.date,
      project: archive.metadata.project?.trim() || "ohne Projekt",
      index
    })) ?? []
  )), [savedArchives]);
  const filteredArchiveActions = useMemo(() => {
    const query = actionSearch.trim().toLowerCase();

    return allArchiveActions.filter((action) => {
      const projectMatches = actionProjectFilter === "alle" || action.project === actionProjectFilter;
      const statusMatches = actionStatusFilter === "alle" || action.status === actionStatusFilter;
      const priorityMatches = actionPriorityFilter === "alle" || action.priority === actionPriorityFilter;
      const queryText = [
        action.task,
        action.owner,
        action.due,
        action.priority,
        action.status,
        action.risk,
        action.archiveTitle,
        action.project
      ].join(" ").toLowerCase();
      const queryMatches = !query || queryText.includes(query);

      return projectMatches && statusMatches && priorityMatches && queryMatches;
    });
  }, [actionPriorityFilter, actionProjectFilter, actionSearch, actionStatusFilter, allArchiveActions]);
  const actionSummary = useMemo(() => ({
    total: allArchiveActions.length,
    open: allArchiveActions.filter((action) => action.status === "Offen").length,
    inProgress: allArchiveActions.filter((action) => action.status === "In Arbeit").length,
    blocked: allArchiveActions.filter((action) => action.status === "Blockiert").length,
    done: allArchiveActions.filter((action) => action.status === "Erledigt").length,
    overdue: allArchiveActions.filter((action) => action.dueState.level === "overdue").length,
    soon: allArchiveActions.filter((action) => action.dueState.level === "soon").length
  }), [allArchiveActions]);
  const projectDashboard = useMemo(() => {
    const projects = new Map<string, {
      project: string;
      meetings: number;
      openActions: number;
      blockedActions: number;
      openDecisions: number;
      risks: number;
    }>();

    savedArchives.forEach((archive) => {
      const project = archive.metadata.project?.trim() || "ohne Projekt";
      const current = projects.get(project) ?? { project, meetings: 0, openActions: 0, blockedActions: 0, openDecisions: 0, risks: 0 };
      const actions = archive.transcriptAnalysis?.actionPlan ?? [];
      current.meetings += 1;
      current.openActions += actions.filter((action) => (action.status ?? "Offen") !== "Erledigt").length;
      current.blockedActions += actions.filter((action) => action.status === "Blockiert").length;
      current.openDecisions += archive.transcriptAnalysis?.deferredDecisions.length ?? 0;
      current.risks += archive.transcriptAnalysis?.openRisks.length ?? 0;
      projects.set(project, current);
    });

    return Array.from(projects.values()).sort((first, second) => first.project.localeCompare(second.project, "de"));
  }, [savedArchives]);
  const reviewItems = useMemo(() => {
    const sourceArchives = filteredArchives.length ? filteredArchives : savedArchives;
    const openActions = allArchiveActions
      .filter((action) => action.status !== "Erledigt")
      .slice(0, 5)
      .map((action) => `${action.project}: ${action.task} (${action.owner}, ${action.status})`);
    const openRisks = sourceArchives.flatMap((archive) => archive.transcriptAnalysis?.openRisks.map((risk) => `${archive.metadata.title}: ${risk}`) ?? []).slice(0, 5);
    const questions = sourceArchives.flatMap((archive) => archive.transcriptAnalysis?.followUpQuestions.map((question) => `${archive.metadata.title}: ${question}`) ?? []).slice(0, 5);
    const stakeholderNotes = sourceArchives.flatMap((archive) => archive.stakeholderAnalysis?.conversationStrategy.map((item) => `${archive.metadata.title}: ${item}`) ?? []).slice(0, 5);

    return { openActions, openRisks, questions, stakeholderNotes };
  }, [allArchiveActions, filteredArchives, savedArchives]);
  const selectedArchive = useMemo(() => {
    if (!selectedArchiveId) {
      return filteredArchives[0] ?? savedArchives[0] ?? null;
    }

    return savedArchives.find((archive) => archive.id === selectedArchiveId) ?? filteredArchives[0] ?? null;
  }, [filteredArchives, savedArchives, selectedArchiveId]);
  const selectedArchiveTimeline = selectedArchive ? getArchiveTimeline(selectedArchive) : [];
  const persistMeetingSuggestions = useCallback((nextSuggestions: MeetingSuggestions) => {
    setMeetingSuggestions(nextSuggestions);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(MEETING_SUGGESTIONS_STORAGE_KEY, JSON.stringify(nextSuggestions));
    }
  }, []);
  const rememberMeetingSuggestionValues = useCallback((values: Partial<Record<MeetingSuggestionKey, string | string[]>>) => {
    setMeetingSuggestions((currentSuggestions) => {
      const nextSuggestions = { ...currentSuggestions };

      (Object.entries(values) as Array<[MeetingSuggestionKey, string | string[] | undefined]>).forEach(([key, rawValue]) => {
        const valuesToStore = (Array.isArray(rawValue) ? rawValue : [rawValue])
          .map((value) => value?.trim())
          .filter((value): value is string => Boolean(value && value.length >= 3));

        if (valuesToStore.length === 0) {
          return;
        }

        const existing = nextSuggestions[key].filter((item) => !valuesToStore.some((value) => value.toLowerCase() === item.toLowerCase()));
        nextSuggestions[key] = [...valuesToStore, ...existing].slice(0, 12);
      });

      if (typeof window !== "undefined") {
        window.localStorage.setItem(MEETING_SUGGESTIONS_STORAGE_KEY, JSON.stringify(nextSuggestions));
      }

      return nextSuggestions;
    });
  }, []);
  const deleteMeetingSuggestion = useCallback((key: MeetingSuggestionKey, value: string) => {
    const nextSuggestions = {
      ...meetingSuggestions,
      [key]: meetingSuggestions[key].filter((item) => item !== value)
    };
    persistMeetingSuggestions(nextSuggestions);
  }, [meetingSuggestions, persistMeetingSuggestions]);
  const rememberCurrentMeetingSuggestions = useCallback(() => {
    rememberMeetingSuggestionValues({
      titles: [meetingStartDraft.title, meetingMetadata.title, agendaInput.title, preparationInput.title],
      projects: [meetingStartDraft.project, meetingMetadata.project],
      goals: [meetingStartDraft.goal, meetingMetadata.goal, agendaInput.meetingGoal, preparationInput.goal],
      participants: [meetingStartDraft.participants, meetingMetadata.participants, agendaInput.participants, preparationInput.participants],
      outcomes: [meetingStartDraft.desiredOutcome, meetingMetadata.desiredOutcome, agendaInput.desiredOutcome, preparationInput.desiredOutcome],
      criticalTopics: [meetingStartDraft.criticalTopics, preparationInput.criticalTopics],
      ownPositions: [meetingStartDraft.ownPosition, preparationInput.ownPosition],
      durations: [meetingStartDraft.duration, agendaInput.duration]
    });
  }, [agendaInput, meetingMetadata, meetingStartDraft, preparationInput, rememberMeetingSuggestionValues]);
  const qualityReview: AiQualityReview = useMemo(() => {
    const missingInputs = [
      !hasMeaningfulText(currentMeetingTitle) || currentMeetingTitle === "Neue Meeting-Akte" ? "Meeting-Titel präzisieren" : "",
      !hasMeaningfulText(meetingMetadata.goal || agendaInput.meetingGoal || preparationInput.goal) ? "Meeting-Ziel ergänzen" : "",
      !hasMeaningfulText(meetingMetadata.participants || agendaInput.participants || preparationInput.participants) ? "Teilnehmer und Rollen ergänzen" : "",
      !hasMeaningfulText(meetingMetadata.desiredOutcome || agendaInput.desiredOutcome || preparationInput.desiredOutcome) ? "Gewünschtes Ergebnis festlegen" : "",
      !hasMeaningfulText(agendaInput.existingAgenda || agendaInput.agendaText) && !agenda ? "Agenda erfassen oder erzeugen" : "",
      !hasMeaningfulText(transcriptText, 40) && !transcription ? "Rohtranskript oder Ergebnisnotizen erfassen" : "",
      !transcript ? "Transkriptanalyse erzeugen" : "",
      !decision && !transcript?.decisions.length ? "Entscheidungen prüfen oder aus Transkript ableiten" : ""
    ].filter(Boolean);
    const completedSignals = 8 - missingInputs.length;
    const score = Math.max(10, Math.min(100, Math.round((completedSignals / 8) * 100)));
    const level: AiQualityReview["level"] = score >= 75 ? "Hoch" : score >= 45 ? "Mittel" : "Niedrig";
    const assumptions = [
      lastAiResultMeta?.source === "Mock" ? "Aktuelle Ergebnisse stammen aus Mock-Logik und dienen als strukturierte Arbeitsvorlage." : "",
      lastAiResultMeta?.source === "OpenAI" ? "Letzte Textanalyse wurde über OpenAI erzeugt; Ergebnis sollte fachlich plausibilisiert werden." : "",
      lastAiResultMeta?.source === "Anthropic" ? "Letzte Textanalyse wurde über Anthropic erzeugt; Ergebnis sollte fachlich plausibilisiert werden." : "",
      transcription?.confidence === "Mock" ? "Das Transkript ist kein echtes Wortprotokoll, sondern eine Mock-Rohfassung." : "",
      !transcript ? "Maßnahmen, Entscheidungen und Risiken sind noch nicht aus einem vollständigen Transkript abgeleitet." : ""
    ].filter(Boolean);
    const reliabilityNotes = [
      `Belastbarkeit: ${level} (${score}/100).`,
      missingInputs.length ? `${missingInputs.length} zentrale Eingaben fehlen noch.` : "Zentrale Eingaben sind für eine belastbare Analyse vorhanden.",
      lastAiResultMeta?.fallback ? "Es gab einen Fallback auf Mock-KI; Ergebnis nicht als echte KI-Auswertung behandeln." : "Kein aktueller Fallback-Hinweis vorhanden.",
      audioBlob && !transcription ? "Audio liegt vor, ist aber noch nicht transkribiert." : "",
      transcript?.actionPlan.length ? "Maßnahmenplan ist vorhanden und kann exportiert werden." : "Maßnahmenplan fehlt noch oder ist leer."
    ].filter(Boolean);
    const recommendedNextChecks = [
      missingInputs[0] ?? "Management Summary und Maßnahmenplan fachlich gegenprüfen.",
      transcript?.openRisks.length ? "Offene Risiken priorisieren und Owner vergeben." : "Risikoabschnitt auf Vollständigkeit prüfen.",
      transcript?.deferredDecisions.length ? "Vertagte Entscheidungen terminieren." : "Entscheidungen explizit dokumentieren.",
      "Vor Export prüfen, ob personenbezogene Daten und Vertraulichkeit korrekt behandelt werden."
    ];

    return {
      level,
      score,
      missingInputs,
      assumptions: assumptions.length ? assumptions : ["Es werden nur lokal eingegebene Daten und die zuletzt gewählte KI-Konfiguration berücksichtigt."],
      reliabilityNotes,
      recommendedNextChecks
    };
  }, [
    agenda,
    agendaInput.agendaText,
    agendaInput.desiredOutcome,
    agendaInput.existingAgenda,
    agendaInput.meetingGoal,
    agendaInput.participants,
    audioBlob,
    currentMeetingTitle,
    decision,
    lastAiResultMeta,
    meetingMetadata.desiredOutcome,
    meetingMetadata.goal,
    meetingMetadata.participants,
    preparationInput.desiredOutcome,
    preparationInput.goal,
    preparationInput.participants,
    transcript,
    transcriptText,
    transcription
  ]);
  const workflowAssistantSteps = useMemo(() => {
    const hasAgenda = Boolean(agenda) || hasMeaningfulText(agendaInput.existingAgenda || agendaInput.agendaText, 20);
    const hasPreparation = Boolean(preparation);
    const hasRecordingInput = Boolean(audioBlob) || Boolean(transcription) || hasMeaningfulText(transcriptText, 40);
    const hasTranscriptAnalysis = Boolean(transcript);
    const hasSavedCurrentArchive = savedArchives.some((archive) => archive.id === currentArchiveId);
    const hasMeasures = Boolean(transcript?.actionPlan.length) || allArchiveActions.length > 0;
    const hasReportBase = hasTranscriptAnalysis || hasSavedCurrentArchive;
    const statusLabel = (done: boolean, ready: boolean, active = false) => {
      if (done) {
        return "erledigt";
      }

      if (active) {
        return "in Arbeit";
      }

      if (ready) {
        return "bereit";
      }

      return "offen";
    };

    return [
      {
        title: "Agenda klären",
        detail: "Meeting-Ziel, Themen, Zeitbudget und vorhandene Agenda erfassen.",
        target: "agenda" as AreaId,
        icon: ListChecks,
        status: statusLabel(hasAgenda, true),
        primaryAction: hasAgenda ? "Agenda prüfen" : "Agenda anlegen"
      },
      {
        title: "Vorbereitung schärfen",
        detail: "Argumente, Einwände, kritische Fragen und Antwortstrategien erzeugen.",
        target: "prepare" as AreaId,
        icon: ClipboardCheck,
        status: statusLabel(hasPreparation, hasAgenda || hasMeaningfulText(meetingMetadata.goal, 10)),
        primaryAction: hasPreparation ? "Vorbereitung öffnen" : "Vorbereiten"
      },
      {
        title: "Meeting durchführen",
        detail: "Audio aufnehmen, vorhandene Audiodatei nutzen oder Rohtranskript einfügen.",
        target: "record" as AreaId,
        icon: Mic,
        status: statusLabel(hasRecordingInput, hasPreparation || hasAgenda),
        primaryAction: hasRecordingInput ? "Aufnahme prüfen" : "Aufnahme starten"
      },
      {
        title: "Transkript analysieren",
        detail: "Entscheidungen, Risiken, offene Punkte, nicht Gesagtes und Maßnahmen ableiten.",
        target: "transcript" as AreaId,
        icon: FileSearch,
        status: statusLabel(hasTranscriptAnalysis, hasRecordingInput),
        primaryAction: hasTranscriptAnalysis ? "Analyse öffnen" : "Analysieren"
      },
      {
        title: "Projektakte sichern",
        detail: "Arbeitsstand lokal speichern, laden, prüfen und für spätere Analysen bereithalten.",
        target: "archives" as AreaId,
        icon: Archive,
        status: statusLabel(hasSavedCurrentArchive, hasTranscriptAnalysis || hasPreparation, !hasSavedCurrentArchive && currentArchiveId !== ""),
        primaryAction: hasSavedCurrentArchive ? "Akte öffnen" : "Akte speichern"
      },
      {
        title: "Maßnahmen steuern",
        detail: "Maßnahmenregister, Projekt-Dashboard und Review vor dem nächsten Meeting nutzen.",
        target: "projects" as AreaId,
        icon: ListChecks,
        status: statusLabel(hasMeasures, hasTranscriptAnalysis || allArchiveActions.length > 0),
        primaryAction: hasMeasures ? "Cockpit öffnen" : "Maßnahmen prüfen"
      },
      {
        title: "Reporting erzeugen",
        detail: "Management-Protokoll, Entscheidungsnotiz und Maßnahmenliste exportieren.",
        target: "reports" as AreaId,
        icon: FileText,
        status: statusLabel(false, hasReportBase),
        primaryAction: "Reporting öffnen"
      }
    ];
  }, [
    agenda,
    agendaInput.agendaText,
    agendaInput.existingAgenda,
    allArchiveActions.length,
    audioBlob,
    currentArchiveId,
    meetingMetadata.goal,
    preparation,
    savedArchives,
    transcript,
    transcriptText,
    transcription
  ]);
  const nextWorkflowStep = workflowAssistantSteps.find((step) => step.status !== "erledigt") ?? workflowAssistantSteps[workflowAssistantSteps.length - 1];
  const NextWorkflowIcon = nextWorkflowStep.icon;

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
      setTranscriptionError("");
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

  function requestAiConsent(title: string, description: string) {
    if (activeAiConfig.mode !== "api" || anthropicConnectionState !== "connected") {
      return Promise.resolve(true);
    }

    return new Promise<boolean>((resolve) => {
      setAiConsentDialog({
        title,
        description,
        providerLabel: apiProvider === "anthropic" ? "Anthropic" : "OpenAI",
        resolve
      });
    });
  }

  function closeAiConsentDialog(approved: boolean) {
    aiConsentDialog?.resolve(approved);
    setAiConsentDialog(null);
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
    setTranscriptionError("");
    setTranscriptionNotice("Audiodatei ist bereit. Klicke auf „Transkription erzeugen“.");
  }

  async function handleTranscription() {
    if (!audioBlob) {
      setTranscriptionNotice("Bitte zuerst eine Aufnahme stoppen oder eine Audiodatei hochladen.");
      return;
    }
    if (activeAiConfig.mode === "api" && activeAiConfig.provider === "openai" && audioBlob.size > OPENAI_AUDIO_UPLOAD_LIMIT_MB * 1024 * 1024) {
      setTranscriptionError(`Die Audiodatei ist größer als ${OPENAI_AUDIO_UPLOAD_LIMIT_MB} MB. Bitte lade eine kürzere Datei oder teile die Aufnahme in Abschnitte.`);
      setTranscriptionNotice("Transkription wurde nicht gestartet, weil die Datei für den aktuellen OpenAI-Upload zu groß ist.");
      return;
    }
    const approved = await requestAiConsent(
      "Audio transkribieren",
      activeAiConfig.provider === "openai"
        ? "Die ausgewählte Aufnahme wird an OpenAI übertragen, um ein echtes Rohtranskript zu erzeugen."
        : "Die ausgewählte Aufnahme würde im API-Modus an den verbundenen Anbieter übertragen, um ein Transkript zu erzeugen."
    );
    if (!approved) {
      setTranscriptionNotice("Transkription wurde abgebrochen. Es wurden keine Daten extern verarbeitet.");
      return;
    }
    setLoadingAction("transcription");
    setTranscriptionError("");
    setTranscriptionNotice(activeAiConfig.mode === "api" && activeAiConfig.provider === "openai"
      ? "Echte Transkription über OpenAI wird erzeugt ..."
      : "Transkription wird erzeugt. Aktuell nutzt die App eine Mock-Transkription.");
    try {
      const result = await transcribeMeetingAudio(audioBlob, audioSourceLabel || "Audiodatei", recordingDurationLabel, activeAiConfig);
      setTranscription(result);
      setTranscriptText(result.transcript);
      setLastAiResultMeta({
        source: result.provider,
        model: result.model,
        fallback: result.provider === "Mock" && activeAiConfig.mode === "api",
        message: result.note,
        generatedAt: new Date().toLocaleString("de-DE", {
          dateStyle: "short",
          timeStyle: "short"
        })
      });
      setTranscriptionNotice(result.provider === "OpenAI"
        ? "Echtes Transkript wurde erzeugt und zusätzlich in „Transkript analysieren“ übernommen."
        : "Mock-Transkript wurde erzeugt und zusätzlich in „Transkript analysieren“ übernommen.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Transkription konnte nicht erzeugt werden.";
      setTranscriptionError(message);
      setTranscriptionNotice("Transkription fehlgeschlagen. Bitte Einstellungen, Anbieter und Dateigröße prüfen.");
      setLastAiResultMeta({
        source: "Mock",
        model: "keine Transkription erzeugt",
        fallback: true,
        message,
        generatedAt: new Date().toLocaleString("de-DE", {
          dateStyle: "short",
          timeStyle: "short"
        })
      });
    } finally {
      setLoadingAction(null);
    }
  }

  async function handlePreparation(event: FormEvent) {
    event.preventDefault();
    rememberCurrentMeetingSuggestions();
    const approved = await requestAiConsent(
      "Meeting-Vorbereitung erzeugen",
      "Die Meeting-Ziele, Teilnehmer, Rollen, kritischen Themen und eigene Position würden im API-Modus an den verbundenen Anbieter gesendet."
    );
    if (!approved) {
      return;
    }
    setLoadingAction("preparation");
    try {
      setPreparation(await generateMeetingPreparation(preparationInput, activeAiConfig));
    } finally {
      setLoadingAction(null);
    }
  }

  function transferPreparationToSimulation() {
    const conflicts = [
      preparationInput.criticalTopics ? `Kritische Themen:\n${preparationInput.criticalTopics}` : "",
      preparation?.objections.length ? `Erwartbare Einwände:\n${preparation.objections.map((item) => `- ${item}`).join("\n")}` : "",
      preparation?.criticalQuestions.length ? `Kritische Fragen:\n${preparation.criticalQuestions.map((item) => `- ${item}`).join("\n")}` : "",
      preparationInput.ownPosition ? `Eigene Position:\n${preparationInput.ownPosition}` : ""
    ].filter(Boolean).join("\n\n");

    setSimulationInput({
      goal: preparationInput.goal || meetingMetadata.goal || agendaInput.meetingGoal,
      participants: preparationInput.participants || meetingMetadata.participants || agendaInput.participants,
      conflicts: conflicts || simulationInput.conflicts
    });
    setActiveArea("simulate");
  }

  async function handleAgenda(event: FormEvent) {
    event.preventDefault();
    rememberCurrentMeetingSuggestions();
    const approved = await requestAiConsent(
      "Agenda prüfen",
      "Agenda, Teilnehmer, Ziel, gewünschtes Ergebnis und spätere Abgleichsnotizen würden im API-Modus an den verbundenen Anbieter gesendet."
    );
    if (!approved) {
      return;
    }
    setLoadingAction("agenda");
    try {
      setAgenda(await generateAgendaWorkflow(agendaInput, activeAiConfig));
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

  function createTimelineEvent(
    id: string,
    label: string,
    timestamp: string,
    category: MeetingArchiveTimelineEvent["category"],
    status: MeetingArchiveTimelineEvent["status"],
    detail: string
  ): MeetingArchiveTimelineEvent {
    return { id, label, timestamp, category, status, detail };
  }

  function createCurrentTimeline(savedAt: string, archiveStatus: MeetingArchive["metadata"]["status"]): MeetingArchiveTimelineEvent[] {
    return [
      createTimelineEvent("akte-angelegt", "Meeting-Akte angelegt", savedAt, "Akte", "erledigt", `Status beim Speichern: ${archiveStatus}.`),
      createTimelineEvent("agenda", agenda ? "Agenda geprüft" : "Agenda noch offen", savedAt, "Agenda", agenda ? "erledigt" : "offen", agenda ? `${agenda.refinedAgenda.length} Agenda-Punkte strukturiert.` : "Noch keine Agenda-Prüfung gespeichert."),
      createTimelineEvent("vorbereitung", preparation ? "Vorbereitung erzeugt" : "Vorbereitung noch offen", savedAt, "Vorbereitung", preparation ? "erledigt" : "offen", preparation ? `${preparation.arguments.length} Argumente und ${preparation.criticalQuestions.length} kritische Fragen gespeichert.` : "Noch keine Meeting-Vorbereitung gespeichert."),
      createTimelineEvent("audio", audioSourceLabel ? "Audioquelle vorhanden" : "Audio noch offen", savedAt, "Audio", audioSourceLabel ? "erledigt" : "offen", audioSourceLabel ? `${audioSourceLabel} · ${recordingDurationLabel}.` : "Noch keine Aufnahme oder Audiodatei gespeichert."),
      createTimelineEvent("transkript", transcription || transcriptText ? "Transkript vorhanden" : "Transkript noch offen", savedAt, "Transkript", transcription || transcriptText ? "erledigt" : "offen", transcription ? `${transcription.provider} · ${transcription.model} · Qualität: ${transcription.confidence}.` : transcriptText ? "Rohtext wurde manuell eingefügt." : "Noch kein Transkript gespeichert."),
      createTimelineEvent("analyse", transcript ? "Transkriptanalyse erstellt" : "Analyse noch offen", savedAt, "Analyse", transcript ? "erledigt" : "offen", transcript ? `${transcript.openRisks.length} Risiken, ${transcript.openPoints.length} offene Punkte und ${transcript.followUpQuestions.length} Nachfragen erkannt.` : "Noch keine strategische Transkriptanalyse gespeichert."),
      createTimelineEvent("entscheidungen", decision || transcript?.decisions.length ? "Entscheidungen dokumentiert" : "Entscheidungen noch offen", savedAt, "Entscheidung", decision || transcript?.decisions.length ? "erledigt" : "offen", decision ? `Devil's Advocate: Risiko ${decision.risk.level}.` : transcript?.decisions.length ? `${transcript.decisions.length} Entscheidungen aus Transkriptanalyse gespeichert.` : "Noch keine Entscheidung dokumentiert."),
      createTimelineEvent("massnahmen", transcript?.actionPlan.length ? "Maßnahmen abgeleitet" : "Maßnahmen noch offen", savedAt, "Maßnahmen", transcript?.actionPlan.length ? "erledigt" : "offen", transcript?.actionPlan.length ? `${transcript.actionPlan.length} Maßnahmen mit Owner, Frist und Priorität gespeichert.` : "Noch kein Maßnahmenregister gespeichert."),
      createTimelineEvent("export", "Exportstand vorbereitet", savedAt, "Export", "hinweis", "JSON-, Markdown- und Management-Exporte können aus dieser Akte erzeugt werden.")
    ];
  }

  function getArchiveTimeline(archive: MeetingArchive): MeetingArchiveTimelineEvent[] {
    if (archive.timeline?.length) {
      return archive.timeline;
    }

    const savedAt = archive.savedAt;
    return [
      createTimelineEvent("akte-angelegt", "Meeting-Akte gespeichert", savedAt, "Akte", "erledigt", `Status: ${archive.metadata.status}.`),
      createTimelineEvent("agenda", archive.agenda.result || archive.agenda.input.agendaText || archive.agenda.input.existingAgenda ? "Agenda vorhanden" : "Agenda noch offen", savedAt, "Agenda", archive.agenda.result || archive.agenda.input.agendaText || archive.agenda.input.existingAgenda ? "erledigt" : "offen", archive.agenda.result ? `${archive.agenda.result.refinedAgenda.length} Agenda-Punkte strukturiert.` : "Aus älterer Akte berechnet."),
      createTimelineEvent("vorbereitung", archive.preparation.result ? "Vorbereitung vorhanden" : "Vorbereitung noch offen", savedAt, "Vorbereitung", archive.preparation.result ? "erledigt" : "offen", archive.preparation.result ? `${archive.preparation.result.arguments.length} Argumente gespeichert.` : "Keine Vorbereitung in dieser Akte."),
      createTimelineEvent("audio", archive.audio.sourceLabel ? "Audioquelle vorhanden" : "Audio noch offen", savedAt, "Audio", archive.audio.sourceLabel ? "erledigt" : "offen", archive.audio.sourceLabel ? `${archive.audio.sourceLabel} · ${archive.audio.durationLabel}.` : "Keine Audioquelle gespeichert."),
      createTimelineEvent("transkript", archive.transcription.rawText ? "Transkript vorhanden" : "Transkript noch offen", savedAt, "Transkript", archive.transcription.rawText ? "erledigt" : "offen", archive.transcription.result ? `${archive.transcription.result.provider} · ${archive.transcription.result.model}.` : "Aus älterer Akte berechnet."),
      createTimelineEvent("analyse", archive.transcriptAnalysis ? "Analyse vorhanden" : "Analyse noch offen", savedAt, "Analyse", archive.transcriptAnalysis ? "erledigt" : "offen", archive.transcriptAnalysis ? `${archive.transcriptAnalysis.openRisks.length} Risiken und ${archive.transcriptAnalysis.openPoints.length} offene Punkte gespeichert.` : "Keine Analyse in dieser Akte."),
      createTimelineEvent("entscheidungen", archive.decisionChallenge || archive.transcriptAnalysis?.decisions.length ? "Entscheidungen vorhanden" : "Entscheidungen noch offen", savedAt, "Entscheidung", archive.decisionChallenge || archive.transcriptAnalysis?.decisions.length ? "erledigt" : "offen", archive.decisionChallenge ? `Devil's Advocate: Risiko ${archive.decisionChallenge.risk.level}.` : `${archive.transcriptAnalysis?.decisions.length ?? 0} Entscheidungen gespeichert.`),
      createTimelineEvent("massnahmen", archive.transcriptAnalysis?.actionPlan.length ? "Maßnahmen vorhanden" : "Maßnahmen noch offen", savedAt, "Maßnahmen", archive.transcriptAnalysis?.actionPlan.length ? "erledigt" : "offen", `${archive.transcriptAnalysis?.actionPlan.length ?? 0} Maßnahmen gespeichert.`),
      createTimelineEvent("export", "Exportstand verfügbar", savedAt, "Export", "hinweis", "Exporte können aus der Detailansicht erzeugt werden.")
    ];
  }

  function createCurrentMeetingArchive(): MeetingArchive {
    const hasAnalysis = Boolean(transcript || agenda || preparation || decision || simulation || stakeholder || patterns);
    const status: MeetingArchive["metadata"]["status"] = transcript
      ? "analysiert"
      : transcription
        ? "transkribiert"
        : audioSourceLabel
          ? "aufgenommen"
          : hasAnalysis
            ? "analysiert"
            : meetingMetadata.status;

    const savedAt = new Date().toISOString();

    return {
      schemaVersion: 1,
      id: currentArchiveId,
      savedAt,
      appVersion: "Meeting Intelligence KI Arbeitsversion",
      metadata: {
        title: currentMeetingTitle,
        project: meetingMetadata.project.trim(),
        meetingType: meetingStartDraft.meetingType,
        date: meetingMetadata.date,
        status,
        participants: meetingMetadata.participants || agendaInput.participants || preparationInput.participants,
        goal: meetingMetadata.goal || agendaInput.meetingGoal || preparationInput.goal,
        desiredOutcome: meetingMetadata.desiredOutcome || agendaInput.desiredOutcome || preparationInput.desiredOutcome
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
      patternAnalysis: patterns,
      qualityReview,
      timeline: createCurrentTimeline(savedAt, status)
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
    rememberMeetingSuggestionValues({
      titles: archive.metadata.title,
      projects: archive.metadata.project,
      goals: archive.metadata.goal,
      participants: archive.metadata.participants,
      outcomes: archive.metadata.desiredOutcome,
      criticalTopics: archive.preparation.input.criticalTopics,
      ownPositions: archive.preparation.input.ownPosition,
      durations: archive.agenda.input.duration
    });
    const nextArchives = [
      archive,
      ...savedArchives.filter((savedArchive) => savedArchive.id !== archive.id)
    ].slice(0, 50);
    persistArchives(nextArchives);
    setArchiveStatus(`Projektakte lokal im Browser gespeichert: ${archive.metadata.title}`);
  }

  function updateArchiveActionStatus(archiveId: string, actionIndex: number, status: ActionPlanStatus) {
    const targetArchive = savedArchives.find((archive) => archive.id === archiveId);
    if (!targetArchive?.transcriptAnalysis) {
      setArchiveStatus("Status konnte nicht aktualisiert werden: Projektakte oder Maßnahmenplan fehlt.");
      return;
    }

    const nextArchives = savedArchives.map((archive) => {
      if (archive.id !== archiveId || !archive.transcriptAnalysis) {
        return archive;
      }

      return {
        ...archive,
        savedAt: new Date().toISOString(),
        transcriptAnalysis: {
          ...archive.transcriptAnalysis,
          actionPlan: archive.transcriptAnalysis.actionPlan.map((item, index) => (
            index === actionIndex ? { ...item, status } : item
          ))
        },
        timeline: [
          ...getArchiveTimeline(archive),
          createTimelineEvent(
            `massnahme-status-${Date.now()}`,
            "Maßnahmenstatus aktualisiert",
            new Date().toISOString(),
            "Maßnahmen",
            status === "Erledigt" ? "erledigt" : "hinweis",
            `Status von Maßnahme ${actionIndex + 1} wurde auf „${status}“ gesetzt.`
          )
        ],
        actionHistory: [
          ...(archive.actionHistory ?? []),
          {
            id: `action-history-${Date.now()}`,
            timestamp: new Date().toISOString(),
            actionIndex,
            actionTask: archive.transcriptAnalysis.actionPlan[actionIndex]?.task ?? `Maßnahme ${actionIndex + 1}`,
            field: "status",
            previousValue: archive.transcriptAnalysis.actionPlan[actionIndex]?.status ?? "Offen",
            nextValue: status
          } satisfies MeetingActionHistoryEvent
        ]
      };
    });

    persistArchives(nextArchives);
    if (currentArchiveId === archiveId && transcript) {
      setTranscript({
        ...transcript,
        actionPlan: transcript.actionPlan.map((item, index) => (
          index === actionIndex ? { ...item, status } : item
        ))
      });
    }
    setArchiveStatus(`Maßnahmenstatus aktualisiert: ${targetArchive.metadata.title}`);
  }

  function downloadArchive(archive: MeetingArchive) {
    downloadTextFile(JSON.stringify(archive, null, 2), createArchiveFileName(archive.metadata.title), "application/json");
    setArchiveStatus(`Projektakte vorbereitet: ${createArchiveFileName(archive.metadata.title)}. Die Datei wird über den Browser-Download gespeichert.`);
  }

  function downloadTextFile(content: string, fileName: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
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
      `Projekt: ${archive.metadata.project || "nicht zugeordnet"}`,
      `Meeting-Typ: ${getMeetingTypeLabel(archive.metadata.meetingType)}`,
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
      ...(archive.transcriptAnalysis?.actionPlan ?? []).map((item) => `- ${item.task} | Owner: ${item.owner} | Frist: ${item.due} | Priorität: ${item.priority} | Status: ${item.status ?? "Offen"}`),
      ...(archive.transcriptAnalysis?.actionPlan.length ? [] : ["Noch keine Maßnahmen gespeichert."]),
      "",
      "## Follow-up",
      archive.transcriptAnalysis?.followUpEmailDraft || "Noch kein Follow-up-Entwurf vorhanden.",
      "",
      "## Qualitätsprüfung",
      `Belastbarkeit: ${archive.qualityReview?.level ?? "nicht bewertet"} (${archive.qualityReview?.score ?? 0}/100)`,
      ...(archive.qualityReview?.reliabilityNotes ?? ["Noch keine Qualitätsnotizen vorhanden."]).map((item) => `- ${item}`),
      "",
      "## Chronologie",
      ...getArchiveTimeline(archive).map((item) => `- ${new Date(item.timestamp).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })} | ${item.category} | ${item.label}: ${item.detail}`)
    ];

    return lines.join("\n");
  }

  function downloadArchiveMarkdown(archive: MeetingArchive) {
    const fileName = createArchiveFileName(archive.metadata.title).replace(".meeting.json", ".md");
    downloadTextFile(archiveToMarkdown(archive), fileName, "text/markdown");
    setArchiveStatus(`Markdown-Export vorbereitet: ${fileName}.`);
  }

  function downloadCurrentMeetingMarkdown() {
    downloadArchiveMarkdown(createCurrentMeetingArchive());
  }

  async function connectLocalArchiveFolder() {
    const picker = (window as FileSystemAccessWindow).showDirectoryPicker;
    if (!picker) {
      setFileSystemStatus("Dieser Browser unterstützt keine direkte Ordnerablage. Nutze Download und Datei-Upload als Fallback.");
      return;
    }

    try {
      const directoryHandle = await picker();
      setFileSystemDirectoryHandle(directoryHandle);
      setFileSystemStatus(`Lokaler Ordner verbunden: ${directoryHandle.name}`);
    } catch (error) {
      const message = error instanceof Error && error.name === "AbortError"
        ? "Ordnerauswahl abgebrochen."
        : "Ordner konnte nicht verbunden werden.";
      setFileSystemStatus(message);
    }
  }

  async function saveCurrentMeetingToLocalFolder() {
    if (!fileSystemDirectoryHandle) {
      setFileSystemStatus("Bitte zuerst einen lokalen Ordner verbinden.");
      return;
    }

    const archive = createCurrentMeetingArchive();
    const fileName = createArchiveFileName(archive.metadata.title);

    try {
      const fileHandle = await fileSystemDirectoryHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(archive, null, 2));
      await writable.close();
      storeArchiveInBrowser(archive);
      setFileSystemStatus(`Projektakte im Ordner gespeichert: ${fileName}`);
    } catch {
      setFileSystemStatus("Projektakte konnte nicht in den verbundenen Ordner geschrieben werden.");
    }
  }

  async function loadMeetingArchivesFromLocalFolder() {
    if (!fileSystemDirectoryHandle) {
      setFileSystemStatus("Bitte zuerst einen lokalen Ordner verbinden.");
      return;
    }

    try {
      const importedArchives: MeetingArchive[] = [];
      for await (const entry of fileSystemDirectoryHandle.values()) {
        if (entry.kind !== "file" || !entry.name.endsWith(".meeting.json")) {
          continue;
        }

        const file = await entry.getFile();
        const archive = JSON.parse(await readTextFile(file)) as MeetingArchive;
        if (archive.schemaVersion === 1 && archive.metadata) {
          importedArchives.push(archive);
        }
      }

      if (importedArchives.length === 0) {
        setFileSystemStatus("Im verbundenen Ordner wurden keine .meeting.json-Projektakten gefunden.");
        return;
      }

      const importedIds = new Set(importedArchives.map((archive) => archive.id));
      persistArchives([
        ...importedArchives,
        ...savedArchives.filter((archive) => !importedIds.has(archive.id))
      ].slice(0, 50));
      setSelectedArchiveId(importedArchives[0]?.id ?? null);
      setLoadedArchiveNames(importedArchives.map((archive) => archive.metadata.title));
      setFileSystemStatus(`${importedArchives.length} Projektakten aus dem Ordner geladen.`);
    } catch {
      setFileSystemStatus("Projektakten konnten nicht aus dem verbundenen Ordner gelesen werden.");
    }
  }

  function archiveToProfessionalExport(archive: MeetingArchive, kind: ExportKind) {
    const title = archive.metadata.title;
    const analysis = archive.transcriptAnalysis;
    const actions = analysis?.actionPlan ?? [];
    const header = [
      `# ${kind === "management" ? "Management-Protokoll" : kind === "actions" ? "Maßnahmenliste" : kind === "decision" ? "Entscheidungsnotiz" : "Projektaktenbericht"}: ${title}`,
      "",
      `Projekt: ${archive.metadata.project || "nicht zugeordnet"}`,
      `Meeting-Typ: ${getMeetingTypeLabel(archive.metadata.meetingType)}`,
      `Datum: ${archive.metadata.date}`,
      `Status: ${archive.metadata.status}`,
      `Ziel: ${archive.metadata.goal || "nicht erfasst"}`,
      `Gewünschtes Ergebnis: ${archive.metadata.desiredOutcome || "nicht erfasst"}`,
      `Qualität: ${archive.qualityReview?.level ?? "nicht bewertet"} (${archive.qualityReview?.score ?? 0}/100)`,
      ""
    ];

    if (kind === "management") {
      return [
        ...header,
        "## Management Summary",
        analysis?.managementSummary ?? "Noch keine Management Summary vorhanden.",
        "",
        "## Entscheidungen",
        ...(analysis?.decisions.length ? analysis.decisions.map((item) => `- ${item}`) : ["- Noch keine Entscheidungen dokumentiert."]),
        "",
        "## Offene Risiken",
        ...(analysis?.openRisks.length ? analysis.openRisks.map((item) => `- ${item}`) : ["- Keine offenen Risiken dokumentiert."]),
        "",
        "## Nächste Schritte",
        ...(archive.qualityReview?.recommendedNextChecks ?? ["Fachliche Prüfung durchführen."]).map((item) => `- ${item}`)
      ].join("\n");
    }

    if (kind === "actions") {
      return [
        ...header,
        "## Maßnahmenregister",
        ...(actions.length
          ? actions.map((item, index) => `${index + 1}. ${item.task}\n   Owner: ${item.owner}\n   Frist: ${item.due}\n   Priorität: ${item.priority}\n   Status: ${item.status ?? "Offen"}\n   Risiko: ${item.risk}`)
          : ["Noch keine Maßnahmen vorhanden."]),
        "",
        "## Offene Punkte",
        ...(analysis?.openPoints.length ? analysis.openPoints.map((item) => `- ${item}`) : ["- Keine offenen Punkte dokumentiert."])
      ].join("\n");
    }

    if (kind === "decision") {
      return [
        ...header,
        "## Entscheidungen",
        ...(analysis?.decisions.length ? analysis.decisions.map((item) => `- ${item}`) : ["- Noch keine Entscheidungen dokumentiert."]),
        "",
        "## Vertagte Entscheidungen",
        ...(analysis?.deferredDecisions.length ? analysis.deferredDecisions.map((item) => `- ${item}`) : ["- Keine vertagten Entscheidungen dokumentiert."]),
        "",
        "## Entscheidungsgrundlage",
        ...(analysis?.decisionBasis.length ? analysis.decisionBasis.map((item) => `- ${item}`) : ["- Keine Entscheidungsgrundlage dokumentiert."]),
        "",
        "## Devil's Advocate",
        archive.decisionChallenge?.risk ? `Risikobewertung: ${archive.decisionChallenge.risk.level} - ${archive.decisionChallenge.risk.rationale}` : "Noch keine separate Entscheidungsprüfung vorhanden."
      ].join("\n");
    }

    return archiveToMarkdown(archive);
  }

  function downloadProfessionalExport(kind: ExportKind) {
    const archive = createCurrentMeetingArchive();
    downloadArchiveProfessionalExport(archive, kind);
  }

  function exportCrossArchiveActions() {
    const lines = [
      "# Projektübergreifendes Maßnahmenregister",
      "",
      `Export: ${new Date().toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}`,
      `Umfang: ${filteredArchiveActions.length} gefilterte Maßnahmen von ${allArchiveActions.length} gesamt`,
      "",
      "| Projekt | Akte | Maßnahme | Owner | Frist | Fälligkeit | Priorität | Status | Risiko |",
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
      ...filteredArchiveActions.map((action) => `| ${action.project} | ${action.archiveTitle} | ${action.task} | ${action.owner} | ${action.due} | ${action.dueState.label} | ${action.priority} | ${action.status} | ${action.risk} |`)
    ];
    const fileName = `${new Date().toISOString().slice(0, 10)}-massnahmenregister.md`;
    downloadTextFile(lines.join("\n"), fileName, "text/markdown");
    setArchiveStatus(`Projektübergreifendes Maßnahmenregister exportiert: ${fileName}`);
  }

  function downloadArchiveProfessionalExport(archive: MeetingArchive, kind: ExportKind) {
    const suffix = kind === "management" ? "management-protokoll" : kind === "actions" ? "massnahmenliste" : kind === "decision" ? "entscheidungsnotiz" : "projektaktenbericht";
    const fileName = createArchiveFileName(archive.metadata.title).replace(".meeting.json", `-${suffix}.md`);
    downloadTextFile(archiveToProfessionalExport(archive, kind), fileName, "text/markdown");
    setArchiveStatus(`Export vorbereitet: ${fileName}.`);
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
    setCurrentArchiveId(archive.id || `meeting-${Date.now()}`);
    setMeetingMetadata({
      title: archive.metadata.title || "Geladene Meeting-Akte",
      project: archive.metadata.project || "",
      date: archive.metadata.date || new Date().toISOString().slice(0, 10),
      participants: archive.metadata.participants,
      goal: archive.metadata.goal,
      desiredOutcome: archive.metadata.desiredOutcome,
      status: archive.metadata.status
    });
    setMeetingStartDraft((currentDraft) => ({
      ...currentDraft,
      meetingType: archive.metadata.meetingType ?? "entscheidung",
      title: archive.metadata.title || "",
      project: archive.metadata.project || "",
      goal: archive.metadata.goal || "",
      participants: archive.metadata.participants || "",
      desiredOutcome: archive.metadata.desiredOutcome || ""
    }));
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
    setSelectedArchiveId(archive.id);
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
      setSelectedArchiveId(archive.id);
      setLoadedArchiveNames([archive.metadata.title || file.name]);
    } catch {
      setArchiveStatus("Diese Datei konnte nicht als Meeting-Projektakte gelesen werden.");
    }
  }

  async function handleMultipleArchiveAnalysis(files: FileList | null) {
    if (!files?.length) {
      return;
    }
    const approved = await requestAiConsent(
      "Mehrere Projektakten analysieren",
      "Die ausgewählten Projektakten würden im API-Modus an den verbundenen Anbieter gesendet."
    );
    if (!approved) {
      setArchiveStatus("Analyse wurde abgebrochen. Es wurden keine Projektakten extern verarbeitet.");
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
        setSelectedArchiveId(validArchives[0]?.id ?? null);
      }
      setArchiveAnalysis(await analyzeMeetingArchives(validArchives, activeAiConfig));
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
    const approved = await requestAiConsent(
      "Lokale Projektakten analysieren",
      "Alle lokal gespeicherten Projektakten würden im API-Modus an den verbundenen Anbieter gesendet."
    );
    if (!approved) {
      setArchiveStatus("Analyse wurde abgebrochen. Es wurden keine lokalen Projektakten extern verarbeitet.");
      return;
    }

    setLoadingAction("archiveAnalysis");
    try {
      setLoadedArchiveNames(savedArchives.map((archive) => archive.metadata.title));
      setArchiveAnalysis(await analyzeMeetingArchives(savedArchives, activeAiConfig));
      setArchiveStatus(`${savedArchives.length} lokal gespeicherte Projektakten analysiert.`);
    } finally {
      setLoadingAction(null);
    }
  }

  async function analyzeFilteredMeetingArchives() {
    if (filteredArchives.length === 0) {
      setArchiveStatus("Der aktuelle Filter enthält keine Projektakten für eine Analyse.");
      return;
    }
    const approved = await requestAiConsent(
      "Gefilterte Projektakten analysieren",
      "Die aktuell gefilterten Projektakten würden im API-Modus an den verbundenen Anbieter gesendet."
    );
    if (!approved) {
      setArchiveStatus("Analyse wurde abgebrochen. Es wurden keine gefilterten Projektakten extern verarbeitet.");
      return;
    }

    setLoadingAction("archiveAnalysis");
    try {
      setLoadedArchiveNames(filteredArchives.map((archive) => archive.metadata.title));
      setArchiveAnalysis(await analyzeMeetingArchives(filteredArchives, activeAiConfig));
      setArchiveStatus(`${filteredArchives.length} gefilterte Projektakten analysiert.`);
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleDecision(event: FormEvent) {
    event.preventDefault();
    const approved = await requestAiConsent(
      "Entscheidung prüfen",
      "Die eingegebene Entscheidung würde im API-Modus an den verbundenen Anbieter gesendet."
    );
    if (!approved) {
      return;
    }
    setLoadingAction("decision");
    try {
      setDecision(await generateDecisionChallenge(decisionText, activeAiConfig));
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleSimulation(event: FormEvent) {
    event.preventDefault();
    const approved = await requestAiConsent(
      "Meeting simulieren",
      "Meeting-Ziel, Teilnehmer und Konfliktthemen würden im API-Modus an den verbundenen Anbieter gesendet."
    );
    if (!approved) {
      return;
    }
    setLoadingAction("simulation");
    try {
      setSimulation(await generateMeetingSimulation(simulationInput, activeAiConfig));
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleTranscript(event: FormEvent) {
    event.preventDefault();
    const approved = await requestAiConsent(
      "Transkript analysieren",
      "Der eingefügte Transkripttext würde im API-Modus an den verbundenen Anbieter gesendet."
    );
    if (!approved) {
      return;
    }
    setLoadingAction("transcript");
    try {
      setTranscript(await analyzeTranscript(transcriptText, activeAiConfig));
    } finally {
      setLoadingAction(null);
    }
  }

  function updateActionPlanItem(index: number, field: keyof ActionPlanItem, value: string) {
    setTranscript((currentTranscript) => {
      if (!currentTranscript) {
        return currentTranscript;
      }

      return {
        ...currentTranscript,
        actionPlan: currentTranscript.actionPlan.map((item, itemIndex) => (
          itemIndex === index
            ? { ...item, [field]: value } as ActionPlanItem
            : item
        ))
      };
    });
  }

  function addManualActionPlanItem() {
    setTranscript((currentTranscript) => {
      const newItem: ActionPlanItem = {
        task: "Neue Maßnahme",
        owner: "offen",
        due: "noch festlegen",
        priority: "Mittel",
        status: "Offen",
        risk: "Noch keine Risikoeinschätzung erfasst."
      };

      if (!currentTranscript) {
        return {
          summary: "Manuell angelegter Maßnahmenplan.",
          managementSummary: "Es wurde ein manueller Maßnahmenplan angelegt. Eine vollständige Transkriptanalyse steht noch aus.",
          said: [],
          unsaid: [],
          avoidedTopics: [],
          contradictions: [],
          decisions: [],
          deferredDecisions: [],
          decisionBasis: [],
          counterArguments: {
            Aufsichtsrat: [],
            "CFO / Banker": [],
            Projektcontroller: [],
            "Kunde / Wettbewerber": []
          },
          tasks: [],
          actionPlan: [newItem],
          openPoints: [],
          openRisks: [],
          followUpQuestions: [],
          followUpEmailDraft: "",
          timestamps: []
        };
      }

      return {
        ...currentTranscript,
        actionPlan: [...currentTranscript.actionPlan, newItem]
      };
    });
  }

  async function handleStakeholder(event: FormEvent) {
    event.preventDefault();
    const approved = await requestAiConsent(
      "Stakeholder analysieren",
      "Die eingegebenen Stakeholder-Daten würden im API-Modus an den verbundenen Anbieter gesendet."
    );
    if (!approved) {
      return;
    }
    setLoadingAction("stakeholder");
    try {
      setStakeholder(await analyzeStakeholder(activeAiConfig));
    } finally {
      setLoadingAction(null);
    }
  }

  async function handlePatterns(event: FormEvent) {
    event.preventDefault();
    const approved = await requestAiConsent(
      "Meeting-Muster erkennen",
      "Die eingefügten Meeting-Zusammenfassungen oder Transkripte würden im API-Modus an den verbundenen Anbieter gesendet."
    );
    if (!approved) {
      return;
    }
    setLoadingAction("patterns");
    try {
      setPatterns(await analyzeMeetingPatterns(activeAiConfig));
    } finally {
      setLoadingAction(null);
    }
  }

  function startNewMeeting() {
    setCurrentArchiveId(`meeting-${Date.now()}`);
    setMeetingMetadata(createInitialMeetingMetadata());
    setMeetingStartDraft(createInitialMeetingStartDraft());
    setPreparationInput(initialPreparation);
    setPreparation(null);
    setAgendaInput(initialAgenda);
    setAgenda(null);
    setAgendaFileStatus("Noch keine Agenda-Datei geladen.");
    setDecisionText("");
    setDecision(null);
    setSimulationInput({ goal: "", participants: "", conflicts: "" });
    setSimulation(null);
    setTranscriptText("");
    setTranscript(null);
    setTranscription(null);
    setTranscriptionNotice("Neues Meeting gestartet. Noch kein Audio für die Transkription vorhanden.");
    setAudioBlob(null);
    clearAudioUrl();
    setAudioUrl("");
    setAudioSourceLabel("");
    setAudioFileName("");
    setRecordingDurationLabel("unbekannt");
    setRecordingSeconds(0);
    setRecordingState("idle");
    setActiveArea("agenda");
  }

  function applyMeetingStartDraft(targetArea: AreaId = "agenda") {
    rememberCurrentMeetingSuggestions();
    const title = meetingStartDraft.title.trim() || "Neue Meeting-Akte";
    const project = meetingStartDraft.project.trim();
    const context = meetingStartDraft.context.trim();
    const goal = meetingStartDraft.goal.trim();
    const participants = meetingStartDraft.participants.trim();
    const desiredOutcome = meetingStartDraft.desiredOutcome.trim();
    const criticalTopics = meetingStartDraft.criticalTopics.trim();
    const ownPosition = meetingStartDraft.ownPosition.trim();
    const duration = meetingStartDraft.duration.trim() || "60 Minuten";
    const typeSpecificNotes = meetingStartDraft.typeSpecificNotes.trim();
    const template = meetingStartTypeTemplates[meetingStartDraft.meetingType];
    const typeGuidance = [
      `Meeting-Typ: ${template.label}`,
      `Fokus: ${template.focus}`,
      `Agenda-Hinweis: ${template.agendaHint}`,
      typeSpecificNotes ? `Zusatzantworten: ${typeSpecificNotes}` : ""
    ].filter(Boolean).join("\n");
    const agendaText = [
      `Meeting-Typ: ${template.label}`,
      context ? `Anlass: ${context}` : "",
      goal ? `Ziel: ${goal}` : "",
      desiredOutcome ? `Gewünschtes Ergebnis: ${desiredOutcome}` : "",
      criticalTopics ? `Kritische Themen: ${criticalTopics}` : "",
      typeSpecificNotes ? `Typbezogene Hinweise: ${typeSpecificNotes}` : "",
      `Vorschlag: ${template.agendaHint}`
    ].filter(Boolean).join("\n");

    setMeetingMetadata((currentMetadata) => ({
      ...currentMetadata,
      title,
      project,
      participants,
      goal,
      desiredOutcome,
      status: "geplant"
    }));
    setAgendaInput((currentInput) => ({
      ...currentInput,
      title,
      meetingGoal: goal,
      participants,
      duration,
      desiredOutcome,
      agendaText,
      existingAgenda: currentInput.existingAgenda
    }));
    setPreparationInput((currentInput) => ({
      ...currentInput,
      title,
      goal,
      participants,
      desiredOutcome,
      criticalTopics: [criticalTopics, typeGuidance].filter(Boolean).join("\n\n"),
      ownPosition: [ownPosition, template.preparationHint].filter(Boolean).join("\n\n")
    }));
    setSimulationInput({
      goal,
      participants,
      conflicts: [criticalTopics, typeSpecificNotes, template.focus].filter(Boolean).join("\n\n")
    });
    setDecisionText([desiredOutcome || goal, template.preparationHint, typeSpecificNotes].filter(Boolean).join("\n\n"));
    setArchiveStatus("Fragen-Assistent hat die aktuelle Meeting-Akte vorbefüllt. Bitte Agenda und Vorbereitung fachlich prüfen.");
    setActiveArea(targetArea);
  }

  function persistAiSettings() {
    window.localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify({
      provider: apiProvider,
      mode: aiMode,
      apiKey: anthropicApiKey.trim()
    }));
    setAiSettingsStatus("KI-Einstellungen wurden lokal im Browser gespeichert.");
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
    setAiMode("api");
    window.localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify({
      provider: apiProvider,
      mode: "api",
      apiKey: trimmedKey
    }));
    setAiSettingsStatus("API-Schlüssel lokal gespeichert. Echte KI ist als Modus vorbereitet; externe Anfragen sind noch nicht aktiv.");
  }

  function disconnectAnthropic() {
    setAnthropicApiKey("");
    setAiMode("mock");
    setAnthropicConnectionState("disconnected");
    setAnthropicStatusText("Nicht verbunden");
    window.localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify({
      provider: apiProvider,
      mode: "mock",
      apiKey: ""
    }));
    setAiSettingsStatus("API-Schlüssel wurde lokal entfernt. Mock-KI ist aktiv.");
  }

  return (
    <div className={isSidebarCollapsed ? "app-shell app-shell--nav-collapsed" : "app-shell"}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand__mark">
            <Brain size={24} aria-hidden="true" />
          </div>
          <div className="brand__text">
            <strong>Meeting Intelligence KI</strong>
            <span>Strategie statt Mitschrift</span>
          </div>
        </div>
        <button
          aria-label={isSidebarCollapsed ? "Navigation ausklappen" : "Navigation einklappen"}
          className="sidebar-toggle"
          onClick={() => setIsSidebarCollapsed((currentValue) => !currentValue)}
          type="button"
        >
          <Menu size={21} aria-hidden="true" />
        </button>
        <nav className="nav-list" aria-label="Hauptbereiche">
          {navGroups.map((group) => (
            <section className="nav-group" key={group.label} aria-label={group.label}>
              <span className="nav-group__label">{group.label}</span>
              {group.items.map((itemId) => {
                const item = navItems.find((navItem) => navItem.id === itemId);
                if (!item) {
                  return null;
                }

                const Icon = item.icon;
                return (
                  <button
                    className={activeArea === item.id ? "nav-button nav-button--active" : "nav-button"}
                    key={item.id}
                    onClick={() => setActiveArea(item.id)}
                    title={isSidebarCollapsed ? `${group.label}: ${item.label}` : undefined}
                    type="button"
                  >
                    <span className="nav-button__icon">
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <span className="nav-button__label">{item.label}</span>
                  </button>
                );
              })}
            </section>
          ))}
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
          <span className={aiMode === "api" && anthropicConnectionState === "connected" ? "status-pill status-pill--api" : "status-pill"}>
            {aiStatusLabel}
          </span>
        </header>

        {lastAiResultMeta && (
          <section className={`ai-result-banner ${lastAiResultMeta.fallback ? "ai-result-banner--fallback" : `ai-result-banner--${lastAiResultMeta.source.toLowerCase()}`}`}>
            <div>
              <strong>Letztes KI-Ergebnis: {lastAiResultMeta.source}</strong>
              <span>Modell: {lastAiResultMeta.model} · {lastAiResultMeta.generatedAt}</span>
            </div>
            <p>{lastAiResultMeta.message}</p>
          </section>
        )}

        <section className="quality-panel" aria-label="Qualitätsprüfung der aktuellen Meeting-Akte">
          <div>
            <span className="quality-panel__eyebrow">Aktuelle Meeting-Akte</span>
            <strong>{currentMeetingTitle}</strong>
            <p>ID: {currentArchiveId} · Projekt: {meetingMetadata.project || "nicht zugeordnet"} · Status: {meetingMetadata.status}</p>
          </div>
          <div className={`quality-score quality-score--${qualityReview.level.toLowerCase()}`}>
            <span>{qualityReview.score}/100</span>
            <strong>Belastbarkeit {qualityReview.level}</strong>
          </div>
          <div className="quality-panel__details">
            <span>{qualityReview.missingInputs.length ? `${qualityReview.missingInputs.length} offene Eingaben` : "Eingaben vollständig"}</span>
            <span>{transcript?.actionPlan.length ?? 0} Maßnahmen</span>
            <span>{transcript?.decisions.length ?? 0} Entscheidungen</span>
          </div>
        </section>

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

        {activeArea === "workflow" && (
          <section className="section">
            <div className="workflow-hero">
              <article className="card">
                <h2>Geführter Meeting-Assistent</h2>
                <p className="lead">
                  Arbeite Schritt für Schritt von Agenda über Vorbereitung, Aufnahme, Analyse und Maßnahmen bis zum Reporting.
                  Der Assistent zeigt den nächsten sinnvollen Arbeitsschritt anhand der aktuellen Akte.
                </p>
                <div className="button-row">
                  <button className="primary-button" onClick={startNewMeeting} type="button">
                    <PlayCircle size={17} /> Neues Meeting starten
                  </button>
                  <button className="secondary-button" onClick={() => setActiveArea("archives")} type="button">
                    <Archive size={17} /> Projektakten öffnen
                  </button>
                </div>
              </article>
              <article className="card">
                <h2>Nächster Schritt</h2>
                <p className="lead">
                  {nextWorkflowStep.title}: {nextWorkflowStep.detail}
                </p>
                <button className="primary-button" onClick={() => setActiveArea(nextWorkflowStep.target)} type="button">
                  <NextWorkflowIcon size={17} /> {nextWorkflowStep.primaryAction}
                </button>
              </article>
            </div>
            <form
              className="workflow-intake-panel"
              onSubmit={(event) => {
                event.preventDefault();
                applyMeetingStartDraft("agenda");
              }}
            >
              <div className="workflow-intake-panel__header">
                <div>
                  <h2>Meeting mit Fragen vorbereiten</h2>
                  <p className="lead">
                    Beantworte die Kernfragen einmal. Die App befüllt daraus Stammdaten, Agenda,
                    Vorbereitung, Simulation und Entscheidungsprüfung.
                  </p>
                </div>
                <span>lokal gespeichert erst nach Akten-Speicherung</span>
              </div>
              <div className="workflow-intake-grid">
                <Field label="Meeting-Typ">
                  <select value={meetingStartDraft.meetingType} onChange={(event) => setMeetingStartDraft({ ...meetingStartDraft, meetingType: event.target.value as MeetingStartType })}>
                    {Object.entries(meetingStartTypeTemplates).map(([type, template]) => (
                      <option key={type} value={type}>{template.label}</option>
                    ))}
                  </select>
                </Field>
                <SuggestedField label="Meeting-Titel" suggestionKey="titles" suggestions={meetingSuggestions.titles} onDeleteSuggestion={deleteMeetingSuggestion} value={meetingStartDraft.title} onChange={(value) => setMeetingStartDraft({ ...meetingStartDraft, title: value })} />
                <SuggestedField label="Projekt / Mandat" suggestionKey="projects" suggestions={meetingSuggestions.projects} onDeleteSuggestion={deleteMeetingSuggestion} value={meetingStartDraft.project} onChange={(value) => setMeetingStartDraft({ ...meetingStartDraft, project: value })} />
                <SuggestedField label="Dauer" suggestionKey="durations" suggestions={meetingSuggestions.durations} onDeleteSuggestion={deleteMeetingSuggestion} placeholder="z. B. 60 Minuten" value={meetingStartDraft.duration} onChange={(value) => setMeetingStartDraft({ ...meetingStartDraft, duration: value })} />
                <section className="workflow-type-card">
                  <span>{meetingStartTemplate.label}</span>
                  <h3>Zusatzfragen für diesen Meeting-Typ</h3>
                  <p>{meetingStartTemplate.focus}</p>
                  <ul>
                    {meetingStartTemplate.prompts.map((prompt) => (
                      <li key={prompt}>{prompt}</li>
                    ))}
                  </ul>
                </section>
                <Field label="Anlass">
                  <textarea value={meetingStartDraft.context} onChange={(event) => setMeetingStartDraft({ ...meetingStartDraft, context: event.target.value })} />
                </Field>
                <SuggestedField label="Ziel" suggestionKey="goals" suggestions={meetingSuggestions.goals} onDeleteSuggestion={deleteMeetingSuggestion} multiline value={meetingStartDraft.goal} onChange={(value) => setMeetingStartDraft({ ...meetingStartDraft, goal: value })} />
                <SuggestedField label="Teilnehmer und Rollen" suggestionKey="participants" suggestions={meetingSuggestions.participants} onDeleteSuggestion={deleteMeetingSuggestion} multiline value={meetingStartDraft.participants} onChange={(value) => setMeetingStartDraft({ ...meetingStartDraft, participants: value })} />
                <SuggestedField label="Gewünschtes Ergebnis" suggestionKey="outcomes" suggestions={meetingSuggestions.outcomes} onDeleteSuggestion={deleteMeetingSuggestion} multiline value={meetingStartDraft.desiredOutcome} onChange={(value) => setMeetingStartDraft({ ...meetingStartDraft, desiredOutcome: value })} />
                <SuggestedField label="Kritische Themen / Konflikte" suggestionKey="criticalTopics" suggestions={meetingSuggestions.criticalTopics} onDeleteSuggestion={deleteMeetingSuggestion} multiline value={meetingStartDraft.criticalTopics} onChange={(value) => setMeetingStartDraft({ ...meetingStartDraft, criticalTopics: value })} />
                <SuggestedField label="Eigene Position" suggestionKey="ownPositions" suggestions={meetingSuggestions.ownPositions} onDeleteSuggestion={deleteMeetingSuggestion} multiline value={meetingStartDraft.ownPosition} onChange={(value) => setMeetingStartDraft({ ...meetingStartDraft, ownPosition: value })} />
                <Field label={`Zusatzantworten: ${meetingStartTemplate.label}`}>
                  <textarea
                    placeholder={meetingStartTemplate.prompts.join("\n")}
                    value={meetingStartDraft.typeSpecificNotes}
                    onChange={(event) => setMeetingStartDraft({ ...meetingStartDraft, typeSpecificNotes: event.target.value })}
                  />
                </Field>
              </div>
              <div className="button-row">
                <button className="primary-button" type="submit">
                  <ListChecks size={17} /> Akte vorbefüllen und Agenda öffnen
                </button>
                <button className="secondary-button" onClick={() => applyMeetingStartDraft("prepare")} type="button">
                  <ClipboardCheck size={17} /> Vorbereitung öffnen
                </button>
                <button className="secondary-button" onClick={() => applyMeetingStartDraft("simulate")} type="button">
                  <PlayCircle size={17} /> Simulation öffnen
                </button>
              </div>
            </form>
            <section className="workflow-assistant-panel">
              <div className="workflow-assistant-panel__header">
                <div>
                  <h2>Meeting-Fortschritt</h2>
                  <p className="lead">Die Statusanzeige bewertet nur lokal vorhandene Eingaben, Analysen und Projektakten.</p>
                </div>
                <span className="workflow-assistant-panel__meta">{workflowAssistantSteps.filter((step) => step.status === "erledigt").length} von {workflowAssistantSteps.length} Schritten erledigt</span>
              </div>
              <div className="workflow-timeline">
                {workflowAssistantSteps.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <button
                      className={`workflow-timeline-step workflow-timeline-step--${step.status.replace(" ", "-")}`}
                      key={step.title}
                      onClick={() => setActiveArea(step.target)}
                      type="button"
                    >
                      <span className="workflow-timeline-step__index">{index + 1}</span>
                      <span className="workflow-timeline-step__icon"><Icon size={18} aria-hidden="true" /></span>
                      <span className="workflow-timeline-step__content">
                        <strong>{step.title}</strong>
                        <small>{step.detail}</small>
                      </span>
                      <span className="workflow-timeline-step__status">{step.status}</span>
                    </button>
                  );
                })}
              </div>
            </section>
            <article className="card meeting-file-card">
              <div className="meeting-file-card__header">
                <div>
                  <h2>Aktuelle Meeting-Akte</h2>
                  <p className="lead">Diese Stammdaten werden für Agenda, Analyse, Export und Projektakte verwendet.</p>
                </div>
                <span className="meeting-status-pill">{meetingMetadata.status}</span>
              </div>
              <div className="meeting-file-form">
                <SuggestedField label="Meeting-Titel" suggestionKey="titles" suggestions={meetingSuggestions.titles} onDeleteSuggestion={deleteMeetingSuggestion} value={meetingMetadata.title} onChange={(value) => setMeetingMetadata({ ...meetingMetadata, title: value })} />
                <SuggestedField label="Projekt / Mandat" suggestionKey="projects" suggestions={meetingSuggestions.projects} onDeleteSuggestion={deleteMeetingSuggestion} placeholder="z. B. CRM-Rollout, Strategie 2026, Kunde A" value={meetingMetadata.project} onChange={(value) => setMeetingMetadata({ ...meetingMetadata, project: value })} />
                <Field label="Datum">
                  <input type="date" value={meetingMetadata.date} onChange={(event) => setMeetingMetadata({ ...meetingMetadata, date: event.target.value })} />
                </Field>
                <Field label="Status">
                  <select value={meetingMetadata.status} onChange={(event) => setMeetingMetadata({ ...meetingMetadata, status: event.target.value as MeetingStatus })}>
                    <option value="geplant">geplant</option>
                    <option value="aufgenommen">aufgenommen</option>
                    <option value="transkribiert">transkribiert</option>
                    <option value="analysiert">analysiert</option>
                    <option value="abgeschlossen">abgeschlossen</option>
                  </select>
                </Field>
                <SuggestedField label="Teilnehmer" suggestionKey="participants" suggestions={meetingSuggestions.participants} onDeleteSuggestion={deleteMeetingSuggestion} multiline value={meetingMetadata.participants} onChange={(value) => setMeetingMetadata({ ...meetingMetadata, participants: value })} />
                <SuggestedField label="Ziel" suggestionKey="goals" suggestions={meetingSuggestions.goals} onDeleteSuggestion={deleteMeetingSuggestion} multiline value={meetingMetadata.goal} onChange={(value) => setMeetingMetadata({ ...meetingMetadata, goal: value })} />
                <SuggestedField label="Gewünschtes Ergebnis" suggestionKey="outcomes" suggestions={meetingSuggestions.outcomes} onDeleteSuggestion={deleteMeetingSuggestion} multiline value={meetingMetadata.desiredOutcome} onChange={(value) => setMeetingMetadata({ ...meetingMetadata, desiredOutcome: value })} />
              </div>
              <div className="button-row">
                <button className="primary-button" onClick={saveCurrentMeetingInBrowser} type="button">
                  <Archive size={17} /> Aktuelle Akte speichern
                </button>
                <button className="secondary-button" onClick={downloadCurrentMeetingMarkdown} type="button">
                  <FileText size={17} /> Ergebnis als Markdown
                </button>
              </div>
            </article>
            <div className="workflow-steps">
              {workflowAssistantSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <article className="workflow-step" key={step.title}>
                    <Icon size={22} aria-hidden="true" />
                    <span className={`workflow-step__status workflow-step__status--${step.status.replace(" ", "-")}`}>{step.status}</span>
                    <h3>{index + 1}. {step.title}</h3>
                    <p>{step.detail}</p>
                    <button className="secondary-button" onClick={() => setActiveArea(step.target)} type="button">
                      {step.primaryAction}
                    </button>
                  </article>
                );
              })}
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
                  <button className="secondary-button" onClick={() => downloadProfessionalExport("management")} type="button">
                    <FileText size={17} /> Management-Protokoll
                  </button>
                  <button className="secondary-button" onClick={() => downloadProfessionalExport("actions")} type="button">
                    <ListChecks size={17} /> Maßnahmenliste
                  </button>
                  <button className="secondary-button" onClick={() => downloadProfessionalExport("decision")} type="button">
                    <ShieldQuestion size={17} /> Entscheidungsnotiz
                  </button>
                </div>
              </article>

              <article className="card archive-card">
                <HardDrive size={24} aria-hidden="true" />
                <div>
                  <h2>Lokalen Ordner verbinden</h2>
                  <p>
                    Speichert und lädt Projektakten direkt aus einem ausgewählten Ordner, sofern der Browser
                    die File System Access API unterstützt.
                  </p>
                </div>
                <div className="archive-button-stack">
                  <button className="primary-button" disabled={!isFileSystemAccessSupported} onClick={connectLocalArchiveFolder} type="button">
                    <FolderOpen size={17} /> Ordner auswählen
                  </button>
                  <button className="secondary-button" disabled={!fileSystemDirectoryHandle} onClick={saveCurrentMeetingToLocalFolder} type="button">
                    <HardDrive size={17} /> Akte in Ordner speichern
                  </button>
                  <button className="secondary-button" disabled={!fileSystemDirectoryHandle} onClick={loadMeetingArchivesFromLocalFolder} type="button">
                    <Files size={17} /> Akten aus Ordner laden
                  </button>
                </div>
                <p className="file-system-status">
                  {isFileSystemAccessSupported ? fileSystemStatus : "Direkte Ordnerablage wird in diesem Browser nicht unterstützt. Download/Upload bleibt verfügbar."}
                </p>
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
                  <button className="secondary-button" disabled={filteredArchives.length === 0} onClick={analyzeFilteredMeetingArchives} type="button">
                    <FileSearch size={17} /> Gefilterte Akten analysieren
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
            <section className="library-panel">
              <div>
                <h2>Lokale Bibliothek</h2>
                <p className="lead">
                  Suche und filtere gespeicherte Akten nach Projekt, Status, Teilnehmern, Zielen, Transkriptinhalten,
                  Entscheidungen und Maßnahmen. Treffer können direkt wiederhergestellt oder gemeinsam analysiert werden.
                </p>
              </div>
              <div className="library-controls">
                <Field label="Suche">
                  <input placeholder="Titel, Projekt, Teilnehmer, Entscheidung, Maßnahme ..." value={archiveSearch} onChange={(event) => setArchiveSearch(event.target.value)} />
                </Field>
                <Field label="Projekt">
                  <select value={archiveProjectFilter} onChange={(event) => setArchiveProjectFilter(event.target.value)}>
                    <option value="alle">alle Projekte</option>
                    {archiveProjects.map((project) => (
                      <option key={project} value={project}>{project}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Status">
                  <select value={archiveStatusFilter} onChange={(event) => setArchiveStatusFilter(event.target.value as MeetingStatus | "alle")}>
                    <option value="alle">alle Status</option>
                    <option value="geplant">geplant</option>
                    <option value="aufgenommen">aufgenommen</option>
                    <option value="transkribiert">transkribiert</option>
                    <option value="analysiert">analysiert</option>
                    <option value="abgeschlossen">abgeschlossen</option>
                  </select>
                </Field>
                <Field label="Meeting-Typ">
                  <select value={archiveMeetingTypeFilter} onChange={(event) => setArchiveMeetingTypeFilter(event.target.value as MeetingType | "alle" | "nicht klassifiziert")}>
                    <option value="alle">alle Typen</option>
                    {archiveMeetingTypes.map((type) => (
                      <option key={type} value={type}>{getMeetingTypeLabel(type)}</option>
                    ))}
                    {savedArchives.some((archive) => !archive.metadata.meetingType) && <option value="nicht klassifiziert">nicht klassifiziert</option>}
                  </select>
                </Field>
              </div>
              <div className="library-summary">
                <span>{filteredArchives.length} von {savedArchives.length} Akten sichtbar</span>
                <span>{archiveProjects.length} Projekte</span>
                <span>{archiveMeetingTypes.length} Meeting-Typen</span>
                <span>{currentArchiveId ? "Wiederherstellung aktiv" : "keine Akte geladen"}</span>
              </div>
            </section>
            <div className="analysis-lane">
              <h2>Qualitätsprüfung der aktuellen Akte</h2>
              <div className="result-grid">
                <section className="result-block">
                  <h3>Belastbarkeit</h3>
                  <RiskBadge level={qualityReview.level === "Hoch" ? "Grün" : qualityReview.level === "Mittel" ? "Gelb" : "Rot"} />
                  <p>{qualityReview.score}/100 Punkte. Diese Bewertung entsteht lokal aus Vollständigkeit, Analysegrad und Quellenstatus.</p>
                </section>
                <ResultSection title="Fehlende Eingaben" items={qualityReview.missingInputs.length ? qualityReview.missingInputs : ["Keine zentralen Lücken erkannt."]} />
                <ResultSection title="Annahmen" items={qualityReview.assumptions} />
                <ResultSection title="Nächste Prüfungen" items={qualityReview.recommendedNextChecks} />
              </div>
            </div>
            {savedArchives.length > 0 && (
              <section className="result-block result-block--wide">
                <h3>Lokale Meeting-Übersicht</h3>
                <div className="archive-table">
                  {filteredArchives.map((archive) => (
                    <article className={selectedArchive?.id === archive.id ? "archive-row archive-row--selected" : "archive-row"} key={archive.id}>
                      <div>
                        <strong>{archive.metadata.title}</strong>
                        <span>{archive.metadata.project || "ohne Projekt"} · {getMeetingTypeLabel(archive.metadata.meetingType)} · {archive.metadata.date} · Status: {archive.metadata.status} · Qualität: {archive.qualityReview?.level ?? "offen"}</span>
                      </div>
                      <div>
                        <span>{archive.transcription.rawText ? "Transkript vorhanden" : "ohne Transkript"}</span>
                        <span>{archive.transcriptAnalysis ? "Analyse vorhanden" : "ohne Analyse"}</span>
                      </div>
                      <div className="archive-row__actions">
                        <button className="secondary-button" onClick={() => setSelectedArchiveId(archive.id)} type="button">
                          <Eye size={16} /> Details
                        </button>
                        <button className="secondary-button" onClick={() => applyMeetingArchive(archive)} type="button">
                          <FolderOpen size={16} /> Als Arbeitsakte öffnen
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
                  {filteredArchives.length === 0 && (
                    <p className="result-note">Keine Akten passen zu Suche und Filter.</p>
                  )}
                </div>
              </section>
            )}
            {selectedArchive && (
              <section className="archive-detail-panel">
                <div className="archive-detail-panel__header">
                  <div>
                    <span className="quality-panel__eyebrow">Projektakten-Detailansicht</span>
                    <h2>{selectedArchive.metadata.title}</h2>
                    <p>
                      {selectedArchive.metadata.project || "ohne Projekt"} · {selectedArchive.metadata.date} · Status: {selectedArchive.metadata.status}
                    </p>
                  </div>
                  <div className="archive-detail-panel__actions">
                    <button className="primary-button" onClick={() => applyMeetingArchive(selectedArchive)} type="button">
                      <FolderOpen size={17} /> Als Arbeitsakte öffnen
                    </button>
                    <button className="secondary-button" onClick={() => downloadArchive(selectedArchive)} type="button">
                      <Download size={17} /> JSON
                    </button>
                    <button className="secondary-button" onClick={() => downloadArchiveProfessionalExport(selectedArchive, "management")} type="button">
                      <FileText size={17} /> Management
                    </button>
                    <button className="secondary-button" onClick={() => downloadArchiveProfessionalExport(selectedArchive, "actions")} type="button">
                      <ListChecks size={17} /> Maßnahmen
                    </button>
                    <button className="secondary-button" onClick={() => downloadArchiveProfessionalExport(selectedArchive, "decision")} type="button">
                      <ShieldQuestion size={17} /> Entscheidung
                    </button>
                  </div>
                </div>

                <div className="archive-detail-metrics">
                  <MetricCard icon={ClipboardCheck} label="Qualität" value={`${selectedArchive.qualityReview?.score ?? 0}/100`} detail={selectedArchive.qualityReview?.level ?? "nicht bewertet"} />
                  <MetricCard icon={FileSearch} label="Transkript" value={selectedArchive.transcription.rawText ? "ja" : "nein"} detail={selectedArchive.transcription.result?.confidence ?? "nicht erzeugt"} />
                  <MetricCard icon={ShieldQuestion} label="Entscheidungen" value={String(selectedArchive.transcriptAnalysis?.decisions.length ?? 0)} detail="aus Analyse" />
                  <MetricCard icon={ListChecks} label="Maßnahmen" value={String(selectedArchive.transcriptAnalysis?.actionPlan.length ?? 0)} detail="im Register" />
                </div>

                <section className="archive-timeline">
                  <div className="archive-timeline__header">
                    <h3>Chronologie</h3>
                    <p>Zeigt, welche Arbeitsschritte in dieser Akte bereits vorhanden sind und wann der aktuelle Stand gespeichert wurde.</p>
                  </div>
                  <div className="timeline-list">
                    {selectedArchiveTimeline.map((event) => (
                      <article className={`timeline-item timeline-item--${event.status}`} key={event.id}>
                        <div className="timeline-item__marker" aria-hidden="true" />
                        <div>
                          <div className="timeline-item__meta">
                            <span>{event.category}</span>
                            <time dateTime={event.timestamp}>
                              {new Date(event.timestamp).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}
                            </time>
                          </div>
                          <strong>{event.label}</strong>
                          <p>{event.detail}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>

                <div className="archive-detail-grid">
                  <section className="result-block">
                    <h3>Metadaten</h3>
                    <dl className="detail-list">
                      <div>
                        <dt>Projekt</dt>
                        <dd>{selectedArchive.metadata.project || "nicht zugeordnet"}</dd>
                      </div>
                      <div>
                        <dt>Meeting-Typ</dt>
                        <dd>{getMeetingTypeLabel(selectedArchive.metadata.meetingType)}</dd>
                      </div>
                      <div>
                        <dt>Teilnehmer</dt>
                        <dd>{selectedArchive.metadata.participants || "nicht erfasst"}</dd>
                      </div>
                      <div>
                        <dt>Ziel</dt>
                        <dd>{selectedArchive.metadata.goal || "nicht erfasst"}</dd>
                      </div>
                      <div>
                        <dt>Gewünschtes Ergebnis</dt>
                        <dd>{selectedArchive.metadata.desiredOutcome || "nicht erfasst"}</dd>
                      </div>
                      <div>
                        <dt>Gespeichert</dt>
                        <dd>{new Date(selectedArchive.savedAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}</dd>
                      </div>
                    </dl>
                  </section>
                  <section className="result-block">
                    <h3>Agenda</h3>
                    {selectedArchive.agenda.result?.refinedAgenda.length ? (
                      <ul>
                        {selectedArchive.agenda.result.refinedAgenda.map((item) => (
                          <li key={`${item.topic}-${item.owner}`}>{item.topic} · {item.owner} · {item.timeBudget}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>{selectedArchive.agenda.input.existingAgenda || selectedArchive.agenda.input.agendaText || "Keine Agenda gespeichert."}</p>
                    )}
                  </section>
                  <section className="result-block result-block--wide">
                    <h3>Management Summary</h3>
                    <p>{selectedArchive.transcriptAnalysis?.managementSummary ?? "Noch keine Management Summary vorhanden."}</p>
                  </section>
                  <ResultSection title="Entscheidungen" items={selectedArchive.transcriptAnalysis?.decisions ?? []} />
                  <ResultSection title="Vertagte Entscheidungen" items={selectedArchive.transcriptAnalysis?.deferredDecisions ?? []} />
                  <ResultSection title="Offene Risiken" items={selectedArchive.transcriptAnalysis?.openRisks ?? []} />
                  <ResultSection title="Offene Punkte" items={selectedArchive.transcriptAnalysis?.openPoints ?? []} />
                  <ResultSection title="Qualitätsnotizen" items={selectedArchive.qualityReview?.reliabilityNotes ?? []} />
                </div>

                {selectedArchive.transcriptAnalysis?.actionPlan.length ? (
                  <div className="archive-detail-actions">
                    <h3>Maßnahmenregister</h3>
                    <div className="measure-register">
                      {selectedArchive.transcriptAnalysis.actionPlan.map((item) => (
                        <article className="measure-row" key={`${selectedArchive.id}-${item.task}-${item.owner}`}>
                          <div>
                            <strong>{item.task}</strong>
                            <span>{item.risk}</span>
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
                            <div>
                              <dt>Status</dt>
                              <dd>{item.status ?? "Offen"}</dd>
                            </div>
                          </dl>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="result-note">In dieser Akte ist noch kein Maßnahmenregister vorhanden.</p>
                )}

                <section className="result-block result-block--wide">
                  <h3>Maßnahmen-Verlauf</h3>
                  {selectedArchive.actionHistory?.length ? (
                    <div className="action-history-list">
                      {selectedArchive.actionHistory.map((event) => (
                        <article className="action-history-item" key={event.id}>
                          <time dateTime={event.timestamp}>{new Date(event.timestamp).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}</time>
                          <strong>{event.actionTask}</strong>
                          <p>{event.field}: {event.previousValue} → {event.nextValue}</p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="result-note">Noch keine manuellen Änderungen am Maßnahmenregister dokumentiert.</p>
                  )}
                </section>

                <section className="result-block result-block--wide">
                  <h3>Rohtranskript</h3>
                  <pre className="transcript-raw">{selectedArchive.transcription.rawText || "Kein Transkript gespeichert."}</pre>
                </section>
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
                  <MetricCard icon={ClipboardCheck} label="Meeting-Typen" value={String(archiveAnalysis.meetingTypeDistribution.length)} detail="klassifizierte Muster" />
                </div>
                <div className="result-grid">
                  <ResultSection title="Meeting-Typ-Verteilung" items={archiveAnalysis.meetingTypeDistribution} />
                  <ResultSection title="Typbezogene Muster" items={archiveAnalysis.typeSpecificPatterns} />
                  <ResultSection title="Wiederkehrende Einwände" items={archiveAnalysis.recurringObjections} />
                  <ResultSection title="Wiederkehrende Risiken" items={archiveAnalysis.repeatedRisks} />
                  <ResultSection title="Vertagte Entscheidungen" items={archiveAnalysis.deferredDecisions} />
                  <ResultSection title="Maßnahmenmuster" items={archiveAnalysis.actionPatterns} />
                  <ResultSection title="Agenda-Treue" items={archiveAnalysis.agendaDiscipline} />
                  <ResultSection title="Verbesserungsvorschläge" items={archiveAnalysis.improvementSuggestions} />
                </div>
              </div>
            )}
            <div className="analysis-lane">
              <h2>Ergebnisprotokoll & Maßnahmenregister</h2>
              <div className="protocol-grid">
                <section className="result-block">
                  <h3>Management Summary</h3>
                  <p>{transcript?.managementSummary ?? "Noch keine Transkriptanalyse vorhanden."}</p>
                </section>
                <ResultSection title="Entscheidungen" items={transcript?.decisions ?? []} />
                <ResultSection title="Offene Punkte" items={transcript?.openPoints ?? []} />
                <ResultSection title="Risiken" items={transcript?.openRisks ?? []} />
              </div>
              {transcript?.actionPlan?.length ? (
                <div className="measure-register">
                  {transcript.actionPlan.map((item) => (
                    <article className="measure-row" key={`${item.task}-${item.owner}`}>
                      <div>
                        <strong>{item.task}</strong>
                        <span>{item.risk}</span>
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
                        <div>
                          <dt>Status</dt>
                          <dd>{item.status ?? "Offen"}</dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="result-note">Noch kein Maßnahmenregister vorhanden. Erzeuge zuerst eine Transkriptanalyse.</p>
              )}
            </div>
          </section>
        )}

        {activeArea === "projects" && (
          <section className="section">
            <PrivacyNotice />
            <section className="cross-action-panel">
              <div className="cross-action-panel__header">
                <div>
                  <h2>Maßnahmen über alle Projektakten</h2>
                  <p className="lead">
                    Zentrales Register für offene, laufende, blockierte und erledigte Maßnahmen aus allen gespeicherten Meeting-Akten.
                  </p>
                </div>
                <div className="cross-action-summary">
                  <span>{actionSummary.total} gesamt</span>
                  <span>{actionSummary.open} offen</span>
                  <span>{actionSummary.inProgress} in Arbeit</span>
                  <span>{actionSummary.blocked} blockiert</span>
                  <span>{actionSummary.done} erledigt</span>
                  <span>{actionSummary.overdue} überfällig</span>
                  <span>{actionSummary.soon} bald fällig</span>
                </div>
              </div>
              <div className="action-library-controls">
                <Field label="Maßnahmensuche">
                  <input placeholder="Maßnahme, Owner, Risiko, Akte ..." value={actionSearch} onChange={(event) => setActionSearch(event.target.value)} />
                </Field>
                <Field label="Projekt">
                  <select value={actionProjectFilter} onChange={(event) => setActionProjectFilter(event.target.value)}>
                    <option value="alle">alle Projekte</option>
                    {archiveProjects.map((project) => (
                      <option key={project} value={project}>{project}</option>
                    ))}
                    {allArchiveActions.some((action) => action.project === "ohne Projekt") && <option value="ohne Projekt">ohne Projekt</option>}
                  </select>
                </Field>
                <Field label="Status">
                  <select value={actionStatusFilter} onChange={(event) => setActionStatusFilter(event.target.value as ActionPlanStatus | "alle")}>
                    <option value="alle">alle Status</option>
                    <option value="Offen">Offen</option>
                    <option value="In Arbeit">In Arbeit</option>
                    <option value="Erledigt">Erledigt</option>
                    <option value="Blockiert">Blockiert</option>
                  </select>
                </Field>
                <Field label="Priorität">
                  <select value={actionPriorityFilter} onChange={(event) => setActionPriorityFilter(event.target.value as ActionPlanItem["priority"] | "alle")}>
                    <option value="alle">alle Prioritäten</option>
                    <option value="Hoch">Hoch</option>
                    <option value="Mittel">Mittel</option>
                    <option value="Niedrig">Niedrig</option>
                  </select>
                </Field>
              </div>
              <div className="button-row">
                <button className="secondary-button" disabled={filteredArchiveActions.length === 0} onClick={exportCrossArchiveActions} type="button">
                  <Download size={17} /> Gefiltertes Maßnahmenregister exportieren
                </button>
              </div>
              <div className="cross-action-table">
                {filteredArchiveActions.map((action) => (
                  <article className={`cross-action-row cross-action-row--${action.status.toLowerCase().replaceAll(" ", "-")}`} key={`${action.archiveId}-${action.index}-${action.task}`}>
                    <div>
                      <strong>{action.task}</strong>
                      <span>{action.risk}</span>
                    </div>
                    <dl>
                      <div>
                        <dt>Projekt</dt>
                        <dd>{action.project}</dd>
                      </div>
                      <div>
                        <dt>Akte</dt>
                        <dd>{action.archiveTitle}</dd>
                      </div>
                      <div>
                        <dt>Owner</dt>
                        <dd>{action.owner}</dd>
                      </div>
                      <div>
                        <dt>Frist</dt>
                        <dd>{action.due}</dd>
                      </div>
                      <div>
                        <dt>Fälligkeit</dt>
                        <dd><span className={`due-badge due-badge--${action.dueState.level}`}>{action.dueState.label}</span></dd>
                      </div>
                      <div>
                        <dt>Priorität</dt>
                        <dd>{action.priority}</dd>
                      </div>
                      <div>
                        <dt>Status</dt>
                        <dd>
                          <select
                            aria-label={`Status für ${action.task}`}
                            className="inline-status-select"
                            value={action.status}
                            onChange={(event) => updateArchiveActionStatus(action.archiveId, action.index, event.target.value as ActionPlanStatus)}
                          >
                            <option value="Offen">Offen</option>
                            <option value="In Arbeit">In Arbeit</option>
                            <option value="Erledigt">Erledigt</option>
                            <option value="Blockiert">Blockiert</option>
                          </select>
                        </dd>
                      </div>
                    </dl>
                    <button
                      className="secondary-button"
                      onClick={() => {
                        setSelectedArchiveId(action.archiveId);
                        setActiveArea("archives");
                      }}
                      type="button"
                    >
                      <Eye size={16} /> Akte anzeigen
                    </button>
                  </article>
                ))}
                {filteredArchiveActions.length === 0 && (
                  <p className="result-note">Keine Maßnahmen passen zu den aktuellen Filtern.</p>
                )}
              </div>
            </section>

            <section className="project-dashboard-panel">
              <div>
                <h2>Projekt-Dashboard</h2>
                <p className="lead">
                  Verdichtet gespeicherte Akten nach Projekt: Meetings, offene Maßnahmen, blockierte Punkte, vertagte Entscheidungen und Risiken.
                </p>
              </div>
              <div className="project-dashboard-grid">
                {projectDashboard.map((project) => (
                  <article className="project-dashboard-card" key={project.project}>
                    <h3>{project.project}</h3>
                    <dl>
                      <div>
                        <dt>Meetings</dt>
                        <dd>{project.meetings}</dd>
                      </div>
                      <div>
                        <dt>Offene Maßnahmen</dt>
                        <dd>{project.openActions}</dd>
                      </div>
                      <div>
                        <dt>Blockiert</dt>
                        <dd>{project.blockedActions}</dd>
                      </div>
                      <div>
                        <dt>Vertagte Entscheidungen</dt>
                        <dd>{project.openDecisions}</dd>
                      </div>
                      <div>
                        <dt>Risiken</dt>
                        <dd>{project.risks}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
                {projectDashboard.length === 0 && <p className="result-note">Noch keine Projektakten für ein Projekt-Dashboard vorhanden.</p>}
              </div>
            </section>

            <section className="review-panel">
              <div>
                <h2>Review vor dem nächsten Meeting</h2>
                <p className="lead">
                  Kompakte Vorbereitung aus den aktuell gefilterten Akten: offene Maßnahmen, Risiken, Nachfragen und Stakeholder-Hinweise.
                </p>
              </div>
              <div className="result-grid">
                <ResultSection title="Offene Maßnahmen" items={reviewItems.openActions.length ? reviewItems.openActions : ["Keine offenen Maßnahmen in der aktuellen Auswahl."]} />
                <ResultSection title="Kritische Risiken" items={reviewItems.openRisks.length ? reviewItems.openRisks : ["Keine offenen Risiken in der aktuellen Auswahl."]} />
                <ResultSection title="Empfohlene Nachfragen" items={reviewItems.questions.length ? reviewItems.questions : ["Keine Nachfragen in der aktuellen Auswahl."]} />
                <ResultSection title="Stakeholder-Hinweise" items={reviewItems.stakeholderNotes.length ? reviewItems.stakeholderNotes : ["Noch keine Stakeholder-Hinweise gespeichert."]} />
              </div>
            </section>
          </section>
        )}

        {activeArea === "reports" && (
          <section className="section">
            <PrivacyNotice />
            <div className="report-hero">
              <article className="card">
                <h2>Reporting & Export</h2>
                <p className="lead">
                  Bündelt Vorbereitung, Entscheidungsschärfung, Simulation, Transkriptanalyse, Stakeholderanalyse und Maßnahmen in exportierbare Management-Unterlagen.
                </p>
                <div className="report-readiness">
                  <div className={`quality-score quality-score--${qualityReview.level.toLowerCase()}`}>
                    <span>{qualityReview.score}/100</span>
                    <strong>Berichtsreife {qualityReview.level}</strong>
                  </div>
                  <p>
                    {qualityReview.missingInputs.length
                      ? `${qualityReview.missingInputs.length} Punkte sollten vor einem belastbaren Export noch ergänzt werden.`
                      : "Die aktuelle Akte ist für einen Management-Export vorbereitet."}
                  </p>
                </div>
              </article>
              <article className="card">
                <h2>Welche Analyse gehört wohin?</h2>
                <p className="lead">
                  Simulation und Stakeholderanalyse stärken die Vorbereitung. Entscheidungsprüfung reduziert blinde Flecken vor Beschlüssen.
                  Transkriptanalyse verdichtet die Nachbereitung und speist Maßnahmen, Risiken und Exporte.
                </p>
              </article>
            </div>

            <section className="report-export-panel">
              <div>
                <h2>Berichtspaket aktuelle Akte</h2>
                <p className="lead">Erzeuge Unterlagen aus dem aktuellen Arbeitsstand, auch wenn die Akte noch nicht als Datei gespeichert wurde.</p>
              </div>
              <div className="report-export-grid">
                <button className="secondary-button report-export-button" onClick={() => downloadProfessionalExport("management")} type="button">
                  <FileText size={18} /> Management-Protokoll
                </button>
                <button className="secondary-button report-export-button" onClick={() => downloadProfessionalExport("actions")} type="button">
                  <ListChecks size={18} /> Maßnahmenliste
                </button>
                <button className="secondary-button report-export-button" onClick={() => downloadProfessionalExport("decision")} type="button">
                  <ShieldQuestion size={18} /> Entscheidungsnotiz
                </button>
                <button className="secondary-button report-export-button" onClick={() => downloadProfessionalExport("full")} type="button">
                  <Archive size={18} /> Projektaktenbericht
                </button>
              </div>
            </section>

            <section className="report-export-panel">
              <div>
                <h2>Projektübergreifende Auswertungen</h2>
                <p className="lead">Nutze gespeicherte Projektakten für Maßnahmenregister, Musteranalyse und Review vor Folge-Meetings.</p>
              </div>
              <div className="report-export-grid">
                <button className="secondary-button report-export-button" disabled={filteredArchiveActions.length === 0} onClick={exportCrossArchiveActions} type="button">
                  <Download size={18} /> Maßnahmenregister exportieren
                </button>
                <button className="secondary-button report-export-button" disabled={filteredArchives.length === 0} onClick={analyzeFilteredMeetingArchives} type="button">
                  <FileSearch size={18} /> Gefilterte Akten analysieren
                </button>
                <button className="secondary-button report-export-button" disabled={savedArchives.length === 0} onClick={analyzeSavedMeetingArchives} type="button">
                  <BarChart3 size={18} /> Alle lokalen Akten analysieren
                </button>
                <button className="secondary-button report-export-button" onClick={() => setActiveArea("projects")} type="button">
                  <ListChecks size={18} /> Maßnahmen-Cockpit öffnen
                </button>
              </div>
              {loadingAction === "archiveAnalysis" && <LoadingIndicator label="KI analysiert mehrere Projektakten ..." />}
            </section>

            <section className="report-export-panel">
              <div>
                <h2>Ausgewählte Projektakte</h2>
                <p className="lead">
                  {selectedArchive
                    ? `${selectedArchive.metadata.title} · ${selectedArchive.metadata.project || "ohne Projekt"}`
                    : "Noch keine Projektakte ausgewählt oder gespeichert."}
                </p>
              </div>
              <div className="report-export-grid">
                <button
                  className="secondary-button report-export-button"
                  disabled={!selectedArchive}
                  onClick={() => selectedArchive && downloadArchiveProfessionalExport(selectedArchive, "management")}
                  type="button"
                >
                  <FileText size={18} /> Management
                </button>
                <button
                  className="secondary-button report-export-button"
                  disabled={!selectedArchive}
                  onClick={() => selectedArchive && downloadArchiveProfessionalExport(selectedArchive, "actions")}
                  type="button"
                >
                  <ListChecks size={18} /> Maßnahmen
                </button>
                <button
                  className="secondary-button report-export-button"
                  disabled={!selectedArchive}
                  onClick={() => selectedArchive && downloadArchiveProfessionalExport(selectedArchive, "decision")}
                  type="button"
                >
                  <ShieldQuestion size={18} /> Entscheidung
                </button>
                <button className="secondary-button report-export-button" onClick={() => setActiveArea("archives")} type="button">
                  <Archive size={18} /> Projektakte auswählen
                </button>
              </div>
            </section>

            <section className="analysis-map-panel">
              <div>
                <h2>Analyse-Landkarte</h2>
                <p className="lead">Diese Module bleiben eigene Arbeitsräume, liefern aber gezielt Bausteine für Bericht, Review und Projektakte.</p>
              </div>
              <div className="analysis-map-grid">
                {[
                  {
                    title: "Meeting simulieren",
                    phase: "Vor dem Meeting",
                    detail: "Erzeugt Best Case, Worst Case und Most Likely, um kritische Wendepunkte und passende Antworten vorzubereiten.",
                    target: "simulate" as AreaId,
                    icon: PlayCircle
                  },
                  {
                    title: "Entscheidung prüfen",
                    phase: "Vor Beschluss oder Freigabe",
                    detail: "Prüft Schwachstellen, unbequeme Fragen und Gegenargumente aus unterschiedlichen Rollen.",
                    target: "decision" as AreaId,
                    icon: ShieldQuestion
                  },
                  {
                    title: "Transkript analysieren",
                    phase: "Nach dem Meeting",
                    detail: "Extrahiert Entscheidungen, offene Punkte, nicht angesprochene Themen, Risiken, Maßnahmen und Follow-up-Entwurf.",
                    target: "transcript" as AreaId,
                    icon: FileSearch
                  },
                  {
                    title: "Stakeholder analysieren",
                    phase: "Vor schwierigen Gesprächen",
                    detail: "Verdichtet eingegebene Informationen zu Interessen, Triggern, Sprachmustern und Gesprächsstrategie.",
                    target: "stakeholder" as AreaId,
                    icon: Users
                  }
                ].map((module) => {
                  const Icon = module.icon;
                  return (
                    <article className="analysis-map-card" key={module.title}>
                      <Icon size={22} aria-hidden="true" />
                      <span>{module.phase}</span>
                      <h3>{module.title}</h3>
                      <p>{module.detail}</p>
                      <button className="secondary-button" onClick={() => setActiveArea(module.target)} type="button">
                        Modul öffnen
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>

            <div className="result-grid">
              <ResultSection title="Vor Export prüfen" items={qualityReview.recommendedNextChecks} />
              <ResultSection title="Fehlende Eingaben" items={qualityReview.missingInputs.length ? qualityReview.missingInputs : ["Keine zentralen Lücken erkannt."]} />
              <ResultSection title="Belastbarkeit" items={qualityReview.reliabilityNotes} />
              <ResultSection title="Aktueller Datenstand" items={[
                `${savedArchives.length} gespeicherte Projektakten`,
                `${filteredArchiveActions.length} sichtbare Maßnahmen im Register`,
                transcript ? "Transkriptanalyse vorhanden" : "Noch keine Transkriptanalyse vorhanden",
                decision ? "Entscheidungsprüfung vorhanden" : "Noch keine Entscheidungsprüfung vorhanden"
              ]} />
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
              {transcriptionError && <p className="recording-error">{transcriptionError}</p>}
              {loadingAction === "transcription" && <LoadingIndicator label="KI arbeitet am Transkript ..." />}
              <div className="transcription-layout">
                <section className="result-block">
                  <h3>Transkriptionsstatus</h3>
                  <p><strong>Quelle:</strong> {transcription?.sourceLabel ?? "keine Audiodatei ausgewählt"}</p>
                  <p><strong>Dauer:</strong> {transcription?.durationLabel ?? "noch unbekannt"}</p>
                  <p><strong>Qualität:</strong> {transcription?.confidence ?? "noch nicht erzeugt"}</p>
                  <p><strong>Anbieter:</strong> {transcription?.provider ?? (activeAiConfig.mode === "api" ? (activeAiConfig.provider === "openai" ? "OpenAI vorbereitet" : "Anthropic vorbereitet") : "Mock")}</p>
                  <p><strong>Modell:</strong> {transcription?.model ?? (activeAiConfig.mode === "api" && activeAiConfig.provider === "openai" ? "gpt-4o-mini-transcribe" : "noch nicht erzeugt")}</p>
                  <p><strong>Upload-Limit:</strong> OpenAI-Audio aktuell bis {OPENAI_AUDIO_UPLOAD_LIMIT_MB} MB je Datei; längere Meetings bitte in Abschnitte aufnehmen.</p>
                  <p><strong>Hinweis:</strong> {transcription?.note ?? "OpenAI kann im API-Modus echte Transkripte erzeugen. Anthropic ist für Audio-Transkription noch nicht angebunden."}</p>
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
              <SuggestedField label="Meeting-Titel" suggestionKey="titles" suggestions={meetingSuggestions.titles} onDeleteSuggestion={deleteMeetingSuggestion} value={agendaInput.title} onChange={(value) => setAgendaInput({ ...agendaInput, title: value })} />
              <SuggestedField label="Dauer" suggestionKey="durations" suggestions={meetingSuggestions.durations} onDeleteSuggestion={deleteMeetingSuggestion} placeholder="z. B. 60 Minuten" value={agendaInput.duration} onChange={(value) => setAgendaInput({ ...agendaInput, duration: value })} />
              <SuggestedField label="Ziel des Meetings" suggestionKey="goals" suggestions={meetingSuggestions.goals} onDeleteSuggestion={deleteMeetingSuggestion} multiline value={agendaInput.meetingGoal} onChange={(value) => setAgendaInput({ ...agendaInput, meetingGoal: value })} />
              <SuggestedField label="Gewünschtes Ergebnis" suggestionKey="outcomes" suggestions={meetingSuggestions.outcomes} onDeleteSuggestion={deleteMeetingSuggestion} multiline value={agendaInput.desiredOutcome} onChange={(value) => setAgendaInput({ ...agendaInput, desiredOutcome: value })} />
              <SuggestedField label="Teilnehmer und Rollen" suggestionKey="participants" suggestions={meetingSuggestions.participants} onDeleteSuggestion={deleteMeetingSuggestion} multiline value={agendaInput.participants} onChange={(value) => setAgendaInput({ ...agendaInput, participants: value })} />
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
              <SuggestedField label="Meeting-Titel" suggestionKey="titles" suggestions={meetingSuggestions.titles} onDeleteSuggestion={deleteMeetingSuggestion} value={preparationInput.title} onChange={(value) => setPreparationInput({ ...preparationInput, title: value })} />
              <SuggestedField label="Ziel des Meetings" suggestionKey="goals" suggestions={meetingSuggestions.goals} onDeleteSuggestion={deleteMeetingSuggestion} value={preparationInput.goal} onChange={(value) => setPreparationInput({ ...preparationInput, goal: value })} />
              <SuggestedField label="Teilnehmer" suggestionKey="participants" suggestions={meetingSuggestions.participants} onDeleteSuggestion={deleteMeetingSuggestion} multiline value={preparationInput.participants} onChange={(value) => setPreparationInput({ ...preparationInput, participants: value })} />
              <Field label="Rollen der Teilnehmer">
                <textarea value={preparationInput.roles} onChange={(event) => setPreparationInput({ ...preparationInput, roles: event.target.value })} />
              </Field>
              <SuggestedField label="Gewünschtes Ergebnis" suggestionKey="outcomes" suggestions={meetingSuggestions.outcomes} onDeleteSuggestion={deleteMeetingSuggestion} multiline value={preparationInput.desiredOutcome} onChange={(value) => setPreparationInput({ ...preparationInput, desiredOutcome: value })} />
              <SuggestedField label="Kritische Themen" suggestionKey="criticalTopics" suggestions={meetingSuggestions.criticalTopics} onDeleteSuggestion={deleteMeetingSuggestion} multiline value={preparationInput.criticalTopics} onChange={(value) => setPreparationInput({ ...preparationInput, criticalTopics: value })} />
              <SuggestedField label="Eigene Position" suggestionKey="ownPositions" suggestions={meetingSuggestions.ownPositions} onDeleteSuggestion={deleteMeetingSuggestion} multiline value={preparationInput.ownPosition} onChange={(value) => setPreparationInput({ ...preparationInput, ownPosition: value })} />
              <div className="form-actions">
                <button className="primary-button" type="submit"><Sparkles size={17} /> Vorbereitung erzeugen</button>
              </div>
            </form>
            {loadingAction === "preparation" && <LoadingIndicator label="KI erstellt die Meeting-Vorbereitung ..." />}
            {preparation && (
              <>
                <section className="analysis-lane">
                  <div className="module-bridge">
                    <div>
                      <h2>Vorbereitung in Simulation testen</h2>
                      <p className="lead">
                        Übernimmt Ziel, Teilnehmer, kritische Themen, erwartbare Einwände und kritische Fragen in das Simulationsmodul.
                      </p>
                    </div>
                    <button className="primary-button" onClick={transferPreparationToSimulation} type="button">
                      <PlayCircle size={17} /> Gesprächsverlauf simulieren
                    </button>
                  </div>
                </section>
                <div className="result-grid">
                  <ResultSection title="Zentrale Argumente" items={preparation.arguments} />
                  <ResultSection title="Erwartbare Einwände" items={preparation.objections} />
                  <ResultSection title="Kritische Fragen" items={preparation.criticalQuestions} />
                  <ResultSection title="Antwortstrategien" items={preparation.responseStrategies} />
                </div>
              </>
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
              <section className="module-bridge module-bridge--form">
                <div>
                  <h2>Aus Vorbereitung übernehmen</h2>
                  <p className="lead">
                    Nutzt vorhandene Vorbereitung als Ausgangsmaterial für Best Case, Worst Case und Most Likely.
                  </p>
                </div>
                <button className="secondary-button" disabled={!preparation && !preparationInput.goal} onClick={transferPreparationToSimulation} type="button">
                  <ClipboardCheck size={17} /> Vorbereitung übernehmen
                </button>
              </section>
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
                  <div className="decision-action-summary">
                    <div>
                      <strong>{transcript.decisions.length}</strong>
                      <span>Entscheidungen erkannt</span>
                    </div>
                    <div>
                      <strong>{transcript.deferredDecisions.length}</strong>
                      <span>vertagte Entscheidungen</span>
                    </div>
                    <div>
                      <strong>{transcript.actionPlan.length}</strong>
                      <span>Maßnahmen abgeleitet</span>
                    </div>
                    <button className="secondary-button" onClick={() => downloadProfessionalExport("actions")} type="button">
                      <Download size={17} /> Maßnahmenliste exportieren
                    </button>
                    <button className="secondary-button" onClick={addManualActionPlanItem} type="button">
                      <ListChecks size={17} /> Maßnahme ergänzen
                    </button>
                  </div>
                  <div className="action-plan-list">
                    {transcript.actionPlan.map((item, index) => (
                      <article className="action-plan-item action-plan-item--editable" key={`${item.task}-${item.owner}-${index}`}>
                        <Field label="Maßnahme">
                          <textarea value={item.task} onChange={(event) => updateActionPlanItem(index, "task", event.target.value)} />
                        </Field>
                        <Field label="Risiko / Kontext">
                          <textarea value={item.risk} onChange={(event) => updateActionPlanItem(index, "risk", event.target.value)} />
                        </Field>
                        <Field label="Owner">
                          <input value={item.owner} onChange={(event) => updateActionPlanItem(index, "owner", event.target.value)} />
                        </Field>
                        <Field label="Frist">
                          <input value={item.due} onChange={(event) => updateActionPlanItem(index, "due", event.target.value)} />
                        </Field>
                        <Field label="Priorität">
                          <select value={item.priority} onChange={(event) => updateActionPlanItem(index, "priority", event.target.value)}>
                            <option value="Hoch">Hoch</option>
                            <option value="Mittel">Mittel</option>
                            <option value="Niedrig">Niedrig</option>
                          </select>
                        </Field>
                        <Field label="Status">
                          <select value={item.status ?? "Offen"} onChange={(event) => updateActionPlanItem(index, "status", event.target.value)}>
                            <option value="Offen">Offen</option>
                            <option value="In Arbeit">In Arbeit</option>
                            <option value="Erledigt">Erledigt</option>
                            <option value="Blockiert">Blockiert</option>
                          </select>
                        </Field>
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
                    setApiProvider(event.target.value as AiProvider);
                    setAnthropicConnectionState("disconnected");
                    setAnthropicStatusText("Nicht verbunden");
                    setAiMode("mock");
                  }}
                >
                  <option value="anthropic">Anthropic</option>
                  <option value="openai">OpenAI</option>
                </select>
              </div>
              <div className="setting-row">
                <span>KI-Modus</span>
                <select
                  value={aiMode}
                  onChange={(event) => {
                    const nextMode = event.target.value as AiMode;
                    setAiMode(nextMode);
                    if (nextMode === "api" && anthropicConnectionState !== "connected") {
                      setAiSettingsStatus("API-Modus gewählt. Bitte Schlüssel eingeben und verbinden.");
                    }
                    if (nextMode === "mock") {
                      setAiSettingsStatus("Mock-KI ist aktiv. Es werden keine externen API-Anfragen gesendet.");
                    }
                  }}
                >
                  <option value="mock">Mock-KI</option>
                  <option value="api">Echte KI vorbereiten</option>
                </select>
              </div>
              <div className="settings-connection-panel">
                <div>
                  <h3>{apiProvider === "anthropic" ? "Anthropic" : "OpenAI"} API-Verbindung</h3>
                  <p>
                    Der Schlüssel kann lokal im Browser gespeichert werden. Es wird noch keine Anfrage
                    an den Anbieter gesendet; echte API-Aufrufe werden erst nach separater Freigabe angebunden.
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
                  <button className="secondary-button" onClick={persistAiSettings} type="button">
                    <Download size={16} /> Lokal speichern
                  </button>
                  {anthropicConnectionState === "connected" && (
                    <>
                      <button className="secondary-button" onClick={disconnectAnthropic} type="button">
                        <Square size={16} /> Trennen
                      </button>
                      <span className="connection-state connection-state--connected">
                        Verbindung ok
                      </span>
                    </>
                  )}
                </div>
                {anthropicConnectionState === "error" && (
                  <p className="connection-error">{anthropicStatusText}</p>
                )}
                <p className="settings-note">{aiSettingsStatus}</p>
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
      {aiConsentDialog && (
        <div className="consent-backdrop" role="presentation">
          <section aria-modal="true" className="consent-dialog" role="dialog">
            <div>
              <p className="eyebrow">Externe Verarbeitung</p>
              <h2>{aiConsentDialog.title}</h2>
              <p>
                Anbieter: <strong>{aiConsentDialog.providerLabel}</strong>
              </p>
              <p>{aiConsentDialog.description}</p>
              <p>
                Bitte bestätige nur, wenn die Verarbeitung mit Datenschutzgrundlagen,
                Vertraulichkeitspflichten und internen Compliance-Vorgaben vereinbar ist.
              </p>
            </div>
            <div className="consent-actions">
              <button className="secondary-button" onClick={() => closeAiConsentDialog(false)} type="button">
                Abbrechen
              </button>
              <button className="primary-button" onClick={() => closeAiConsentDialog(true)} type="button">
                Freigeben
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
