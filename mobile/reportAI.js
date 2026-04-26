// Groq API configuration - using direct HTTP calls for React Native compatibility
// API key should be set via environment variable or app config
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || "";
const GROQ_API_BASE = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "openai/gpt-oss-120b";

// Vision model for OCR - using Groq's Llama 4 Scout
const GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

/**
 * Extract text from image using Groq's Llama 4 Scout Vision model
 * @param {string} imageBase64 - Base64 encoded image data
 * @param {string} mimeType - MIME type of the image (e.g., 'image/jpeg')
 * @returns {Promise<{text: string, error: string|null}>}
 */
export const extractTextFromImage = async (imageBase64, mimeType = 'image/jpeg') => {
  try {
    console.log("Extracting text from image using Groq Llama 4 Scout Vision...");
    
    const response = await fetch(GROQ_API_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_VISION_MODEL,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract and transcribe ALL text from this medical report image. Include every word, number, date, and medical term exactly as shown. Preserve the document structure and formatting. Output only the extracted text, nothing else."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 4096,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Groq Vision API error (${response.status}):`, errorText);
      return { text: null, error: `OCR API error: ${response.status} - ${errorText}` };
    }

    const data = await response.json();
    console.log("OCR Response received");
    
    // Extract text from Groq response
    const extractedText = data.choices?.[0]?.message?.content || '';
    
    if (!extractedText.trim()) {
      return { text: null, error: "No text extracted from image" };
    }
    
    console.log("Text extracted successfully, length:", extractedText.length);
    return { text: extractedText, error: null };
  } catch (err) {
    console.error("OCR extraction failed:", err);
    return { text: null, error: err.message };
  }
};

/**
 * Clean and process OCR-extracted text using Groq
 * @param {string} rawText - Raw text extracted from OCR
 * @returns {Promise<{text: string, error: string|null}>}
 */
export const cleanOCRText = async (rawText) => {
  try {
    console.log("Cleaning OCR text with Groq...");
    
    const messages = [
      {
        role: "system",
        content: `You are a medical document processor. Your task is to clean and format OCR-extracted text from medical reports.

Rules:
1. Fix any OCR errors or misspellings
2. Preserve all medical terminology exactly
3. Maintain the document structure (sections, headers, values)
4. Keep all numbers, dates, and measurements accurate
5. Remove any artifacts or noise from OCR
6. Output clean, readable medical report text

Only output the cleaned text, no explanations.`
      },
      {
        role: "user",
        content: `Clean and format this OCR-extracted medical report text:\n\n${rawText}`
      }
    ];
    
    const { content, error } = await callGroqAPI(messages, 4096);
    
    if (error) {
      console.error("Text cleaning error:", error);
      return { text: rawText, error: null }; // Return raw text if cleaning fails
    }
    
    return { text: content, error: null };
  } catch (err) {
    console.error("Text cleaning exception:", err);
    return { text: rawText, error: null }; // Return raw text if cleaning fails
  }
};

/**
 * Full OCR pipeline: Extract text from image and clean it
 * @param {string} imageBase64 - Base64 encoded image
 * @param {string} mimeType - MIME type of the image
 * @returns {Promise<{text: string, error: string|null}>}
 */
export const processImageOCR = async (imageBase64, mimeType = 'image/jpeg') => {
  try {
    // Step 1: Extract text using Llama Vision
    const { text: rawText, error: ocrError } = await extractTextFromImage(imageBase64, mimeType);
    
    if (ocrError || !rawText) {
      return { text: null, error: ocrError || "Failed to extract text from image" };
    }
    
    // Step 2: Clean the extracted text using Groq
    const { text: cleanedText, error: cleanError } = await cleanOCRText(rawText);
    
    if (cleanError) {
      console.warn("Text cleaning warning:", cleanError);
    }
    
    return { text: cleanedText || rawText, error: null };
  } catch (err) {
    console.error("OCR pipeline error:", err);
    return { text: null, error: err.message };
  }
};

/**
 * Make a request to Groq API
 * @param {Array} messages - The chat messages
 * @param {number} maxTokens - Maximum tokens for completion
 * @returns {Promise<{content: string, error: string|null}>}
 */
const callGroqAPI = async (messages, maxTokens = 2048) => {
  try {
    const response = await fetch(GROQ_API_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: messages,
        temperature: 0.7,
        max_completion_tokens: maxTokens,
        top_p: 1,
        stream: false, // Non-streaming for simplicity in React Native
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Groq API error (${response.status}):`, errorText);
      return { content: null, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || null;
    return { content, error: null };
  } catch (err) {
    console.error("Groq API call failed:", err);
    return { content: null, error: err.message };
  }
};

/**
 * Summarize medical report text using Groq
 * @param {string} reportText - The full text of the medical report
 * @returns {Promise<{summary: string, error: string|null}>}
 */
export const summarizeReport = async (reportText) => {
  try {
    console.log("Summarizing report with Groq AI...");
    
    const messages = [
      {
        role: "system",
        content: "You are a medical report summarization assistant. Provide concise, accurate summaries of medical reports in 2-3 paragraphs. Focus on key findings, diagnoses, and important medical details. Use clear, professional language."
      },
      {
        role: "user",
        content: `Please summarize the following medical report:\n\n${reportText}`
      }
    ];
    
    const { content, error } = await callGroqAPI(messages, 1024);
    
    if (error) {
      console.error("Summarization error:", error);
      return { summary: null, error: error };
    }
    
    console.log("Summary generated successfully");
    return { summary: content, error: null };
  } catch (err) {
    console.error("Summarization exception:", err);
    return { summary: null, error: err.message };
  }
};

/**
 * Answer questions about the medical report using Groq
 * @param {string} reportText - The context (medical report text)
 * @param {string} question - The user's question
 * @returns {Promise<{answer: string, score: number, error: string|null}>}
 */
export const answerReportQuestion = async (reportText, question) => {
  try {
    console.log("Answering question with Groq AI...");
    
    const messages = [
      {
        role: "system",
        content: "You are a helpful medical assistant. Answer questions about medical reports accurately and clearly. If the answer is not found in the report, say so. Provide helpful context when appropriate, but don't make up information not present in the report."
      },
      {
        role: "user",
        content: `Based on the following medical report, please answer the question.\n\nMedical Report:\n${reportText}\n\nQuestion: ${question}`
      }
    ];
    
    const { content, error } = await callGroqAPI(messages, 1024);
    
    if (error) {
      console.error("QA error:", error);
      return { answer: null, score: 0, error: error };
    }
    
    console.log("Answer generated successfully");
    return { answer: content, score: 1.0, error: null };
  } catch (err) {
    console.error("QA exception:", err);
    return { answer: null, score: 0, error: err.message };
  }
};

/**
 * Classify the report type and content
 * @param {string} reportText - The medical report text
 * @returns {Promise<{classification: object, error: string|null}>}
 */
export const classifyReport = async (reportText) => {
  try {
    console.log("Classifying report...");
    
    // Use local keyword-based detection (fast and reliable)
    const reportType = detectReportType(reportText);
    const riskLevel = detectRiskLevel(reportText);
    
    console.log("Classification completed");
    return { 
      classification: {
        reportType,
        riskLevel,
      }, 
      error: null 
    };
  } catch (err) {
    console.error("Classification exception:", err);
    return { classification: null, error: err.message };
  }
};

/**
 * Extract medical entities from the report using Groq
 * @param {string} reportText - The medical report text
 * @returns {Promise<{entities: Array, error: string|null}>}
 */
export const extractEntities = async (reportText) => {
  try {
    console.log("Extracting entities with Groq AI...");
    
    const messages = [
      {
        role: "system",
        content: `You are a medical entity extraction assistant. Extract important medical entities from reports.
Return a JSON array of objects with this format:
[{"text": "entity text", "type": "TYPE", "category": "Category"}]

Types to extract:
- MEASUREMENT: sizes, dimensions (e.g., "2.5 cm")
- STAGING: cancer stages/grades (e.g., "Stage II", "Grade 3")
- BIOMARKER: medical markers (e.g., "HER2 positive", "ER+")
- DIAGNOSIS: conditions/diagnoses
- PROCEDURE: medical procedures performed
- MEDICATION: drugs mentioned
- ANATOMY: body parts/organs

Only return the JSON array, no other text.`
      },
      {
        role: "user",
        content: `Extract medical entities from this report:\n\n${reportText}`
      }
    ];
    
    const { content, error } = await callGroqAPI(messages, 1024);
    
    if (error) {
      console.error("Entity extraction error:", error);
      // Fall back to regex-based entity extraction
      const entities = processEntities([], reportText);
      return { entities, error: null };
    }
    
    // Parse the JSON response
    let aiEntities = [];
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        aiEntities = JSON.parse(jsonMatch[0]);
      }
    } catch (parseErr) {
      console.error("Failed to parse entity JSON:", parseErr);
    }
    
    // Combine with regex-based extraction for robustness
    const entities = processEntities(aiEntities, reportText);
    
    console.log("Entity extraction completed");
    return { entities, error: null };
  } catch (err) {
    console.error("Entity extraction exception:", err);
    // Fall back to regex-based extraction
    const entities = processEntities([], reportText);
    return { entities, error: null };
  }
};

/**
 * Perform full analysis of a medical report
 * @param {string} reportText - The full medical report text
 * @returns {Promise<object>} Complete analysis results
 */
export const analyzeFullReport = async (reportText) => {
  console.log("Starting full report analysis...");
  
  try {
    // Detect report type and risk level directly from text first
    const reportType = detectReportType(reportText);
    const riskLevel = detectRiskLevel(reportText);
    
    // Run all analyses in parallel for efficiency
    const [summaryResult, classificationResult, entitiesResult] = await Promise.all([
      summarizeReport(reportText),
      classifyReport(reportText),
      extractEntities(reportText)
    ]);
    
    // Build comprehensive analysis result
    const analysis = {
      report_type: reportType,
      risk_level: riskLevel,
      
      summary: summaryResult.summary || generateFallbackSummary(reportText),
      
      key_findings: extractKeyFindings(reportText, entitiesResult.entities),
      
      entities: entitiesResult.entities || [],
      
      // Generate patient-friendly explanation
      patient_explanation: generatePatientExplanation(reportText, reportType, riskLevel, entitiesResult.entities),
      
      recommendations: generateRecommendations(riskLevel, reportText),
      
      errors: {
        summarization: summaryResult.error,
        classification: classificationResult.error,
        ner: entitiesResult.error
      }
    };
    
    console.log("Full analysis completed");
    return analysis;
  } catch (err) {
    console.error("Full analysis error:", err);
    const riskLevel = detectRiskLevel(reportText);
    return {
      report_type: detectReportType(reportText),
      risk_level: riskLevel,
      key_findings: "Analysis could not be completed. Please try again.",
      summary: "Error occurred during analysis.",
      patient_explanation: "We had trouble analyzing your report. Please share this report with your doctor who can explain it to you in person.",
      recommendations: "Please consult with your healthcare provider.",
      error: err.message
    };
  }
};

// Helper functions

/**
 * Detect report type from text content
 * Priority order: More specific types first, generic pathology last
 */
function detectReportType(text) {
  const lowerText = text.toLowerCase();
  
  // Define report types in priority order (more specific first)
  const reportTypeChecks = [
    // Imaging reports - check first as they're very specific
    { type: "MRI Report", keywords: ["mri", "magnetic resonance", "t1-weighted", "t2-weighted", "t1 weighted", "t2 weighted"] },
    { type: "CT Scan Report", keywords: ["ct scan", "computed tomography", "ct findings", "ct report", "cat scan"] },
    { type: "PET Scan Report", keywords: ["pet scan", "pet-ct", "pet ct", "fdg uptake", "fdg-pet", "positron emission"] },
    { type: "Mammography Report", keywords: ["mammogram", "mammography", "breast imaging", "bi-rads", "birads"] },
    { type: "X-Ray Report", keywords: ["x-ray", "xray", "radiograph", "chest x-ray", "chest xray", "radiographic"] },
    { type: "Ultrasound Report", keywords: ["ultrasound", "sonography", "sonogram", "doppler", "echography", "usg"] },
    
    // Lab tests - specific markers
    { type: "Genetic Testing Report", keywords: ["genetic test", "brca1", "brca2", "mutation analysis", "genomic", "gene panel", "dna analysis", "sequencing"] },
    { type: "Tumor Marker Report", keywords: ["tumor marker", "ca-125", "ca 125", "cea level", "psa level", "afp level", "ca19-9", "ca 19-9"] },
    
    // Blood tests - common terms
    { type: "Blood Test Report", keywords: ["blood test", "blood work", "cbc", "complete blood count", "hemoglobin", "hematology", "serum", "blood panel", "wbc count", "rbc count", "platelet count", "blood chemistry"] },
    
    // Pathology/Biopsy - check last as many reports mention "specimen"
    { type: "Pathology/Biopsy Report", keywords: ["biopsy report", "pathology report", "histopathology", "histology report", "surgical pathology", "cytology", "tissue examination", "microscopic examination", "adenocarcinoma", "carcinoma", "malignant", "benign lesion"] }
  ];
  
  // Check each report type in priority order
  for (const check of reportTypeChecks) {
    if (check.keywords.some(keyword => lowerText.includes(keyword))) {
      return check.type;
    }
  }
  
  // Default fallback
  return "Medical Report";
}

/**
 * Detect risk level from report content
 */
function detectRiskLevel(text) {
  const lowerText = text.toLowerCase();
  
  const highRiskTerms = [
    "malignant", "metastasis", "stage iv", "stage 4", "advanced", 
    "aggressive", "invasive carcinoma", "poorly differentiated",
    "high grade", "grade 3", "grade iii"
  ];
  
  const mediumRiskTerms = [
    "suspicious", "atypical", "stage ii", "stage 2", "stage iii", "stage 3",
    "moderate", "intermediate", "grade 2", "grade ii"
  ];
  
  const lowRiskTerms = [
    "benign", "negative", "normal", "no evidence", "stage i", "stage 1",
    "low grade", "grade 1", "grade i", "well differentiated"
  ];
  
  // Check for high risk first
  if (highRiskTerms.some(term => lowerText.includes(term))) {
    return "High Risk";
  }
  
  // Check for medium risk
  if (mediumRiskTerms.some(term => lowerText.includes(term))) {
    return "Medium Risk";
  }
  
  // Check for low risk indicators
  if (lowRiskTerms.some(term => lowerText.includes(term))) {
    return "Low Risk";
  }
  
  return "Requires Review";
}

/**
 * Process NER entities and add medical context
 */
function processEntities(rawEntities, reportText) {
  if (!Array.isArray(rawEntities)) {
    rawEntities = rawEntities ? [rawEntities] : [];
  }
  
  // Also extract medical-specific entities using regex
  const medicalEntities = [];
  
  // Extract measurements (tumor sizes, etc.)
  const measurementPattern = /(\d+\.?\d*)\s*(mm|cm|centimeter|millimeter)/gi;
  let match;
  while ((match = measurementPattern.exec(reportText)) !== null) {
    medicalEntities.push({
      text: match[0],
      type: "MEASUREMENT",
      category: "Size/Dimension"
    });
  }
  
  // Extract staging information
  const stagingPattern = /(stage|grade)\s*(i{1,3}v?|[1-4]|[a-c])/gi;
  while ((match = stagingPattern.exec(reportText)) !== null) {
    medicalEntities.push({
      text: match[0],
      type: "STAGING",
      category: "Cancer Stage/Grade"
    });
  }
  
  // Extract biomarkers
  const biomarkers = ["HER2", "ER", "PR", "Ki-67", "PD-L1", "BRCA1", "BRCA2", "EGFR", "ALK"];
  biomarkers.forEach(marker => {
    const regex = new RegExp(`${marker}[\\s:]*([\\w+-]+)?`, "gi");
    while ((match = regex.exec(reportText)) !== null) {
      medicalEntities.push({
        text: match[0],
        type: "BIOMARKER",
        category: "Biomarker"
      });
    }
  });
  
  // Combine with NER results
  const processedEntities = rawEntities.map(entity => ({
    text: entity.word || entity.text || entity,
    type: entity.entity || entity.label || "ENTITY",
    score: entity.score || 1.0
  }));
  
  return [...processedEntities, ...medicalEntities];
}

/**
 * Extract key findings from text and entities
 */
function extractKeyFindings(reportText, entities) {
  const findings = [];
  
  // Look for impression/conclusion sections
  const impressionMatch = reportText.match(/(?:impression|conclusion|findings|diagnosis)[:\s]*([\s\S]*?)(?:\n\n|$)/i);
  if (impressionMatch) {
    findings.push(impressionMatch[1].trim().substring(0, 200));
  }
  
  // Add entity-based findings
  const importantEntities = entities
    .filter(e => ["STAGING", "BIOMARKER", "MEASUREMENT"].includes(e.type))
    .slice(0, 5)
    .map(e => e.text);
  
  if (importantEntities.length > 0) {
    findings.push(`Key markers identified: ${importantEntities.join(", ")}`);
  }
  
  // If no findings extracted, provide generic summary
  if (findings.length === 0) {
    const preview = reportText.substring(0, 300).trim();
    findings.push(preview + (reportText.length > 300 ? "..." : ""));
  }
  
  return findings.join("\n\n");
}

/**
 * Generate recommendations based on analysis
 */
function generateRecommendations(riskLevel, reportText) {
  const baseRecommendations = [
    "Discuss these results with your healthcare provider.",
    "Keep a copy of this report for your medical records."
  ];
  
  switch (riskLevel) {
    case "High Risk":
      return [
        "⚠️ URGENT: Schedule an appointment with your oncologist immediately.",
        "Consider seeking a second opinion from a specialized cancer center.",
        "Discuss treatment options and timeline with your care team.",
        ...baseRecommendations
      ].join("\n");
      
    case "Medium Risk":
      return [
        "Schedule a follow-up appointment with your doctor within 1-2 weeks.",
        "Additional diagnostic tests may be recommended.",
        "Monitor for any new symptoms and report them promptly.",
        ...baseRecommendations
      ].join("\n");
      
    case "Low Risk":
      return [
        "Continue with routine screening as recommended by your doctor.",
        "Maintain a healthy lifestyle with regular exercise and balanced diet.",
        "Schedule your next routine check-up as advised.",
        ...baseRecommendations
      ].join("\n");
      
    default:
      return [
        "Schedule a follow-up appointment to discuss these results.",
        "Your healthcare provider can explain the findings in detail.",
        ...baseRecommendations
      ].join("\n");
  }
}

/**
 * Generate fallback summary if AI summarization fails
 */
function generateFallbackSummary(reportText) {
  const sentences = reportText.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const keyPhrases = sentences.slice(0, 3).join(". ");
  return keyPhrases.length > 0 
    ? keyPhrases + "." 
    : "Report content processed. Please review the key findings above.";
}

/**
 * Generate patient-friendly explanation in simple English
 */
function generatePatientExplanation(reportText, reportType, riskLevel, entities) {
  const lowerText = reportText.toLowerCase();
  let explanation = [];
  
  // Start with what type of test this is
  explanation.push(`📋 What is this report?\nThis is a ${reportType.toLowerCase()}. It's a medical test that doctors use to understand what's happening in your body.`);
  
  // Explain the main finding based on content
  if (lowerText.includes("carcinoma") || lowerText.includes("cancer") || lowerText.includes("malignant")) {
    explanation.push(`\n\n🔬 What did they find?\nThe test found cancer cells. This means some cells in your body are growing in a way they shouldn't. The good news is that finding it means doctors can now make a plan to treat it.`);
    
    // Explain the type if mentioned
    if (lowerText.includes("invasive ductal carcinoma")) {
      explanation.push(`\n\nThe specific type found is called "invasive ductal carcinoma" - this is the most common type of breast cancer. "Invasive" means the cancer cells have started to spread from where they first appeared.`);
    } else if (lowerText.includes("invasive")) {
      explanation.push(`\n\nThe word "invasive" in your report means the abnormal cells have spread beyond where they first started. Your doctor will explain what this means for your treatment.`);
    }
  } else if (lowerText.includes("benign")) {
    explanation.push(`\n\n🔬 What did they find?\nGood news! The test found that the growth is "benign" - this means it is NOT cancer. Benign growths are usually not dangerous, but your doctor may still want to monitor it.`);
  } else if (lowerText.includes("negative") || lowerText.includes("normal") || lowerText.includes("no evidence")) {
    explanation.push(`\n\n🔬 What did they find?\nGood news! The test results appear normal or negative, which usually means no major problems were found. Your doctor will confirm this with you.`);
  } else if (lowerText.includes("suspicious") || lowerText.includes("atypical")) {
    explanation.push(`\n\n🔬 What did they find?\nThe test found some cells that look unusual. This doesn't definitely mean cancer, but your doctor will likely want to do more tests to be sure. Try not to worry - many suspicious findings turn out to be harmless.`);
  }
  
  // Explain staging if present
  const stageMatch = lowerText.match(/stage\s*(i{1,3}v?a?b?|[1-4][a-c]?)/i);
  if (stageMatch) {
    const stage = stageMatch[1].toUpperCase();
    explanation.push(`\n\n📊 What does the stage mean?\nYour report mentions "Stage ${stage}".`);
    
    if (stage.includes("I") && !stage.includes("II") && !stage.includes("IV")) {
      explanation.push(` This is an early stage, which is good news! Early stage usually means the cancer is small and hasn't spread far, making it easier to treat.`);
    } else if (stage.includes("II")) {
      explanation.push(` This is an intermediate stage. The cancer may be a bit larger or may have started to spread to nearby areas, but there are still many good treatment options.`);
    } else if (stage.includes("III")) {
      explanation.push(` This is a more advanced stage, meaning the cancer has grown larger or spread to nearby lymph nodes. Treatment is still possible, and your medical team will create a plan for you.`);
    } else if (stage.includes("IV") || stage.includes("4")) {
      explanation.push(` This is an advanced stage, meaning the cancer has spread to other parts of the body. While this is serious, there are still treatments available that can help manage the disease and maintain quality of life.`);
    }
  }
  
  // Explain grade if present
  const gradeMatch = lowerText.match(/grade\s*([1-3]|i{1,3})/i);
  if (gradeMatch) {
    const grade = gradeMatch[1];
    explanation.push(`\n\n📈 What does the grade mean?\nThe "grade" tells doctors how different the cancer cells look compared to normal cells.`);
    
    if (grade === "1" || grade.toLowerCase() === "i") {
      explanation.push(` Grade 1 (low grade) means the cells look almost normal and usually grow slowly. This is generally favorable.`);
    } else if (grade === "2" || grade.toLowerCase() === "ii") {
      explanation.push(` Grade 2 (moderate/intermediate) means the cells look somewhat different from normal and grow at a moderate pace.`);
    } else if (grade === "3" || grade.toLowerCase() === "iii") {
      explanation.push(` Grade 3 (high grade) means the cells look very different from normal cells. These may grow faster, but modern treatments can still be very effective.`);
    }
  }
  
  // Explain biomarkers in simple terms
  if (lowerText.includes("er positive") || lowerText.includes("er:") || lowerText.includes("estrogen receptor")) {
    explanation.push(`\n\n💊 About hormone receptors:\nYour report mentions "ER" (Estrogen Receptor). When it's "positive," it means the cancer cells respond to the hormone estrogen. This is actually helpful because there are medications that can block estrogen and slow down the cancer.`);
  }
  
  if (lowerText.includes("her2")) {
    if (lowerText.includes("her2 negative") || lowerText.includes("her2: negative") || lowerText.includes("her2: 1+") || lowerText.includes("her2: 0")) {
      explanation.push(`\n\nThe report shows "HER2 negative." HER2 is a protein that can make cancer grow faster. Being negative means this protein is not fueling the cancer, which can be a good thing for treatment planning.`);
    } else if (lowerText.includes("her2 positive") || lowerText.includes("her2: 3+") || lowerText.includes("her2: positive")) {
      explanation.push(`\n\nThe report shows "HER2 positive." HER2 is a protein that can make cancer grow faster. There are specific targeted drugs that work very well against HER2-positive cancers.`);
    }
  }
  
  // Add risk level explanation
  explanation.push(`\n\n⚠️ Overall Assessment:`);
  switch (riskLevel) {
    case "High Risk":
      explanation.push(` Based on the findings, this report indicates a situation that needs prompt medical attention. Please don't panic - "high risk" means your doctors will prioritize your care and develop a treatment plan quickly. Many people with similar findings respond well to treatment.`);
      break;
    case "Medium Risk":
      explanation.push(` The findings suggest some concerns that your doctor will want to discuss with you. You may need additional tests or monitoring. This is a common situation, and your healthcare team will guide you through the next steps.`);
      break;
    case "Low Risk":
      explanation.push(` The findings suggest lower concern. This is reassuring, but your doctor will still want to discuss the results and may recommend routine follow-up to make sure everything stays healthy.`);
      break;
    default:
      explanation.push(` Your doctor will review these results with you and explain what they mean for your specific situation. Every person is different, and your medical team knows your health history best.`);
  }
  
  // Closing reassurance
  explanation.push(`\n\n💙 Remember:\nThis explanation is meant to help you understand your report better, but it's not a substitute for talking to your doctor. Write down any questions you have and bring them to your next appointment. You're not alone in this - your healthcare team is there to support you.`);
  
  return explanation.join("");
}

export default {
  summarizeReport,
  answerReportQuestion,
  classifyReport,
  extractEntities,
  analyzeFullReport
};
