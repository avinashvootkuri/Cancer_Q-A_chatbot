import ingest

import os
import re
import json
from time import time

from groq import Groq


def _normalize_api_key(value):
    if value is None:
        return ""
    key = str(value).strip()
    if len(key) >= 2 and key[0] == key[-1] and key[0] in ('"', "'"):
        key = key[1:-1].strip()
    return key


def _groq_api_keys():
    primary = _normalize_api_key(os.getenv("GROQ_API_KEY"))

    # Accept multiple fallback env names to avoid deployment/config drift.
    fallback_candidates = [
        os.getenv("GROQ_API_KEY_FALLBACK"),
        os.getenv("GROQ_API_KEY_SECONDARY"),
        os.getenv("GROQ_API_KEY_2"),
    ]
    fallback = ""
    for candidate in fallback_candidates:
        key = _normalize_api_key(candidate)
        if key:
            fallback = key
            break

    keys = []
    if primary:
        keys.append(primary)
    if fallback and fallback not in keys:
        keys.append(fallback)
    return keys


def _groq_error_suggests_try_next_key(exc):
    code = getattr(exc, "status_code", None)
    if code is None:
        code = getattr(getattr(exc, "response", None), "status_code", None)
    if code is None:
        code = getattr(exc, "code", None)
    if code is not None:
        if code == 400:
            return False
        return code in (401, 403, 429, 408, 500, 502, 503, 504)
    name = type(exc).__name__
    text = f"{name} {str(exc)}".lower()
    if any(part in name for part in ("Connection", "Timeout", "Connect", "RemoteProtocol")):
        return True
    return any(
        hint in text
        for hint in (
            "unauthorized",
            "authentication",
            "invalid api key",
            "invalid_api_key",
            "forbidden",
            "rate limit",
            "too many requests",
            "service unavailable",
            "temporarily unavailable",
            "timeout",
            "connection",
        )
    )

# Available models
AVAILABLE_MODELS = {
    "gpt-oss": "llama-3.3-70b-versatile",  # Default Groq model (higher token limit)
    "meditron": "epfl-llm/meditron-7b",  # Optional HuggingFace model (requires access)
}

# For meditron model (lazy loading)
meditron_pipeline = None
meditron_tokenizer = None

def load_meditron():
    """Lazy load meditron model only when needed"""
    global meditron_pipeline, meditron_tokenizer
    
    if meditron_pipeline is None:
        import torch
        from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline
        from huggingface_hub import login
        
        HF_TOKEN = os.getenv("HF_TOKEN")
        if HF_TOKEN:
            login(token=HF_TOKEN)
            print("Logged in to Hugging Face successfully!")
        
        MODEL_NAME = "epfl-llm/meditron-7b"
        print(f"Loading {MODEL_NAME} model... This may take a few minutes.")
        
        meditron_tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, token=HF_TOKEN)
        model = AutoModelForCausalLM.from_pretrained(
            MODEL_NAME,
            torch_dtype=torch.float16,
            device_map="auto",
            low_cpu_mem_usage=True,
            token=HF_TOKEN
        )
        
        meditron_pipeline = pipeline(
            "text-generation",
            model=model,
            tokenizer=meditron_tokenizer,
            max_new_tokens=512,
            do_sample=True,
            temperature=0.7,
            top_p=0.95,
        )
        print(f"{MODEL_NAME} model loaded successfully!")
    
    return meditron_pipeline, meditron_tokenizer

index = ingest.load_index()


def search(query):
    boost = {}

    results = index.search(
        query=query,
        filter_dict={},
        boost_dict=boost,
        num_results=3  # Reduced to stay within token limits
    )

    return results

# System instructions for the /question RAG endpoint (adaptive length, safety, tone).
ASSISTANT_SYSTEM_PROMPT = """
You are an AI-powered cancer-focused medical assistant. You provide educational and supportive health information only. Your responses must adapt in length and depth to the user's question while maintaining medical safety and clarity.

## Scope restriction (strict)
- Only provide cancer-related educational information (types, symptoms, risk factors, screening/diagnosis, staging, treatment, prevention, survivorship).
- If a prompt is out of scope, politely redirect with: "I specialize in providing information related to cancer. Could you please share any cancer-related symptoms or concerns?"

## Adaptive response length (strict)
1. **Simple queries** (definitions like "what is X", "what does benign mean", yes/no, or one short factual ask): Reply in **2–4 short sentences total**. **No** long paragraphs, **no** numbered lists, **no** bullet lists, **no** rare case examples or deep CONTEXT excerpts unless the user explicitly asked for detail (e.g. "explain in depth", "full overview"). Prefer a plain definition plus one-sentence contrast if needed (e.g. benign vs malignant).
2. **Detailed queries** only when the user clearly asks for depth (stages, treatment options, compare approaches, "explain fully", multiple sub-questions, or several symptoms with context): Then use structured paragraphs and/or bullets/numbered lists.
3. If the question is simple but CONTEXT contains long stories or rare tumors, **ignore** those details unless the user asked for them.

## Symptom-based interactions (strict)
- **One or two symptoms** reported in a personal way (I/my/I've been…): **Do not** name cancer types, **do not** say fatigue or similar "can occur in" breast cancer, lung cancer, melanoma, etc., **do not** list ways cancer might cause the symptom. Reply in **2–5 short sentences**: acknowledge briefly, explain one symptom is not enough, ask focused follow-up questions (duration, progression, other symptoms, medications, age/relevant risks). Do not repeat questions that were already answered in previous conversation context. **Ignore PREVIOUS CONVERSATION** if it would push you toward cancer examples for this turn—safety comes first.
- Only when the user has given **rich context** (several symptoms, timeline, clear request for differential-style education) may you discuss **possible** categories with probabilistic language. Never a definitive diagnosis.

## Tone and language
- Be empathetic, supportive, and professional. Avoid alarming or definitive statements such as "You have cancer."

## Medical disclaimer
- Include a disclaimer only when discussing symptoms, triage, or potential cancer-related risk. Do not append a disclaimer to every informational response.
- Rotate phrasing naturally to avoid repeating identical disclaimer wording every turn.

## Output formatting (required for the mobile app)
The client renders inline styles only when you use these exact markers (balanced pairs, no HTML):
- **Bold:** wrap text in `**double asterisks**` or `__double underscores__`
- *Italic:* wrap in `*single asterisks*` or `_single underscores_` (do not mix `***` triples; use nested pairs like `**bold *and italic* together**` if needed)
- Lists: use `•` or numbered lines as plain text; newlines are preserved
- Use point-wise bullets or numbered steps whenever the user asks for options, causes, next steps, treatment plans, comparisons, or multi-part guidance.
- Avoid repetitive phrasing across turns; if the same safety message was just given, rephrase it briefly rather than repeating verbatim.

Match depth to the question: **detailed** answers should use bold/italic for key terms; **simple** answers may stay mostly plain with at most light emphasis.

## Grounding
- The user's message will include **CONTEXT** from a cancer knowledge base. Use those facts when they apply **without** copying long passages. For **simple** questions, use CONTEXT only for a tight definition, not for extended examples. If CONTEXT is thin or off-topic, still follow safety rules and give a careful, educational reply.

## Constraints
- No definitive diagnoses. Prioritize clarity for non-medical readers. Respect any explicit instructions in the user's question (e.g. safety or format requests).
""".strip()

prompt_template = """
QUESTION: {question}

CONTEXT:
{context}
""".strip()

_FIRST_PERSON_RE = re.compile(
    r"\b(i'm|i am|i've|i\b|my|me|suffering\s+from)\b",
    re.I,
)

_SIMPLE_DEF_START_RE = re.compile(
    r"^\s*(what\s+is|what\s+are|what\s+does|what's|whats|define\b|meaning\s+of|what\s+do\s+you\s+mean\s+by|can\s+you\s+define)\b",
    re.I,
)

_VAGUE_SYMPTOM_RE = re.compile(
    r"\b(tired(ness)?|exhaust(ed|ion)?|fatigue|low\s+energy|feel(ing)?\s+tired|been\s+tired|"
    r"can't\s+sleep|cannot\s+sleep|insomnia|headache|nausea|dizz(y|iness)|fever|chills|aches?|"
    r"pain|cough(ing)?|lump|bleed(ing)?|lost\s+weight|weight\s+loss)\b",
    re.I,
)

_SIMPLE_DEF_HINT = """

[Response constraint — required]
This is a simple definition or short factual question. Answer in **2–4 short sentences only**. Do **not** use bullet lists or numbered lists. Do **not** pull in long examples, rare tumors, or extended vignettes from CONTEXT unless the user explicitly asked for detail. At most lightly bold one or two terms."""

_MINIMAL_SYMPTOM_HINT = """

[Symptom triage — required]
The user message is a brief first-person symptom or complaint. Do **not** name specific cancer types. Do **not** write that this symptom "can occur with" breast cancer, lung cancer, melanoma, lymphoma, or similar. Do **not** use prior conversation only to introduce cancer-related examples. In **2–5 short sentences**, acknowledge briefly, explain that more information is needed, ask practical follow-up questions (duration, change over time, other symptoms, medications, relevant history) that have not already been answered. One disclaimer sentence."""


def looks_like_simple_definition_question(query: str) -> bool:
    q = (query or "").strip()
    if len(q) > 240:
        return False
    low = q.lower()
    if "[safety instruction]" in low or "[clinical response" in low or "[response constraint" in low:
        return False
    if _FIRST_PERSON_RE.search(q) and _VAGUE_SYMPTOM_RE.search(q):
        return False
    return bool(_SIMPLE_DEF_START_RE.match(q))


def looks_like_minimal_personal_symptom(query: str) -> bool:
    q = (query or "").strip()
    if len(q) > 400:
        return False
    low = q.lower()
    if "[symptom triage" in low:
        return False
    if not _FIRST_PERSON_RE.search(q):
        return False
    return bool(_VAGUE_SYMPTOM_RE.search(q))


def augment_question_for_policy(query: str) -> str:
    if not query:
        return query
    extra = []
    if looks_like_simple_definition_question(query):
        extra.append(_SIMPLE_DEF_HINT)
    if looks_like_minimal_personal_symptom(query):
        extra.append(_MINIMAL_SYMPTOM_HINT)
    return query + "".join(extra) if extra else query

FOLLOW_UP_REFERENCE_PATTERNS = [
    r"\bthat\b",
    r"\bit\b",
    r"\bthis\b",
    r"\bthose\b",
    r"\bthese\b",
    r"\bthe above\b",
    r"\bprevious\b",
    r"\bearlier\b",
    r"\bmore about\b",
    r"\bexplain more\b",
    r"\btell me more\b",
    r"\bwhat about\b",
    r"\bwhich one\b",
    r"\bthat one\b",
]

def should_use_conversation_history(query: str) -> bool:
    text = (query or "").strip().lower()
    if not text:
        return False
    return any(re.search(pattern, text) for pattern in FOLLOW_UP_REFERENCE_PATTERNS)

entry_template = """
question: {question}
answer: {answer}
topic: {topic}
""".strip()

def build_prompt(query, search_results, conversation_history=None):
    query = augment_question_for_policy(query)
    context = ""
    
    for doc in search_results:
        context = context + entry_template.format(**doc) + "\n\n"
    
    # Add conversation history context if provided
    history_context = ""
    if should_use_conversation_history(query) and conversation_history and len(conversation_history) > 0:
        history_context = "\n\nPREVIOUS CONVERSATION (for context):\n"
        # Take last 4 messages (2 Q&A pairs) to keep context manageable
        for msg in conversation_history[-4:]:
            if msg.get("role") == "user":
                history_context += f"User asked: {msg.get('content', '')}\n"
            elif msg.get("role") == "assistant":
                # Truncate long answers in history
                answer = msg.get('content', '')
                if len(answer) > 200:
                    answer = answer[:200] + "..."
                history_context += f"Assistant answered: {answer}\n"
        history_context += "\nNow answer the current question using this context.\n"

    prompt = prompt_template.format(
        question=query, 
        context=context
    ).strip()
    
    if history_context:
        prompt = history_context + prompt
    
    return prompt


def llm_groq(prompt, model='llama-3.3-70b-versatile', system=None):
    """Use Groq API for text generation; tries GROQ_API_KEY then GROQ_API_KEY_FALLBACK."""
    keys = _groq_api_keys()
    if not keys:
        raise RuntimeError(
            "No Groq API key configured. Set GROQ_API_KEY and optionally GROQ_API_KEY_FALLBACK."
        )
    print(f"[groq] loaded {len(keys)} key(s) for request")

    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    last_error = None
    for idx, api_key in enumerate(keys, start=1):
        client = Groq(api_key=api_key)
        try:
            completion = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.7,
                max_tokens=1024,
                top_p=1,
                stream=False,
            )
        except Exception as e:
            last_error = e
            has_next_key = idx < len(keys)
            reason_matched = _groq_error_suggests_try_next_key(e)
            should_try_next = has_next_key
            print(
                f"[groq] key attempt {idx}/{len(keys)} failed ({type(e).__name__}), "
                f"reason_matched={reason_matched}, retry_next={should_try_next}"
            )
            if should_try_next:
                continue
            raise

        answer = completion.choices[0].message.content
        token_stats = {
            "prompt_tokens": completion.usage.prompt_tokens,
            "completion_tokens": completion.usage.completion_tokens,
            "total_tokens": completion.usage.total_tokens,
        }
        return answer, token_stats

    raise last_error


def llm_meditron(prompt):
    """Use Meditron model from HuggingFace"""
    pipe, tokenizer = load_meditron()
    
    # Count input tokens
    input_ids = tokenizer.encode(prompt, return_tensors="pt")
    prompt_tokens = len(input_ids[0])
    
    # Generate response
    response = pipe(prompt, max_new_tokens=512, return_full_text=False)
    answer = response[0]['generated_text'].strip()
    
    # Count output tokens
    output_ids = tokenizer.encode(answer, return_tensors="pt")
    completion_tokens = len(output_ids[0])
    
    token_stats = {
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": prompt_tokens + completion_tokens,
    }
    
    return answer, token_stats


def llm(prompt, model='gpt-oss', system=None):
    """Main LLM function that routes to appropriate backend"""
    if model == 'meditron':
        combined = f"{system}\n\n{prompt}" if system else prompt
        return llm_meditron(combined)
    else:
        # Default to Groq's gpt-oss model
        groq_model = AVAILABLE_MODELS.get(model, 'openai/gpt-oss-20b')
        return llm_groq(prompt, groq_model, system=system)


def calculate_openai_cost(model, tokens):
    # Groq and local models have different pricing or are free
    return 0.0

evaluation_prompt_template = """
You are an expert evaluator for a RAG system.
Your task is to analyze the relevance of the generated answer to the given question.
Based on the relevance of the generated answer, you will classify it 
as "NON_RELEVANT", "PARTLY_RELEVANT", or "RELEVANT".

Here is the data for evaluation:

Question: {question}
Generated Answer: {answer}

Please analyze the content and context of the generated answer in relation to the original
answer and provide your evaluation in parsable JSON without using code blocks:

{{
  "Relevance": "NON_RELEVANT" | "PARTLY_RELEVANT" | "RELEVANT",
  "Explanation": "[Provide a brief explanation for your evaluation]"
}}
""".strip()

def evaluate_relevance(question, answer, model='gpt-oss'):
    prompt = evaluation_prompt_template.format(question=question, answer=answer)
    evaluation, tokens = llm(prompt, model=model)

    try:
        json_eval = json.loads(evaluation)
        return json_eval, tokens
    except json.JSONDecodeError:
        result = {"Relevance": "UNKNOWN", "Explanation": "Failed to parse evaluation"}
        return result, tokens

def rag(query, model='gpt-oss', conversation_history=None):
    """
    Main RAG function with conversation memory.
    
    Args:
        query: The question to answer
        model: 'gpt-oss' (default, uses Groq) or 'meditron' (uses HuggingFace)
        conversation_history: List of previous messages for context
    """
    t0 = time()

    # Search local database
    search_results = search(query)
    
    # Build prompt with context and conversation history
    prompt = build_prompt(query, search_results, conversation_history)
    answer, token_stats = llm(prompt, model=model, system=ASSISTANT_SYSTEM_PROMPT)

    # Relevance evaluation is a second Groq call — skip gracefully on rate-limit
    try:
        relevance, rel_token_stats = evaluate_relevance(query, answer, model=model)
    except Exception as eval_err:
        import traceback
        print(f"[rag] evaluate_relevance failed (non-fatal): {eval_err}")
        relevance = {"Relevance": "UNKNOWN", "Explanation": "Evaluation skipped"}
        rel_token_stats = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

    t1 = time()
    took = t1 - t0

    openai_cost_rag = calculate_openai_cost(model, token_stats)
    openai_cost_eval = calculate_openai_cost(model, rel_token_stats)

    openai_cost = openai_cost_rag + openai_cost_eval

    answer_data = {
        "answer": answer,
        "model_used": model,
        "response_time": took,
        "relevance": relevance.get("Relevance", "UNKNOWN"),
        "relevance_explanation": relevance.get(
            "Explanation", "Failed to parse evaluation"
        ),
        "prompt_tokens": token_stats["prompt_tokens"],
        "completion_tokens": token_stats["completion_tokens"],
        "total_tokens": token_stats["total_tokens"],
        "eval_prompt_tokens": rel_token_stats["prompt_tokens"],
        "eval_completion_tokens": rel_token_stats["completion_tokens"],
        "eval_total_tokens": rel_token_stats["total_tokens"],
        "openai_cost": openai_cost,
    }
    return answer_data


# if __name__ == "__main__":
#     question = "What are different types of lung cancers?"
#     answer = rag(question)
#     print(answer)
