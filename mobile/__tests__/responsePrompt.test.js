import {
  analyzeQuestionIntent,
  buildDynamicResponseInstruction,
} from '../responsePrompt';

describe('responsePrompt', () => {
  test('treats simple definition questions as concise answers without extra sections', () => {
    const intent = analyzeQuestionIntent('What is lung cancer?');
    const instruction = buildDynamicResponseInstruction('What is lung cancer?');

    expect(intent.asksDefinition).toBe(true);
    expect(instruction).toContain('Respond with one short, clear explanation only.');
    expect(instruction).not.toContain('## Recommended Tests');
    expect(instruction).not.toContain('## Treatment Options');
    expect(instruction).not.toContain('## Lifestyle & Home Care');
    expect(instruction).not.toContain('## Warning Signs');
  });

  test('includes only treatment guidance for treatment questions', () => {
    const instruction = buildDynamicResponseInstruction('How is lung cancer treated?');

    expect(instruction).toContain('## Treatment Options');
    expect(instruction).not.toContain('## Recommended Tests');
    expect(instruction).not.toContain('## Lifestyle & Home Care');
  });

  test('includes only recommended tests guidance for diagnosis questions', () => {
    const instruction = buildDynamicResponseInstruction('How is lung cancer diagnosed?');

    expect(instruction).toContain('## Recommended Tests');
    expect(instruction).not.toContain('## Treatment Options');
    expect(instruction).not.toContain('## Lifestyle & Home Care');
  });

  test('includes only lifestyle guidance for prevention and survivorship questions', () => {
    const instruction = buildDynamicResponseInstruction('How can I reduce my cancer risk during survivorship?');

    expect(instruction).toContain('## Lifestyle & Home Care');
    expect(instruction).not.toContain('## Recommended Tests');
    expect(instruction).not.toContain('## Treatment Options');
    expect(instruction).not.toContain('## Warning Signs');
  });

  test('includes warning signs for symptom questions', () => {
    const instruction = buildDynamicResponseInstruction('What are the symptoms of lung cancer?');

    expect(instruction).toContain('## Warning Signs');
    expect(instruction).not.toContain('## Recommended Tests');
    expect(instruction).not.toContain('## Treatment Options');
  });

  test('keeps therapy definition questions concise', () => {
    const instruction = buildDynamicResponseInstruction('What is immunotherapy?');

    expect(instruction).toContain('Respond with one short, clear explanation only.');
    expect(instruction).not.toContain('## Treatment Options');
  });

  test('does not add treatment options to red-flag questions about post-treatment concerns', () => {
    const instruction = buildDynamicResponseInstruction('What are red flags after cancer treatment?');

    expect(instruction).toContain('## Warning Signs');
    expect(instruction).not.toContain('## Treatment Options');
  });

  test('keeps prevention questions brief unless more detail is requested', () => {
    const briefInstruction = buildDynamicResponseInstruction('How can I prevent colon cancer?');
    const detailedInstruction = buildDynamicResponseInstruction('How can I prevent colon cancer? Please explain in detail.');

    expect(briefInstruction).toContain('Keep the answer brief unless the user explicitly asks for more detail.');
    expect(detailedInstruction).toContain('The user asked for more detail, so a fuller explanation is appropriate.');
  });

  test('forbids the repeated "Introduction to" opening', () => {
    const instruction = buildDynamicResponseInstruction('Tell me about breast cancer');

    expect(instruction).toContain('Never begin with or add the heading "Introduction to [Cancer Type]"');
  });

  test('tells the model not to carry forward an old cancer type assumption', () => {
    const instruction = buildDynamicResponseInstruction('I have throat pain and hoarseness');

    expect(instruction).toContain('Do not assume a previous cancer type unless the user explicitly confirms it in this chat.');
    expect(instruction).toContain('If the user describes a different organ or body area than earlier messages, prioritize the latest body area');
  });
});
