# Pronoun Resolution Fix - Conversation History

## Problem
The chatbot was forgetting context in the third question of a conversation sequence:
1. "Tell me about lung cancer stages" ✅ (worked)
2. "Which stage is most dangerous?" ✅ (worked - remembered lung cancer)
3. "Can you explain more about that one?" ❌ (failed - forgot which stage)

## Root Cause
The conversation history was not being properly maintained and sent between the frontend and backend:
- Frontend JavaScript wasn't tracking conversation history
- Frontend wasn't sending history with requests
- Backend build_prompt function needed better context formatting

## Changes Made

### 1. Backend: `Cancer_chatbot/rag.py`
**Updated `build_prompt()` function:**
```python
# Before: Only kept last 6 messages without proper formatting
# After: 
- Takes last 4 messages (2 Q&A pairs) to keep token usage manageable
- Distinguishes between user and assistant messages
- Truncates long answers in history (>200 chars) to save tokens
- Adds clear instruction: "Now answer the current question using this context"
```

**Key improvements:**
- More specific formatting of conversation history
- Better token management (truncating historical answers)
- Clearer instructions to the LLM about using context

### 2. Frontend: `Cancer_chatbot/app.py`
**Added conversation tracking:**
```javascript
// Track conversation history in memory
let conversationHistory = [];
```

**Updated `sendMessage()` function to:**
1. Send conversation history with each request:
```javascript
body: JSON.stringify({
    question: question,
    conversation_history: conversationHistory
})
```

2. Update history after each response:
```javascript
conversationHistory.push({role: 'user', content: question});
conversationHistory.push({role: 'assistant', content: data.answer});

// Keep only last 10 messages (5 Q&A pairs)
if (conversationHistory.length > 10) {
    conversationHistory = conversationHistory.slice(-10);
}
```

### 3. Mobile App: Already Fixed
The mobile app (`mobile/App.js` and `mobile/api.js`) already had proper conversation history implementation.

## How It Works Now

### Example Flow:
1. **User asks:** "Tell me about lung cancer stages"
   - Conversation history: []
   - Answer includes info about Stage 1-4

2. **User asks:** "Which stage is most dangerous?"
   - Conversation history: [
       {role: 'user', content: 'Tell me about lung cancer stages'},
       {role: 'assistant', content: 'Stage 1 is... Stage 4 is...'}
     ]
   - LLM sees previous context and knows to talk about Stage 4 of lung cancer

3. **User asks:** "Can you explain more about that one?"
   - Conversation history: [
       {role: 'user', content: 'Tell me about lung cancer stages'},
       {role: 'assistant', content: 'Stage 1 is...'},
       {role: 'user', content: 'Which stage is most dangerous?'},
       {role: 'assistant', content: 'Stage 4 of lung cancer...'}
     ]
   - LLM now knows "that one" refers to Stage 4 of lung cancer

## Testing

To test the fix:

1. **Start the Flask server:**
```bash
cd Cancer_chatbot
set DATA_PATH=../data/CancerQA_data.csv  # Windows CMD
# OR
$env:DATA_PATH = "../data/CancerQA_data.csv"  # PowerShell
python app.py
```

2. **Open browser:** http://127.0.0.1:5001

3. **Test the sequence:**
   - Ask: "Tell me about lung cancer stages"
   - Ask: "Which stage is most dangerous?"
   - Ask: "Can you explain more about that one?"
   
   ✅ The third answer should now correctly reference lung cancer Stage 4

## Benefits

1. **Better Context Retention:** The chatbot remembers what was discussed
2. **Natural Conversations:** Users can use pronouns like "that one", "it", "this", etc.
3. **Token Efficiency:** Only keeps last 4-10 messages to avoid token limits
4. **Consistent Behavior:** Both web and mobile apps now handle context properly

## Technical Details

### Message Format:
```javascript
{
    role: 'user' | 'assistant',
    content: 'message text'
}
```

### Token Management:
- Frontend: Keeps last 10 messages (5 Q&A pairs)
- Backend: Uses last 4 messages (2 Q&A pairs) in prompt
- Historical answers truncated to 200 chars in prompt

### API Changes:
The `/question` endpoint now expects:
```json
{
    "question": "string",
    "conversation_history": [
        {"role": "user", "content": "string"},
        {"role": "assistant", "content": "string"}
    ]
}
```

## Files Modified
1. `Cancer_chatbot/rag.py` - Updated `build_prompt()` function
2. `Cancer_chatbot/app.py` - Added conversation history tracking and sending

## No Changes Needed
- `mobile/App.js` - Already had proper implementation
- `mobile/api.js` - Already sending conversation_history parameter
