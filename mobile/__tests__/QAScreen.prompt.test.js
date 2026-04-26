import React from 'react';
import { Text } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import QAScreen from '../QAScreen';
import { sendQuestion } from '../api';
import { clearAllData } from '../storage';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('../HistoryModal', () => () => null);

jest.mock('../formatRichText', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return {
    renderRichTextElements: (text) => React.createElement(Text, null, text),
  };
});

jest.mock('../api', () => ({
  sendQuestion: jest.fn(),
}));

jest.mock('../storage', () => ({
  saveUserProfile: jest.fn(() => Promise.resolve()),
  loadUserProfile: jest.fn(() => Promise.resolve(null)),
  saveConversation: jest.fn(() => Promise.resolve()),
  saveActiveConversation: jest.fn(() => Promise.resolve()),
  loadActiveConversation: jest.fn(() => Promise.resolve(null)),
  clearActiveConversation: jest.fn(() => Promise.resolve()),
  clearAllData: jest.fn(() => Promise.resolve()),
}));

jest.mock('../symptomTriage', () => ({
  createConversationState: () => ({
    stage: 'initial',
    symptoms: [],
    riskFactors: {},
    answers: {},
  }),
  shouldRunSymptomTriage: jest.fn(() => false),
  runTriageStep: jest.fn((state) => ({
    nextState: state,
    shouldBlockBackend: false,
    reply: null,
  })),
  isSymptomNarrative: jest.fn(() => false),
  extractSymptoms: jest.fn(() => []),
}));

const typeAndSend = async (screen, question) => {
  fireEvent.changeText(screen.getByPlaceholderText('Ask about cancer...'), question);
  await act(async () => {
    fireEvent.press(screen.getByText('↑'));
    jest.runOnlyPendingTimers();
  });

  await waitFor(() => expect(sendQuestion).toHaveBeenCalled());
};

describe('QAScreen prompt generation', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args) => {
      const firstArg = args[0];
      if (
        typeof firstArg === 'string' &&
        firstArg.includes('An update to Animated(View) inside a test was not wrapped in act(...)')
      ) {
        return;
      }

      if (typeof firstArg === 'string' && firstArg.includes('Warning: An update to %s inside a test was not wrapped in act(...)')) {
        return;
      }

      // Keep any unexpected errors visible.
      // eslint-disable-next-line no-console
      console.warn(...args);
    });
    sendQuestion.mockResolvedValue({
      answer: 'Mock answer',
      conversation_id: 'conv-1',
      relevance: 1,
      sources: [],
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    consoleErrorSpy?.mockRestore();
  });

  test('sends a concise overview prompt for definition questions', async () => {
    const screen = render(<QAScreen backendConnected />);

    await typeAndSend(screen, 'What is lung cancer?');

    const [prompt] = sendQuestion.mock.calls[0];
    expect(prompt).toContain('What is lung cancer?');
    expect(prompt).toContain('Respond with one short, clear explanation only.');
    expect(prompt).not.toContain('## Recommended Tests');
    expect(prompt).not.toContain('## Treatment Options');
    expect(prompt).not.toContain('## Warning Signs');
  });

  test('includes only treatment guidance for treatment queries', async () => {
    const screen = render(<QAScreen backendConnected />);

    await typeAndSend(screen, 'How is lung cancer treated?');

    const [prompt] = sendQuestion.mock.calls[0];
    expect(prompt).toContain('How is lung cancer treated?');
    expect(prompt).toContain('## Treatment Options');
    expect(prompt).not.toContain('## Recommended Tests');
    expect(prompt).not.toContain('## Warning Signs');
  });

  test('includes warning signs guidance for symptom queries', async () => {
    const screen = render(<QAScreen backendConnected />);

    await typeAndSend(screen, 'What are the symptoms of lung cancer?');

    const [prompt] = sendQuestion.mock.calls[0];
    expect(prompt).toContain('What are the symptoms of lung cancer?');
    expect(prompt).toContain('## Warning Signs');
    expect(prompt).not.toContain('## Recommended Tests');
    expect(prompt).not.toContain('## Treatment Options');
  });

  test('clear chat button wipes local memory immediately', async () => {
    const screen = render(<QAScreen backendConnected />);

    await act(async () => {
      fireEvent.press(screen.getByText('Clear Chat'));
    });

    expect(clearAllData).toHaveBeenCalled();
  });
});
