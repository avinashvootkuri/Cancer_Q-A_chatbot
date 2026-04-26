import os 
from dotenv import load_dotenv
import traceback

load_dotenv()

import uuid
import json
import re
from datetime import datetime

from flask import Flask, request, jsonify
from flask_cors import CORS

from rag import rag

import db

app = Flask(__name__)
CORS(app)  # Enable CORS for mobile app

# In-memory conversation storage (fallback when DB is disabled)
in_memory_conversations = []

CANCER_KEYWORDS = [
    'cancer', 'tumor', 'tumour', 'oncology', 'chemotherapy', 'radiation', 'malignant', 'benign',
    'carcinoma', 'lymphoma', 'leukemia', 'melanoma', 'sarcoma', 'metastasis', 'biopsy',
    'mammogram', 'colonoscopy', 'remission', 'stage', 'grade', 'prognosis', 'survival',
    'treatment', 'symptom', 'diagnosis', 'screening', 'prevention', 'risk', 'genetic',
    'breast', 'lung', 'colon', 'prostate', 'skin', 'ovarian', 'cervical', 'pancreatic',
    'liver', 'kidney', 'bladder', 'brain', 'thyroid', 'blood', 'bone', 'stomach'
]
CANCER_KEYWORD_RE = re.compile("|".join(re.escape(k) for k in CANCER_KEYWORDS), re.I)


@app.route("/")
def home():
    return r"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Cancer Q&A Chatbot</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                background: linear-gradient(to bottom, #0f0f0f, #1a1a1a);
                height: 100vh;
                display: flex;
                flex-direction: column;
                color: #ffffff;
            }
            
            .header {
                background: rgba(0, 0, 0, 0.4);
                padding: 20px 30px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(10px);
            }
            
            .header h1 {
                font-size: 24px;
                font-weight: 600;
                color: #ffffff;
            }
            
            .header p {
                font-size: 14px;
                color: #888;
                margin-top: 5px;
            }
            
            .chat-container {
                flex: 1;
                overflow-y: auto;
                padding: 30px;
                display: flex;
                flex-direction: column;
                gap: 20px;
            }
            
            .message {
                display: flex;
                align-items: flex-start;
                gap: 15px;
                max-width: 80%;
                animation: slideIn 0.3s ease;
            }
            
            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            .message.user {
                align-self: flex-end;
                flex-direction: row-reverse;
            }
            
            .avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                flex-shrink: 0;
            }
            
            .avatar.bot {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            
            .avatar.user {
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            }
            
            .message-content {
                background: rgba(50, 50, 60, 0.7);
                padding: 16px 20px;
                border-radius: 18px;
                line-height: 1.6;
                font-size: 15px;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.05);
            }
            
            .message.user .message-content {
                background: rgba(230, 230, 240, 0.95);
                color: #1a1a1a;
            }
            
            /* Formatted text styles */
            .message-content strong,
            .message-content b {
                font-weight: 700;
                color: #ffffff;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }
            
            .message.user .message-content strong,
            .message.user .message-content b {
                color: #1a1a1a;
                background: linear-gradient(135deg, #f5576c 0%, #f093fb 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }
            
            .message-content em,
            .message-content i {
                font-style: italic;
                color: #aaaaff;
            }
            
            .message.user .message-content em,
            .message.user .message-content i {
                color: #555;
            }
            
            .message-content ul,
            .message-content ol {
                margin: 10px 0;
                padding-left: 20px;
            }
            
            .message-content li {
                margin: 6px 0;
                line-height: 1.5;
            }
            
            .message-content li::marker {
                color: #667eea;
            }
            
            .message.user .message-content li::marker {
                color: #f5576c;
            }
            
            .message-content h1,
            .message-content h2,
            .message-content h3 {
                margin: 12px 0 8px 0;
                font-weight: 600;
                color: #ffffff;
            }
            
            .message-content h1 { font-size: 20px; }
            .message-content h2 { font-size: 18px; }
            .message-content h3 { font-size: 16px; }
            
            .message-content code {
                background: rgba(20, 20, 30, 0.8);
                padding: 2px 6px;
                border-radius: 4px;
                font-family: 'Courier New', monospace;
                font-size: 14px;
                color: #ffa07a;
            }
            
            .message.user .message-content code {
                background: rgba(200, 200, 210, 0.5);
                color: #d63384;
            }
            
            .message-content pre {
                background: rgba(20, 20, 30, 0.9);
                padding: 12px;
                border-radius: 8px;
                overflow-x: auto;
                margin: 10px 0;
            }
            
            .message-content pre code {
                background: none;
                padding: 0;
            }
            
            .message-content p {
                margin: 8px 0;
            }
            
            .message-content p:first-child {
                margin-top: 0;
            }
            
            .message-content p:last-child {
                margin-bottom: 0;
            }
            
            .message-content blockquote {
                border-left: 3px solid #667eea;
                padding-left: 12px;
                margin: 10px 0;
                color: #aaa;
                font-style: italic;
            }
            
            .message.user .message-content blockquote {
                border-left-color: #f5576c;
                color: #666;
            }
            
            .input-container {
                padding: 20px 30px;
                background: rgba(0, 0, 0, 0.4);
                border-top: 1px solid rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(10px);
            }
            
            .input-wrapper {
                display: flex;
                gap: 15px;
                max-width: 1200px;
                margin: 0 auto;
                align-items: center;
            }
            
            #messageInput {
                flex: 1;
                background: rgba(40, 40, 50, 0.8);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 24px;
                padding: 14px 20px;
                color: #ffffff;
                font-size: 15px;
                outline: none;
                transition: all 0.3s ease;
            }
            
            #messageInput:focus {
                border-color: rgba(102, 126, 234, 0.5);
                background: rgba(40, 40, 50, 1);
            }
            
            #messageInput::placeholder {
                color: #666;
            }
            
            #sendButton {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 24px;
                padding: 14px 32px;
                font-size: 15px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
            }
            
            #sendButton:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
            }
            
            #sendButton:active {
                transform: translateY(0);
            }
            
            #sendButton:disabled {
                opacity: 0.5;
                cursor: not-allowed;
                transform: none;
            }
            
            .typing-indicator {
                display: flex;
                gap: 6px;
                padding: 16px 20px;
            }
            
            .typing-indicator span {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #667eea;
                animation: typing 1.4s infinite;
            }
            
            .typing-indicator span:nth-child(2) {
                animation-delay: 0.2s;
            }
            
            .typing-indicator span:nth-child(3) {
                animation-delay: 0.4s;
            }
            
            @keyframes typing {
                0%, 60%, 100% {
                    opacity: 0.3;
                    transform: scale(0.8);
                }
                30% {
                    opacity: 1;
                    transform: scale(1);
                }
            }
            
            .welcome-message {
                text-align: center;
                padding: 40px 20px;
                color: #888;
            }
            
            .welcome-message h2 {
                font-size: 28px;
                margin-bottom: 10px;
                color: #fff;
            }
            
            .welcome-message p {
                font-size: 16px;
            }
            
            .sources-container {
                margin-top: 12px;
                padding-top: 12px;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .sources-title {
                font-size: 12px;
                color: #888;
                margin-bottom: 8px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            .source-item {
                background: rgba(30, 30, 40, 0.6);
                padding: 10px 12px;
                border-radius: 8px;
                margin-bottom: 8px;
                border-left: 3px solid #667eea;
                transition: all 0.2s ease;
            }
            
            .source-item:hover {
                background: rgba(30, 30, 40, 0.8);
                transform: translateX(3px);
            }
            
            .source-item:last-child {
                margin-bottom: 0;
            }
            
            .source-title {
                font-size: 13px;
                color: #667eea;
                font-weight: 600;
                margin-bottom: 4px;
                display: block;
                text-decoration: none;
            }
            
            .source-title:hover {
                color: #764ba2;
            }
            
            .source-snippet {
                font-size: 12px;
                color: #aaa;
                line-height: 1.4;
                margin-bottom: 4px;
            }
            
            .source-link {
                font-size: 11px;
                color: #666;
                text-decoration: none;
                word-break: break-all;
            }
            
            .message.user .sources-container {
                border-top-color: rgba(0, 0, 0, 0.1);
            }
            
            .message.user .source-item {
                background: rgba(200, 200, 210, 0.3);
                border-left-color: #f5576c;
            }
            
            .message.user .source-title {
                color: #f5576c;
            }
            
            .message.user .source-link {
                color: #555;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🏥 Cancer Q&A Chatbot</h1>
            <p>AI-powered assistant for cancer-related questions</p>
        </div>
        
        <div class="chat-container" id="chatContainer">
            <div class="welcome-message">
                <h2>Welcome!</h2>
                <p>Ask me any cancer-related question and I'll help you find answers.</p>
            </div>
        </div>
        
        <div class="input-container">
            <div class="input-wrapper">
                <input 
                    type="text" 
                    id="messageInput" 
                    placeholder="Ask a question about cancer..."
                    autocomplete="off"
                />
                <button id="sendButton">Send</button>
            </div>
        </div>
        
        <script>
            const chatContainer = document.getElementById('chatContainer');
            const messageInput = document.getElementById('messageInput');
            const sendButton = document.getElementById('sendButton');
            let conversationId = null;
            let conversationHistory = []; // Track conversation for context
            
            function parseMarkdown(text) {
                // Remove URLs from text (they'll be in sources)
                text = text.replace(/https?:\/\/[^\s]+/g, '');
                
                // Convert markdown to HTML
                let html = text;
                
                // Headers
                html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
                html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
                html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
                
                // Bold (both ** and __)
                html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
                
                // Italic (both * and _)
                html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
                html = html.replace(/_(.*?)_/g, '<em>$1</em>');
                
                // Inline code
                html = html.replace(/`(.*?)`/g, '<code>$1</code>');
                
                // Line breaks
                html = html.replace(/\n\n/g, '</p><p>');
                html = html.replace(/\n/g, '<br>');
                
                // Numbered lists
                html = html.replace(/^(\d+\.\s+.+)$/gim, function(match) {
                    return '<li>' + match.replace(/^\d+\.\s+/, '') + '</li>';
                });
                html = html.replace(/(<li>.*<\/li>)/s, '<ol>$1</ol>');
                
                // Bullet lists
                html = html.replace(/^[•\-\*]\s+(.+)$/gim, '<li>$1</li>');
                html = html.replace(/(<li>(?!.*<ol>).*<\/li>)/s, '<ul>$1</ul>');
                
                // Wrap in paragraphs if not already wrapped
                if (!html.startsWith('<h') && !html.startsWith('<ul>') && !html.startsWith('<ol>')) {
                    html = '<p>' + html + '</p>';
                }
                
                return html;
            }
            
            function addMessage(text, isUser, sources = []) {
                const messageDiv = document.createElement('div');
                messageDiv.className = `message ${isUser ? 'user' : 'bot'}`;
                
                const avatar = document.createElement('div');
                avatar.className = `avatar ${isUser ? 'user' : 'bot'}`;
                avatar.textContent = isUser ? '👤' : '🤖';
                
                const content = document.createElement('div');
                content.className = 'message-content';
                
                // For bot messages, parse markdown; for user messages, keep plain text
                if (!isUser) {
                    content.innerHTML = parseMarkdown(text);
                } else {
                    content.textContent = text;
                }
                
                // Add sources if available
                if (!isUser && sources && sources.length > 0) {
                    const sourcesContainer = document.createElement('div');
                    sourcesContainer.className = 'sources-container';
                    
                    const sourcesTitle = document.createElement('div');
                    sourcesTitle.className = 'sources-title';
                    sourcesTitle.textContent = '📚 Sources';
                    sourcesContainer.appendChild(sourcesTitle);
                    
                    sources.forEach((source, index) => {
                        const sourceItem = document.createElement('div');
                        sourceItem.className = 'source-item';
                        
                        const sourceTitle = document.createElement('a');
                        sourceTitle.className = 'source-title';
                        sourceTitle.href = source.link;
                        sourceTitle.target = '_blank';
                        sourceTitle.textContent = `${index + 1}. ${source.title}`;
                        
                        const sourceSnippet = document.createElement('div');
                        sourceSnippet.className = 'source-snippet';
                        sourceSnippet.textContent = source.snippet;
                        
                        const sourceLink = document.createElement('a');
                        sourceLink.className = 'source-link';
                        sourceLink.href = source.link;
                        sourceLink.target = '_blank';
                        sourceLink.textContent = source.link;
                        
                        sourceItem.appendChild(sourceTitle);
                        sourceItem.appendChild(sourceSnippet);
                        sourceItem.appendChild(sourceLink);
                        sourcesContainer.appendChild(sourceItem);
                    });
                    
                    content.appendChild(sourcesContainer);
                }
                
                messageDiv.appendChild(avatar);
                messageDiv.appendChild(content);
                chatContainer.appendChild(messageDiv);
                chatContainer.scrollTop = chatContainer.scrollHeight;
                
                return messageDiv;
            }
            
            function addTypingIndicator() {
                const messageDiv = document.createElement('div');
                messageDiv.className = 'message bot';
                messageDiv.id = 'typing-indicator';
                
                const avatar = document.createElement('div');
                avatar.className = 'avatar bot';
                avatar.textContent = '🤖';
                
                const content = document.createElement('div');
                content.className = 'message-content';
                content.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
                
                messageDiv.appendChild(avatar);
                messageDiv.appendChild(content);
                chatContainer.appendChild(messageDiv);
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
            
            function removeTypingIndicator() {
                const indicator = document.getElementById('typing-indicator');
                if (indicator) {
                    indicator.remove();
                }
            }
            
            async function sendMessage() {
                const question = messageInput.value.trim();
                if (!question) return;
                
                // Remove welcome message if it exists
                const welcomeMsg = chatContainer.querySelector('.welcome-message');
                if (welcomeMsg) welcomeMsg.remove();
                
                // Add user message
                addMessage(question, true);
                messageInput.value = '';
                sendButton.disabled = true;
                
                // Add typing indicator
                addTypingIndicator();
                
                try {
                    const response = await fetch('/question', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({
                            question: question,
                            conversation_history: conversationHistory
                        })
                    });
                    
                    const data = await response.json();
                    removeTypingIndicator();
                    
                    if (data.error) {
                        addMessage('Sorry, I encountered an error. Please try again.', false);
                    } else {
                        addMessage(data.answer, false, data.sources || []);
                        conversationId = data.conversation_id;
                        
                        // Update conversation history
                        conversationHistory.push({role: 'user', content: question});
                        conversationHistory.push({role: 'assistant', content: data.answer});
                        
                        // Keep only last 10 messages (5 Q&A pairs) to avoid token limits
                        if (conversationHistory.length > 10) {
                            conversationHistory = conversationHistory.slice(-10);
                        }
                    }
                } catch (error) {
                    removeTypingIndicator();
                    addMessage('Sorry, I encountered an error. Please try again.', false);
                    console.error('Error:', error);
                } finally {
                    sendButton.disabled = false;
                    messageInput.focus();
                }
            }
            
            sendButton.addEventListener('click', sendMessage);
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });
            
            // Focus input on load
            messageInput.focus();
        </script>
    </body>
    </html>
    """


@app.route("/question", methods=["POST"])
def handle_question():
    data = request.json
    question = data["question"]
    turn_history = data.get("conversation_history", [])

    if not question:
        return jsonify({"error": "No question provided"}), 400

    conversation_id = data.get("conversation_id") or str(uuid.uuid4())
    
    # Check for greetings
    greetings = ['hi', 'hello', 'hey', 'hii', 'hiii', 'good morning', 'good afternoon', 'good evening', 'greetings']
    if question.strip().lower() in greetings:
        result = {
            "conversation_id": conversation_id,
            "question": question,
            "answer": "Hello! 👋 I'm a Cancer Q&A assistant. Ask me anything about cancer types, prevention, diagnosis, or treatment.",
            "sources": []
        }
        return jsonify(result)
    
    # Check if question is cancer-related
    is_cancer_related = bool(CANCER_KEYWORD_RE.search(question))
    
    # If question doesn't have cancer keywords, check conversation history
    # This allows follow-up questions like "tell me more about that" to work
    if not is_cancer_related and turn_history:
        # Check if previous conversation was about cancer
        history_text = ' '.join([msg.get('content', '') for msg in turn_history[-6:]])
        is_cancer_related = bool(CANCER_KEYWORD_RE.search(history_text))
    
    if not is_cancer_related:
        result = {
            "conversation_id": conversation_id,
            "question": question,
            "answer": "🩺 I'm specifically designed to answer questions about **cancer** only. Please ask me about cancer types, symptoms, diagnosis, treatment, prevention, or related topics. I'm here to help with your cancer-related questions!",
            "sources": []
        }
        return jsonify(result)

    try:
        answer_data = rag(question, conversation_history=turn_history)
    except Exception as e:
        app.logger.error(f"Error processing question: {type(e).__name__}: {e}")
        app.logger.error(traceback.format_exc())
        return jsonify({"error": "Internal server error"}), 500
    

    result = {
        "conversation_id": conversation_id,
        "question": question,
        "answer": answer_data["answer"],
        "sources": answer_data.get("sources", [])
    }

    # Save to database if enabled
    db.save_conversation(
        conversation_id=conversation_id,
        question=question,
        answer_data=answer_data,
    )
    
    # Also save to in-memory storage for history (fallback)
    in_memory_conversations.append({
        "id": conversation_id,
        "question": question,
        "answer": answer_data["answer"],
        "model_used": answer_data.get("model_used", "gpt-oss"),
        "relevance": answer_data.get("relevance", "UNKNOWN"),
        "timestamp": datetime.now().isoformat(),
        "sources": answer_data.get("sources", [])
    })
    
    # Keep only last 100 conversations in memory
    if len(in_memory_conversations) > 100:
        in_memory_conversations.pop(0)

    return jsonify(result)


@app.route("/feedback", methods=["POST"])
def handle_feedback():
    data = request.json
    conversation_id = data["conversation_id"]
    feedback = data["feedback"]

    if not conversation_id or feedback not in [1, -1]:
        return jsonify({"error": "Invalid input"}), 400

    db.save_feedback(
        conversation_id=conversation_id,
        feedback=feedback,
    )

    result = {
        "message": f"Feedback received for conversation {conversation_id}: {feedback}"
    }
    return jsonify(result)


@app.route("/history", methods=["GET"])
def get_history():
    """Get conversation history"""
    try:
        limit = request.args.get('limit', 50, type=int)
        
        # Try to get from database first
        conversations = db.get_recent_conversations(limit)
        
        # If database is empty or disabled, use in-memory storage
        if not conversations:
            # Return in-memory history (reversed to show newest first)
            conversations = list(reversed(in_memory_conversations[-limit:]))
        
        return jsonify({"conversations": conversations})
    except Exception as e:
        app.logger.error(f"Error fetching history: {e}")
        # Fallback to in-memory storage
        limit = request.args.get('limit', 50, type=int)
        conversations = list(reversed(in_memory_conversations[-limit:]))
        return jsonify({"conversations": conversations})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    debug = os.environ.get("FLASK_ENV") == "development"
    host = "0.0.0.0" if not debug else "127.0.0.1"
    app.run(debug=debug, host=host, port=port)