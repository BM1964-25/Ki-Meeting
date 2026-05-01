import {
  AgendaInput,
  AgendaResult,
  DecisionChallengeResult,
  MeetingArchive,
  MeetingPatternsResult,
  MeetingPreparationInput,
  MeetingPreparationResult,
  MeetingScenario,
  MultiMeetingArchiveAnalysisResult,
  StakeholderAnalysisResult,
  TranscriptionResult,
  TranscriptAnalysisResult
} from "@/types/ai";

const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

export type AiServiceProvider = "mock" | "openai" | "anthropic";
export type AiServiceMode = "mock" | "api";

export type AiServiceConfig = {
  mode: AiServiceMode;
  provider: AiServiceProvider;
  apiKey?: string;
};

const mockConfig: AiServiceConfig = {
  mode: "mock",
  provider: "mock"
};

async function routeAiRequest<T>(config: AiServiceConfig | undefined, mockResult: T): Promise<T> {
  const activeConfig = config ?? mockConfig;

  if (activeConfig.mode === "mock" || activeConfig.provider === "mock") {
    await delay();
    return mockResult;
  }

  await delay(450);

  // Future integration point:
  // - activeConfig.provider === "openai": call OpenAI Responses / transcription APIs
  // - activeConfig.provider === "anthropic": call Anthropic Messages API
  // The UI currently requires explicit consent before reaching this branch.
  // Until real API calls are connected, structured mock results are returned.
  return mockResult;
}

export async function generateMeetingPreparation(
  input: MeetingPreparationInput,
  config?: AiServiceConfig
): Promise<MeetingPreparationResult> {
  return routeAiRequest(config, {
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
  });
}

export async function generateAgendaWorkflow(input: AgendaInput, config?: AiServiceConfig): Promise<AgendaResult> {
  const title = input.title || "Strategisches Abstimmungsmeeting";
  const goal = input.meetingGoal || "Entscheidungslage klären und nächste Schritte verbindlich festlegen";
  const duration = input.duration || "60 Minuten";
  const desiredOutcome = input.desiredOutcome || "klare Entscheidung oder belastbarer Follow-up-Auftrag";

  return routeAiRequest(config, {
    refinedAgenda: [
      {
        topic: "Zielbild und Entscheidungsfrage schärfen",
        goal: `Gemeinsames Verständnis herstellen: ${goal}.`,
        owner: "Meeting-Owner",
        timeBudget: "10 Min.",
        expectedDecision: "Entscheidungsfrage ist von allen Teilnehmenden akzeptiert."
      },
      {
        topic: "Ausgangslage, Datenbasis und offene Annahmen",
        goal: "Fakten, Annahmen und Unsicherheiten sichtbar voneinander trennen.",
        owner: "Fachbereich / Controlling",
        timeBudget: "15 Min.",
        expectedDecision: "Offene Annahmen sind priorisiert und mit Owner versehen."
      },
      {
        topic: "Risiken, Einwände und Alternativen",
        goal: "Kritische Punkte früh behandeln, bevor die Runde in Detaildiskussionen abgleitet.",
        owner: "Projektleitung",
        timeBudget: "15 Min.",
        expectedDecision: "Akzeptierte Risiken und noch zu reduzierende Risiken sind getrennt."
      },
      {
        topic: "Entscheidung, Maßnahmen und Follow-up",
        goal: `Das gewünschte Ergebnis absichern: ${desiredOutcome}.`,
        owner: "Entscheiderkreis",
        timeBudget: "15 Min.",
        expectedDecision: "Entscheidung, Verantwortliche und Termin sind festgehalten."
      },
      {
        topic: "Abschluss und Kommunikationslinie",
        goal: "Einheitliche Ergebnisformulierung für alle Beteiligten vereinbaren.",
        owner: "Meeting-Owner",
        timeBudget: "5 Min.",
        expectedDecision: "Follow-up-Mail und nächste Kommunikation sind abgestimmt."
      }
    ],
    qualityChecks: [
      `Die Agenda ist für ${duration} realistisch, wenn die Entscheidungsfrage zu Beginn klar eingegrenzt wird.`,
      "Jeder Agenda-Punkt sollte mit einem konkreten Ergebnis enden, nicht nur mit Diskussion.",
      "Kritische Risiken sollten vor der Entscheidung behandelt werden, nicht erst im Abschluss.",
      "Teilnehmerrollen und Entscheidungsrechte sollten vor Versand der Agenda sichtbar gemacht werden."
    ],
    preparationQuestions: [
      "Welche Entscheidung muss am Ende ausdrücklich getroffen oder vertagt werden?",
      "Welche Information würde die Empfehlung noch verändern?",
      "Wer könnte die Agenda als zu früh, zu eng oder zu offen kritisieren?",
      "Welche Einwände sollten aktiv eingeladen werden, damit sie später nicht verdeckt blockieren?"
    ],
    riskSignals: [
      "Agenda-Punkte ohne Owner führen wahrscheinlich zu unverbindlicher Diskussion.",
      "Wenn Budget, Ressourcen oder Prioritäten erst am Ende auftauchen, steigt das Vertagungsrisiko.",
      "Eine bestehende Agenda ohne Entscheidungsfrage kann später nur schwer gegen Ergebnisse abgeglichen werden."
    ],
    sendableAgendaDraft:
      `Betreff: Agenda ${title}\n\nHallo zusammen,\n\nfür unser Meeting schlage ich folgende Agenda vor. Ziel ist: ${goal}. Das gewünschte Ergebnis ist: ${desiredOutcome}.\n\n1. Zielbild und Entscheidungsfrage schärfen\n2. Ausgangslage, Datenbasis und offene Annahmen\n3. Risiken, Einwände und Alternativen\n4. Entscheidung, Maßnahmen und Follow-up\n5. Abschluss und Kommunikationslinie\n\nBitte ergänzt vorab, welche Punkte aus eurer Sicht für die Entscheidung zwingend geklärt werden müssen.\n\nViele Grüße`,
    comparison: {
      covered: [
        "Ziel und Ausgangslage wurden voraussichtlich behandelt, wenn sie im Transkript ausdrücklich erwähnt werden.",
        "Risiken wurden adressiert, sofern Einwände, Budget, Ressourcen oder Timing diskutiert wurden."
      ],
      skipped: [
        "Entscheidungsrechte und finale Verantwortlichkeit sind häufig nicht klar genug ausgesprochen.",
        "Kommunikationslinie und Ergebnisformulierung werden oft am Ende vergessen."
      ],
      newTopics: [
        "Ungeplante Ressourcenkonflikte",
        "Zusätzliche Abhängigkeiten zu anderen Projekten"
      ],
      decisions: [
        "Entscheidung oder Vertagung sollte je Agenda-Punkt dokumentiert werden.",
        "Offene Annahmen brauchen Owner und Termin."
      ],
      followUps: [
        "Agenda-Punkte ohne Ergebnis in den nächsten Termin übernehmen.",
        "Abweichungen zwischen Agenda und tatsächlichem Verlauf im Ergebnisprotokoll markieren."
      ]
    }
  });
}

export async function generateDecisionChallenge(decision: string, config?: AiServiceConfig): Promise<DecisionChallengeResult> {
  return routeAiRequest(config, {
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
  });
}

export async function generateMeetingSimulation(config?: AiServiceConfig): Promise<MeetingScenario[]> {
  return routeAiRequest(config, [
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
  ]);
}

export async function analyzeTranscript(transcript: string, config?: AiServiceConfig): Promise<TranscriptAnalysisResult> {
  const timestamps = Array.from(transcript.matchAll(/(?:^|\s)(\d{1,2}:\d{2}(?::\d{2})?)/g)).map((match) => ({
    time: match[1],
    note: "Zeitmarke erkannt: Für spätere Detailanalyse als Referenz nutzbar."
  }));

  return routeAiRequest(config, {
    managementSummary:
      "Das Meeting wirkt entscheidungsnah, aber noch nicht entscheidungsreif. Nutzen und Handlungsdruck sind erkennbar; belastbare Verantwortlichkeiten, Entscheidungskriterien und Risikotoleranzen fehlen noch. Für das Management sollte der nächste Schritt eine klare Entscheidungsfrage mit Owner, Termin und prüfbaren Voraussetzungen sein.",
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
    deferredDecisions: [
      "Budget- und Ressourcenfreigabe wurden noch nicht verbindlich entschieden.",
      "Die finale Verantwortlichkeit für die Nachverfolgung bleibt offen."
    ],
    decisionBasis: [
      "Genannte Entscheidungsgrundlage: Zielerreichung, Budget, Ressourcen und Timing.",
      "Noch fehlend: harte Abbruchkriterien, Risikotoleranz und belastbare Owner."
    ],
    counterArguments: {
      Aufsichtsrat: [
        "Governance und Entscheidungsbefugnis sind nicht ausreichend dokumentiert.",
        "Die Risikotoleranz ist noch zu weich formuliert."
      ],
      "CFO / Banker": [
        "Budget- und Liquiditätseffekte sind noch nicht belastbar abgegrenzt.",
        "Der Business Case braucht klarere Annahmen und Sensitivitäten."
      ],
      Projektcontroller: [
        "Ohne Owner, Termin und Meilenstein bleibt die Umsetzung nicht steuerbar.",
        "Ressourcenrisiken wurden angesprochen, aber nicht in Maßnahmen übersetzt."
      ],
      "Kunde / Wettbewerber": [
        "Der Kundennutzen wurde noch nicht scharf genug gegenüber Alternativen positioniert.",
        "Ein Wettbewerber könnte Verzögerungen ausnutzen, wenn keine klare Entscheidung folgt."
      ]
    },
    tasks: [
      "Entscheiderkreis und finale Entscheidungsbefugnis schriftlich festhalten.",
      "Offene Budget- und Ressourcenannahmen bis zum nächsten Termin validieren.",
      "Verantwortliche Person für die Nachverfolgung benennen."
    ],
    actionPlan: [
      {
        task: "Konkrete Entscheidungsfrage formulieren und vorab verteilen.",
        owner: "Meeting-Owner",
        due: "vor dem nächsten Termin",
        priority: "Hoch",
        risk: "Ohne klare Frage wird erneut nur diskutiert statt entschieden."
      },
      {
        task: "Budget- und Ressourcenannahmen validieren.",
        owner: "Controlling / Fachbereich",
        due: "innerhalb von 5 Arbeitstagen",
        priority: "Hoch",
        risk: "Die Entscheidung bleibt angreifbar, wenn zentrale Annahmen offen sind."
      },
      {
        task: "Offene Risiken und akzeptierte Risiken trennen.",
        owner: "Projektleitung",
        due: "bis zum Follow-up",
        priority: "Mittel",
        risk: "Risiken werden sonst weiter sprachlich weich behandelt."
      }
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
  });
}

export async function transcribeMeetingAudio(
  sourceLabel: string,
  durationLabel = "unbekannt",
  config?: AiServiceConfig
): Promise<TranscriptionResult> {
  return routeAiRequest(config, {
    sourceLabel,
    durationLabel,
    confidence: "Mock",
    transcript:
      "00:00 Begrüßung und Zielklärung. 00:45 Der Teilnehmerkreis diskutiert die Entscheidungsfrage und benennt Budget, Ressourcen und Timing als kritische Punkte. 02:10 Ein Einwand zur Umsetzbarkeit wird aufgenommen. 03:20 Die Runde vereinbart, offene Annahmen bis zum nächsten Termin zu prüfen und Verantwortlichkeiten festzuhalten."
  });
}

export async function analyzeStakeholder(config?: AiServiceConfig): Promise<StakeholderAnalysisResult> {
  return routeAiRequest(config, {
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
  });
}

export async function analyzeMeetingPatterns(config?: AiServiceConfig): Promise<MeetingPatternsResult> {
  return routeAiRequest(config, {
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
  });
}

export async function analyzeMeetingArchives(
  archives: MeetingArchive[],
  config?: AiServiceConfig
): Promise<MultiMeetingArchiveAnalysisResult> {
  const titles = archives.map((archive) => archive.metadata.title).filter(Boolean);
  const analyzedCount = archives.filter((archive) => archive.transcriptAnalysis).length;
  const agendaCount = archives.filter((archive) => archive.agenda.result).length;

  return routeAiRequest(config, {
    totalMeetings: archives.length,
    recurringObjections: [
      "Ressourcen- und Budgeteinwände tauchen in mehreren Projektakten als wiederkehrendes Muster auf.",
      "Entscheidungen werden häufig an fehlende Datensicherheit oder unklare Owner gekoppelt.",
      "Timing und Priorisierung erscheinen als typische Einwandlinien."
    ],
    repeatedRisks: [
      `${analyzedCount} von ${archives.length} geladenen Meetings enthalten bereits Transkript- oder Ergebnisanalysen.`,
      "Risiken werden oft benannt, aber nicht konsequent in konkrete Maßnahmen übersetzt.",
      "Vertagungen entstehen vor allem dort, wo Entscheidungsfrage und Verantwortlichkeit getrennt bleiben."
    ],
    deferredDecisions: [
      "Budgetfreigaben und Ressourcenentscheidungen sollten über mehrere Meetings hinweg gesondert verfolgt werden.",
      "Offene Entscheidungsvoraussetzungen brauchen eine eigene Wiedervorlage mit Termin.",
      titles.length ? `Für die Projektakten ${titles.slice(0, 3).join(", ")} sollte geprüft werden, welche Entscheidungen mehrfach vertagt wurden.` : "Für geladene Projektakten sollte geprüft werden, welche Entscheidungen mehrfach vertagt wurden."
    ],
    actionPatterns: [
      "Maßnahmen mit Owner und Frist sind deutlich verbindlicher als allgemeine Follow-up-Formulierungen.",
      "Hohe Prioritäten sollten mit einem konkreten Risiko verknüpft werden.",
      "Wiederkehrende offene Punkte gehören in ein eigenes Maßnahmenregister."
    ],
    agendaDiscipline: [
      `${agendaCount} von ${archives.length} geladenen Meetings enthalten gespeicherte Agenda-Ergebnisse.`,
      "Agenda-Treue wird messbar, sobald geplante Punkte, tatsächliche Diskussion und Entscheidungen zusammen gespeichert werden.",
      "Übersprungene Agenda-Punkte sollten im nächsten Meeting sichtbar wieder aufgenommen werden."
    ],
    improvementSuggestions: [
      "Jede Projektakte mit einer klaren Entscheidungsfrage starten.",
      "Nach jedem Meeting Entscheidungen, vertagte Punkte und Maßnahmen getrennt speichern.",
      "Für Musteranalysen mehrere Projektakten laden und insbesondere Einwände, Risiken und offene Maßnahmen vergleichen."
    ]
  });
}
