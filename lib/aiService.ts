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
      `Das Meeting-Ziel "${input.goal || "Ziel klaeren"}" sollte konsequent mit dem gewuenschten Ergebnis verknuepft werden.`,
      "Nutzen, Risiko und Entscheidungsbedarf frueh trennen, damit die Diskussion nicht in Detailfragen abgleitet.",
      `Die eigene Position (${input.ownPosition || "noch zu schaerfen"}) als belastbare Empfehlung, nicht als Meinung formulieren.`
    ],
    objections: [
      "Budget- oder Ressourcenbindung koennte als zu frueh kritisiert werden.",
      "Teilnehmer koennten fehlende Datenbasis oder unklare Verantwortlichkeiten ansprechen.",
      "Kritische Themen koennten auf spaetere Runden verschoben werden."
    ],
    criticalQuestions: [
      "Welche Entscheidung muss am Ende wirklich getroffen sein?",
      "Welche Annahme wuerde die Empfehlung sofort kippen?",
      "Wer traegt das Risiko, wenn keine Entscheidung faellt?"
    ],
    responseStrategies: [
      "Einwand anerkennen, Entscheidungskriterium benennen, konkrete naechste Pruefung anbieten.",
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
      "Es fehlt ein klarer Abbruchpunkt fuer den Fall schlechter Zwischenindikatoren.",
      "Stakeholder mit Vetomacht sind moeglicherweise zu spaet eingebunden.",
      "Die Opportunitaetskosten gegenueber Alternativen sind nicht transparent.",
      "Operative Kapazitaeten werden optimistischer bewertet als historisch belegt.",
      "Die Entscheidung ist stark von Einzelpersonen abhaengig.",
      "Finanzielle Effekte sind zeitlich nicht ausreichend abgegrenzt.",
      "Risiken aus Abhaengigkeiten zu Lieferanten oder Partnern sind unterschaetzt.",
      "Es gibt keinen belastbaren Kommunikationsplan fuer Widerstand.",
      "Erfolgskriterien sind noch nicht messbar genug formuliert."
    ],
    uncomfortableQuestions: [
      `Was waere der ehrlichste Grund, die Entscheidung "${decision || "diese Entscheidung"}" heute nicht zu treffen?`,
      "Welche Information wuerde das Management spaeter als Warnsignal interpretieren?",
      "Wer profitiert, wenn die Entscheidung unklar bleibt?",
      "Welche Konsequenz wird aktuell politisch vermieden?",
      "Welche Alternative wurde nicht ernsthaft genug geprueft?"
    ],
    counterArguments: {
      Aufsichtsrat: [
        "Governance, Haftung und strategische Konsistenz sind noch nicht ausreichend dokumentiert.",
        "Die Entscheidung braucht klarere Kontrollpunkte."
      ],
      Banker: [
        "Cashflow-Wirkung und Covenants muessen konservativer gerechnet werden.",
        "Die Kapitalbindung koennte die Flexibilitaet in einem Abschwung einschraenken."
      ],
      Wettbewerber: [
        "Der Markteintritt ist sichtbar und leicht konterbar.",
        "Differenzierung und Geschwindigkeit reichen nicht aus, um Nachahmung zu verhindern."
      ],
      Projektcontroller: [
        "Termine, Ressourcen und Eskalationspfade sind zu weich beschrieben.",
        "Die aktuellen Meilensteine zeigen zu wenig Fruehwarnindikatoren."
      ]
    },
    risk: {
      level: "Gelb",
      rationale: "Strategisch plausibel, aber mit relevanten Umsetzungs- und Annahmerisiken. Vor Freigabe sollten Trigger, Kostenrahmen und Entscheidungslogik geschaerft werden."
    }
  };
}

export async function generateMeetingSimulation(): Promise<MeetingScenario[]> {
  await delay();

  return [
    {
      name: "Best Case",
      likelyFlow: ["Ziel wird akzeptiert.", "Einwaende bleiben sachlich.", "Es entsteht ein klares Commitment."],
      participantStatements: ["Das ist nachvollziehbar.", "Welche naechsten Schritte brauchen wir?", "Ich kann den Teil uebernehmen."],
      optimalResponses: ["Danke, ich schlage drei konkrete Entscheidungspunkte vor.", "Lassen Sie uns Verantwortung und Termin direkt festhalten."],
      turningPoints: ["Fruehe Zustimmung eines Schluessel-Stakeholders.", "Gemeinsames Verstaendnis der Risiken."],
      closingStatement: "Wir halten fest: Entscheidung, Verantwortliche und naechster Pruefpunkt sind vereinbart."
    },
    {
      name: "Worst Case",
      likelyFlow: ["Einflussreiche Teilnehmer stellen Grundannahmen infrage.", "Die Diskussion springt zwischen Details.", "Eine Entscheidung wird vertagt."],
      participantStatements: ["Das ist mir zu unsicher.", "Wir haben dafuer keine Kapazitaet.", "Das sollten wir spaeter klaeren."],
      optimalResponses: ["Welches Kriterium muesste erfuellt sein, damit Sie zustimmen koennen?", "Ich trenne kurz Risiko, Ressource und Entscheidungsbedarf."],
      turningPoints: ["Ein pauschaler Einwand bleibt unwidersprochen.", "Niemand uebernimmt die offene Risikoannahme."],
      closingStatement: "Wenn heute keine Entscheidung moeglich ist, vereinbaren wir die fehlende Evidenz, den Owner und den Termin."
    },
    {
      name: "Most Likely",
      likelyFlow: ["Grundsaetzliche Zustimmung mit Bedenken.", "Einige Themen werden vertagt.", "Es entsteht ein bedingtes Commitment."],
      participantStatements: ["Ich sehe den Nutzen, aber die Umsetzung ist kritisch.", "Wir brauchen mehr Sicherheit bei Kosten und Timing."],
      optimalResponses: ["Ich nehme die Bedingung auf und mache sie messbar.", "Die Entscheidung kann als Stufenfreigabe formuliert werden."],
      turningPoints: ["Bedenken werden in Bedingungen uebersetzt.", "Ein klares Follow-up verhindert diffuse Vertagung."],
      closingStatement: "Wir einigen uns auf eine bedingte Freigabe mit klaren Pruefpunkten und Verantwortlichen."
    }
  ];
}

export async function analyzeTranscript(transcript: string): Promise<TranscriptAnalysisResult> {
  await delay();
  const timestamps = Array.from(transcript.matchAll(/(?:^|\s)(\d{1,2}:\d{2}(?::\d{2})?)/g)).map((match) => ({
    time: match[1],
    note: "Zeitmarke erkannt: Fuer spaetere Detailanalyse als Referenz nutzbar."
  }));

  return {
    said: ["Ziele und naechste Schritte wurden angesprochen.", "Mehrere Risiken wurden indirekt beruehrt."],
    unsaid: ["Konkrete Entscheidungsrechte blieben unklar.", "Konsequenzen bei Nicht-Entscheidung wurden nicht benannt."],
    avoidedTopics: ["Budgetverantwortung", "Ressourcenkonflikte", "Eskalationslogik"],
    contradictions: ["Es wurde Dringlichkeit betont, aber kein verbindlicher Termin vereinbart."],
    openRisks: ["Diffuse Zustimmung ohne Owner.", "Offene Abhaengigkeiten koennen spaeter zu Blockaden fuehren."],
    followUpQuestions: [
      "Wer entscheidet final und bis wann?",
      "Welche Annahme muss vor dem naechsten Termin validiert werden?",
      "Welche Risiken akzeptieren wir bewusst?"
    ],
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
      "00:00 Begruessung und Zielklaerung. 00:45 Der Teilnehmerkreis diskutiert die Entscheidungsfrage und benennt Budget, Ressourcen und Timing als kritische Punkte. 02:10 Ein Einwand zur Umsetzbarkeit wird aufgenommen. 03:20 Die Runde vereinbart, offene Annahmen bis zum naechsten Termin zu pruefen und Verantwortlichkeiten festzuhalten."
  };
}

export async function analyzeStakeholder(): Promise<StakeholderAnalysisResult> {
  await delay();

  return {
    inferredInterests: ["Planbarkeit", "Einfluss auf Entscheidungskriterien", "Schutz eigener Ressourcen"],
    triggers: ["Unklare Verantwortlichkeiten", "Ueberraschende Budgetforderungen", "Oeffentliche Festlegung ohne Vorlauf"],
    languagePatterns: ["Pruefende Fragen", "Absicherung ueber Zahlen", "Betonung von Machbarkeit"],
    conversationStrategy: [
      "Frueh Transparenz ueber Ziel und Entscheidungsbedarf herstellen.",
      "Interessen als legitime Kriterien aufnehmen.",
      "Konkrete Optionen statt abstrakter Forderungen anbieten."
    ],
    connectingPhrases: [
      "Aus Ihrer Perspektive ist die Umsetzbarkeit wahrscheinlich der kritische Punkt.",
      "Ich wuerde die Entscheidung gern an klaren Kriterien festmachen.",
      "Welche Bedingung muesste erfuellt sein, damit Sie mitgehen koennen?"
    ],
    avoidPhrases: [
      "Das ist nur eine Formalie.",
      "Wir muessen das jetzt einfach entscheiden.",
      "Die Details klaeren wir spaeter."
    ]
  };
}

export async function analyzeMeetingPatterns(): Promise<MeetingPatternsResult> {
  await delay();

  return {
    recurringObjections: ["Zu wenig Ressourcen", "Unklare Priorisierung", "Fehlende Entscheidungsgrundlage"],
    argumentativeWeaknesses: ["Nutzen wird stark beschrieben, Entscheidungskriterium aber zu spaet benannt.", "Risikoannahmen werden nicht aktiv genug quantifiziert."],
    convincingPhrases: ["Wenn wir heute A entscheiden, koennen wir B bis Freitag absichern.", "Der Vorschlag reduziert vor allem das Risiko X."],
    uncertainPhrases: ["Ich glaube, das muesste passen.", "Das klaeren wir wahrscheinlich spaeter."],
    conflictPatterns: ["Kosten gegen Geschwindigkeit", "Fachbereich gegen Steuerung", "Kurzfristiger Aufwand gegen strategischen Nutzen"],
    improvements: [
      "Jedes Meeting mit einer konkreten Entscheidungsfrage beginnen.",
      "Einwaende als Bedingungen fuer Zustimmung formulieren lassen.",
      "Am Ende Owner, Termin und Risikoannahme sichtbar festhalten."
    ]
  };
}
