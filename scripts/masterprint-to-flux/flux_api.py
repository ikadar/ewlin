"""Client HTTP minimal pour l'API Flux (login + GET/POST jobs)."""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.request


class AuthError(RuntimeError):
    pass


class ApiError(RuntimeError):
    def __init__(self, status: int, body: str):
        super().__init__(f"HTTP {status}: {body[:200]}")
        self.status = status
        self.body = body


def _request(method: str, url: str, *, token: str | None = None, body: dict | None = None, timeout: int = 30, scenario: str = "prod"):
    # X-Flux-Scenario explicit — MasterPrint is a fact-on-the-wall source
    # that propagates to every scenario (Prod canonical + Préprod sandbox).
    # The API's default scenario is not deterministic, so we always pin.
    headers = {"Accept": "application/json", "X-Flux-Scenario": scenario}
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode("utf-8")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8") if e.fp else ""
        return e.code, (json.loads(raw) if raw else None)


def login(base_url: str, email: str, password: str) -> str:
    """Renvoie le JWT ou lève AuthError."""
    status, body = _request("POST", f"{base_url}/auth/login", body={"email": email, "password": password})
    if status != 200 or not body or "token" not in body:
        raise AuthError(f"Login failed: HTTP {status} {body}")
    return body["token"]


def list_existing_references(base_url: str, token: str) -> set[str]:
    """Renvoie l'ensemble des `reference` de jobs existants côté Flux.

    L'API paginée à 100 max par page (format {items, total, page, limit, pages}).
    On boucle jusqu'à épuisement.
    """
    refs: set[str] = set()
    page = 1
    while True:
        status, body = _request("GET", f"{base_url}/jobs?page={page}&limit=100", token=token, timeout=60)
        if status != 200:
            raise ApiError(status, json.dumps(body) if body else "")
        items = body if isinstance(body, list) else (body or {}).get("items", []) or (body or {}).get("data", [])
        for item in items:
            if "reference" in item:
                refs.add(item["reference"])
        if isinstance(body, dict):
            total_pages = body.get("pages", 1)
            if page >= total_pages:
                break
            page += 1
        else:
            # API renvoie un array nu : pas de pagination, on s'arrête
            break
    return refs


def create_job(base_url: str, token: str, request: dict, *, retry_5xx: int = 1, scenario: str = "prod") -> tuple[int, dict | None]:
    """POST /jobs, renvoie (status, body). Retry 1× sur 5xx (configurable)."""
    return _action_with_retry("POST", f"{base_url}/jobs", token, request, retry_5xx, scenario)


def update_job(base_url: str, token: str, job_id: str, request: dict, *, retry_5xx: int = 1, scenario: str = "prod") -> tuple[int, dict | None]:
    """PUT /jobs/{id}, renvoie (status, body). Retry 1× sur 5xx."""
    return _action_with_retry("PUT", f"{base_url}/jobs/{job_id}", token, request, retry_5xx, scenario)


def delete_job(base_url: str, token: str, job_id: str, *, retry_5xx: int = 1, scenario: str = "prod") -> tuple[int, dict | None]:
    """DELETE /jobs/{id}, renvoie (status, body). Retry 1× sur 5xx."""
    return _action_with_retry("DELETE", f"{base_url}/jobs/{job_id}", token, None, retry_5xx, scenario)


def trigger_recompute(base_url: str, token: str, *, scenario: str = "prod") -> tuple[int, dict | None]:
    """POST /schedule/compute to pick up gate changes after LANCE actions."""
    return _action_with_retry("POST", f"{base_url}/schedule/compute", token, {"mode": "full"}, 1, scenario)


def list_providers(base_url: str, token: str) -> list[dict]:
    """GET /providers — returns list of all existing outsourced providers."""
    status, body = _request("GET", f"{base_url}/providers", token=token, timeout=30)
    if status != 200:
        raise ApiError(status, json.dumps(body) if body else "")
    if isinstance(body, dict):
        return body.get("data", [])
    return body if isinstance(body, list) else []


def create_provider(
    base_url: str,
    token: str,
    name: str,
    action_types: list[str],
    transit_days: int = 1,
) -> tuple[int, dict | None]:
    """POST /providers — create an outsourced provider. Returns (status, body)."""
    payload = {
        "name": name,
        "supportedActionTypes": action_types,
        "transitDays": transit_days,
    }
    return _action_with_retry("POST", f"{base_url}/providers", token, payload, 1)


def _action_with_retry(method: str, url: str, token: str, body: dict | None, retry_5xx: int, scenario: str = "prod") -> tuple[int, dict | None]:
    attempts = 1 + retry_5xx
    last: tuple[int, dict | None] = (0, None)
    for i in range(attempts):
        status, response = _request(method, url, token=token, body=body, scenario=scenario)
        last = (status, response)
        if status < 500:
            return last
        if i < attempts - 1:
            time.sleep(2)
    return last
