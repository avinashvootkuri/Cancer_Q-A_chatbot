import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { analyzeFullReport, answerReportQuestion, processImageOCR } from './reportAI';
import { renderRichTextElements } from './formatRichText';

/** Markdown-style **bold**, *italic*, __bold__, _italic_ inside analysis text */
const FormattedText = ({ children, style }) => {
  if (!children || typeof children !== 'string') {
    return <Text style={style}>{children}</Text>;
  }
  const rich = renderRichTextElements(children, {
    boldText: { fontWeight: '700' },
    italicText: { fontStyle: 'italic' },
  });
  return <Text style={style}>{rich ?? children}</Text>;
};

export default function ReportAnalysisScreen({ backendConnected }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [extractedText, setExtractedText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [reportSummary, setReportSummary] = useState(null);
  
  // Q&A state
  const [showQA, setShowQA] = useState(false);
  const [question, setQuestion] = useState('');
  const [qaHistory, setQaHistory] = useState([]);
  const [askingQuestion, setAskingQuestion] = useState(false);
  
  // Processing state - unified for all processing
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [processingStep, setProcessingStep] = useState(0); // 0: not started, 1: extracting, 2: analyzing, 3: done
  
  // Text input state
  const [showTextInput, setShowTextInput] = useState(false);
  const [manualText, setManualText] = useState('');

  /**
   * Main function to process and analyze a document
   */
  const processAndAnalyze = async (fileUri, fileType, mimeType) => {
    console.log('processAndAnalyze called:', { fileUri: fileUri?.substring(0, 50), fileType, mimeType });
    
    setIsProcessing(true);
    setProcessingStep(1);
    setProcessingStatus('Reading document...');
    
    try {
      let text = '';
      
      if (fileType === 'txt') {
        // Text file - read directly
        console.log('Reading text file...');
        setProcessingStatus('Loading text file...');
        text = await FileSystem.readAsStringAsync(fileUri);
      } else if (fileType === 'image') {
        // Image - use OCR
        console.log('Processing image with OCR...');
        setProcessingStatus('Converting image...');
        
        let base64 = '';
        let actualMimeType = mimeType || 'image/jpeg';
        
        // Check if the URI is already a data URL (web) or needs to be read from file (native)
        if (fileUri.startsWith('data:')) {
          // Web: Extract base64 from data URL
          console.log('Extracting base64 from data URL (web)...');
          const matches = fileUri.match(/^data:([^;]+);base64,(.+)$/);
          if (matches) {
            actualMimeType = matches[1];
            base64 = matches[2];
          } else {
            throw new Error('Invalid image data URL format');
          }
        } else {
          // Native: Read file as base64
          console.log('Reading file as base64 (native)...');
          base64 = await FileSystem.readAsStringAsync(fileUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        }
        
        console.log('Image converted to base64, length:', base64?.length);
        
        setProcessingStatus('Extracting text with AI OCR...');
        const { text: ocrText, error } = await processImageOCR(base64, actualMimeType);
        console.log('OCR result:', { textLength: ocrText?.length, error });
        
        if (error || !ocrText?.trim()) {
          throw new Error(error || 'No text found in image');
        }
        text = ocrText;
      }
      
      if (!text?.trim()) {
        throw new Error('No text extracted from document');
      }
      
      // Text extracted successfully, now analyze
      setExtractedText(text);
      setManualText(text);
      setProcessingStep(2);
      setProcessingStatus('Analyzing report with AI...');
      
      const result = await analyzeFullReport(text.trim());
      
      setProcessingStep(3);
      setProcessingStatus('Analysis complete!');
      setReportSummary(result);
      setShowQA(true);
      
      // Brief delay to show success, then hide processing
      setTimeout(() => {
        setIsProcessing(false);
      }, 500);
      
    } catch (error) {
      console.error('Processing error:', error);
      setIsProcessing(false);
      setProcessingStep(0);
      
      // Show text input as fallback
      Alert.alert(
        'Processing Failed',
        `${error.message}\n\nPlease enter the report text manually.`,
        [{ text: 'OK', onPress: () => setShowTextInput(true) }]
      );
    }
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant permission to access your photos');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.9,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const image = result.assets[0];
        
        // Set file and start processing
        setSelectedFile({
          uri: image.uri,
          name: 'medical_report.jpg',
          type: 'image',
          width: image.width,
          height: image.height,
        });
        setReportSummary(null);
        setQaHistory([]);
        setShowQA(false);
        setExtractedText('');
        
        // Start processing immediately - use setTimeout to ensure state updates first
        setTimeout(() => {
          processAndAnalyze(image.uri, 'image', 'image/jpeg');
        }, 100);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
      console.error('Image picker error:', error);
    }
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (permissionResult.status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant permission to access your camera');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.9,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const image = result.assets[0];
        setSelectedFile({
          uri: image.uri,
          name: 'medical_report_photo.jpg',
          type: 'image',
          width: image.width,
          height: image.height,
        });
        setReportSummary(null);
        setQaHistory([]);
        setShowQA(false);
        setExtractedText('');
        
        // Start processing immediately - use setTimeout to ensure state updates first
        setTimeout(() => {
          processAndAnalyze(image.uri, 'image', 'image/jpeg');
        }, 100);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo');
      console.error('Camera error:', error);
    }
  };

  const handleTextInput = () => {
    setShowTextInput(true);
  };

  const handleSubmitText = async () => {
    if (manualText.trim()) {
      const text = manualText.trim();
      setShowTextInput(false);
      setExtractedText(text);
      setSelectedFile(prev => prev || {
        uri: 'manual-input',
        name: 'Manual Report Input',
        type: 'text',
        size: text.length,
      });
      
      // Start analysis with processing screen
      setIsProcessing(true);
      setProcessingStep(2);
      setProcessingStatus('Analyzing report with AI...');
      
      try {
        const result = await analyzeFullReport(text);
        setProcessingStep(3);
        setProcessingStatus('Analysis complete!');
        setReportSummary(result);
        setShowQA(true);
        setQaHistory([]);
        
        setTimeout(() => {
          setIsProcessing(false);
        }, 500);
      } catch (error) {
        Alert.alert('Analysis Failed', 'Failed to analyze the report. Please try again.');
        console.error('Analysis error:', error);
        setIsProcessing(false);
        setProcessingStep(0);
      }
    }
  };

  const handleAnalyze = async () => {
    if (!extractedText || !extractedText.trim()) {
      Alert.alert('No Report Text', 'Please enter the report text to analyze.');
      return;
    }

    setIsProcessing(true);
    setProcessingStep(2);
    setProcessingStatus('Analyzing report with AI...');
    
    try {
      const result = await analyzeFullReport(extractedText.trim());
      setProcessingStep(3);
      setProcessingStatus('Analysis complete!');
      setReportSummary(result);
      setShowQA(true);
      
      setTimeout(() => {
        setIsProcessing(false);
      }, 500);
    } catch (error) {
      Alert.alert('Analysis Failed', 'Failed to analyze the report. Please try again.');
      console.error('Analysis error:', error);
      setIsProcessing(false);
      setProcessingStep(0);
    }
  };

  const handleAskQuestion = async () => {
    if (!question.trim() || !extractedText) return;
    
    setAskingQuestion(true);
    const currentQuestion = question;
    setQuestion('');
    
    // Add question to history immediately
    setQaHistory(prev => [...prev, { type: 'question', text: currentQuestion }]);
    
    try {
      const result = await answerReportQuestion(extractedText, currentQuestion);
      
      setQaHistory(prev => [...prev, { 
        type: 'answer', 
        text: result.answer || "I couldn't find a specific answer in the report.",
        score: result.score 
      }]);
    } catch (error) {
      setQaHistory(prev => [...prev, { 
        type: 'answer', 
        text: "Sorry, I couldn't process that question. Please try again.",
        error: true 
      }]);
    } finally {
      setAskingQuestion(false);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setExtractedText('');
    setReportSummary(null);
    setQaHistory([]);
    setShowQA(false);
    setManualText('');
    setShowTextInput(false);
    setIsProcessing(false);
    setProcessingStep(0);
    setProcessingStatus('');
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Sample report text for demonstration
  const getSampleReportText = () => {
    return `PATHOLOGY REPORT

Patient: Jane Doe
Date: January 15, 2026
Specimen: Breast Biopsy, Right

CLINICAL HISTORY:
52-year-old female with suspicious mass identified on mammography. BI-RADS 4B.

GROSS DESCRIPTION:
Received in formalin labeled "Right breast biopsy" is a core needle biopsy consisting of 4 cores, each measuring 1.0 cm in length.

MICROSCOPIC DESCRIPTION:
Sections show breast tissue with invasive ductal carcinoma, moderately differentiated (Grade 2). 
Tumor size: 1.8 cm
Margins: Involved at the posterior margin
Lymphovascular invasion: Present

IMMUNOHISTOCHEMISTRY:
Estrogen Receptor (ER): Positive (90%)
Progesterone Receptor (PR): Positive (75%)
HER2: Negative (1+)
Ki-67 proliferation index: 15%

TNM STAGING: pT1c pN0 M0 (Stage IA)

DIAGNOSIS:
Invasive ductal carcinoma of the right breast, moderately differentiated.
ER positive, PR positive, HER2 negative.

RECOMMENDATIONS:
1. Surgical consultation for definitive treatment
2. Consider oncotype DX testing
3. Multidisciplinary tumor board review recommended`;
  };

  const suggestedQuestions = [
    "What is the cancer stage?",
    "Is this malignant or benign?",
    "What is the tumor size?",
    "What are the biomarker results?",
    "What treatment is recommended?",
  ];

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Report Analysis</Text>
        <Text style={styles.headerSubtitle}>AI-powered medical report analysis</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Text Input Modal */}
        {showTextInput && (
          <View style={styles.textInputSection}>
            <Text style={styles.textInputTitle}>Enter Report Text</Text>
            <TextInput
              style={styles.reportTextInput}
              multiline
              placeholder="Paste or type your medical report text here..."
              placeholderTextColor="#8E8E93"
              value={manualText}
              onChangeText={setManualText}
            />
            <View style={styles.textInputButtons}>
              <TouchableOpacity 
                style={styles.cancelTextButton} 
                onPress={() => setShowTextInput(false)}
              >
                <Text style={styles.cancelTextButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.submitTextButton} 
                onPress={handleSubmitText}
              >
                <Text style={styles.submitTextButtonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!selectedFile && !reportSummary && !showTextInput && !isProcessing && (
          <View style={styles.uploadSection}>
            <View style={styles.uploadIconContainer}>
              <Text style={styles.uploadIcon}>📄</Text>
            </View>
            <Text style={styles.uploadTitle}>Upload Your Report</Text>
            <Text style={styles.uploadDescription}>
              Upload an image, take a photo, or enter report text for AI-powered analysis
            </Text>

            <View style={styles.uploadButtonsContainer}>
              <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
                <Text style={styles.uploadButtonIcon}>🖼️</Text>
                <Text style={styles.uploadButtonText}>Choose Image</Text>
              </TouchableOpacity>

              {Platform.OS !== 'web' && (
                <TouchableOpacity style={styles.uploadButton} onPress={takePhoto}>
                  <Text style={styles.uploadButtonIcon}>📷</Text>
                  <Text style={styles.uploadButtonText}>Take Photo</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity 
                style={[styles.uploadButton, styles.textInputButton]} 
                onPress={handleTextInput}
              >
                <Text style={styles.uploadButtonIcon}>📝</Text>
                <Text style={styles.uploadButtonText}>Enter Text</Text>
              </TouchableOpacity>
            </View>

            {/* Try Sample Report button for demo */}
            <TouchableOpacity 
              style={styles.sampleReportButton} 
              onPress={async () => {
                const sampleText = getSampleReportText();
                setSelectedFile({
                  uri: 'sample-report',
                  name: 'Sample Pathology Report',
                  type: 'text',
                  size: sampleText.length,
                });
                setExtractedText(sampleText);
                setManualText(sampleText);
                
                // Start analysis with processing screen
                setIsProcessing(true);
                setProcessingStep(2);
                setProcessingStatus('Analyzing sample report...');
                
                try {
                  const result = await analyzeFullReport(sampleText.trim());
                  setProcessingStep(3);
                  setProcessingStatus('Analysis complete!');
                  setReportSummary(result);
                  setShowQA(true);
                  setQaHistory([]);
                  
                  setTimeout(() => {
                    setIsProcessing(false);
                  }, 500);
                } catch (error) {
                  Alert.alert('Analysis Failed', 'Failed to analyze the report.');
                  setIsProcessing(false);
                  setProcessingStep(0);
                }
              }}
            >
              <Text style={styles.sampleReportIcon}>🧪</Text>
              <Text style={styles.sampleReportText}>Try Sample Report (Demo)</Text>
            </TouchableOpacity>


          </View>
        )}

        {/* Processing Screen - shown when processing any file */}
        {isProcessing && (
          <View style={styles.processingContainer}>
            <View style={styles.processingCard}>
              <ActivityIndicator size="large" color="#4CAF50" />
              <Text style={styles.processingTitle}>
                {processingStep === 1 ? '📖 Reading Document...' : 
                 processingStep === 2 ? '🔬 Analyzing Report...' : 
                 processingStep === 3 ? '✅ Complete!' : 'Processing...'}
              </Text>
              <Text style={styles.processingStatus}>{processingStatus}</Text>
              <View style={styles.processingSteps}>
                <Text style={[styles.processingStep, processingStep >= 1 && styles.processingStepActive]}>
                  {processingStep > 1 ? '✅' : processingStep === 1 ? '⏳' : '⬜'} Extract text from document
                </Text>
                <Text style={[styles.processingStep, processingStep >= 2 && styles.processingStepActive]}>
                  {processingStep > 2 ? '✅' : processingStep === 2 ? '⏳' : '⬜'} Analyze with AI
                </Text>
                <Text style={[styles.processingStep, processingStep >= 3 && styles.processingStepActive]}>
                  {processingStep >= 3 ? '✅' : '⬜'} Generate insights
                </Text>
              </View>
              <Text style={styles.processingHint}>This may take a moment...</Text>
            </View>
          </View>
        )}

        {selectedFile && !reportSummary && !showTextInput && !isProcessing && (
          <View style={styles.filePreviewSection}>
            <View style={styles.filePreviewCard}>
              {selectedFile.type === 'image' ? (
                <Image source={{ uri: selectedFile.uri }} style={styles.previewImage} />
              ) : selectedFile.type === 'text' ? (
                <View style={styles.textPreview}>
                  <Text style={styles.textPreviewIcon}>📝</Text>
                  <Text style={styles.textPreviewTitle}>Report Text Entered</Text>
                  <Text style={styles.textPreviewSize}>{formatFileSize(selectedFile.size)} characters</Text>
                </View>
              ) : (
                <View style={styles.pdfPreview}>
                  <Text style={styles.pdfIcon}>📄</Text>
                  <Text style={styles.pdfName}>{selectedFile.name}</Text>
                  <Text style={styles.pdfSize}>{formatFileSize(selectedFile.size)}</Text>
                </View>
              )}
            </View>

            <View style={styles.actionButtons}>
              {extractedText && (
                <View style={styles.textStatusContainer}>
                  <Text style={styles.textStatusIcon}>✅</Text>
                  <Text style={styles.textStatusText}>
                    Report text ready ({extractedText.length} characters)
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.analyzeButton, !extractedText && styles.analyzeButtonDisabled]}
                onPress={handleAnalyze}
                disabled={!extractedText}
              >
                <Text style={styles.analyzeButtonIcon}>🔍</Text>
                <Text style={styles.analyzeButtonText}>Analyze Report</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.clearButton} onPress={clearFile}>
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {reportSummary && (
          <View style={styles.summarySection}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryHeaderIcon}>✅</Text>
              <Text style={styles.summaryHeaderTitle}>Analysis Complete</Text>
            </View>

            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryRowItem}>
                  <Text style={styles.summaryLabel}>Report Type</Text>
                  <Text style={styles.summaryValue}>{reportSummary.report_type || 'Medical Report'}</Text>
                </View>
                <View style={styles.summaryRowItem}>
                  <Text style={styles.summaryLabel}>Risk Level</Text>
                  <View style={[
                    styles.riskBadge,
                    reportSummary.risk_level === 'High Risk' && styles.riskHigh,
                    reportSummary.risk_level === 'Medium Risk' && styles.riskMedium,
                    reportSummary.risk_level === 'Low Risk' && styles.riskLow,
                    reportSummary.risk_level === 'Requires Review' && styles.riskRequiresReview,
                  ]}>
                    <Text style={styles.riskBadgeText}>{reportSummary.risk_level || 'Requires Review'}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.summaryDivider} />

              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>📋 AI Summary</Text>
                <FormattedText style={styles.summaryText}>{reportSummary.summary || 'No summary available'}</FormattedText>
              </View>

              <View style={styles.summaryDivider} />

              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>🔍 Key Findings</Text>
                <FormattedText style={styles.summaryText}>{reportSummary.key_findings || 'Analysis in progress...'}</FormattedText>
              </View>

              {reportSummary.entities && reportSummary.entities.length > 0 && (
                <>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>🏷️ Extracted Entities</Text>
                    <View style={styles.entitiesContainer}>
                      {reportSummary.entities.slice(0, 8).map((entity, index) => (
                        <View key={index} style={styles.entityTag}>
                          <Text style={styles.entityText}>{entity.text}</Text>
                          <Text style={styles.entityType}>{entity.type || entity.category}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </>
              )}

              {reportSummary.recommendations && (
                <>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>💡 Recommendations</Text>
                    <Text style={styles.summaryText}>{reportSummary.recommendations}</Text>
                  </View>
                </>
              )}
            </View>

            {/* Patient-Friendly Explanation Section */}
            {reportSummary.patient_explanation && (
              <View style={styles.patientExplanationCard}>
                <View style={styles.patientExplanationHeader}>
                  <Text style={styles.patientExplanationIcon}>💙</Text>
                  <Text style={styles.patientExplanationTitle}>In Simple Words</Text>
                </View>
                <Text style={styles.patientExplanationSubtitle}>
                  Here's what your report means in everyday language:
                </Text>
                <View style={styles.patientExplanationDivider} />
                <FormattedText style={styles.patientExplanationText}>
                  {reportSummary.patient_explanation}
                </FormattedText>
              </View>
            )}

            {/* Q&A Section */}
            {showQA && (
              <View style={styles.qaSection}>
                <Text style={styles.qaSectionTitle}>💬 Ask Questions About Your Report</Text>
                
                {/* Suggested Questions */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestedContainer}>
                  {suggestedQuestions.map((q, index) => (
                    <TouchableOpacity 
                      key={index}
                      style={styles.suggestedQuestion}
                      onPress={() => setQuestion(q)}
                    >
                      <Text style={styles.suggestedQuestionText}>{q}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Q&A History */}
                {qaHistory.length > 0 && (
                  <View style={styles.qaHistory}>
                    {qaHistory.map((item, index) => (
                      <View 
                        key={index} 
                        style={[
                          styles.qaItem,
                          item.type === 'question' ? styles.qaQuestion : styles.qaAnswer
                        ]}
                      >
                        <Text style={styles.qaItemIcon}>
                          {item.type === 'question' ? '❓' : '💡'}
                        </Text>
                        <FormattedText style={[
                          styles.qaItemText,
                          item.error && styles.qaErrorText
                        ]}>
                          {item.text}
                        </FormattedText>
                        {item.score !== undefined && (
                          <Text style={styles.qaScore}>
                            Confidence: {(item.score * 100).toFixed(0)}%
                          </Text>
                        )}
                      </View>
                    ))}
                    {askingQuestion && (
                      <View style={[styles.qaItem, styles.qaAnswer]}>
                        <ActivityIndicator size="small" color="#FF2D55" />
                        <Text style={styles.qaItemText}>Searching report...</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Question Input */}
                <View style={styles.qaInputContainer}>
                  <TextInput
                    style={styles.qaInput}
                    placeholder="Ask about your report..."
                    placeholderTextColor="#8E8E93"
                    value={question}
                    onChangeText={setQuestion}
                    onSubmitEditing={handleAskQuestion}
                    editable={!askingQuestion}
                  />
                  <TouchableOpacity 
                    style={[styles.qaButton, (!question.trim() || askingQuestion) && styles.qaButtonDisabled]}
                    onPress={handleAskQuestion}
                    disabled={!question.trim() || askingQuestion}
                  >
                    <Text style={styles.qaButtonText}>Ask</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.disclaimerCard}>
              <Text style={styles.disclaimerIcon}>⚠️</Text>
              <Text style={styles.disclaimerText}>
                This AI analysis is for informational purposes only and should not replace professional medical advice. Always consult with your healthcare provider.
              </Text>
            </View>

            <TouchableOpacity style={styles.newAnalysisButton} onPress={clearFile}>
              <Text style={styles.newAnalysisButtonText}>Analyze Another Report</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
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
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  // Text Input Section
  textInputSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  textInputTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  reportTextInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    color: '#1C1C1E',
    minHeight: 200,
    textAlignVertical: 'top',
  },
  textInputButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelTextButton: {
    flex: 1,
    padding: 14,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelTextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
  },
  submitTextButton: {
    flex: 1,
    padding: 14,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    alignItems: 'center',
  },
  submitTextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Upload Section
  uploadSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  uploadIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  uploadIcon: {
    fontSize: 40,
  },
  uploadTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  uploadDescription: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  uploadButtonsContainer: {
    width: '100%',
    gap: 12,
  },
  uploadButton: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  textInputButton: {
    backgroundColor: '#34C759',
  },
  uploadButtonIcon: {
    fontSize: 20,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modelsInfoContainer: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
    alignSelf: 'stretch',
  },
  modelsInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  modelsInfoText: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 4,
  },
  // Sample Report Button
  sampleReportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderStyle: 'dashed',
  },
  sampleReportIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  sampleReportText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  },
  // Text Status in file preview
  textStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  textStatusIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  textStatusText: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '500',
  },
  textStatusWarning: {
    fontSize: 14,
    color: '#FF9500',
    fontWeight: '500',
    flex: 1,
  },
  enterTextPromptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#34C759',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    gap: 8,
  },
  enterTextPromptIcon: {
    fontSize: 18,
  },
  enterTextPromptText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // OCR Status Styles
  ocrStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  ocrStatusText: {
    fontSize: 14,
    color: '#1976D2',
    fontWeight: '500',
  },
  ocrSuccessContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  ocrSuccessIcon: {
    fontSize: 16,
  },
  ocrSuccessText: {
    fontSize: 14,
    color: '#388E3C',
    fontWeight: '500',
  },
  ocrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    gap: 8,
  },
  ocrButtonIcon: {
    fontSize: 18,
  },
  ocrButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Processing Screen Styles
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  processingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    width: '100%',
    maxWidth: 400,
  },
  processingTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1C1E',
    marginTop: 24,
    marginBottom: 8,
  },
  processingStatus: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '500',
    marginBottom: 24,
    textAlign: 'center',
  },
  processingSteps: {
    alignSelf: 'stretch',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  processingStep: {
    fontSize: 14,
    color: '#8E8E93',
    paddingVertical: 8,
  },
  processingStepActive: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  processingHint: {
    fontSize: 13,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  // File Preview
  filePreviewSection: {
    gap: 20,
  },
  filePreviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  previewImage: {
    width: '100%',
    height: 300,
    resizeMode: 'contain',
    backgroundColor: '#F2F2F7',
  },
  pdfPreview: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  pdfName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 8,
  },
  pdfSize: {
    fontSize: 14,
    color: '#8E8E93',
  },
  textPreview: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textPreviewIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  textPreviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 8,
  },
  textPreviewSize: {
    fontSize: 14,
    color: '#8E8E93',
  },
  actionButtons: {
    gap: 12,
  },
  analyzeButton: {
    flexDirection: 'row',
    backgroundColor: '#FF2D55',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  analyzeButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  analyzeButtonIcon: {
    fontSize: 20,
  },
  analyzeButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  clearButton: {
    backgroundColor: '#F2F2F7',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF2D55',
  },
  // Summary Section
  summarySection: {
    gap: 20,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  summaryHeaderIcon: {
    fontSize: 28,
  },
  summaryHeaderTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryRowItem: {
    marginVertical: 8,
    flex: 1,
  },
  summaryItem: {
    marginVertical: 8,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  summaryText: {
    fontSize: 15,
    color: '#1C1C1E',
    lineHeight: 24,
    flexWrap: 'wrap',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#F2F2F7',
    marginVertical: 16,
  },
  // Risk Badge
  riskBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#8E8E93',
  },
  riskHigh: {
    backgroundColor: '#FF3B30',
  },
  riskMedium: {
    backgroundColor: '#FF9500',
  },
  riskLow: {
    backgroundColor: '#34C759',
  },
  riskRequiresReview: {
    backgroundColor: '#5856D6',
  },
  riskBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Entities
  entitiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  entityTag: {
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  entityText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  entityType: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 2,
  },
  // Patient Explanation Section
  patientExplanationCard: {
    backgroundColor: '#E8F4FD',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#B8D4E8',
  },
  patientExplanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  patientExplanationIcon: {
    fontSize: 28,
  },
  patientExplanationTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1565C0',
  },
  patientExplanationSubtitle: {
    fontSize: 14,
    color: '#5B8DB8',
    marginBottom: 12,
  },
  patientExplanationDivider: {
    height: 1,
    backgroundColor: '#B8D4E8',
    marginVertical: 16,
  },
  patientExplanationText: {
    fontSize: 16,
    color: '#1C1C1E',
    lineHeight: 26,
  },
  // Q&A Section
  qaSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  qaSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  suggestedContainer: {
    marginBottom: 16,
  },
  suggestedQuestion: {
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
  },
  suggestedQuestionText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '500',
  },
  qaHistory: {
    marginBottom: 16,
    gap: 12,
  },
  qaItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 12,
  },
  qaQuestion: {
    backgroundColor: '#007AFF15',
  },
  qaAnswer: {
    backgroundColor: '#F2F2F7',
  },
  qaItemIcon: {
    fontSize: 16,
  },
  qaItemText: {
    flex: 1,
    fontSize: 14,
    color: '#1C1C1E',
    lineHeight: 20,
  },
  qaErrorText: {
    color: '#FF3B30',
  },
  qaScore: {
    fontSize: 11,
    color: '#8E8E93',
  },
  qaInputContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  qaInput: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1C1C1E',
  },
  qaButton: {
    backgroundColor: '#FF2D55',
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qaButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  qaButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Disclaimer
  disclaimerCard: {
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 0, 0.3)',
  },
  disclaimerIcon: {
    fontSize: 20,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 18,
  },
  newAnalysisButton: {
    backgroundColor: '#007AFF',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  newAnalysisButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
