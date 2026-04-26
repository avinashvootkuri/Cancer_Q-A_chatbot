import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { getHistory } from './api';

export default function HistoryModal({ visible, onClose, onSelectConversation }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const { width, height } = useWindowDimensions();
  
  const isMobile = width < 768;

  useEffect(() => {
    if (visible) {
      loadHistory();
    }
  }, [visible]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await getHistory(50);
      setConversations(data.conversations || []);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return '';
    }
  };

  const handleSelectConversation = (conv) => {
    onSelectConversation({
      question: conv.question,
      answer: conv.answer,
    });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[
          styles.modalContent,
          isMobile ? styles.modalContentMobile : styles.modalContentWeb
        ]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Chat History</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FF2D55" />
              <Text style={styles.loadingText}>Loading history...</Text>
            </View>
          ) : conversations.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No conversations yet</Text>
              <Text style={styles.emptySubtext}>
                Start chatting to see your history here
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.conversationList} contentContainerStyle={styles.conversationListContent}>
              {conversations.map((conv, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.conversationItem,
                    isMobile && styles.conversationItemMobile
                  ]}
                  onPress={() => handleSelectConversation(conv)}
                >
                  <View style={styles.conversationHeader}>
                    <Text style={styles.conversationDate}>
                      {formatDate(conv.timestamp)}
                    </Text>
                    {conv.relevance && (
                      <View
                        style={[
                          styles.relevanceBadge,
                          conv.relevance === 'RELEVANT' && styles.relevantBadge,
                          conv.relevance === 'PARTLY_RELEVANT' && styles.partlyBadge,
                        ]}
                      >
                        <Text style={styles.relevanceBadgeText}>
                          {conv.relevance === 'RELEVANT' ? '✓' : '~'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.conversationQuestion} numberOfLines={isMobile ? 2 : 3}>
                    {conv.question}
                  </Text>
                  <Text style={styles.conversationAnswer} numberOfLines={isMobile ? 2 : 4}>
                    {conv.answer}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#F2F2F7',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalContentMobile: {
    maxHeight: '90%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  modalContentWeb: {
    maxHeight: '70%',
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
    borderRadius: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: -0.2,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#8E8E93',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
  },
  conversationList: {
    flex: 1,
  },
  conversationListContent: {
    padding: 16,
  },
  conversationItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  conversationItemMobile: {
    padding: 14,
    marginBottom: 8,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  conversationDate: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '400',
  },
  relevanceBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  relevantBadge: {
    backgroundColor: '#34C759',
  },
  partlyBadge: {
    backgroundColor: '#FF9500',
  },
  relevanceBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  conversationQuestion: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 6,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  conversationAnswer: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 19,
  },
});
