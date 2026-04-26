/**
 * Tests for symptomTriage.js
 *
 * Verifies:
 * - Symptom extraction accuracy
 * - Risk factor parsing
 * - Triage flow (insufficient → follow-up → suggestion)
 * - "Next Steps" output replaces generic "consult a doctor"
 * - Suggested tests appear for relevant symptoms
 * - Context accumulation across messages
 */

const {
  extractSymptoms,
  isSymptomNarrative,
  assessSymptomCount,
  createConversationState,
  updateConversationState,
  isSufficientForSuggestion,
  requestMoreInformation,
  generateCancerSuggestion,
  runTriageStep,
  shouldRunSymptomTriage,
  getSuggestedTests,
  getSuggestedSpecialists,
} = require('../symptomTriage');

// ─── Symptom Extraction ─────────────────────────────────────────────────────

describe('extractSymptoms', () => {
  test('detects single keyword symptoms', () => {
    expect(extractSymptoms('I have a persistent cough')).toContain('cough');
    expect(extractSymptoms('There is a lump on my neck')).toContain('lump');
    expect(extractSymptoms('I am bleeding from my nose')).toContain('bleeding');
  });

  test('detects multiple symptoms at once', () => {
    const result = extractSymptoms('I have cough, fatigue and weight loss for weeks');
    expect(result).toContain('cough');
    expect(result).toContain('fatigue');
    expect(result).toContain('weight loss');
  });

  test('detects pain phrases', () => {
    const result = extractSymptoms('I feel ache in my chest');
    expect(result).toContain('chest pain');
  });

  test('normalizes sore throat to throat pain', () => {
    const result = extractSymptoms('I have a sore throat and headache');
    expect(result).toContain('throat pain');
    expect(result).toContain('headache');
  });

  test('detects red eyes', () => {
    const result = extractSymptoms('I have red eyes and cough');
    expect(result).toContain('red eyes');
    expect(result).toContain('cough');
  });

  test('returns empty for unrelated text', () => {
    expect(extractSymptoms('What is the weather today?')).toEqual([]);
  });

  test('deduplicates symptoms', () => {
    const result = extractSymptoms('I have a cough. My cough is bad.');
    const coughCount = result.filter((s) => s === 'cough').length;
    expect(coughCount).toBe(1);
  });
});

// ─── Symptom Narrative Detection ────────────────────────────────────────────

describe('isSymptomNarrative', () => {
  test('returns true for first-person symptom statements', () => {
    expect(isSymptomNarrative('I have a cough for 2 weeks')).toBe(true);
    expect(isSymptomNarrative('My throat is sore and I feel fatigue')).toBe(true);
  });

  test('returns false for questions without symptoms', () => {
    expect(isSymptomNarrative('What is pancreatic cancer?')).toBe(false);
  });

  test('returns false for third-person statements', () => {
    expect(isSymptomNarrative('Cancer causes weight loss')).toBe(false);
  });
});

// ─── Risk Factor Parsing ────────────────────────────────────────────────────

describe('updateConversationState – risk factors', () => {
  test('extracts age', () => {
    const state = createConversationState();
    const next = updateConversationState(state, 'I am 45 years old and have a cough');
    expect(next.riskFactors.age).toBe(45);
  });

  test('extracts gender', () => {
    const state = createConversationState();
    const next = updateConversationState(state, 'I am a female with a lump');
    expect(next.riskFactors.gender).toBe('female');
  });

  test('detects smoking history', () => {
    const state = createConversationState();
    const next = updateConversationState(state, 'I smoke and have a cough');
    expect(next.riskFactors.smoking).toBe(true);
  });

  test('detects family history', () => {
    const state = createConversationState();
    const next = updateConversationState(state, 'I have family history of cancer and bleeding');
    expect(next.riskFactors.familyHistory).toBe(true);
  });

  test('accumulates symptoms across updates', () => {
    let state = createConversationState();
    state = updateConversationState(state, 'I have a cough');
    state = updateConversationState(state, 'I also feel fatigue');
    state = updateConversationState(state, 'And I have weight loss');
    expect(state.symptoms).toContain('cough');
    expect(state.symptoms).toContain('fatigue');
    expect(state.symptoms).toContain('weight loss');
    expect(state.symptoms.length).toBeGreaterThanOrEqual(3);
  });
});

// ─── Sufficiency Check ──────────────────────────────────────────────────────

describe('isSufficientForSuggestion', () => {
  test('returns false with fewer than 3 symptoms and no strong risk', () => {
    const state = createConversationState();
    const next = updateConversationState(state, 'I have a cough');
    expect(isSufficientForSuggestion(next)).toBe(false);
  });

  test('returns true with 3+ symptoms', () => {
    let state = createConversationState();
    state = updateConversationState(state, 'I have cough, fatigue and weight loss');
    expect(isSufficientForSuggestion(state)).toBe(true);
  });

  test('returns true with strong risk factors even with fewer symptoms', () => {
    let state = createConversationState();
    state = updateConversationState(state, 'I am a 65 year old smoker with bleeding');
    expect(isSufficientForSuggestion(state)).toBe(true);
  });
});

// ─── "Next Steps" Output Quality ────────────────────────────────────────────

describe('generateCancerSuggestion – "Next Steps" output', () => {
  test('contains "Next Steps" section, not generic "consult a doctor"', () => {
    let state = createConversationState();
    state = updateConversationState(state, 'I am a 50 year old male smoker with cough and blood in sputum and weight loss');
    const output = generateCancerSuggestion(state);
    expect(output).toContain('Next Steps');
    expect(output).not.toMatch(/\bconsult a doctor\b/i);
    expect(output).not.toMatch(/\bplease consult\b/i);
  });

  test('contains Summary section', () => {
    let state = createConversationState();
    state = updateConversationState(state, 'I have cough, fatigue, and night sweats');
    const output = generateCancerSuggestion(state);
    expect(output).toContain('Summary');
  });

  test('contains Recommended Tests section', () => {
    let state = createConversationState();
    state = updateConversationState(state, 'I have cough, fatigue, and weight loss');
    const output = generateCancerSuggestion(state);
    expect(output).toContain('Recommended Tests');
  });

  test('suggests relevant tests for cough symptoms', () => {
    let state = createConversationState();
    state = updateConversationState(state, 'I am 55 years old and have cough, blood in sputum and shortness of breath');
    const output = generateCancerSuggestion(state);
    expect(output).toMatch(/chest x-ray/i);
  });

  test('includes specialist referral', () => {
    let state = createConversationState();
    state = updateConversationState(state, 'I have a persistent cough, fatigue and weight loss');
    const output = generateCancerSuggestion(state);
    expect(output).toMatch(/specialist|pulmonologist|oncologist/i);
  });

  test('mentions family history when relevant', () => {
    let state = createConversationState();
    state = updateConversationState(state, 'I have family history of cancer and I have a lump, bleeding, and fatigue');
    const output = generateCancerSuggestion(state);
    expect(output).toMatch(/family history/i);
  });
});

// ─── Follow-up Questions ────────────────────────────────────────────────────

describe('requestMoreInformation', () => {
  test('asks relevant follow-up questions', () => {
    let state = createConversationState();
    state = updateConversationState(state, 'I have a cough');
    const result = requestMoreInformation(state);
    expect(result.reply).toContain('?');
    expect(result.reply).toContain('cough');
  });

  test('does NOT repeat generic disclaimers on subsequent rounds', () => {
    let state = createConversationState();
    state = updateConversationState(state, 'I have a cough');
    const round1 = requestMoreInformation(state);
    state = round1.state;
    state = updateConversationState(state, 'It has been 2 weeks');
    const round2 = requestMoreInformation(state);
    // Second round should not have a disclaimer
    expect(round2.reply).not.toMatch(/informational purposes/i);
  });
});

// ─── Triage Flow ────────────────────────────────────────────────────────────

describe('runTriageStep', () => {
  test('blocks backend only on the FIRST symptom message', () => {
    const state = createConversationState();
    const result = runTriageStep(state, 'I have a cough');
    expect(result.shouldBlockBackend).toBe(true);
    expect(result.reply).toBeTruthy();
  });

  test('does NOT block on second message (after one round of questions)', () => {
    const state = createConversationState();
    const round1 = runTriageStep(state, 'I have a cough');
    expect(round1.shouldBlockBackend).toBe(true);
    // User replies to the follow-up — should NOT block again
    const round2 = runTriageStep(round1.nextState, 'It has been 2 weeks and it is getting worse');
    expect(round2.shouldBlockBackend).toBe(false);
  });

  test('never blocks when user explicitly asks for an answer', () => {
    const state = createConversationState();
    const round1 = runTriageStep(state, 'I have a lump and throat pain');
    // User asks for assessment
    const round2 = runTriageStep(round1.nextState, 'Can you give what it could be');
    expect(round2.shouldBlockBackend).toBe(false);
  });

  test('never blocks for "what should I do" requests', () => {
    let state = createConversationState();
    state = updateConversationState(state, 'I have a cough');
    const result = runTriageStep(state, 'What should I do about this?');
    expect(result.shouldBlockBackend).toBe(false);
  });

  test('allows backend with sufficient info', () => {
    let state = createConversationState();
    state = updateConversationState(state, 'I am 65 year old smoker');
    const result = runTriageStep(state, 'I have cough, blood in sputum, and weight loss');
    expect(result.shouldBlockBackend).toBe(false);
  });
});

// ─── Suggested Tests Mapping ────────────────────────────────────────────────

describe('getSuggestedTests', () => {
  test('returns relevant tests for cough', () => {
    const tests = getSuggestedTests(['cough']);
    expect(tests.length).toBeGreaterThan(0);
    expect(tests.some((t) => /chest/i.test(t))).toBe(true);
  });

  test('returns relevant tests for lump', () => {
    const tests = getSuggestedTests(['lump']);
    expect(tests.length).toBeGreaterThan(0);
    expect(tests.some((t) => /ultrasound|biopsy/i.test(t))).toBe(true);
  });

  test('combines tests for multiple symptoms', () => {
    const tests = getSuggestedTests(['cough', 'weight loss', 'fatigue']);
    expect(tests.length).toBeGreaterThan(2);
  });

  test('caps results at 6', () => {
    const tests = getSuggestedTests(['cough', 'lump', 'bleeding', 'fatigue', 'headache']);
    expect(tests.length).toBeLessThanOrEqual(6);
  });
});

// ─── Suggested Specialists ──────────────────────────────────────────────────

describe('getSuggestedSpecialists', () => {
  test('returns pulmonologist for cough', () => {
    const specialists = getSuggestedSpecialists(['cough']);
    expect(specialists.some((s) => /pulmonologist/i.test(s))).toBe(true);
  });

  test('returns ENT for throat pain', () => {
    const specialists = getSuggestedSpecialists(['throat pain']);
    expect(specialists.some((s) => /ent/i.test(s))).toBe(true);
  });
});
