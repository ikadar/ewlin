"""Applique les règles métier de mapping NUSEC -> station Flux."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from csv_loader import ElementInfo, Operation, Tirage


@dataclass
class ResolverContext:
    """Contexte nécessaire pour appliquer une règle de mapping."""
    tirage: Tirage | None       # papier de l'élément (None si NOPAP=000)
    element: ElementInfo | None  # ligne DI_ELEME correspondante
    nb_postes: int               # COUNT papiers du dossier


@dataclass
class Resolution:
    kind: Literal["station", "outsourced", "skip"]
    station_name: str | None = None
    provider_name: str | None = None
    action_type: str | None = None
    days: int | None = None
    skip_reason: str | None = None


def _station_dsl_name(name: str) -> str:
    """Convertit un nom de station Flux en token DSL (espaces -> underscores)."""
    return name.replace(" ", "_")


def _apply_rule(rule: dict, op: Operation, ctx: ResolverContext) -> str | None:
    """Renvoie le nom de la station choisie, ou None si la règle n'aboutit pas."""
    rule_type = rule.get("rule")

    if rule_type == "fixed":
        return rule.get("station")

    if rule_type == "duration_threshold":
        total = op.setup_min + op.run_min
        return rule["gt"] if total > rule["threshold_minutes"] else rule["le"]

    if rule_type == "postes_threshold":
        return rule["gt"] if ctx.nb_postes > rule["threshold"] else rule["le"]

    if rule_type == "format_threshold":
        # Petit format si min(ftfou) <= max_small[0] ET max(ftfou) <= max_small[1]
        # Sinon grand format. Fallback : petit format si ftfou absent.
        if ctx.tirage is None or ctx.tirage.ftfou is None:
            return rule["small"]
        d1, d2 = ctx.tirage.ftfou
        small_w, small_h = rule["max_small_cm"]
        if min(d1, d2) <= small_w and max(d1, d2) <= small_h:
            return rule["small"]
        return rule["large"]

    if rule_type == "composite":
        for branch in rule.get("branches", []):
            if "default" in branch:
                return branch["default"]
            cond = branch.get("if", {})
            if _eval_condition(cond, op, ctx):
                return branch.get("choose")
        return None

    if rule_type == "libop_keywords":
        libop_lower = (op.libop or "").lower()
        for pattern in rule.get("patterns", []):
            keywords = [k.lower() for k in pattern.get("keywords", [])]
            if any(k in libop_lower for k in keywords):
                return pattern.get("station")
        return rule.get("default")

    raise ValueError(f"Unknown rule type: {rule_type}")


def _eval_condition(cond: dict, op: Operation, ctx: ResolverContext) -> bool:
    """Évalue une clause `if:` d'une règle composite."""
    if "pagination_eq" in cond:
        if ctx.element is None or ctx.element.pag is None:
            return False
        return ctx.element.pag == cond["pagination_eq"]
    if "grammage_gte" in cond:
        if ctx.tirage is None or ctx.tirage.gramm is None:
            return False
        return ctx.tirage.gramm >= cond["grammage_gte"]
    if "grammage_lt" in cond:
        if ctx.tirage is None or ctx.tirage.gramm is None:
            return False
        return ctx.tirage.gramm < cond["grammage_lt"]
    raise ValueError(f"Unknown condition: {cond}")


def resolve(op: Operation, ctx: ResolverContext, config: dict) -> Resolution:
    """Décide quoi faire avec une opération MasterPrint."""
    # Skip explicite par NUSEC
    skip_nusec = config.get("skip_nusec", [])
    if op.nusec in skip_nusec:
        return Resolution(kind="skip", skip_reason=f"NUSEC_{op.nusec}_skipped")

    # Skip si pas de temps machine (sauf outsourced qui ont 0 par nature)
    outsourcing = config.get("outsourcing", {})
    is_outsourced_trigger = op.nusec == outsourcing.get("trigger_nusec")
    if not is_outsourced_trigger and op.setup_min == 0 and op.run_min == 0:
        return Resolution(kind="skip", skip_reason="zero_duration")

    # Tâche sous-traitée
    if is_outsourced_trigger:
        return Resolution(
            kind="outsourced",
            provider_name=outsourcing.get("provider_name", "Inconnu"),
            action_type=outsourcing.get("action_type", "divers"),
            days=outsourcing.get("default_days", 3),
        )

    # Tâche interne : applique la règle de mapping
    mapping = config.get("mapping", {})
    rule = mapping.get(op.nusec) if op.nusec else None
    if rule is None:
        return Resolution(kind="skip", skip_reason=f"NUSEC_unmapped_{op.nusec or 'EMPTY'}")

    station_name = _apply_rule(rule, op, ctx)
    if station_name is None:
        return Resolution(kind="skip", skip_reason=f"NUSEC_{op.nusec}_no_match")

    return Resolution(kind="station", station_name=station_name)


def to_dsl_line(op: Operation, resolution: Resolution) -> str:
    """Construit la ligne DSL pour une résolution donnée."""
    if resolution.kind == "station":
        token = _station_dsl_name(resolution.station_name or "")
        if op.setup_min == 0:
            return f"{token}({op.run_min})"
        return f"{token}({op.setup_min}+{op.run_min})"
    if resolution.kind == "outsourced":
        provider_token = _station_dsl_name(resolution.provider_name or "")
        return f"ST:{provider_token}({resolution.days}j):{resolution.action_type}"
    raise ValueError(f"Cannot build DSL for kind={resolution.kind}")
