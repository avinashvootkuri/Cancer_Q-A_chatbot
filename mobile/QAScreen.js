import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Keyboard,
  Platform,
  ActivityIndicator,
  Clipboard,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sendQuestion } from './api';
import HistoryModal from './HistoryModal';
import { renderRichTextElements } from './formatRichText';
import { buildDynamicResponseInstruction } from './responsePrompt';
import {
  createConversationState,
  shouldRunSymptomTriage,
  runTriageStep,
  isSymptomNarrative,
} from './symptomTriage';
import {
  saveConversation,
  clearActiveConversation,
  clearAllData,
} from './storage';

export default function QAScreen({ backendConnected }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [responseCache, setResponseCache] = useState({});
  const [triageState, setTriageState] = useState(createConversationState());
  const [contextChips, setContextChips] = useState([]);
  const scrollViewRef = useRef();
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [dockDragOffset, setDockDragOffset] = useState(0);
  const dockDragStartRef = useRef(0);

  const createWelcomeMessage = () => ({
    id: '0',
    text: 'Hello! I\'m your OncoConnect assistant. Ask me anything about cancer types, prevention, diagnosis, or treatment.\n\nI can help you with:\n- Understanding symptoms and what they might mean\n- Suggesting relevant medical tests\n- Providing actionable next steps\n- Explaining medical reports',
    isUser: false,
    timestamp: new Date(),
  });

  /** Space reserved so messages clear the docked composer (absolute). */
  const dockReserveHeight = 96;

  const dockPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 3,
      onPanResponderGrant: () => {
        dockDragStartRef.current = dockDragOffset;
      },
      onPanResponderMove: (_, gestureState) => {
        const nextOffset = dockDragStartRef.current - gestureState.dy;
        setDockDragOffset(nextOffset);
      },
      onPanResponderRelease: () => {},
      onPanResponderTerminate: () => {},
    })
  ).current;

  // ─── Keyboard listeners ───────────────────────────────────────────────────

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      const h = e.endCoordinates?.height;
      setKeyboardHeight(typeof h === 'number' ? h : 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // ─── Load persisted data on mount (always start fresh chat) ────────────────

  useEffect(() => {
    const init = async () => {
      // Always clear persisted chat state so a reopened app starts fresh.
      await clearActiveConversation();

      // Always start a fresh conversation
      const newId = generateId();
      setConversationId(newId);
      setMessages([createWelcomeMessage()]);
    };
    init();
  }, []);

  // ─── Auto-save on message changes ─────────────────────────────────────────

  useEffect(() => {
    if (messages.length > 1 && conversationId) {
      saveConversation(conversationId, messages, triageState);
    }
  }, [messages, conversationId, triageState]);

  // ─── Context chips ────────────────────────────────────────────────────────

  const updateContextChipsFromState = (state) => {
    if (!state) return;
    const chips = [];
    if (state.riskFactors?.age) chips.push(`${state.riskFactors.age}yo`);
    if (state.riskFactors?.gender) chips.push(state.riskFactors.gender);
    if (state.riskFactors?.smoking) chips.push('smoker');
    if (state.riskFactors?.familyHistory) chips.push('family hx');
    if (state.symptoms?.length > 0) {
      state.symptoms.slice(0, 3).forEach((s) => chips.push(s));
      if (state.symptoms.length > 3) chips.push(`+${state.symptoms.length - 3} more`);
    }
    setContextChips(chips);
  };

  const updateContextFromTriageState = (newState) => {
    updateContextChipsFromState(newState);
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  };

  const normalizeQuestion = (text) => text.toLowerCase().replace(/\s+/g, ' ').trim();

  const getCacheKey = (chatId, question) => {
    return `${chatId || 'local-chat'}::${normalizeQuestion(question)}`;
  };

  const cacheAnswer = (chatId, question, answer) => {
    const key = getCacheKey(chatId, question);
    setResponseCache((prev) => ({
      ...prev,
      [key]: answer,
    }));
  };

  const CANCER_SCOPE_RE =
    /\b(cancer|tumou?r|oncology|malignan|metast|chemotherapy|radiation|immunotherapy|biopsy|screening|carcinoma|sarcoma|lymphoma|leukemia|melanoma)\b/i;

  // Broader health/medical keyword pattern to also accept symptom-related queries
  const HEALTH_SCOPE_RE =
    /\b(symptom|diagnosis|treatment|prognosis|surgery|hospital|doctor|medical|health|disease|illness|pain|ache|lump|bleeding|blood|cough|fatigue|weight loss|nausea|vomiting|swelling|fever|headache|diarrhea|constipation|bruising|skin changes|shortness of breath|night sweats|appetite|urination|sputum|hoarseness|throat|difficulty swallowing|pelvic|abdominal|back pain|bone|breast|test|scan|x-ray|ct scan|mri|ultrasound|biopsy|chemo|radiation|stage|benign|malignant|remission|relapse|survival rate|risk factor|prevention|early detection|mammogram|colonoscopy|pap smear|psa|marker|cell|tumor marker|oncologist|pathology|histology|genetic|mutation|hereditary|familial|metastasis|palliative|hospice|clinical trial)\b/i;

  const shouldUseCache = (questionText) => {
    return !isSymptomNarrative(questionText);
  };

  const buildContextAwareQuestion = (questionText) => {
    const parts = [questionText];
    const symptomNarrative = isSymptomNarrative(questionText);

    // Append accumulated context so the backend has full picture
    if (triageState.symptoms.length > 0) {
      parts.push(`\n\n[Context — gathered across this conversation]`);
      parts.push(`Symptoms: ${triageState.symptoms.join(', ')}`);

      const rf = triageState.riskFactors;
      if (rf.age) parts.push(`Age: ${rf.age}`);
      if (rf.gender) parts.push(`Gender: ${rf.gender}`);
      if (rf.smoking) parts.push(`Smoking history: yes`);
      if (rf.familyHistory) parts.push(`Family history of cancer: yes`);
      if (triageState.answers.duration) parts.push(`Duration: ${triageState.answers.duration}`);
      if (triageState.answers.progression) parts.push(`Progression: ${triageState.answers.progression}`);
    }

    parts.push(`\n[Consistency instruction]\nUse only the symptoms and cancer type mentioned in this current conversation. Do not assume the user has breast cancer or any other cancer unless they explicitly said so in this chat. If the user mentions a different body area, focus on that area instead of earlier assumptions.`);

    // Safety instruction for limited data
    if (symptomNarrative && triageState.symptoms.length < 3) {
      parts.push(`\n[Safety instruction]\nThe user has limited symptom details. Do NOT suggest specific cancer types yet. Instead, provide:\n- Possible causes (both benign and serious)\n- Specific diagnostic tests they should consider\n- Warning signs to watch for\n- Lifestyle and home-care measures\nDo NOT just say "consult a doctor" — give real, useful information.`);
    }

    parts.push(`\n${buildDynamicResponseInstruction(questionText, {
      hasSymptomContext: triageState.symptoms.length > 0,
      isSymptomNarrative: symptomNarrative,
    })}`);

    return parts.join('\n');
  };

  const renderFormattedText = (text) =>
    renderRichTextElements(text, {
      boldText: styles.boldText,
      italicText: styles.italicText,
    });

  // ─── New Chat ─────────────────────────────────────────────────────────────

  const startNewChat = async () => {
    const newId = generateId();
    setConversationId(newId);
    setTriageState(createConversationState());
    setResponseCache({});
    setContextChips([]);
    await clearActiveConversation();
    setMessages([createWelcomeMessage()]);
  };

  const handleClearChat = () => {
    clearAllData()
      .then(() => startNewChat())
      .catch((error) => {
        console.error('Failed to clear chat:', error);
      });
  };

  // ─── Send message ─────────────────────────────────────────────────────────

  const handleSend = async () => {
    if (!inputText.trim() || loading) return;

    const userMessage = {
      id: generateId(),
      text: inputText.trim(),
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');

    // Guard: backend offline — show inline message, no API call
    if (!backendConnected) {
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          text: "⚠️ I'm currently offline. Please check your internet connection — the app retries automatically every 30 seconds.",
          isUser: false,
          timestamp: new Date(),
          isError: true,
        },
      ]);
      return;
    }

    setLoading(true);

    try {
      const triageCandidate = shouldRunSymptomTriage(userMessage.text, triageState);

      // Strict cancer/health scope gate — the message itself must be relevant.
      // Previous conversation history does NOT bypass this check.
      const isCancerRelated = CANCER_SCOPE_RE.test(userMessage.text);
      const isHealthRelated = HEALTH_SCOPE_RE.test(userMessage.text);
      const isOngoingTriage = triageState.stage !== 'initial' && triageState.symptoms.length > 0;

      if (!isCancerRelated && !isHealthRelated && !triageCandidate && !isOngoingTriage) {
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            text: 'I\'m OncoConnect — a cancer-focused assistant. I can only help with cancer and health-related questions.\n\nPlease ask me about:\n- Cancer symptoms, types, and staging\n- Screening and diagnostic tests\n- Treatment options (chemo, radiation, surgery, etc.)\n- Risk factors and prevention\n- Understanding medical reports',
            isUser: false,
            timestamp: new Date(),
            relevance: 1,
            sources: [],
          },
        ]);
        return;
      }

      if (triageCandidate) {
        const triageResult = runTriageStep(triageState, userMessage.text);
        setTriageState(triageResult.nextState);
        updateContextFromTriageState(triageResult.nextState);
        if (triageResult.shouldBlockBackend && triageResult.reply) {
          setMessages((prev) => [
            ...prev,
            {
              id: generateId(),
              text: triageResult.reply,
              isUser: false,
              timestamp: new Date(),
              relevance: 1,
              sources: [],
            },
          ]);
          return;
        }
      }

      if (shouldUseCache(userMessage.text)) {
        const cacheKey = getCacheKey(conversationId, userMessage.text);
        const cachedResponse = responseCache[cacheKey];

        if (cachedResponse) {
          setMessages((prev) => [
            ...prev,
            {
              id: generateId(),
              text: `I found this answer earlier in this chat:\n\n${cachedResponse}`,
              isUser: false,
              timestamp: new Date(),
              relevance: 1,
              sources: [],
            },
          ]);
          return;
        }
      }

      // Cap history to last 4 messages (2 Q&A pairs) and truncate long
      // assistant replies so we don't blow Groq's token budget.
      const MAX_HISTORY_CHARS = 300;
      const rawHistory = messages
        .filter(m => m.id !== '0')
        .map(m => ({
          role: m.isUser ? 'user' : 'assistant',
          content: m.isUser
            ? m.text
            : m.text.length > MAX_HISTORY_CHARS
              ? m.text.slice(0, MAX_HISTORY_CHARS) + '…'
              : m.text,
        }));

      // Keep only the 4 most-recent turns then append current user message
      const outboundHistory = rawHistory.slice(-4);
      outboundHistory.push({ role: 'user', content: userMessage.text });

      const contextAwarePrompt = buildContextAwareQuestion(userMessage.text);
      const response = await sendQuestion(contextAwarePrompt, conversationId, outboundHistory);
      const safeAnswer = response.answer;
      
      const botMessage = {
        id: generateId(),
        text: safeAnswer,
        isUser: false,
        timestamp: new Date(),
        conversationId: response.conversation_id,
        relevance: response.relevance,
        sources: response.sources || [],
      };

      setMessages((prev) => [...prev, botMessage]);
      if (shouldUseCache(userMessage.text)) {
        cacheAnswer(response.conversation_id || conversationId, userMessage.text, safeAnswer);
      }
      
      if (response.conversation_id && !conversationId) {
        setConversationId(response.conversation_id);
      }
    } catch (error) {
      const fallbackMessage =
        "⚠️ The OncoConnect server returned an error while processing your question. Please try again in a moment.";
      const errorText = error?.userMessage ? `⚠️ ${error.userMessage}` : fallbackMessage;

      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          text: errorText,
          isUser: false,
          timestamp: new Date(),
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    Clipboard.setString(text);
    Alert.alert('Copied!', 'Text copied to clipboard');
  };

  const handleSelectConversation = (conversation) => {
    const nextConversationId = generateId();
    const userMsg = {
      id: generateId(),
      text: conversation.question,
      isUser: true,
      timestamp: new Date(),
    };
    
    const botMsg = {
      id: generateId(),
      text: conversation.answer,
      isUser: false,
      timestamp: new Date(),
    };

    setConversationId(nextConversationId);
    setResponseCache({});
    setTriageState(createConversationState());
    setContextChips([]);
    setMessages([createWelcomeMessage(), userMsg, botMsg]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.screenContainer}>
        <HistoryModal
          visible={showHistory}
          onClose={() => setShowHistory(false)}
          onSelectConversation={handleSelectConversation}
        />

        <View style={styles.header}>
          <Text style={styles.headerTitle}>Ask Questions</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClearChat}
            >
              <Text style={styles.clearButtonText}>Clear Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.historyButton}
              onPress={() => setShowHistory(true)}
            >
              <Text style={styles.historyIcon}>📋</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Context Chips — show tracked health context */}
        {contextChips.length > 0 && (
          <View style={styles.contextChipBar}>
            <Text style={styles.contextLabel}>Tracking:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.contextChipScroll}>
              {contextChips.map((chip, idx) => (
                <View key={idx} style={styles.contextChip}>
                  <Text style={styles.contextChipText}>{chip}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.chatContainer}>
          <View style={styles.messagesPane}>
            <ScrollView
              ref={scrollViewRef}
              style={styles.messagesContainer}
              contentContainerStyle={[
                styles.messagesContent,
                {
                  paddingBottom:
                    dockReserveHeight +
                    16 +
                    Math.max(0, dockDragOffset) +
                    (keyboardHeight > 0 ? 28 : 0),
                },
              ]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              onScrollBeginDrag={Keyboard.dismiss}
              onContentSizeChange={() =>
                scrollViewRef.current?.scrollToEnd({ animated: true })
              }
            >
              {messages.map((message) => (
                <View
                  key={message.id}
                  style={[
                    styles.messageRow,
                    message.isUser ? styles.userMessageRow : styles.botMessageRow,
                  ]}
                >
                  {!message.isUser && (
                    <View style={styles.avatarContainer}>
                      <View style={styles.botAvatar}>
                        <Text style={styles.avatarEmoji}>🩺</Text>
                      </View>
                    </View>
                  )}

                  <View
                    style={[
                      styles.messageBubble,
                      message.isUser ? styles.userMessage : styles.botMessage,
                      message.isError && styles.errorMessage,
                    ]}
                  >
                    {message.isUser ? (
                      <Text style={[styles.messageText, styles.userMessageText]}>
                        {message.text}
                      </Text>
                    ) : (
                      <View style={styles.botMessageContent}>
                        {renderFormattedText(message.text)}
                      </View>
                    )}

                    {!message.isUser && !message.isError && (
                      <TouchableOpacity
                        style={styles.copyButton}
                        onPress={() => copyToClipboard(message.text)}
                      >
                        <Text style={styles.copyButtonText}>Copy</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {message.isUser && (
                    <View style={styles.avatarContainer}>
                      <View style={styles.userAvatar}>
                        <Text style={styles.avatarEmoji}>👤</Text>
                      </View>
                    </View>
                  )}
                </View>
              ))}

              {loading && (
                <View style={[styles.messageRow, styles.botMessageRow]}>
                  <View style={styles.avatarContainer}>
                    <View style={styles.botAvatar}>
                      <Text style={styles.avatarEmoji}>🩺</Text>
                    </View>
                  </View>
                  <View style={[styles.messageBubble, styles.botMessage, styles.loadingBubble]}>
                    <ActivityIndicator size="small" color="#FF2D55" />
                    <Text style={styles.loadingText}>Analyzing...</Text>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>

          {/* Composer dock: `bottom` tracks IME height so the field stays above the keyboard */}
          <View
            style={[
              styles.keyboardDock,
              {
                bottom: keyboardHeight + dockDragOffset,
                paddingLeft: 16 + insets.left,
                paddingRight: 16 + insets.right,
              },
            ]}
          >
            <View style={styles.dragHandleArea} {...dockPanResponder.panHandlers}>
              <View style={styles.dragHandle} />
              <Text style={styles.dragLabel}>Drag input box</Text>
            </View>
            {keyboardHeight > 0 ? (
              <Text style={styles.dockHint}>Typing above keyboard</Text>
            ) : null}
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Ask about cancer..."
                placeholderTextColor="#8E8E93"
                multiline
                maxLength={500}
                editable={!loading}
              />
              <TouchableOpacity
                style={[styles.sendButton, (!inputText.trim() || loading) && styles.sendButtonDisabled]}
                onPress={handleSend}
                disabled={!inputText.trim() || loading}
              >
                <Text style={styles.sendIcon}>↑</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const botAvatarShadowStyle = Platform.select({
  web: {
    boxShadow: '0px 2px 4px rgba(255,45,85,0.3)',
  },
  default: {
    shadowColor: '#FF2D55',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
});

const cardShadowStyle = Platform.select({
  web: {
    boxShadow: '0px 1px 4px rgba(0,0,0,0.05)',
  },
  default: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
});

const dockShadowStyle = Platform.select({
  web: {
    boxShadow: '0px -3px 8px rgba(0,0,0,0.12)',
  },
  default: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 18,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  screenContainer: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: '#FFE4EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#D72655',
  },
  historyButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyIcon: {
    fontSize: 16,
  },
  // ── Context Chips ─────────────────────────────────────
  contextChipBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  contextLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
    marginRight: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  contextChipScroll: {
    flexGrow: 0,
  },
  contextChip: {
    backgroundColor: 'rgba(255,45,85,0.1)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 6,
  },
  contextChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF2D55',
  },
  // ── Chat ──────────────────────────────────────────────
  chatContainer: {
    flex: 1,
    minHeight: 0,
    backgroundColor: '#F2F2F7',
    position: 'relative',
  },
  messagesPane: {
    flex: 1,
    minHeight: 0,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 20,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  userMessageRow: {
    justifyContent: 'flex-end',
  },
  botMessageRow: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    marginHorizontal: 8,
  },
  botAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF2D55',
    justifyContent: 'center',
    alignItems: 'center',
    ...botAvatarShadowStyle,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEmoji: {
    fontSize: 18,
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: 20,
    padding: 14,
    paddingHorizontal: 16,
  },
  userMessage: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 6,
  },
  botMessage: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 6,
    ...cardShadowStyle,
  },
  errorMessage: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  botMessageContent: {
    // Container for the rich-text View tree
  },
  botMessageText: {
    color: '#1C1C1E',
  },
  boldText: {
    fontWeight: '600',
    color: '#FF2D55',
  },
  italicText: {
    fontStyle: 'italic',
    color: '#8E8E93',
  },
  copyButton: {
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: '#F2F2F7',
    borderRadius: 14,
    alignSelf: 'flex-start',
  },
  copyButtonText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  loadingText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  keyboardDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.12)',
    ...dockShadowStyle,
    zIndex: 1000,
  },
  dragHandleArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
    paddingBottom: 8,
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D1D1D6',
  },
  dragLabel: {
    marginTop: 4,
    fontSize: 10,
    color: '#8E8E93',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  dockHint: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  inputWrapper: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F7',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    minHeight: 48,
  },
  input: {
    flex: 1,
    color: '#1C1C1E',
    fontSize: 16,
    maxHeight: 100,
    paddingVertical: 8,
    letterSpacing: -0.2,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF2D55',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  sendIcon: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
