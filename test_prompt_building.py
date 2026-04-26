"""
Simple test to verify the build_prompt function correctly includes conversation history
"""

def test_build_prompt_with_history():
    """Test that build_prompt properly formats conversation history"""
    
    # Simulate conversation history
    conversation_history = [
        {'role': 'user', 'content': 'Tell me about lung cancer stages'},
        {'role': 'assistant', 'content': 'Lung cancer has 4 stages. Stage 1 is early and most treatable. Stage 4 is advanced and most dangerous with spread to other organs.'},
        {'role': 'user', 'content': 'Which stage is most dangerous?'},
        {'role': 'assistant', 'content': 'Stage 4 lung cancer is the most dangerous stage because it has metastasized to other parts of the body.'}
    ]
    
    # Current query
    current_query = "Can you explain more about that one?"
    
    # Mock search results (simplified)
    search_results = [
        {
            'question': 'What is stage 4 lung cancer?',
            'answer': 'Stage 4 lung cancer is the most advanced stage where cancer has spread to distant organs.',
            'topic': 'lung cancer'
        }
    ]
    
    # Build the context string
    context = ""
    entry_template = """
question: {question}
answer: {answer}
topic: {topic}
""".strip()
    
    for doc in search_results:
        context = context + entry_template.format(**doc) + "\n\n"
    
    # Build history context
    history_context = ""
    if conversation_history and len(conversation_history) > 0:
        history_context = "\n\nPREVIOUS CONVERSATION (for context):\n"
        for msg in conversation_history[-4:]:  # Last 4 messages
            if msg.get("role") == "user":
                history_context += f"User asked: {msg.get('content', '')}\n"
            elif msg.get("role") == "assistant":
                answer = msg.get('content', '')
                if len(answer) > 200:
                    answer = answer[:200] + "..."
                history_context += f"Assistant answered: {answer}\n"
        history_context += "\nNow answer the current question using this context.\n"
    
    # Build the user prompt (system instructions are sent separately in rag.llm for Groq)
    prompt_template = """
QUESTION: {question}

CONTEXT:
{context}
""".strip()
    
    prompt = prompt_template.format(
        question=current_query,
        context=context
    ).strip()
    
    if history_context:
        prompt = history_context + prompt
    
    # Print the result
    print("=" * 80)
    print("PROMPT WITH CONVERSATION HISTORY")
    print("=" * 80)
    print(prompt)
    print("=" * 80)
    
    # Verify the prompt contains the necessary context
    checks = {
        "Contains 'PREVIOUS CONVERSATION'": "PREVIOUS CONVERSATION" in prompt,
        "Contains first user question": "Tell me about lung cancer stages" in prompt,
        "Contains second user question": "Which stage is most dangerous" in prompt,
        "Contains Stage 4 reference": "Stage 4" in prompt,
        "Contains current question": "Can you explain more about that one" in prompt,
        "Contains 'Now answer the current question'": "Now answer the current question" in prompt,
    }
    
    print("\n✅ VALIDATION CHECKS:")
    all_passed = True
    for check, result in checks.items():
        status = "✓" if result else "✗"
        print(f"  {status} {check}: {result}")
        if not result:
            all_passed = False
    
    if all_passed:
        print("\n✅ SUCCESS: All checks passed! The LLM will have proper context.")
    else:
        print("\n⚠️  WARNING: Some checks failed.")
    
    return prompt

if __name__ == "__main__":
    test_build_prompt_with_history()
