export type RiskLevel = "Grün" | "Gelb" | "Rot";

export type MeetingPreparationInput = {
  title: string;
  goal: string;
  participants: string;
  roles: string;
  desiredOutcome: string;
  criticalTopics: string;
  ownPosition: string;
};

export type MeetingPreparationResult = {
  arguments: string[];
  objections: string[];
  criticalQuestions: string[];
  responseStrategies: string[];
};

export type AgendaInput = {
  title: string;
  meetingGoal: string;
  participants: string;
  duration: string;
  desiredOutcome: string;
  agendaText: string;
  existingAgenda: string;
  comparisonText: string;
};

export type AgendaResult = {
  refinedAgenda: Array<{
    topic: string;
    goal: string;
    owner: string;
    timeBudget: string;
    expectedDecision: string;
  }>;
  qualityChecks: string[];
  preparationQuestions: string[];
  riskSignals: string[];
  sendableAgendaDraft: string;
  comparison: {
    covered: string[];
    skipped: string[];
    newTopics: string[];
    decisions: string[];
    followUps: string[];
  };
};

export type DecisionChallengeResult = {
  weaknesses: string[];
  uncomfortableQuestions: string[];
  counterArguments: Record<"Aufsichtsrat" | "Banker" | "Wettbewerber" | "Projektcontroller", string[]>;
  risk: {
    level: RiskLevel;
    rationale: string;
  };
};

export type MeetingScenario = {
  name: "Best Case" | "Worst Case" | "Most Likely";
  likelyFlow: string[];
  participantStatements: string[];
  optimalResponses: string[];
  turningPoints: string[];
  closingStatement: string;
};

export type TranscriptAnalysisResult = {
  summary: string;
  managementSummary: string;
  said: string[];
  unsaid: string[];
  avoidedTopics: string[];
  contradictions: string[];
  decisions: string[];
  deferredDecisions: string[];
  decisionBasis: string[];
  counterArguments: Record<"Aufsichtsrat" | "CFO / Banker" | "Projektcontroller" | "Kunde / Wettbewerber", string[]>;
  tasks: string[];
  actionPlan: Array<{
    task: string;
    owner: string;
    due: string;
    priority: "Hoch" | "Mittel" | "Niedrig";
    status?: "Offen" | "In Arbeit" | "Erledigt" | "Blockiert";
    risk: string;
  }>;
  openPoints: string[];
  openRisks: string[];
  followUpQuestions: string[];
  followUpEmailDraft: string;
  timestamps: Array<{ time: string; note: string }>;
};

export type TranscriptionResult = {
  transcript: string;
  durationLabel: string;
  sourceLabel: string;
  confidence: "Mock" | "Niedrig" | "Mittel" | "Hoch";
  provider: "Mock" | "OpenAI" | "Anthropic";
  model: string;
  note: string;
};

export type AiQualityReview = {
  level: "Hoch" | "Mittel" | "Niedrig";
  score: number;
  missingInputs: string[];
  assumptions: string[];
  reliabilityNotes: string[];
  recommendedNextChecks: string[];
};

export type StakeholderAnalysisResult = {
  inferredInterests: string[];
  triggers: string[];
  languagePatterns: string[];
  conversationStrategy: string[];
  connectingPhrases: string[];
  avoidPhrases: string[];
};

export type MeetingPatternsResult = {
  recurringObjections: string[];
  argumentativeWeaknesses: string[];
  convincingPhrases: string[];
  uncertainPhrases: string[];
  conflictPatterns: string[];
  improvements: string[];
};

export type MeetingArchive = {
  schemaVersion: 1;
  id: string;
  savedAt: string;
  appVersion: string;
  metadata: {
    title: string;
    project?: string;
    date: string;
    status: "geplant" | "aufgenommen" | "transkribiert" | "analysiert" | "abgeschlossen";
    participants: string;
    goal: string;
    desiredOutcome: string;
  };
  agenda: {
    input: AgendaInput;
    result: AgendaResult | null;
  };
  preparation: {
    input: MeetingPreparationInput;
    result: MeetingPreparationResult | null;
  };
  audio: {
    sourceLabel: string;
    fileName: string;
    durationLabel: string;
    note: string;
  };
  transcription: {
    result: TranscriptionResult | null;
    rawText: string;
  };
  transcriptAnalysis: TranscriptAnalysisResult | null;
  decisionChallenge: DecisionChallengeResult | null;
  simulation: MeetingScenario[] | null;
  stakeholderAnalysis: StakeholderAnalysisResult | null;
  patternAnalysis: MeetingPatternsResult | null;
  qualityReview?: AiQualityReview;
  timeline?: MeetingArchiveTimelineEvent[];
  actionHistory?: MeetingActionHistoryEvent[];
};

export type MeetingArchiveTimelineEvent = {
  id: string;
  label: string;
  timestamp: string;
  category: "Akte" | "Agenda" | "Vorbereitung" | "Audio" | "Transkript" | "Analyse" | "Entscheidung" | "Maßnahmen" | "Export";
  status: "erledigt" | "offen" | "hinweis";
  detail: string;
};

export type MeetingActionHistoryEvent = {
  id: string;
  timestamp: string;
  actionIndex: number;
  actionTask: string;
  field: "status" | "owner" | "due" | "priority" | "task" | "risk";
  previousValue: string;
  nextValue: string;
};

export type MultiMeetingArchiveAnalysisResult = {
  totalMeetings: number;
  recurringObjections: string[];
  repeatedRisks: string[];
  deferredDecisions: string[];
  actionPatterns: string[];
  agendaDiscipline: string[];
  improvementSuggestions: string[];
};
