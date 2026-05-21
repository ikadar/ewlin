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


def _request(method: str, url: str, *, token: str | None = None, body: dict | None = None, timeout: int = 30):
    headers = {"Accept": "application/json"}
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


def create_job(base_url: str, token: str, request: dict, *, retry_5xx: int = 1) -> tuple[int, dict | None]:
    """POST /jobs, renvoie (status, body). Retry 1× sur 5xx (configurable)."""
    attempts = 1 + retry_5xx
    last = None
    for i in range(attempts):
        status, body = _request("POST", f"{base_url}/jobs", token=token, body=request)
        last = (status, body)
        if status < 500:
            return last
        if i < attempts - 1:
            time.sleep(2)
    return last  # type: ignore
