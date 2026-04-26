"""
Test script to verify conversation history and pronoun resolution works correctly.
This tests the exact scenario described by the user.
"""

import sys
import os

# Add the parent directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from Cancer_chatbot.rag import rag

def test_pronoun_resolution():
    """Test the three-question sequence with pronoun resolution"""
    
    print("=" * 80)
    print("TEST: Pronoun Resolution with Conversation History")
    print("=" * 80)
    
    conversation_history = []
    
    # Question 1: "Tell me about lung cancer stages"
    print("\n[Question 1]")
    question1 = "Tell me about lung cancer stages"
    print(f"User: {question1}")
    
    result1 = rag(question1, conversation_history=conversation_history)
    answer1 = result1['answer']
    print(f"\nAssistant: {answer1[:200]}...")
    
    # Update conversation history
    conversation_history.append({'role': 'user', 'content': question1})
    conversation_history.append({'role': 'assistant', 'content': answer1})
    
    print("\n" + "-" * 80)
    
    # Question 2: "Which stage is most dangerous?"
    print("\n[Question 2]")
    question2 = "Which stage is most dangerous?"
    print(f"User: {question2}")
    
    result2 = rag(question2, conversation_history=conversation_history)
    answer2 = result2['answer']
    print(f"\nAssistant: {answer2[:200]}...")
    
    # Update conversation history
    conversation_history.append({'role': 'user', 'content': question2})
    conversation_history.append({'role': 'assistant', 'content': answer2})
    
    print("\n" + "-" * 80)
    
    # Question 3: "Can you explain more about that one?"
    print("\n[Question 3]")
    question3 = "Can you explain more about that one?"
    print(f"User: {question3}")
    
    result3 = rag(question3, conversation_history=conversation_history)
    answer3 = result3['answer']
    print(f"\nAssistant: {answer3[:300]}...")
    
    print("\n" + "=" * 80)
    print("TEST COMPLETE")
    print("=" * 80)
    
    # Check if the third answer maintains context
    print("\n[ANALYSIS]")
    print(f"Question 3 asked: '{question3}'")
    print(f"Answer should reference lung cancer and specific stage (e.g., Stage 4)")
    
    # Simple checks
    contains_lung = 'lung' in answer3.lower()
    contains_stage = 'stage' in answer3.lower()
    contains_cancer = 'cancer' in answer3.lower()
    
    print(f"\n✓ Answer mentions 'lung': {contains_lung}")
    print(f"✓ Answer mentions 'stage': {contains_stage}")
    print(f"✓ Answer mentions 'cancer': {contains_cancer}")
    
    if contains_lung and contains_stage and contains_cancer:
        print("\n✅ SUCCESS: Context was maintained correctly!")
    else:
        print("\n⚠️  WARNING: Context might not have been maintained properly")
    
    return result3

if __name__ == "__main__":
    test_pronoun_resolution()
