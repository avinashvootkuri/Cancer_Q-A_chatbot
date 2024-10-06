#!/usr/bin/env python
# coding: utf-8

# In[2]:


import pandas as pd


# ## Ingestion

# In[18]:


df = pd.read_csv('../data/CancerQA_data.csv')


# In[19]:


df.head()


# In[11]:


get_ipython().system('wget https://raw.githubusercontent.com/alexeygrigorev/minsearch/main/minsearch.py')


# In[14]:


df.head()


# In[45]:


del df['topic']


# In[46]:


documents = df.to_dict(orient='records')


# In[47]:


documents


# In[14]:


import minsearch


# In[50]:


index = minsearch.Index(
    # text_fields=["question", "answer", "topic"],
    text_fields=["question", "answer"],
    keyword_fields=['id']
)


# In[51]:


index.fit(documents)


# ## RAG Flow

# In[23]:


import os


# In[24]:


os.environ['OPENAI_API_KEY'] = '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'


# In[27]:


from openai import OpenAI

client = OpenAI()


# In[29]:


response = client.chat.completions.create(
    model='gpt-4o-mini',
    messages=[{"role": "user", "content": query}]
)

response.choices[0].message.content


# In[46]:


def search(query):
    boost = {}

    results = index.search(
        query=query,
        filter_dict={},
        boost_dict=boost,
        num_results=10
    )

    return results


# In[47]:


search('lung cancer')


# In[56]:


prompt_template = """
You're a CANCER expert. Answer the QUESTION based on the CONTEXT from our cancer database.
Use only the facts from the CONTEXT when answering the QUESTION.

QUESTION: {question}

CONTEXT:
{context}
""".strip()

entry_template = """
question: {question}
answer: {answer}
topic: {topic}
""".strip()

def build_prompt(query, search_results):
    context = ""
    
    for doc in search_results:
        context = context + entry_template.format(**doc) + "\n\n"

    prompt = prompt_template.format(question=query, context=context).strip()
    return prompt


# In[57]:


search_results = search(query)
prompt = build_prompt(query, search_results)


# In[58]:


print(prompt)


# In[59]:


def llm(prompt, model='gpt-4o-mini'):
    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}]
    )
    
    return response.choices[0].message.content


# In[60]:


def rag(query, model='gpt-4o-mini'):
    search_results = search(query)
    prompt = build_prompt(query, search_results)
    #print(prompt)
    answer = llm(prompt, model=model)
    return answer


# In[61]:


question = 'what are different types of lung cancer and how to diagnose them?'
answer = rag(question)
print(answer)


# In[37]:


question = 'what are different types of lung cancer and how to prevent lung cancer?'
answer = rag(question)
print(answer)


# ## Retrivel Evaluation

# In[60]:


df_question = pd.read_csv('../data/ground-truth-retrieval_v2.csv')


# In[61]:


df_question


# In[62]:


ground_truth = df_question.to_dict(orient='records')


# In[63]:


ground_truth[0]


# In[64]:


def hit_rate(relevance_total):
    cnt = 0

    for line in relevance_total:
        if True in line:
            cnt = cnt + 1

    return cnt / len(relevance_total)

def mrr(relevance_total):
    total_score = 0.0

    for line in relevance_total:
        for rank in range(len(line)):
            if line[rank] == True:
                total_score = total_score + 1 / (rank + 1)

    return total_score / len(relevance_total)


# In[65]:


def minsearch_search(query):
    boost = {}

    results = index.search(
        query=query,
        filter_dict={},
        boost_dict=boost,
        num_results=10
    )

    return results


# In[66]:


from tqdm.auto import tqdm


# In[67]:


def evaluate(ground_truth, search_function):
    relevance_total = []

    for q in tqdm(ground_truth):
        doc_id = q['id']
        results = search_function(q)
        relevance = [d['id'] == doc_id for d in results]
        relevance_total.append(relevance)

    return {
        'hit_rate': hit_rate(relevance_total),
        'mrr': mrr(relevance_total),
    }


# In[68]:


evaluate(ground_truth, lambda q: minsearch_search(q['question']))


# ### Finding the best parameters

# In[69]:


df_validation = df_question[:1000]
df_test = df_question[1000:]


# In[70]:


import random

def simple_optimize(param_ranges, objective_function, n_iterations=10):
    best_params = None
    best_score = float('-inf')  # Assuming we're minimizing. Use float('-inf') if maximizing.

    for _ in range(n_iterations):
        # Generate random parameters
        current_params = {}
        for param, (min_val, max_val) in param_ranges.items():
            if isinstance(min_val, int) and isinstance(max_val, int):
                current_params[param] = random.randint(min_val, max_val)
            else:
                current_params[param] = random.uniform(min_val, max_val)
        
        # Evaluate the objective function
        current_score = objective_function(current_params)
        
        # Update best if current is better
        if current_score > best_score:  # Change to > if maximizing
            best_score = current_score
            best_params = current_params
    
    return best_params, best_score


# In[71]:


gt_val = df_validation.to_dict(orient='records')


# In[72]:


def minsearch_search(query, boost=None):
    if boost is None:
        boost = {}

    results = index.search(
        query=query,
        filter_dict={},
        boost_dict=boost,
        num_results=10
    )

    return results


# In[73]:


param_ranges = {
    'question': (0.0, 10.0),
    'answer': (0.0, 10.0)
}

def objective(boost_params):
    def search_function(q):
        return minsearch_search(q['question'], boost_params)

    results = evaluate(gt_val, search_function)
    return results['mrr']


# In[74]:


simple_optimize(param_ranges, objective, n_iterations=25)


# In[75]:


def minsearch_improved(query):
    boost = {
        'question': 2.21,
        'answer': 7.84
    }

    results = index.search(
        query=query,
        filter_dict={},
        boost_dict=boost,
        num_results=10
    )

    return results

evaluate(ground_truth, lambda q: minsearch_improved(q['question']))

