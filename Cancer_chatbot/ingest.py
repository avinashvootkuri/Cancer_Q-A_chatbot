import os
import pandas as pd

import minsearch

DATA_PATH = os.getenv("DATA_PATH", "../data/CancerQA_data.csv")

def load_index(data_path=DATA_PATH):
    df = pd.read_csv(data_path)

    documents = df.to_dict(orient='records')

    index = minsearch.Index(
        text_fields=["question", "answer"],
        keyword_fields=['id']
    )

    index.fit(documents)

    return index
