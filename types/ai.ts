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
