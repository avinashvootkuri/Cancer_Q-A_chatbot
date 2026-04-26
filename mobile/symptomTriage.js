// ─── Symptom Triage Engine ──────────────────────────────────────────────────
// Replaces generic "consult a doctor" patterns with actionable, context-aware
// "Next Steps" that include specific tests, specialist recommendations, and
// lifestyle guidance based on the symptoms gathered.

// ─── Constants ──────────────────────────────────────────────────────────────

const SYMPTOM_KEYWORDS = [
  'cough', 'lump', 'bleeding', 'blood', 'chest pain', 'throat pain',
  'sore throat', 'red eyes', 'eye redness', 'fatigue', 'weight loss',
  'hoarseness', 'fever', 'night sweats', 'shortness of breath', 'swelling',
  'appetite loss', 'nausea', 'vomiting', 'constipation', 'diarrhea',
  'headache', 'difficulty swallowing', 'urination', 'sputum', 'skin changes',
  'bruising', 'back pain', 'abdominal pain', 'pelvic pain',
];

const PAIN_AREAS = [
  'chest', 'throat', 'abdomen', 'stomach', 'back', 'head',
  'neck', 'breast', 'pelvis', 'arm', 'leg', 'bone', 'joint',
];

const FIRST_PERSON_PATTERNS = [
  /\bi have\b/i, /\bi am having\b/i, /\bi feel\b/i,
  /\bi'm having\b/i, /\bmy\b/i, /\bme\b/i, /\bsuffering from\b/i,
];

// ─── Symptom → Recommended Tests Mapping ────────────────────────────────────

const SYMPTOM_TESTS = {
  cough: ['Chest X-ray', 'Sputum cytology', 'CT scan of chest'],
  'chest pain': ['Chest X-ray', 'ECG', 'CT scan of chest', 'Cardiac enzyme panel'],
  'shortness of breath': ['Chest X-ray', 'Pulmonary function test', 'CT scan of chest'],
  lump: ['Ultrasound of the area', 'Fine needle aspiration biopsy (FNAB)', 'MRI'],
  bleeding: ['Complete blood count (CBC)', 'Coagulation profile', 'Endoscopy or colonoscopy'],
  blood: ['Complete blood count (CBC)', 'Stool occult blood test', 'Urinalysis'],
  'weight loss': ['Complete blood count (CBC)', 'Thyroid function test', 'Blood sugar test', 'CT abdomen'],
  fatigue: ['Complete blood count (CBC)', 'Thyroid function test', 'Iron studies', 'Blood sugar test'],
  'night sweats': ['Complete blood count (CBC)', 'ESR / CRP (inflammation markers)', 'Chest X-ray'],
  fever: ['Complete blood count (CBC)', 'Blood culture', 'CRP / ESR'],
  hoarseness: ['Laryngoscopy', 'Neck ultrasound', 'CT scan of neck'],
  'throat pain': ['Laryngoscopy', 'Throat culture', 'Neck ultrasound'],
  'difficulty swallowing': ['Barium swallow test', 'Upper GI endoscopy', 'CT scan of neck/chest'],
  swelling: ['Ultrasound of the area', 'Complete blood count (CBC)', 'Biopsy if persistent'],
  'appetite loss': ['Complete blood count (CBC)', 'Liver function test', 'Upper GI endoscopy'],
  nausea: ['Complete blood count (CBC)', 'Liver function test', 'Abdominal ultrasound'],
  vomiting: ['Complete blood count (CBC)', 'Electrolyte panel', 'Abdominal CT'],
  constipation: ['Colonoscopy', 'Abdominal X-ray', 'Thyroid function test'],
  diarrhea: ['Stool analysis', 'Colonoscopy', 'Blood tests for infection'],
  headache: ['Neurological examination', 'MRI of brain', 'CT scan of brain'],
  urination: ['Urinalysis', 'PSA test (if male, 50+)', 'Pelvic ultrasound'],
  sputum: ['Sputum cytology', 'Chest X-ray', 'CT scan of chest'],
  'skin changes': ['Dermoscopy', 'Skin biopsy', 'Full-body skin examination'],
  bruising: ['Complete blood count (CBC)', 'Coagulation profile', 'Platelet count'],
  'back pain': ['Spine X-ray', 'MRI of spine', 'Bone scan'],
  'abdominal pain': ['Abdominal ultrasound', 'CT abdomen', 'Complete blood count (CBC)'],
  'pelvic pain': ['Pelvic ultrasound', 'CT pelvis', 'Urinalysis'],
};

// ─── Symptom → Specialist Mapping ───────────────────────────────────────────

const SYMPTOM_SPECIALISTS = {
  cough: 'Pulmonologist',
  'chest pain': 'Pulmonologist or Cardiologist',
  'shortness of breath': 'Pulmonologist',
  lump: 'Surgical Oncologist',
  bleeding: 'Gastroenterologist or Oncologist',
  blood: 'Hematologist',
  'weight loss': 'Internal Medicine specialist',
  fatigue: 'Internal Medicine specialist',
  'night sweats': 'Hematologist or Oncologist',
  fever: 'Internal Medicine specialist',
  hoarseness: 'ENT specialist (Otolaryngologist)',
  'throat pain': 'ENT specialist (Otolaryngologist)',
  'difficulty swallowing': 'Gastroenterologist or ENT specialist',
  swelling: 'Surgical Oncologist',
  headache: 'Neurologist',
  urination: 'Urologist',
  'skin changes': 'Dermatologist',
  'back pain': 'Orthopedist or Oncologist',
  'abdominal pain': 'Gastroenterologist',
  'pelvic pain': 'Gynecologist or Urologist',
};

// ─── Urgency keywords ───────────────────────────────────────────────────────

const URGENT_SYMPTOMS = [
  'blood in stool', 'blood in urine', 'blood in sputum', 'coughing blood',
  'sudden weight loss', 'rapidly growing lump', 'severe pain',
  'persistent bleeding', 'difficulty breathing',
];

// ─── Helpers ────────────────────────────────────────────────────────────────

const unique = (values) => Array.from(new Set(values));

const extractAge = (text) => {
  const match = text.match(/\b(\d{1,3})\s*(?:years?\s*old|yo|y\/o)\b/i);
  return match ? Number(match[1]) : null;
};

const detectGender = (text) => {
  if (/\b(female|woman|girl)\b/i.test(text)) return 'female';
  if (/\b(male|man|boy)\b/i.test(text)) return 'male';
  return null;
};

const hasPattern = (text, regexes) => regexes.some((regex) => regex.test(text));

const normalizeSymptom = (symptom) => {
  const map = { 'eye redness': 'red eyes', 'sore throat': 'throat pain' };
  return map[symptom] || symptom;
};

const extractPainPhrases = (text) => {
  const lower = text.toLowerCase();
  const detected = [];
  PAIN_AREAS.forEach((area) => {
    const pattern = new RegExp(`\\b(pain|ache|soreness)\\s+(in|on|at)\\s+(my\\s+)?${area}\\b`, 'i');
    if (pattern.test(lower)) detected.push(`${area} pain`);
  });
  return detected;
};

// ─── Exported extractors ────────────────────────────────────────────────────

export const extractSymptoms = (text) => {
  const lower = text.toLowerCase();
  const keywordHits = SYMPTOM_KEYWORDS.filter((s) => lower.includes(s));
  const painPhrases = extractPainPhrases(text);
  if (/\b(red|reddish)\s+eyes?\b/i.test(lower)) keywordHits.push('red eyes');
  return unique([...keywordHits, ...painPhrases].map(normalizeSymptom));
};

export const isSymptomNarrative = (text) => {
  return extractSymptoms(text).length > 0 && hasPattern(text, FIRST_PERSON_PATTERNS);
};

export const assessSymptomCount = (symptoms) => symptoms.length >= 3;

// ─── Conversation State ─────────────────────────────────────────────────────

export const createConversationState = () => ({
  stage: 'initial',
  symptoms: [],
  askedQuestions: [],
  answers: {},
  riskFactors: {
    age: undefined,
    gender: undefined,
    smoking: undefined,
    familyHistory: undefined,
    alcohol: undefined,
    unexplainedWeightLoss: undefined,
    fatigue: undefined,
    persistentLump: undefined,
    bleeding: undefined,
  },
  questionRound: 0,
});

// ─── Risk factor parser ─────────────────────────────────────────────────────

const parseRiskFactors = (text, existing) => {
  const lower = text.toLowerCase();
  return {
    age: extractAge(text) ?? existing.age,
    gender: detectGender(text) ?? existing.gender,
    smoking:
      /\b(smoke|smoker|smoking|tobacco)\b/i.test(lower) ? true
        : /\bnever smoke|non smoker\b/i.test(lower) ? false
        : existing.smoking,
    alcohol:
      /\b(alcohol|drinking|drink regularly)\b/i.test(lower) ? true
        : /\bno alcohol|do not drink\b/i.test(lower) ? false
        : existing.alcohol,
    familyHistory:
      /\bfamily history|runs in (my )?family\b/i.test(lower) ? true
        : /\bno family history\b/i.test(lower) ? false
        : existing.familyHistory,
    unexplainedWeightLoss:
      /\b(unexplained weight loss|lost weight|weight loss)\b/i.test(lower) ? true : existing.unexplainedWeightLoss,
    fatigue: /\b(fatigue|tired|exhausted)\b/i.test(lower) ? true : existing.fatigue,
    persistentLump: /\b(lump|mass|swelling)\b/i.test(lower) ? true : existing.persistentLump,
    bleeding:
      /\b(bleeding|blood in stool|blood in sputum|blood in urine)\b/i.test(lower) ? true : existing.bleeding,
  };
};

// ─── State updater ──────────────────────────────────────────────────────────

export const updateConversationState = (state, userInput) => {
  const nextSymptoms = unique([...state.symptoms, ...extractSymptoms(userInput)]);
  const existingAnswers = state.answers || {};
  const nextAnswers = { ...existingAnswers };
  const lower = userInput.toLowerCase();

  if (!nextAnswers.duration && /\b(day|days|week|weeks|month|months|year|years)\b/i.test(lower)) {
    nextAnswers.duration = userInput;
  }
  if (!nextAnswers.progression && /\b(getting worse|worse|improving|better|same|stable|unchanged)\b/i.test(lower)) {
    nextAnswers.progression = userInput;
  }
  if (!nextAnswers.severity && /\b([1-9]|10)\s*\/\s*10\b/i.test(lower)) {
    nextAnswers.severity = userInput;
  }
  if (!nextAnswers.associatedSymptoms && /\b(fever|pain|bleeding|weight loss|lump|shortness of breath|hoarseness)\b/i.test(lower)) {
    nextAnswers.associatedSymptoms = userInput;
  }

  return {
    ...state,
    stage: 'gathering',
    symptoms: nextSymptoms,
    answers: nextAnswers,
    riskFactors: parseRiskFactors(userInput, state.riskFactors),
  };
};

// ─── Sufficiency check ──────────────────────────────────────────────────────

const hasStrongRiskFactors = (riskFactors) => {
  const ageRisk = typeof riskFactors.age === 'number' && riskFactors.age >= 60;
  const flags = [
    riskFactors.smoking, riskFactors.familyHistory,
    riskFactors.unexplainedWeightLoss, riskFactors.persistentLump,
    riskFactors.bleeding, ageRisk,
  ].filter(Boolean).length;
  return flags >= 2;
};

export const isSufficientForSuggestion = (state) => {
  return assessSymptomCount(state.symptoms) || hasStrongRiskFactors(state.riskFactors);
};

// ─── Follow-up questions ────────────────────────────────────────────────────

const FOLLOW_UP_QUESTIONS = {
  duration: 'How long have these symptoms been present?',
  progression: 'Are the symptoms improving, stable, or getting worse?',
  severity: 'How severe are the symptoms on a scale of 1 to 10?',
  ageGender: 'Could you share your age and gender?',
  smoking: 'Do you smoke or have a history of smoking?',
  familyHistory: 'Do you have a family history of cancer?',
  associatedSymptoms: 'Do you have any other symptoms such as fever, bleeding, weight change, or new lumps?',
  coughRedFlags: 'Have you noticed blood in sputum, chest pain, or shortness of breath?',
  throatRedFlags: 'Do you also have trouble swallowing, persistent hoarseness, or a neck lump?',
  lumpDetails: 'Where is the lump, and has its size changed over time?',
  bleedingDetails: 'Where is the bleeding occurring, and is it persistent or intermittent?',
};

const getCandidateQuestionIds = (state) => {
  const ids = ['duration', 'progression', 'severity', 'associatedSymptoms'];
  if (!state.riskFactors.age || !state.riskFactors.gender) ids.push('ageGender');
  if (state.riskFactors.smoking == null) ids.push('smoking');
  if (state.riskFactors.familyHistory == null) ids.push('familyHistory');
  if (state.symptoms.includes('cough')) ids.push('coughRedFlags');
  if (state.symptoms.includes('throat pain')) ids.push('throatRedFlags');
  if (state.symptoms.includes('lump') || state.symptoms.includes('persistent lump')) ids.push('lumpDetails');
  if (state.symptoms.includes('bleeding') || state.symptoms.includes('blood')) ids.push('bleedingDetails');
  return unique(ids);
};

const isQuestionAnswered = (questionId, state) => {
  if (questionId === 'duration') return Boolean(state.answers.duration);
  if (questionId === 'progression') return Boolean(state.answers.progression);
  if (questionId === 'severity') return Boolean(state.answers.severity);
  if (questionId === 'associatedSymptoms') return Boolean(state.answers.associatedSymptoms);
  if (questionId === 'ageGender') return Boolean(state.riskFactors.age && state.riskFactors.gender);
  if (questionId === 'smoking') return state.riskFactors.smoking != null;
  if (questionId === 'familyHistory') return state.riskFactors.familyHistory != null;
  return false;
};

const getNextFollowUpQuestions = (state, limit = 3) => {
  const asked = new Set(state.askedQuestions || []);
  return getCandidateQuestionIds(state)
    .filter((id) => !asked.has(id))
    .filter((id) => !isQuestionAnswered(id, state))
    .slice(0, limit)
    .map((id) => ({ id, text: FOLLOW_UP_QUESTIONS[id] }));
};

// ─── Formatting helpers ─────────────────────────────────────────────────────

const formatSymptomSummary = (symptoms) => {
  if (symptoms.length === 0) return '';
  if (symptoms.length === 1) return symptoms[0];
  if (symptoms.length === 2) return `${symptoms[0]} and ${symptoms[1]}`;
  return `${symptoms.slice(0, -1).join(', ')}, and ${symptoms[symptoms.length - 1]}`;
};

// ─── Suggested tests for symptoms ───────────────────────────────────────────

const getSuggestedTests = (symptoms) => {
  const testsSet = new Set();
  symptoms.forEach((s) => {
    const tests = SYMPTOM_TESTS[s];
    if (tests) tests.forEach((t) => testsSet.add(t));
  });
  return Array.from(testsSet).slice(0, 6); // Cap at 6 most relevant
};

const getSuggestedSpecialists = (symptoms) => {
  const specialistsSet = new Set();
  symptoms.forEach((s) => {
    const spec = SYMPTOM_SPECIALISTS[s];
    if (spec) specialistsSet.add(spec);
  });
  return Array.from(specialistsSet).slice(0, 3);
};

const hasUrgentSymptoms = (text, symptoms) => {
  const lower = (text || '').toLowerCase();
  const fromText = URGENT_SYMPTOMS.some((u) => lower.includes(u));
  const fromSymptoms = symptoms.some((s) =>
    ['bleeding', 'blood', 'difficulty breathing'].includes(s)
  );
  return fromText || fromSymptoms;
};

// ─── "More Information" request (follow-up) ─────────────────────────────────

export const requestMoreInformation = (state) => {
  const symptomSummary = formatSymptomSummary(state.symptoms);
  const round = state.questionRound || 0;

  // Context-aware intro — no generic disclaimers
  const contextLead = symptomSummary
    ? `I've noted your symptoms: **${symptomSummary}**.`
    : 'I understand your concern.';

  const needMore = state.symptoms.length <= 2
    ? 'A few more details will help me give you more specific guidance.'
    : 'I need a bit more context to provide targeted next steps.';

  const followUps = getNextFollowUpQuestions(state);
  const questionsText = followUps.length > 0
    ? followUps.map((q) => `- ${q.text}`).join('\n')
    : '- Could you share any new or worsening symptoms, along with duration and severity?';

  const askedIds = followUps.map((q) => q.id);
  const nextState = {
    ...state,
    askedQuestions: unique([...(state.askedQuestions || []), ...askedIds]),
    questionRound: round + 1,
  };

  // Only add a brief disclaimer on the first round
  const disclaimer = round === 0
    ? '\n\n*This assessment is for informational purposes and does not replace a professional evaluation.*'
    : '';

  return {
    reply: `${contextLead} ${needMore}\n\n${questionsText}${disclaimer}`,
    state: nextState,
  };
};

// ─── Cancer inference ───────────────────────────────────────────────────────

const inferPossibleCancers = (state) => {
  const symptoms = state.symptoms;
  const risks = state.riskFactors;
  const possibilities = [];

  if (symptoms.includes('cough') && (symptoms.includes('blood') || symptoms.includes('shortness of breath') || risks.smoking)) {
    possibilities.push('lung cancer');
  }
  if (
    symptoms.includes('lump') &&
    risks.gender === 'female' &&
    (symptoms.includes('breast pain') || symptoms.includes('skin changes'))
  ) {
    possibilities.push('breast cancer');
  }
  if ((symptoms.includes('bleeding') || symptoms.includes('blood')) && (symptoms.includes('weight loss') || symptoms.includes('fatigue'))) {
    possibilities.push('colorectal cancer');
  }
  if (symptoms.includes('urination') && risks.gender === 'male' && typeof risks.age === 'number' && risks.age >= 50) {
    possibilities.push('prostate cancer');
  }
  if (symptoms.includes('throat pain') && symptoms.includes('hoarseness') && risks.smoking) {
    possibilities.push('throat/laryngeal cancer');
  }
  if (symptoms.includes('difficulty swallowing') && symptoms.includes('weight loss')) {
    possibilities.push('esophageal cancer');
  }
  if (symptoms.includes('skin changes') && (symptoms.includes('lump') || risks.familyHistory)) {
    possibilities.push('skin cancer / melanoma');
  }

  return unique(possibilities);
};

// ─── Context-Aware "Next Steps" Generator ───────────────────────────────────

export const generateCancerSuggestion = (state) => {
  if (!isSufficientForSuggestion(state)) {
    return requestMoreInformation(state).reply;
  }

  const possibilities = inferPossibleCancers(state);
  const suggestedTests = getSuggestedTests(state.symptoms);
  const specialists = getSuggestedSpecialists(state.symptoms);
  const isUrgent = hasUrgentSymptoms('', state.symptoms);
  const symptomSummary = formatSymptomSummary(state.symptoms);

  const sections = [];

  // ── Summary ───────────────────────────────────────────
  sections.push(`## 📋 Summary`);
  sections.push(`Based on the information you shared — **${symptomSummary}** — here is what I can tell you:`);

  // ── Possible Concerns ─────────────────────────────────
  if (possibilities.length > 0) {
    sections.push(`\n## 🔍 Possible Concerns`);
    possibilities.forEach((p) => {
      sections.push(`- ${p.charAt(0).toUpperCase() + p.slice(1)}`);
    });
    sections.push(`\nThese are possibilities based on your symptoms, **not a diagnosis**. Many benign conditions share similar symptoms.`);
  } else {
    sections.push(`\n## 🔍 Assessment`);
    sections.push(`Your symptoms may be associated with several conditions, including non-cancerous causes. A medical evaluation will help determine the exact cause.`);
  }

  // ── Recommended Tests ─────────────────────────────────
  if (suggestedTests.length > 0) {
    sections.push(`\n## 🧪 Recommended Tests`);
    suggestedTests.forEach((t) => {
      sections.push(`- ${t}`);
    });
  }

  // ── Next Steps (REPLACES "consult a doctor") ──────────
  sections.push(`\n## 📝 Next Steps`);
  if (isUrgent) {
    sections.push(`- **Seek medical attention promptly** — your symptoms warrant urgent evaluation`);
  }
  if (specialists.length > 0) {
    sections.push(`- Schedule an appointment with a **${specialists[0]}**`);
    if (specialists.length > 1) {
      sections.push(`- A referral to a **${specialists[1]}** may also be helpful`);
    }
  } else {
    sections.push(`- Schedule an appointment with your primary care physician`);
  }
  sections.push(`- Bring a list of all your symptoms, their duration, and any medications you take`);
  if (state.riskFactors.familyHistory) {
    sections.push(`- Mention your **family history of cancer** to your doctor — this is important for screening decisions`);
  }
  sections.push(`- Keep a symptom diary tracking any changes until your appointment`);

  // ── When to Seek Urgent Care ──────────────────────────
  if (isUrgent || state.riskFactors.bleeding) {
    sections.push(`\n## ⚠️ When to Seek Urgent Care`);
    sections.push(`- Sudden or severe worsening of symptoms`);
    sections.push(`- Heavy or uncontrolled bleeding`);
    sections.push(`- Difficulty breathing or severe chest pain`);
    sections.push(`- High fever that does not respond to medication`);
  }

  // Brief disclaimer at the end — NOT "consult a doctor" boilerplate
  sections.push(`\n*This guidance is informational. Your doctor can provide a personalized evaluation based on your complete medical history.*`);

  return sections.join('\n');
};

// ─── Triage entry points ────────────────────────────────────────────────────

// Detect when the user is explicitly asking for an answer / assessment
const ANSWER_REQUEST_PATTERNS = [
  /\bwhat (could|can|might|does) it be\b/i,
  /\bwhat is (it|this|wrong)\b/i,
  /\b(tell|give) me (the |an? )?(answer|result|diagnosis|assessment|suggestion)\b/i,
  /\bwhat do you think\b/i,
  /\bcould it be cancer\b/i,
  /\bdo i have\b/i,
  /\bam i at risk\b/i,
  /\bwhat (should|can) i do\b/i,
  /\bany idea\b/i,
  /\bplease (just |)answer\b/i,
  /\bstop asking\b/i,
  /\bjust tell me\b/i,
];

const isAskingForAnswer = (text) => {
  return ANSWER_REQUEST_PATTERNS.some((p) => p.test(text));
};

export const shouldRunSymptomTriage = (userInput, state) => {
  if (state.stage !== 'initial') return true;
  return isSymptomNarrative(userInput);
};

export const runTriageStep = (state, userInput) => {
  const nextState = updateConversationState(state, userInput);

  // NEVER block if the user is explicitly requesting an answer
  if (isAskingForAnswer(userInput)) {
    return {
      shouldBlockBackend: false,
      reply: null,
      nextState,
    };
  }

  // Only block the backend on the FIRST round (questionRound === 0)
  // and ONLY if this is the very first symptom mention.
  // After one round of follow-ups, ALWAYS let the backend handle it.
  const round = nextState.questionRound || 0;
  if (round === 0 && !isSufficientForSuggestion(nextState) && isSymptomNarrative(userInput)) {
    const moreInfo = requestMoreInformation(nextState);
    return {
      shouldBlockBackend: true,
      reply: moreInfo.reply,
      nextState: moreInfo.state,
    };
  }

  // All subsequent messages go to the backend with full context
  return {
    shouldBlockBackend: false,
    reply: null,
    nextState,
  };
};

// ─── Export test helpers ────────────────────────────────────────────────────

export { getSuggestedTests, getSuggestedSpecialists, SYMPTOM_TESTS, SYMPTOM_SPECIALISTS };
