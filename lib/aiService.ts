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

const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

export async function generateMeetingPreparation(
  input: MeetingPreparationInput
): Promise<MeetingPreparationResult> {
  await delay();

  return {
    arguments: [
      `Das Meeting-Ziel "${input.goal || "Ziel klären"}" sollte konsequent mit dem gewünschten Ergebnis verknüpft werden.`,
      "Nutzen, Risiko und Entscheidungsbedarf früh trennen, damit die Diskussion nicht in Detailfragen abgleitet.",
      `Die eigene Position (${input.ownPosition || "noch zu schärfen"}) als belastbare Empfehlung, nicht als Meinung formulieren.`
    ],
    objections: [
      "Budget- oder Ressourcenbindung könnte als zu früh kritisiert werden.",
      "Teilnehmer könnten fehlende Datenbasis oder unklare Verantwortlichkeiten ansprechen.",
      "Kritische Themen könnten auf spätere Runden verschoben werden."
    ],
    criticalQuestions: [
      "Welche Entscheidung muss am Ende wirklich getroffen sein?",
      "Welche Annahme würde die Empfehlung sofort kippen?",
      "Wer trägt das Risiko, wenn keine Entscheidung fällt?"
    ],
    responseStrategies: [
      "Einwand anerkennen, Entscheidungskriterium benennen, konkrete nächste Prüfung anbieten.",
      "Bei Widerstand zwischen Sachrisiko, Interessenkonflikt und Timing-Problem unterscheiden.",
      "Am Ende eine klare Commit-Frage stellen: Zustimmung, Bedenken oder definierter Nacharbeitsauftrag."
    ]
  };
}

export async function generateDecisionChallenge(decision: string): Promise<DecisionChallengeResult> {
  await delay();

  return {
    weaknesses: [
      "Die zugrunde liegenden Annahmen sind noch nicht priorisiert.",
      "Es fehlt ein klarer Abbruchpunkt für den Fall schlechter Zwischenindikatoren.",
      "Stakeholder mit Vetomacht sind möglicherweise zu spät eingebunden.",
      "Die Opportunitätskosten gegenüber Alternativen sind nicht transparent.",
      "Operative Kapazitäten werden optimistischer bewertet als historisch belegt.",
      "Die Entscheidung ist stark von Einzelpersonen abhängig.",
      "Finanzielle Effekte sind zeitlich nicht ausreichend abgegrenzt.",
      "Risiken aus Abhängigkeiten zu Lieferanten oder Partnern sind unterschätzt.",
      "Es gibt keinen belastbaren Kommunikationsplan für Widerstand.",
      "Erfolgskriterien sind noch nicht messbar genug formuliert."
    ],
    uncomfortableQuestions: [
      `Was wäre der ehrlichste Grund, die Entscheidung "${decision || "diese Entscheidung"}" heute nicht zu treffen?`,
      "Welche Information würde das Management später als Warnsignal interpretieren?",
      "Wer profitiert, wenn die Entscheidung unklar bleibt?",
      "Welche Konsequenz wird aktuell politisch vermieden?",
      "Welche Alternative wurde nicht ernsthaft genug geprüft?"
    ],
    counterArguments: {
      Aufsichtsrat: [
        "Governance, Haftung und strategische Konsistenz sind noch nicht ausreichend dokumentiert.",
        "Die Entscheidung braucht klarere Kontrollpunkte."
      ],
      Banker: [
        "Cashflow-Wirkung und Covenants müssen konservativer gerechnet werden.",
        "Die Kapitalbindung könnte die Flexibilität in einem Abschwung einschränken."
      ],
      Wettbewerber: [
        "Der Markteintritt ist sichtbar und leicht konterbar.",
        "Differenzierung und Geschwindigkeit reichen nicht aus, um Nachahmung zu verhindern."
      ],
      Projektcontroller: [
        "Termine, Ressourcen und Eskalationspfade sind zu weich beschrieben.",
        "Die aktuellen Meilensteine zeigen zu wenig Frühwarnindikatoren."
      ]
    },
    risk: {
      level: "Gelb",
      rationale: "Strategisch plausibel, aber mit relevanten Umsetzungs- und Annahmerisiken. Vor Freigabe sollten Trigger, Kostenrahmen und Entscheidungslogik geschärft werden."
    }
  };
}

export async function generateMeetingSimulation(): Promise<MeetingScenario[]> {
  await delay();

  return [
    {
      name: "Best Case",
      likelyFlow: ["Ziel wird akzeptiert.", "Einwände bleiben sachlich.", "Es entsteht ein klares Commitment."],
      participantStatements: ["Das ist nachvollziehbar.", "Welche nächsten Schritte brauchen wir?", "Ich kann den Teil übernehmen."],
      optimalResponses: ["Danke, ich schlage drei konkrete Entscheidungspunkte vor.", "Lassen Sie uns Verantwortung und Termin direkt festhalten."],
      turningPoints: ["Frühe Zustimmung eines Schlüssel-Stakeholders.", "Gemeinsames Verständnis der Risiken."],
      closingStatement: "Wir halten fest: Entscheidung, Verantwortliche und nächster Prüfpunkt sind vereinbart."
    },
    {
      name: "Worst Case",
      likelyFlow: ["Einflussreiche Teilnehmer stellen Grundannahmen infrage.", "Die Diskussion springt zwischen Details.", "Eine Entscheidung wird vertagt."],
      participantStatements: ["Das ist mir zu unsicher.", "Wir haben dafür keine Kapazität.", "Das sollten wir später klären."],
      optimalResponses: ["Welches Kriterium müsste erfüllt sein, damit Sie zustimmen können?", "Ich trenne kurz Risiko, Ressource und Entscheidungsbedarf."],
      turningPoints: ["Ein pauschaler Einwand bleibt unwidersprochen.", "Niemand übernimmt die offene Risikoannahme."],
      closingStatement: "Wenn heute keine Entscheidung möglich ist, vereinbaren wir die fehlende Evidenz, den Owner und den Termin."
    },
    {
      name: "Most Likely",
      likelyFlow: ["Grundsätzliche Zustimmung mit Bedenken.", "Einige Themen werden vertagt.", "Es entsteht ein bedingtes Commitment."],
      participantStatements: ["Ich sehe den Nutzen, aber die Umsetzung ist kritisch.", "Wir brauchen mehr Sicherheit bei Kosten und Timing."],
      optimalResponses: ["Ich nehme die Bedingung auf und mache sie messbar.", "Die Entscheidung kann als Stufenfreigabe formuliert werden."],
      turningPoints: ["Bedenken werden in Bedingungen übersetzt.", "Ein klares Follow-up verhindert diffuse Vertagung."],
      closingStatement: "Wir einigen uns auf eine bedingte Freigabe mit klaren Prüfpunkten und Verantwortlichen."
    }
  ];
}

export async function analyzeTranscript(transcript: string): Promise<TranscriptAnalysisResult> {
  await delay();
  const timestamps = Array.from(transcript.matchAll(/(?:^|\s)(\d{1,2}:\d{2}(?::\d{2})?)/g)).map((match) => ({
    time: match[1],
    note: "Zeitmarke erkannt: Für spätere Detailanalyse als Referenz nutzbar."
  }));

  return {
    summary:
      "Das Meeting zeigt grundsätzlichen Abstimmungsbedarf, aber noch keine vollständig belastbare Entscheidungslage. Ziele und nächste Schritte wurden angesprochen; Entscheidungsrechte, Verantwortlichkeiten und Konsequenzen bei Nicht-Entscheidung sollten im Follow-up präzisiert werden.",
    said: ["Ziele und nächste Schritte wurden angesprochen.", "Mehrere Risiken wurden indirekt berührt."],
    unsaid: ["Konkrete Entscheidungsrechte blieben unklar.", "Konsequenzen bei Nicht-Entscheidung wurden nicht benannt."],
    avoidedTopics: ["Budgetverantwortung", "Ressourcenkonflikte", "Eskalationslogik"],
    contradictions: ["Es wurde Dringlichkeit betont, aber kein verbindlicher Termin vereinbart."],
    decisions: [
      "Noch keine finale Entscheidung erkennbar.",
      "Es wurde ein weiterer Klärungs- oder Prüftermin implizit notwendig."
    ],
    tasks: [
      "Entscheiderkreis und finale Entscheidungsbefugnis schriftlich festhalten.",
      "Offene Budget- und Ressourcenannahmen bis zum nächsten Termin validieren.",
      "Verantwortliche Person für die Nachverfolgung benennen."
    ],
    openPoints: [
      "Welche Entscheidung soll beim nächsten Termin konkret getroffen werden?",
      "Welche Daten fehlen noch für eine belastbare Freigabe?",
      "Welche Risiken werden bewusst akzeptiert und welche müssen reduziert werden?"
    ],
    openRisks: ["Diffuse Zustimmung ohne Owner.", "Offene Abhängigkeiten können später zu Blockaden führen."],
    followUpQuestions: [
      "Wer entscheidet final und bis wann?",
      "Welche Annahme muss vor dem nächsten Termin validiert werden?",
      "Welche Risiken akzeptieren wir bewusst?"
    ],
    followUpEmailDraft:
      "Betreff: Follow-up zum Meeting\n\nHallo zusammen,\n\nvielen Dank für die Diskussion. Aus meiner Sicht sollten wir bis zum nächsten Termin drei Punkte klären: erstens die konkrete Entscheidungsfrage, zweitens die offenen Budget- und Ressourcenannahmen und drittens die verantwortliche Person für die Nachverfolgung.\n\nBitte ergänzt bis zum vereinbarten Termin, welche Risiken aus eurer Sicht noch offen sind und welche Voraussetzungen für eine Entscheidung erfüllt sein müssen.\n\nViele Grüße",
    timestamps
  };
}

export async function transcribeMeetingAudio(sourceLabel: string, durationLabel = "unbekannt"): Promise<TranscriptionResult> {
  await delay(450);

  return {
    sourceLabel,
    durationLabel,
    confidence: "Mock",
    transcript:
      "00:00 Begrüßung und Zielklärung. 00:45 Der Teilnehmerkreis diskutiert die Entscheidungsfrage und benennt Budget, Ressourcen und Timing als kritische Punkte. 02:10 Ein Einwand zur Umsetzbarkeit wird aufgenommen. 03:20 Die Runde vereinbart, offene Annahmen bis zum nächsten Termin zu prüfen und Verantwortlichkeiten festzuhalten."
  };
}

export async function analyzeStakeholder(): Promise<StakeholderAnalysisResult> {
  await delay();

  return {
    inferredInterests: ["Planbarkeit", "Einfluss auf Entscheidungskriterien", "Schutz eigener Ressourcen"],
    triggers: ["Unklare Verantwortlichkeiten", "Überraschende Budgetforderungen", "Öffentliche Festlegung ohne Vorlauf"],
    languagePatterns: ["Prüfende Fragen", "Absicherung über Zahlen", "Betonung von Machbarkeit"],
    conversationStrategy: [
      "Früh Transparenz über Ziel und Entscheidungsbedarf herstellen.",
      "Interessen als legitime Kriterien aufnehmen.",
      "Konkrete Optionen statt abstrakter Forderungen anbieten."
    ],
    connectingPhrases: [
      "Aus Ihrer Perspektive ist die Umsetzbarkeit wahrscheinlich der kritische Punkt.",
      "Ich würde die Entscheidung gern an klaren Kriterien festmachen.",
      "Welche Bedingung müsste erfüllt sein, damit Sie mitgehen können?"
    ],
    avoidPhrases: [
      "Das ist nur eine Formalie.",
      "Wir müssen das jetzt einfach entscheiden.",
      "Die Details klären wir später."
    ]
  };
}

export async function analyzeMeetingPatterns(): Promise<MeetingPatternsResult> {
  await delay();

  return {
    recurringObjections: ["Zu wenig Ressourcen", "Unklare Priorisierung", "Fehlende Entscheidungsgrundlage"],
    argumentativeWeaknesses: ["Nutzen wird stark beschrieben, Entscheidungskriterium aber zu spät benannt.", "Risikoannahmen werden nicht aktiv genug quantifiziert."],
    convincingPhrases: ["Wenn wir heute A entscheiden, können wir B bis Freitag absichern.", "Der Vorschlag reduziert vor allem das Risiko X."],
    uncertainPhrases: ["Ich glaube, das müsste passen.", "Das klären wir wahrscheinlich später."],
    conflictPatterns: ["Kosten gegen Geschwindigkeit", "Fachbereich gegen Steuerung", "Kurzfristiger Aufwand gegen strategischen Nutzen"],
    improvements: [
      "Jedes Meeting mit einer konkreten Entscheidungsfrage beginnen.",
      "Einwände als Bedingungen für Zustimmung formulieren lassen.",
      "Am Ende Owner, Termin und Risikoannahme sichtbar festhalten."
    ]
  };
}
