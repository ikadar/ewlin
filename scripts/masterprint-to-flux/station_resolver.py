"""Applique les règles métier de mapping NUSEC -> station Flux."""

from __future__ import annotations

import re
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
    # Per-NUSEC duration adjustments (None = use op.setup_min / op.run_min unchanged).
    # Driven by `normalize:` block on the mapping rule.
    setup_min_override: int | None = None
    run_min_override: int | None = None
    # When true, to_dsl_line emits "STATION(0+X)" verbatim even if setup is 0.
    force_setup_run_format: bool = False


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


_LIBOP_NOISE_RE = re.compile(
    r'\b(?:DEVIS|devis)\s+[\w/.-]+|'   # "DEVIS M4473", "DEVIS DE00002040"
    r'\bAF\s?\d+\b|'                     # "AF 37", "AF37" (when used as action prefix)
    r'\bS/T\s+|'                          # "S/T " prefix
    r'\bDE\d{8,}\b|'                      # long reference numbers "DE0000206701"
    r'[RV]°',                             # "R°", "V°" (recto/verso marks)
    re.IGNORECASE,
)


def _clean_libop_as_action(libop: str, strip_extra: list[str] | None = None) -> str:
    """Clean LIBOP text into a usable action_type description.

    strip_extra: additional substrings to remove (e.g. matched provider name).
    """
    cleaned = _LIBOP_NOISE_RE.sub("", libop)
    if strip_extra:
        for s in strip_extra:
            cleaned = re.sub(re.escape(s), "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\s*[-–/]+\s*$', '', cleaned)
    cleaned = re.sub(r'^\s*[-–/]+\s*', '', cleaned)
    cleaned = re.sub(r'\s{2,}', ' ', cleaned).strip()
    if not cleaned:
        return "divers"
    return cleaned[:80].lower()


def _resolve_outsourced_details(op: Operation, outsourcing: dict) -> tuple[str, str]:
    """Extract (provider_name, action_type) from an ST operation.

    Resolution order:
      1. CDMAC rules (PLB → Pelliculage ST / pelliculage brillant)
      2. LIBOP keyword rules (first match wins)
      3. Fallback: provider=default, action_type from cleaned LIBOP
    """
    default_provider = outsourcing.get("default_provider", "Inconnu")
    default_action = outsourcing.get("default_action_type", "divers")
    libop = (op.libop or "").strip()

    # Tier 1: CDMAC-based (pelliculage, vernis — typed operations)
    cdmac_rules = outsourcing.get("cdmac_rules", {})
    if op.cdmac and op.cdmac in cdmac_rules:
        rule = cdmac_rules[op.cdmac]
        return rule.get("provider", default_provider), rule.get("action_type", default_action)

    # Tier 2: LIBOP keyword matching (known providers)
    if libop:
        libop_upper = libop.upper()
        for rule in outsourcing.get("provider_rules", []):
            match_str = rule.get("match", "").upper()
            if match_str and match_str in libop_upper:
                provider = rule.get("provider", default_provider)
                if "action_type" in rule:
                    action = rule["action_type"]
                else:
                    action = _clean_libop_as_action(
                        libop,
                        strip_extra=[rule.get("provider", ""), rule.get("match", "")],
                    )
                return provider, action

    # Tier 3: Fallback — generic "Sous-Traitance" or empty LIBOP
    if not libop or libop.lower() in ("sous-traitance", "sous traitance"):
        return default_provider, default_action

    return default_provider, _clean_libop_as_action(libop)


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
        provider_name, action_type = _resolve_outsourced_details(op, outsourcing)
        return Resolution(
            kind="outsourced",
            provider_name=provider_name,
            action_type=action_type,
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

    resolution = Resolution(kind="station", station_name=station_name)
    _apply_normalize(resolution, rule.get("normalize"), op)
    return resolution


def _apply_normalize(resolution: Resolution, normalize: dict | None, op: Operation) -> None:
    """Mutate `resolution` with duration overrides from the rule's `normalize:` block.

    Supported keys:
      collapse_to_run: bool  → setup = 0, run = setup + run (sum into run, force 0+X format).
      min_total_minutes: int → final total (setup_override + run_override) bumped to this floor.
    """
    if not normalize:
        return

    setup = op.setup_min
    run = op.run_min

    if normalize.get("collapse_to_run"):
        run = setup + run
        setup = 0
        resolution.force_setup_run_format = True

    floor = normalize.get("min_total_minutes")
    if floor is not None and (setup + run) < floor:
        # Bump the run side so setup stays whatever the collapse step decided.
        run = floor - setup

    resolution.setup_min_override = setup
    resolution.run_min_override = run


def to_dsl_line(op: Operation, resolution: Resolution) -> str:
    """Construit la ligne DSL pour une résolution donnée."""
    if resolution.kind == "station":
        token = _station_dsl_name(resolution.station_name or "")
        setup = resolution.setup_min_override if resolution.setup_min_override is not None else op.setup_min
        run = resolution.run_min_override if resolution.run_min_override is not None else op.run_min
        if setup == 0 and not resolution.force_setup_run_format:
            return f"{token}({run})"
        return f"{token}({setup}+{run})"
    if resolution.kind == "outsourced":
        provider_token = _station_dsl_name(resolution.provider_name or "")
        return f"ST:{provider_token}({resolution.days}j):{resolution.action_type}"
    raise ValueError(f"Cannot build DSL for kind={resolution.kind}")
