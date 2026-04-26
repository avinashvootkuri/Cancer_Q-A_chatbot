const DIAGNOSIS_RE =
  /\b(how is .*?(diagnos|detect|screen)|diagnos\w*|detect\w*|screen\w*|evaluat\w*|workup|confirm\w*|what tests|which tests|medical tests|early detection|biopsy|scan\w*|imaging|mammogram|colonoscopy|pap smear|psa|blood test|lab test|test\w*)\b/i;

const TREATMENT_RE =
  /\b(how is .*?treated|treatment options?|treated|treat\w*|therap\w*|management|manage\w*|medicat\w*|medicine|surgery|operation|chemo\w*|radiat\w*|targeted therapy|hormone therapy|transplant|palliative|cure)\b/i;

const LIFESTYLE_RE =
  /\b(how can i prevent|how to prevent|prevent\w*|reduce risk|risk reduction|recover\w*|surviv\w*|daily living|living with|diet|exercise|nutrition|home care|lifestyle|wellness|rehab\w*|after treatment)\b/i;

const DEFINITION_RE =
  /^(what is|what does .* mean|define|meaning of|overview of|tell me about|explain)\b/i;

const WARNING_SIGNS_RE =
  /\b(symptom|symptoms|sign|signs|red flag|red flags|warning sign|warning signs|early sign|early signs|when should i worry|should i worry|when to seek medical attention|when should i seek medical attention|is this serious)\b/i;

const RISK_OR_SYMPTOM_RE =
  /\b(symptom|symptoms|sign|signs|risk|risk factor|risk factors|pain|bleeding|lump|cough|fatigue|weight loss|fever|nausea|swelling|could this be|should i worry|is this serious)\b/i;

const DETAIL_RE =
  /\b(more detail|detailed|in detail|details|more information|explain more|tell me more|comprehensive)\b/i;

export const analyzeQuestionIntent = (
  questionText,
  { hasSymptomContext = false, isSymptomNarrative = false } = {}
) => {
  const text = (questionText || '').trim();

  const asksAboutDiagnosis = DIAGNOSIS_RE.test(text);
  const asksAboutTreatment = TREATMENT_RE.test(text);
  const asksAboutLifestyle = LIFESTYLE_RE.test(text);
  const asksForDetailedAnswer = DETAIL_RE.test(text);
  const hasDefinitionLeadIn = DEFINITION_RE.test(text);
  const hasWarningSignsIntent = isSymptomNarrative || WARNING_SIGNS_RE.test(text);
  const asksDefinition =
    hasDefinitionLeadIn &&
    !asksAboutDiagnosis &&
    !asksAboutTreatment &&
    !asksAboutLifestyle &&
    !hasWarningSignsIntent &&
    !isSymptomNarrative &&
    !hasSymptomContext;
  const needsDisclaimer =
    isSymptomNarrative || hasSymptomContext || RISK_OR_SYMPTOM_RE.test(text);
  const asksAboutTreatmentSection = asksAboutTreatment && !hasWarningSignsIntent;
  const asksAboutDiagnosisSection = asksAboutDiagnosis;
  const asksAboutWarningSigns = hasWarningSignsIntent;

  return {
    asksAboutDiagnosis: asksAboutDiagnosisSection,
    asksAboutTreatment: asksAboutTreatmentSection,
    asksAboutLifestyle,
    asksForDetailedAnswer,
    asksDefinition,
    needsDisclaimer,
    shouldIncludePossibleCauses: isSymptomNarrative,
    shouldIncludeWarningSigns: asksAboutWarningSigns,
  };
};

export const buildDynamicResponseInstruction = (
  questionText,
  options = {}
) => {
  const intent = analyzeQuestionIntent(questionText, options);
  const sections = [];

  if (intent.shouldIncludePossibleCauses) {
    sections.push(
      `## Possible Causes
- Include only for symptom-based questions
- Mention both common benign explanations and more serious possibilities
- Avoid presenting any possibility as a diagnosis`
    );
  }

  if (intent.asksAboutDiagnosis) {
    sections.push(
      `## Recommended Tests
- Include only because the user is asking about diagnosis, screening, or evaluation
- Name relevant tests and briefly explain what each one helps assess`
    );
  }

  if (intent.asksAboutTreatment) {
    sections.push(
      `## Treatment Options
- Include only because the user is asking about treatment, management, or therapy
- Summarize common treatment approaches in a balanced, educational way`
    );
  }

  if (intent.asksAboutLifestyle) {
    sections.push(
      `## Lifestyle & Home Care
- Include only because the user is asking about prevention, recovery, survivorship, or daily living
- Focus on practical self-care, recovery habits, and healthy lifestyle measures`
    );
  }

  if (intent.shouldIncludeWarningSigns) {
    sections.push(
      `## Warning Signs
- Include only when discussing symptoms, possible risk, or when urgent follow-up matters
- List red flags that would justify prompt medical attention`
    );
  }

  const baseRules = [
    '[Output style instruction]',
    'Use an empathetic, professional, and educational tone.',
    'Use cautious, non-diagnostic language.',
    'Stay within the chatbot\'s cancer-only educational scope.',
    'Base the answer on the current message and current conversation context only.',
    'Do not assume a previous cancer type unless the user explicitly confirms it in this chat.',
    'If the user describes a different organ or body area than earlier messages, prioritize the latest body area and ask for clarification instead of carrying forward the old assumption.',
    'Start with a natural, varied opening sentence.',
    'Never begin with or add the heading "Introduction to [Cancer Type]" unless the user explicitly asks for it.',
    'Examples of acceptable opening styles: "[Cancer Type] is a form of cancer that...", "This type of cancer affects...", "Here\'s an overview of [Cancer Type]...", "Understanding [Cancer Type] can help...".',
    'Match the response length to the question complexity.',
  ];

  if (intent.asksDefinition && sections.length === 0) {
    baseRules.push(
      'This is a simple definition or overview question. Respond with one short, clear explanation only.',
      'Do not add extra sections, bullet lists, or headings.'
    );
  } else {
    baseRules.push(
      'Generate sections dynamically based on the user\'s intent rather than using a fixed template.',
      'Use ## headings only for sections that are directly relevant to this question.',
      'Use bullet points (- item) inside sections when helpful.',
      intent.asksForDetailedAnswer
        ? 'The user asked for more detail, so a fuller explanation is appropriate.'
        : 'Keep the answer brief unless the user explicitly asks for more detail.',
      'Keep paragraphs short and practical.'
    );

    if (sections.length > 0) {
      baseRules.push('Include these sections and no others unless the user explicitly asks for more detail:');
      baseRules.push(...sections);
    } else {
      baseRules.push('No special section is required for this question. Give a concise, direct answer.');
    }
  }

  if (intent.needsDisclaimer) {
    baseRules.push('Add one brief disclaimer at the end only if the response discusses symptoms, risks, or urgent warning signs.');
  } else {
    baseRules.push('Do not add a disclaimer unless symptoms or risk are being discussed.');
  }

  return baseRules.join('\n');
};
