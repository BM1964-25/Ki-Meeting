export type RiskLevel = "Gruen" | "Gelb" | "Rot";

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
  said: string[];
  unsaid: string[];
  avoidedTopics: string[];
  contradictions: string[];
  openRisks: string[];
  followUpQuestions: string[];
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
