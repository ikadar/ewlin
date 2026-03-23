FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml .
COPY flux_solver/ flux_solver/

RUN pip install --no-cache-dir ".[service]"

EXPOSE 8000

CMD ["uvicorn", "flux_solver.main:app", "--host", "0.0.0.0", "--port", "8000"]
