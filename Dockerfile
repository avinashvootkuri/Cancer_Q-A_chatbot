FROM python:3.12-slim

WORKDIR /app

RUN pip install pipenv

COPY data/CancerQA_data.csv data/CancerQA_data.csv
COPY ["Pipfile", "Pipfile.lock", "./"]

RUN pipenv install --deploy --ignore-pipfile --system

COPY Cancer_chatbot .

EXPOSE 5001

CMD gunicorn --bind 0.0.0.0:5001 app:app