# User Guide: Cancer Q&A Mobile App

## Getting Started

### Installation & Setup
1. Navigate to the mobile directory
2. Run `npm install` to install dependencies
3. Run `npm start` to launch the development server
4. Choose your platform (Android/iOS/Web)

## Features Overview

### 🏠 Home Screen
- App displays a splash screen on launch
- Shows connection status (Online/Offline) in the header
- Bottom navigation bar with two tabs:
  - 💬 Q&A
  - 📊 Report Analysis

---

## 💬 Q&A Section

### How to Use
1. **Ask Questions**: Type your cancer-related question in the input box
2. **Send**: Tap the send button (↑ icon)
3. **Receive Answer**: AI responds with detailed information
4. **Copy Response**: Tap "Copy" button under any AI response
5. **View History**: Tap the 📋 icon in the header to see past conversations

### Features
- ✅ Real-time AI responses
- ✅ Markdown formatting support (bold, italic)
- ✅ Conversation context awareness
- ✅ Copy to clipboard
- ✅ Conversation history
- ✅ Typing indicators

### Example Questions
- "What are the early signs of breast cancer?"
- "How is lung cancer diagnosed?"
- "What are the treatment options for prostate cancer?"
- "What lifestyle changes can help prevent cancer?"

---

## 📊 Report Analysis Section

### Step-by-Step Guide

#### 1. Upload Your Report
Choose one of three options:

**Option A: PDF Document**
1. Tap "Choose PDF" button
2. Browse and select a PDF file from your device
3. File preview will appear

**Option B: Image from Gallery**
1. Tap "Choose Image" button
2. Grant photo library permission (first time only)
3. Select an image of your medical report
4. Crop if desired
5. Confirm selection

**Option C: Take Photo**
1. Tap "Take Photo" button (mobile only)
2. Grant camera permission (first time only)
3. Position your medical report
4. Take the photo
5. Adjust and confirm

#### 2. Preview Your File
- For images: Full image preview displayed
- For PDFs: Document icon with filename and size

#### 3. Analyze Report
1. Tap "Analyze Report" button
2. Wait while AI processes (shows "Analyzing..." indicator)
3. Analysis typically takes 10-30 seconds

#### 4. View Results
The analysis shows:

**Report Type**
- Classification of your medical document
- Examples: "Blood Test", "MRI Report", "Biopsy Results"

**Key Findings**
- Important highlights from your report
- Critical values or observations

**Summary**
- Comprehensive overview of the report
- Medical terminology explained
- Context and interpretation

**Recommendations**
- Healthcare guidance
- Follow-up suggestions
- When to consult a doctor

**Confidence Score**
- Visual progress bar
- Percentage indicating AI confidence
- Higher scores mean more reliable analysis

#### 5. Next Steps
- Read the medical disclaimer
- Tap "Analyze Another Report" to upload a new file
- Consult with your healthcare provider for professional advice

---

## Important Notes

### ⚠️ Medical Disclaimer
- This app provides informational analysis only
- **NOT a substitute for professional medical advice**
- Always consult qualified healthcare providers
- Do not make medical decisions based solely on app analysis

### 🔒 Privacy & Security
- Files are uploaded securely to the backend
- No files are stored permanently without consent
- Review your healthcare provider's data policies

### 📱 Supported Formats
- **PDF**: Medical reports, lab results, prescriptions
- **Images**: JPG, PNG formats
- **Photo Quality**: Clear, well-lit images work best

### 🌐 Internet Connection Required
- Both features require active internet connection
- Check the status indicator in the header
- Green "Online" = Connected
- Red "Offline" = Connection issue

---

## Troubleshooting

### Backend Connection Issues
**Problem**: Status shows "Offline"
**Solutions**:
1. Check your internet connection
2. Verify backend server is running
3. Restart the app
4. Contact support if issue persists

### File Upload Fails
**Problem**: Cannot select or upload files
**Solutions**:
1. Grant necessary permissions (camera/photos)
2. Check file size (PDFs should be < 10MB)
3. Ensure file is not corrupted
4. Try different file format

### Analysis Takes Too Long
**Problem**: "Analyzing..." stays indefinitely
**Solutions**:
1. Check backend server status
2. Verify file is valid medical document
3. Try smaller file size
4. Refresh app and retry

### Poor Analysis Quality
**Problem**: Results don't match document
**Solutions**:
1. Ensure image is clear and well-lit
2. Avoid blurry or skewed photos
3. Use PDF format when possible
4. Re-upload with better quality

---

## Tips for Best Results

### For Q&A Section
- ✓ Be specific in your questions
- ✓ Provide context when needed
- ✓ Ask follow-up questions
- ✓ Review conversation history

### For Report Analysis
- ✓ Use high-resolution images
- ✓ Ensure good lighting
- ✓ Include all pages of multi-page reports
- ✓ Keep text clearly visible
- ✓ Avoid reflections on photos
- ✓ Use original PDFs when available

---

## Support & Feedback

### Getting Help
- Check documentation in NAVIGATION_UPDATE.md
- Review ARCHITECTURE.md for technical details
- Contact development team for issues

### Providing Feedback
- Report bugs through proper channels
- Suggest features for improvement
- Share user experience insights

---

## Version Information
- **Current Version**: 2.0
- **Last Updated**: January 2026
- **Platform**: React Native (Expo)
- **Supported Devices**: iOS, Android, Web

---

## Quick Reference

| Feature | Location | Icon |
|---------|----------|------|
| Ask Questions | Q&A Tab | 💬 |
| Upload PDF | Report Analysis Tab | 📎 |
| Choose Image | Report Analysis Tab | 🖼️ |
| Take Photo | Report Analysis Tab | 📷 |
| View History | Q&A Header | 📋 |
| Status | App Header | 🟢/🔴 |

---

**Remember**: This app is a helpful tool, but always consult healthcare professionals for medical decisions! 🏥
