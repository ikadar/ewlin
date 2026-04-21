//! Practicity score calculator (Phase 3 Rust port).
//!
//! Mirrors `services/php-api/src/Service/SimilarityScoreCalculator.php` and
//! `apps/web/src/utils/similarityScore.ts`. The three implementations MUST
//! stay in lockstep — tests share the same truth tables so drift breaks on
//! the side that hasn't been updated.
//!
//! The engine consumes this via a new `compatibility_bonus` term in the
//! forward-pass scoring sum (see `crate::engine::forward_pass`).
//!
//! ## Inputs
//! - `SpecSnapshot` — the three `ElementSpec` fields consulted by any
//!   similarity criterion today (`papier`, `format`, `impression`). Built
//!   once per action in `engine/mod.rs` from `element.spec`, so we don't
//!   touch the raw JSON on the scoring hot path.
//! - `SimilarityCriterion` + `SimilarityScoreRule` — shipped per
//!   `StationInput` by the PHP payload. See `crate::model::station`.
//!
//! ## Output
//! - `compute_similarity_score` → `f64`, the points contribution. Always
//!   `>= 0`. `0` means "no compatibility bonus applies" (either score-0
//!   transition or absent data).
//!
//! ## Paper DSL special-case
//! `paper_type` / `paper_weight` both read `spec.papier` because the field
//! is DSL-encoded (`"Couché mat:135"`). Parsing happens inline via
//! `parse_papier`.

use crate::model::station::{RuleKind, SimilarityCriterion, SimilarityScoreRule};

/// Points-per-unit scale applied to the similarity score in the forward
/// pass. Offset max 7 × SCALE 10 → compatibility_bonus ∈ [0, 70], roughly
/// comparable to `proximity_bonus` (~45–90). Tunable at the forward_pass
/// call site via `score_weights[6]`.
pub const BONUS_SCALE: f64 = 10.0;

/// Three ElementSpec fields relevant to similarity today. Extracted once per
/// action at build time so the scoring hot path doesn't parse JSON.
#[derive(Debug, Clone, Default)]
pub struct SpecSnapshot {
    pub papier: Option<String>,
    pub format: Option<String>,
    pub impression: Option<String>,
}

impl SpecSnapshot {
    /// Extract from an `ElementInput.spec` JSON value. Non-string values
    /// coerce to `None` since all three spec fields are string-valued at
    /// the DB level.
    pub fn from_spec_json(spec: Option<&serde_json::Value>) -> Self {
        let Some(obj) = spec.and_then(|v| v.as_object()) else {
            return Self::default();
        };
        let read = |k: &str| -> Option<String> {
            obj.get(k).and_then(|v| v.as_str()).map(|s| s.trim().to_string()).filter(|s| !s.is_empty())
        };
        Self {
            papier: read("papier"),
            format: read("format"),
            impression: read("impression"),
        }
    }
}

/// Compute the practicity score between two consecutive specs on a station
/// whose scoring rules are supplied. Returns 0.0 when the rule set is
/// empty, the data is too incomplete to resolve any rule, or no rule fires.
pub fn compute_similarity_score(
    prev: &SpecSnapshot,
    curr: &SpecSnapshot,
    criteria: &[SimilarityCriterion],
    rules: &[SimilarityScoreRule],
) -> f64 {
    if rules.is_empty() {
        return 0.0;
    }

    // Build a map code -> MATCHED (true) / UNMATCHED (false). Missing keys
    // represent NEUTRALIZED criteria (at least one side null/empty).
    let mut match_by_code: std::collections::HashMap<&str, bool> = std::collections::HashMap::new();
    for c in criteria {
        let Some(code) = c.code.as_deref() else { continue; };
        if let Some(state) = resolve_criterion(code, c.field_path.as_deref(), prev, curr) {
            match_by_code.insert(code, state);
        }
    }

    // Collect firing rules
    let mut fired: Vec<&SimilarityScoreRule> = Vec::new();
    for rule in rules {
        if rule_fires(rule, &match_by_code, prev, curr) {
            fired.push(rule);
        }
    }

    // Group resolution: best-in-group for grouped rules, all non-grouped kept
    let mut non_grouped_sum = 0.0f64;
    let mut best_per_group: std::collections::HashMap<&str, f64> = std::collections::HashMap::new();
    for rule in fired {
        match rule.group.as_deref() {
            None => non_grouped_sum += rule.points,
            Some(g) => {
                let entry = best_per_group.entry(g).or_insert(f64::NEG_INFINITY);
                if rule.points > *entry {
                    *entry = rule.points;
                }
            }
        }
    }
    non_grouped_sum + best_per_group.values().copied().sum::<f64>()
}

/// Per-criterion match resolution. Returns:
/// - `Some(true)` MATCHED
/// - `Some(false)` UNMATCHED
/// - `None` NEUTRALIZED (data missing on at least one side, rule can't fire)
fn resolve_criterion(
    code: &str,
    field_path: Option<&str>,
    prev: &SpecSnapshot,
    curr: &SpecSnapshot,
) -> Option<bool> {
    let (p, c) = match code {
        "paper_type" => (papier_sub(prev, PaperSub::Type), papier_sub(curr, PaperSub::Type)),
        "paper_weight" => (papier_sub(prev, PaperSub::Grammage), papier_sub(curr, PaperSub::Grammage)),
        _ => {
            let fp = field_path?;
            (read_raw(prev, fp), read_raw(curr, fp))
        }
    };
    match (p, c) {
        (Some(a), Some(b)) => Some(a == b),
        _ => None,
    }
}

fn read_raw(snap: &SpecSnapshot, field: &str) -> Option<String> {
    match field {
        "papier" => snap.papier.clone(),
        "format" => snap.format.clone(),
        "impression" => snap.impression.clone(),
        _ => None,
    }
}

enum PaperSub { Type, Grammage }

fn papier_sub(snap: &SpecSnapshot, sub: PaperSub) -> Option<String> {
    let raw = snap.papier.as_deref()?;
    let (t, g) = parse_papier(raw);
    match sub {
        PaperSub::Type => if t.is_empty() { None } else { Some(t) },
        // Parser appends 'g' when a colon is present with empty grammage part.
        // Treat a lone "g" as "no grammage info" to stay consistent with PHP/TS.
        PaperSub::Grammage => if g.is_empty() || g == "g" { None } else { Some(g) },
    }
}

/// Port of `papierDSL.ts::parsePapierDSL` — "Type:grammage" split, with the
/// `g` suffix appended when a colon is present. Empty input → empty pair.
pub fn parse_papier(raw: &str) -> (String, String) {
    match raw.find(':') {
        None => (raw.trim().to_string(), String::new()),
        Some(idx) => (
            raw[..idx].trim().to_string(),
            format!("{}g", raw[idx + 1..].trim()),
        ),
    }
}

fn rule_fires(
    rule: &SimilarityScoreRule,
    match_by_code: &std::collections::HashMap<&str, bool>,
    prev: &SpecSnapshot,
    curr: &SpecSnapshot,
) -> bool {
    match rule.kind {
        RuleKind::FormatDescending => format_is_descending(prev, curr),
        RuleKind::AllMatch => rule
            .criteria_codes
            .iter()
            .all(|code| match_by_code.get(code.as_str()).copied() == Some(true)),
    }
}

fn format_is_descending(prev: &SpecSnapshot, curr: &SpecSnapshot) -> bool {
    let (Some(p), Some(c)) = (long_side(prev.format.as_deref()), long_side(curr.format.as_deref())) else {
        return false;
    };
    p > c
}

// ─── Format DSL — long-side extraction (port of PHP / TS sibling) ───────

/// ISO / SRA / RA long-side in millimetres. Lowercase keys — caller trims
/// and lowercases the input before lookup.
fn iso_long_side(code: &str) -> Option<u32> {
    match code {
        "a0" => Some(1189), "a1" => Some(841), "a2" => Some(594), "a3" => Some(420),
        "a4" => Some(297),  "a5" => Some(210), "a6" => Some(148), "a7" => Some(105),
        "a8" => Some(74),   "a9" => Some(52),  "a10" => Some(37),
        "b0" => Some(1414), "b1" => Some(1000), "b2" => Some(707), "b3" => Some(500),
        "b4" => Some(353),  "b5" => Some(250),  "b6" => Some(176), "b7" => Some(125),
        "b8" => Some(88),   "b9" => Some(62),   "b10" => Some(44),
        "sra0" => Some(1280), "sra1" => Some(900), "sra2" => Some(640),
        "sra3" => Some(450),  "sra4" => Some(320),
        "ra0" => Some(1220), "ra1" => Some(860), "ra2" => Some(610),
        "ra3" => Some(430),  "ra4" => Some(305),
        _ => None,
    }
}

/// Long-side extractor. See PHP `FormatDSLParser::longSide` / TS `longSide`.
pub fn long_side(format: Option<&str>) -> Option<u32> {
    let raw = format?.trim();
    if raw.is_empty() {
        return None;
    }
    let trimmed = raw.to_lowercase();

    // Composite "A3/A6" → max of each part's long side
    if trimmed.contains('/') {
        let mut best: Option<u32> = None;
        for part in trimmed.split('/') {
            if let Some(v) = long_side(Some(part.trim())) {
                best = Some(best.map_or(v, |b| b.max(v)));
            }
        }
        return best;
    }

    // Strip trailing "(poses)"
    let cleaned = strip_parens(&trimmed);

    // LxH / L×H (with optional spaces)
    if let Some((a, b)) = parse_dims(&cleaned) {
        return Some(a.max(b).round() as u32);
    }

    // ISO / SRA / RA
    if let Some(v) = iso_long_side(&cleaned) {
        return Some(v);
    }

    // Lone number
    if let Ok(n) = cleaned.parse::<f64>() {
        return Some(n.round() as u32);
    }

    None
}

fn strip_parens(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut depth = 0u32;
    for ch in s.chars() {
        match ch {
            '(' => depth += 1,
            ')' if depth > 0 => depth -= 1,
            c if depth == 0 => out.push(c),
            _ => {}
        }
    }
    out.trim().to_string()
}

fn parse_dims(s: &str) -> Option<(f64, f64)> {
    // Match the first digit run, optional spaces, x/× separator, optional spaces, second digit run.
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < bytes.len() && !bytes[i].is_ascii_digit() {
        i += 1;
    }
    let start_a = i;
    while i < bytes.len() && (bytes[i].is_ascii_digit() || bytes[i] == b'.') {
        i += 1;
    }
    if start_a == i {
        return None;
    }
    let a: f64 = s[start_a..i].parse().ok()?;

    // Skip spaces
    while i < bytes.len() && bytes[i] == b' ' {
        i += 1;
    }
    // Separator: 'x', 'X' or '×' (multi-byte UTF-8)
    let sep_len = if i < bytes.len() && (bytes[i] == b'x' || bytes[i] == b'X') {
        1
    } else if s[i..].starts_with('×') {
        '×'.len_utf8()
    } else {
        return None;
    };
    i += sep_len;

    while i < bytes.len() && bytes[i] == b' ' {
        i += 1;
    }
    let start_b = i;
    while i < bytes.len() && (bytes[i].is_ascii_digit() || bytes[i] == b'.') {
        i += 1;
    }
    if start_b == i {
        return None;
    }
    let b: f64 = s[start_b..i].parse().ok()?;
    Some((a, b))
}

// ─── Tests ──────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn criterion(code: &str, field_path: &str) -> SimilarityCriterion {
        SimilarityCriterion {
            code: Some(code.to_string()),
            name: Some(code.to_string()),
            field_path: Some(field_path.to_string()),
        }
    }

    fn rule(codes: &[&str], points: f64, group: Option<&str>, kind: RuleKind) -> SimilarityScoreRule {
        SimilarityScoreRule {
            criteria_codes: codes.iter().map(|s| s.to_string()).collect(),
            points,
            group: group.map(|s| s.to_string()),
            kind,
        }
    }

    fn offset_criteria() -> Vec<SimilarityCriterion> {
        vec![
            criterion("paper_type", "papier"),
            criterion("paper_format", "format"),
            criterion("inking", "impression"),
        ]
    }

    fn offset_rules() -> Vec<SimilarityScoreRule> {
        vec![
            rule(&["inking"], 4.0, None, RuleKind::AllMatch),
            rule(&["paper_type", "paper_format"], 3.0, Some("paper"), RuleKind::AllMatch),
            rule(&["paper_format"], 2.0, Some("paper"), RuleKind::AllMatch),
            rule(&["paper_format"], 1.0, Some("paper"), RuleKind::FormatDescending),
        ]
    }

    fn spec(papier: Option<&str>, format: Option<&str>, impression: Option<&str>) -> SpecSnapshot {
        SpecSnapshot {
            papier: papier.map(String::from),
            format: format.map(String::from),
            impression: impression.map(String::from),
        }
    }

    // ─── Papier DSL ─────
    #[test]
    fn parse_papier_colon() {
        assert_eq!(parse_papier("Couché mat:135"), ("Couché mat".into(), "135g".into()));
    }

    #[test]
    fn parse_papier_no_colon() {
        assert_eq!(parse_papier("Offset"), ("Offset".into(), "".into()));
    }

    #[test]
    fn parse_papier_empty() {
        assert_eq!(parse_papier(""), ("".into(), "".into()));
    }

    // ─── Format long-side ─────
    #[test]
    fn long_side_custom() {
        assert_eq!(long_side(Some("50x70")), Some(70));
        assert_eq!(long_side(Some("70x50")), Some(70));
        assert_eq!(long_side(Some("50 X 70")), Some(70));
        assert_eq!(long_side(Some("50×70")), Some(70));
        assert_eq!(long_side(Some("50x70(8)")), Some(70));
    }

    #[test]
    fn long_side_iso() {
        assert_eq!(long_side(Some("A3")), Some(420));
        assert_eq!(long_side(Some("a4")), Some(297));
        assert_eq!(long_side(Some("SRA3")), Some(450));
        assert_eq!(long_side(Some("RA3")), Some(430));
    }

    #[test]
    fn long_side_composite() {
        assert_eq!(long_side(Some("A3/A6")), Some(420));
        assert_eq!(long_side(Some("50x70/A4")), Some(297));
    }

    #[test]
    fn long_side_edges() {
        assert_eq!(long_side(None), None);
        assert_eq!(long_side(Some("")), None);
        assert_eq!(long_side(Some("   ")), None);
        assert_eq!(long_side(Some("not a format")), None);
        assert_eq!(long_side(Some("70")), Some(70));
    }

    // ─── Offset truth table (max = 7) — mirrors PHP / TS suites ─────
    // Base uses A4 so different-format cases default to ASCENDING (R4 quiet).
    fn offset_base() -> SpecSnapshot {
        spec(Some("Couché mat:135"), Some("A4"), Some("CMYK"))
    }

    #[test]
    fn offset_all_different_ascending() {
        let c = spec(Some("Offset:120"), Some("A3"), Some("NB"));
        assert_eq!(compute_similarity_score(&offset_base(), &c, &offset_criteria(), &offset_rules()), 0.0);
    }

    #[test]
    fn offset_pf_only() {
        let c = spec(Some("Offset:120"), Some("A4"), Some("NB"));
        assert_eq!(compute_similarity_score(&offset_base(), &c, &offset_criteria(), &offset_rules()), 2.0);
    }

    #[test]
    fn offset_pt_only_ascending() {
        let c = spec(Some("Couché mat:200"), Some("A3"), Some("NB"));
        assert_eq!(compute_similarity_score(&offset_base(), &c, &offset_criteria(), &offset_rules()), 0.0);
    }

    #[test]
    fn offset_pt_pf_wins_over_pf() {
        let c = spec(Some("Couché mat:200"), Some("A4"), Some("NB"));
        assert_eq!(compute_similarity_score(&offset_base(), &c, &offset_criteria(), &offset_rules()), 3.0);
    }

    #[test]
    fn offset_ink_only_ascending() {
        let c = spec(Some("Offset:120"), Some("A3"), Some("CMYK"));
        assert_eq!(compute_similarity_score(&offset_base(), &c, &offset_criteria(), &offset_rules()), 4.0);
    }

    #[test]
    fn offset_ink_plus_pf() {
        let c = spec(Some("Offset:120"), Some("A4"), Some("CMYK"));
        assert_eq!(compute_similarity_score(&offset_base(), &c, &offset_criteria(), &offset_rules()), 6.0);
    }

    #[test]
    fn offset_all_match() {
        let c = spec(Some("Couché mat:135"), Some("A4"), Some("CMYK"));
        assert_eq!(compute_similarity_score(&offset_base(), &c, &offset_criteria(), &offset_rules()), 7.0);
    }

    // ─── R4 descending scenarios ─────
    #[test]
    fn offset_desc_only_no_ink() {
        let p = spec(Some("Couché mat:135"), Some("A3"), Some("CMYK"));
        let c = spec(Some("Offset:120"), Some("A4"), Some("NB"));
        assert_eq!(compute_similarity_score(&p, &c, &offset_criteria(), &offset_rules()), 1.0);
    }

    #[test]
    fn offset_desc_plus_ink() {
        let p = spec(Some("Couché mat:135"), Some("A3"), Some("CMYK"));
        let c = spec(Some("Offset:120"), Some("A4"), Some("CMYK"));
        assert_eq!(compute_similarity_score(&p, &c, &offset_criteria(), &offset_rules()), 5.0);
    }

    #[test]
    fn offset_desc_sra3_to_a3() {
        let p = spec(Some("Couché:135"), Some("SRA3"), Some("CMYK"));
        let c = spec(Some("Offset:80"), Some("A3"), Some("NB"));
        assert_eq!(compute_similarity_score(&p, &c, &offset_criteria(), &offset_rules()), 1.0);
    }

    #[test]
    fn offset_same_format_r4_quiet() {
        let p = spec(Some("Couché:135"), Some("A4"), Some("CMYK"));
        let c = spec(Some("Offset:80"), Some("A4"), Some("NB"));
        assert_eq!(compute_similarity_score(&p, &c, &offset_criteria(), &offset_rules()), 2.0);
    }

    #[test]
    fn offset_desc_garbage_curr_format() {
        let p = spec(Some("Couché:135"), Some("A3"), Some("CMYK"));
        let c = spec(Some("Offset:80"), Some("pouet"), Some("NB"));
        assert_eq!(compute_similarity_score(&p, &c, &offset_criteria(), &offset_rules()), 0.0);
    }

    // ─── Neutralization ─────
    #[test]
    fn offset_missing_ink_neutralizes_r1() {
        let p = spec(Some("Couché mat:135"), Some("A4"), None);
        let c = spec(Some("Couché mat:135"), Some("A4"), None);
        assert_eq!(compute_similarity_score(&p, &c, &offset_criteria(), &offset_rules()), 3.0);
    }

    #[test]
    fn offset_empty_rules_returns_zero() {
        let p = offset_base();
        let c = offset_base();
        assert_eq!(compute_similarity_score(&p, &c, &offset_criteria(), &[]), 0.0);
    }

    // ─── Pelliculeuses / Finition / Massicots — other categories ─────
    #[test]
    fn pelliculeuses_pt_only_gives_0_5() {
        let cat_criteria = vec![
            criterion("paper_type", "papier"),
            criterion("paper_format", "format"),
        ];
        let cat_rules = vec![
            rule(&["paper_format"], 1.0, Some("paper"), RuleKind::AllMatch),
            rule(&["paper_type", "paper_format"], 3.0, Some("paper"), RuleKind::AllMatch),
            rule(&["paper_type"], 0.5, Some("paper"), RuleKind::AllMatch),
        ];
        let p = spec(Some("Couché mat"), Some("A3"), None);
        let c = spec(Some("Couché mat"), Some("A4"), None);
        assert_eq!(compute_similarity_score(&p, &c, &cat_criteria, &cat_rules), 0.5);
    }

    #[test]
    fn finition_pw_plus_pf() {
        let cat_criteria = vec![
            criterion("paper_weight", "papier"),
            criterion("paper_format", "format"),
        ];
        let cat_rules = vec![
            rule(&["paper_format"], 1.0, Some("paper"), RuleKind::AllMatch),
            rule(&["paper_weight", "paper_format"], 3.0, Some("paper"), RuleKind::AllMatch),
        ];
        let p = spec(Some("Couché mat:135"), Some("A3"), None);
        let c = spec(Some("Offset:135"), Some("A3"), None);
        assert_eq!(compute_similarity_score(&p, &c, &cat_criteria, &cat_rules), 3.0);
    }

    #[test]
    fn massicot_format_match() {
        let cat_criteria = vec![criterion("paper_format", "format")];
        let cat_rules = vec![rule(&["paper_format"], 1.0, None, RuleKind::AllMatch)];
        let p = spec(None, Some("A3"), None);
        let c = spec(None, Some("A3"), None);
        assert_eq!(compute_similarity_score(&p, &c, &cat_criteria, &cat_rules), 1.0);
    }

    // ─── SpecSnapshot from JSON ─────
    #[test]
    fn spec_snapshot_from_json() {
        let j = serde_json::json!({
            "papier": "Couché mat:135",
            "format": "50x70",
            "impression": "CMYK",
            "other": "ignored",
        });
        let s = SpecSnapshot::from_spec_json(Some(&j));
        assert_eq!(s.papier.as_deref(), Some("Couché mat:135"));
        assert_eq!(s.format.as_deref(), Some("50x70"));
        assert_eq!(s.impression.as_deref(), Some("CMYK"));
    }

    #[test]
    fn spec_snapshot_empty_strings_treated_as_none() {
        let j = serde_json::json!({ "papier": "", "format": "  ", "impression": "CMYK" });
        let s = SpecSnapshot::from_spec_json(Some(&j));
        assert_eq!(s.papier, None);
        assert_eq!(s.format, None);
        assert_eq!(s.impression.as_deref(), Some("CMYK"));
    }
}
