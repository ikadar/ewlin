"""Tests for split-hash import protection (metadata vs structure)."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import db as db_mod
from masterprint_to_flux import _strip_gate_fields


def _sample_request() -> dict:
    return {
        "reference": "12345-00001",
        "client": "Acme Corp",
        "description": "Brochure 16 pages",
        "quantity": 5000,
        "workshopExitDate": "2026-06-01",
        "deadlinePriority": 2,
        "status": "planned",
        "referent": "MasterPrint",
        "elements": [
            {
                "name": "PAP1",
                "label": "Papier 1",
                "sequence": "G37(30 120)\nMBO(15 60)",
                "papier": "CB300:90",
                "format": "630x880",
                "pagination": 16,
                "qteFeuilles": 2500,
                "prerequisiteNames": [],
                "needsBat": True,
                "needsPaper": True,
                "needsForme": False,
                "needsPlates": True,
                "batStatus": "bat_approved",
            },
            {
                "name": "GLOBAL",
                "label": "Operations transversales",
                "sequence": "Conditionnement(10 30)",
                "prerequisiteNames": ["PAP1"],
                "needsBat": False,
                "needsPaper": False,
                "needsForme": False,
                "needsPlates": False,
            },
        ],
    }


class TestComputeMpStructureHash:
    def test_metadata_change_does_not_affect_structure_hash(self):
        req1 = _sample_request()
        req2 = _sample_request()
        req2["client"] = "Different Client"
        req2["workshopExitDate"] = "2026-07-01"
        req2["quantity"] = 9999

        assert db_mod.compute_mp_structure_hash(req1) == db_mod.compute_mp_structure_hash(req2)

    def test_full_hash_differs_on_metadata_change(self):
        req1 = _sample_request()
        req2 = _sample_request()
        req2["client"] = "Different Client"

        assert db_mod.compute_mp_hash(req1) != db_mod.compute_mp_hash(req2)

    def test_gate_change_does_not_affect_structure_hash(self):
        req1 = _sample_request()
        req2 = _sample_request()
        req2["elements"][0]["needsBat"] = False
        req2["elements"][0]["needsPlates"] = False
        req2["elements"][0]["batStatus"] = "waiting_files"

        assert db_mod.compute_mp_structure_hash(req1) == db_mod.compute_mp_structure_hash(req2)

    def test_full_hash_differs_on_gate_change(self):
        req1 = _sample_request()
        req2 = _sample_request()
        req2["elements"][0]["needsBat"] = False

        assert db_mod.compute_mp_hash(req1) != db_mod.compute_mp_hash(req2)

    def test_dsl_change_affects_structure_hash(self):
        req1 = _sample_request()
        req2 = _sample_request()
        req2["elements"][0]["sequence"] = "G37(60 240)\nMBO(15 60)"

        assert db_mod.compute_mp_structure_hash(req1) != db_mod.compute_mp_structure_hash(req2)

    def test_element_name_change_affects_structure_hash(self):
        req1 = _sample_request()
        req2 = _sample_request()
        req2["elements"][0]["name"] = "COUV"

        assert db_mod.compute_mp_structure_hash(req1) != db_mod.compute_mp_structure_hash(req2)

    def test_spec_change_affects_structure_hash(self):
        req1 = _sample_request()
        req2 = _sample_request()
        req2["elements"][0]["format"] = "450x640"

        assert db_mod.compute_mp_structure_hash(req1) != db_mod.compute_mp_structure_hash(req2)

    def test_prereq_change_affects_structure_hash(self):
        req1 = _sample_request()
        req2 = _sample_request()
        req2["elements"][1]["prerequisiteNames"] = []

        assert db_mod.compute_mp_structure_hash(req1) != db_mod.compute_mp_structure_hash(req2)

    def test_deterministic(self):
        req = _sample_request()
        h1 = db_mod.compute_mp_structure_hash(req)
        h2 = db_mod.compute_mp_structure_hash(req)
        assert h1 == h2
        assert len(h1) == 64  # SHA-256 hex


class TestStripGateFields:
    def test_removes_all_gate_keys(self):
        req = _sample_request()
        stripped = _strip_gate_fields(req)

        for element in stripped["elements"]:
            assert "needsBat" not in element
            assert "needsPaper" not in element
            assert "needsForme" not in element
            assert "needsPlates" not in element
            assert "batStatus" not in element

    def test_preserves_structural_fields(self):
        req = _sample_request()
        stripped = _strip_gate_fields(req)

        assert stripped["elements"][0]["name"] == "PAP1"
        assert stripped["elements"][0]["sequence"] == "G37(30 120)\nMBO(15 60)"
        assert stripped["elements"][0]["papier"] == "CB300:90"
        assert stripped["elements"][0]["prerequisiteNames"] == []

    def test_preserves_job_metadata(self):
        req = _sample_request()
        stripped = _strip_gate_fields(req)

        assert stripped["reference"] == req["reference"]
        assert stripped["client"] == req["client"]
        assert stripped["workshopExitDate"] == req["workshopExitDate"]

    def test_does_not_mutate_original(self):
        req = _sample_request()
        _strip_gate_fields(req)

        assert "needsBat" in req["elements"][0]
        assert "batStatus" in req["elements"][0]


class TestDiffClassification:
    """Verify the diff logic classifies jobs correctly."""

    def test_metadata_only_when_structure_hash_matches(self):
        req = _sample_request()
        struct_hash = db_mod.compute_mp_structure_hash(req)

        req_changed = _sample_request()
        req_changed["client"] = "New Client"
        new_full_hash = db_mod.compute_mp_hash(req_changed)
        new_struct_hash = db_mod.compute_mp_structure_hash(req_changed)

        assert new_struct_hash == struct_hash, "Structure hash should match (only metadata changed)"
        assert new_full_hash != db_mod.compute_mp_hash(req), "Full hash should differ"

    def test_structural_when_dsl_changes(self):
        req = _sample_request()
        struct_hash = db_mod.compute_mp_structure_hash(req)

        req_changed = _sample_request()
        req_changed["elements"][0]["sequence"] = "NEW_STATION(10 20)"
        new_struct_hash = db_mod.compute_mp_structure_hash(req_changed)

        assert new_struct_hash != struct_hash, "Structure hash should differ (DSL changed)"
