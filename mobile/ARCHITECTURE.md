# Navigation Structure Summary

## App Architecture

```
App.js (Root)
├── SplashScreen
└── NavigationContainer
    ├── Header (Global)
    │   ├── Title: "Cancer Q&A"
    │   ├── Subtitle: "Your Health Assistant"
    │   └── Status Indicator (Online/Offline)
    │
    └── Bottom Tab Navigator
        ├── Tab 1: Q&A Section 💬
        │   └── QAScreen.js
        │       ├── Chat Messages
        │       ├── History Modal
        │       └── Input Area
        │
        └── Tab 2: Report Analysis 📊
            └── ReportAnalysisScreen.js
                ├── Upload Options
                │   ├── Choose PDF 📎
                │   ├── Choose Image 🖼️
                │   └── Take Photo 📷
                │
                ├── File Preview
                │   ├── Image Display
                │   └── PDF Info
                │
                └── Analysis Results
                    ├── Report Type
                    ├── Key Findings
                    ├── Summary
                    ├── Recommendations
                    ├── Confidence Score
                    └── Disclaimer
```

## Component Flow

### Q&A Screen
1. User enters question
2. Send to backend API
3. Display AI response
4. Support markdown formatting
5. Allow copying responses
6. Access conversation history

### Report Analysis Screen
1. Select upload method (PDF/Image/Camera)
2. Display file preview
3. Click "Analyze Report"
4. Send to backend `/analyze-report` endpoint
5. Display comprehensive summary
6. Show confidence score
7. Display medical disclaimer
8. Option to analyze another report

## API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/question` | POST | Ask Q&A questions |
| `/feedback` | POST | Submit feedback |
| `/history` | GET | Get conversation history |
| `/analyze-report` | POST | Analyze medical reports (NEW) |

## File Structure

```
mobile/
├── App.js                      (Main navigation container)
├── QAScreen.js                 (Q&A chat interface)
├── ReportAnalysisScreen.js     (Report upload & analysis)
├── SplashScreen.js             (Existing)
├── HistoryModal.js             (Existing)
├── api.js                      (Updated with analyzeReport)
├── package.json                (Updated dependencies)
└── NAVIGATION_UPDATE.md        (Documentation)
```

## Design System

### Colors (Apple Health Style)
- Primary: `#FF2D55` (Health Pink/Red)
- Secondary: `#007AFF` (Apple Blue)
- Success: `#34C759` (Green)
- Background: `#F2F2F7` (System Gray)
- Surface: `#FFFFFF` (White)
- Text: `#1C1C1E` (Black)
- Secondary Text: `#8E8E93` (Gray)

### Typography
- Header: 28pt, Bold
- Subtitle: 13pt, Regular
- Body: 16pt, Regular
- Button: 16-17pt, Semibold
- Caption: 12-13pt, Regular

### Spacing
- Container Padding: 20px
- Card Border Radius: 20px
- Button Border Radius: 14px
- Element Gap: 12-16px
