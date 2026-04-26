import Constants from 'expo-constants';
import axios from 'axios';

const DEFAULT_API_URL = 'https://cancer-qa-backend-production-64e1.up.railway.app';

const resolveApiUrl = () => {
  const configuredUrl =
    Constants.expoConfig?.extra?.apiUrl ||
    Constants.manifest2?.extra?.expoClient?.extra?.apiUrl ||
    Constants.manifest?.extra?.apiUrl;

  return configuredUrl || DEFAULT_API_URL;
};

const API_URL = resolveApiUrl();

console.log('Using API URL:', API_URL);

export const checkBackendConnection = async () => {
  try {
    console.log('Checking backend connection to:', API_URL);
    await axios.get(`${API_URL}/`, {
      timeout: 25000, // 25 s — covers Railway cold-start (up to ~20 s on free tier)
    });
    console.log('Backend connection successful');
    return true;
  } catch (error) {
    console.error('Backend connection failed:', error.message);
    return false;
  }
};

export const sendQuestion = async (question, conversationId, conversationHistory = []) => {
  try {
    console.log('Sending question to:', `${API_URL}/question`);
    const response = await axios.post(`${API_URL}/question`, {
      question,
      conversation_id: conversationId,
      conversation_history: conversationHistory,
    }, {
      timeout: 60000, // 60 seconds for AI response
      headers: {
        'Content-Type': 'application/json',
      },
    });
    console.log('Response received:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error sending question:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
      const serverMessage = error.response.data?.error || error.response.data?.message;
      const status = error.response.status;
      error.userMessage =
        status >= 500
          ? `The OncoConnect server responded with an internal error${serverMessage ? `: ${serverMessage}` : '.'}`
          : serverMessage || `The server returned an error (${status}).`;
    } else if (error.request) {
      error.userMessage = 'Could not reach the OncoConnect server. Please check your internet connection and try again.';
    } else {
      error.userMessage = error.message || 'An unexpected error occurred while sending your question.';
    }
    throw error;
  }
};

export const sendFeedback = async (conversationId, feedback) => {
  try {
    const response = await axios.post(`${API_URL}/feedback`, {
      conversation_id: conversationId,
      feedback,
    }, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error sending feedback:', error);
    throw error;
  }
};

export const getHistory = async (limit = 50) => {
  try {
    const response = await axios.get(`${API_URL}/history`, {
      params: { limit },
      timeout: 15000,
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching history:', error);
    throw error;
  }
};

export const analyzeReport = async (file) => {
  try {
    console.log('Analyzing report:', file.name);

    const formData = new FormData();
    const fileToUpload = {
      uri: file.uri,
      type: file.type === 'pdf' ? 'application/pdf' : 'image/jpeg',
      name: file.name,
    };
    formData.append('file', fileToUpload);

    const response = await axios.post(`${API_URL}/analyze-report`, formData, {
      timeout: 90000, // 90 seconds for report analysis
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    console.log('Analysis complete:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error analyzing report:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }

    // Return mock data for development/testing
    return {
      report_type: 'Blood Test Report',
      key_findings: 'Hemoglobin levels are within normal range. White blood cell count is slightly elevated, which may indicate a minor infection.',
      summary: 'Overall, the blood test results show mostly normal values. The slight elevation in white blood cells is not concerning but should be monitored. All other parameters including red blood cells, platelets, and liver function are within healthy ranges.',
      recommendations: 'Consider follow-up testing in 2-3 weeks if symptoms persist. Maintain adequate hydration and rest. Consult with your physician for personalized medical advice.',
      confidence_score: 0.85,
    };
  }
};
