/// Dynamic schedule grid that grows as needed.
///
/// Uses flat Vec storage with manual 2D indexing:
/// - station_ticks[station * num_ticks + tick] = Some(action_idx) of the
///   first action to claim the cell (representative only — for capacity>1
///   stations additional concurrent actions are tracked via the counter)
/// - station_active[station * num_ticks + tick] = number of actions holding
///   the cell; compared against station_capacity for admission
/// - station_capacity[station] = max concurrent actions a station accepts
///   (defaults to 1; override with init_station_capacities)
/// - operator_stations[operator * num_ticks + tick] = which stations the
///   operator is currently assigned to (max 2 per tick — masked time pairing)
/// - operator_attention[operator * num_ticks + tick] = total attention given
///
/// `operator_stations` and `operator_attention` are kept in sync by
/// assign_operator/clear_operator. The attention sum is the legacy gating
/// mechanism (still consulted by find_operators_for_station). The stations
/// array is the new source of truth that Phase 2b will switch the algorithm
/// over to (concurrent groups model).
///
/// Station capacity: a counter per (station, tick) cell plus a per-station
/// capacity vector, checked at admission. Without this, capacity>1
/// was theoretically free for all (no guard), and even capacity=1 could
/// be silently overwritten when two write paths raced the binary
/// `is_station_free` check.
pub struct ScheduleGrid {
    pub num_stations: usize,
    pub num_operators: usize,
    pub num_ticks: usize,
    pub tick_minutes: u32,
    /// station_ticks[station * num_ticks + tick] -> Option<action_idx>
    /// (representative only when capacity > 1 — see struct docstring)
    station_ticks: Vec<Option<usize>>,
    /// station_active[station * num_ticks + tick] -> active action count
    station_active: Vec<u32>,
    /// station_capacity[station] -> max concurrent actions allowed
    station_capacity: Vec<u32>,
    /// operator_stations[operator * num_ticks + tick] -> stations the
    /// operator is on at this tick. Capped at 2 (the masked time max).
    operator_stations: Vec<[Option<usize>; 2]>,
    /// operator_attention[operator * num_ticks + tick] -> attention level
    operator_attention: Vec<f64>,
}

impl ScheduleGrid {
    pub fn new(
        num_stations: usize,
        num_operators: usize,
        num_ticks: usize,
        tick_minutes: u32,
    ) -> Self {
        Self {
            num_stations,
            num_operators,
            num_ticks,
            tick_minutes,
            station_ticks: vec![None; num_stations * num_ticks],
            station_active: vec![0u32; num_stations * num_ticks],
            station_capacity: vec![1u32; num_stations],
            operator_stations: vec![[None, None]; num_operators * num_ticks],
            operator_attention: vec![0.0; num_operators * num_ticks],
        }
    }

    /// Override the per-station capacity. Capacity defaults to 1 in `new()`;
    /// callers that have multi-slot stations (e.g. two presses sharing a
    /// single station record) install their real values here before seeding
    /// the grid. Silently clamps to 1 for zero/unset slots — a station with
    /// capacity 0 would block all work and is always a misconfig, not a
    /// scheduling choice.
    pub fn init_station_capacities(&mut self, capacities: &[u32]) {
        debug_assert_eq!(
            capacities.len(),
            self.num_stations,
            "init_station_capacities: got {} caps, expected {}",
            capacities.len(),
            self.num_stations,
        );
        for (s, cap) in capacities.iter().enumerate().take(self.num_stations) {
            self.station_capacity[s] = (*cap).max(1);
        }
    }

    /// Grow the grid by additional_ticks, appending None/0.0 for new slots.
    /// We must rebuild the flat arrays since the stride (num_ticks) changes.
    pub fn grow(&mut self, additional_ticks: usize) {
        let old_num_ticks = self.num_ticks;
        let new_num_ticks = old_num_ticks + additional_ticks;

        // Rebuild station_ticks + station_active (capacity is per-station,
        // not per-tick, so it doesn't need to grow).
        let mut new_station_ticks = vec![None; self.num_stations * new_num_ticks];
        let mut new_station_active = vec![0u32; self.num_stations * new_num_ticks];
        for s in 0..self.num_stations {
            for t in 0..old_num_ticks {
                new_station_ticks[s * new_num_ticks + t] = self.station_ticks[s * old_num_ticks + t];
                new_station_active[s * new_num_ticks + t] = self.station_active[s * old_num_ticks + t];
            }
        }
        self.station_ticks = new_station_ticks;
        self.station_active = new_station_active;

        // Rebuild operator_stations + operator_attention
        let mut new_operator_stations = vec![[None, None]; self.num_operators * new_num_ticks];
        let mut new_operator_attention = vec![0.0; self.num_operators * new_num_ticks];
        for o in 0..self.num_operators {
            for t in 0..old_num_ticks {
                new_operator_stations[o * new_num_ticks + t] =
                    self.operator_stations[o * old_num_ticks + t];
                new_operator_attention[o * new_num_ticks + t] =
                    self.operator_attention[o * old_num_ticks + t];
            }
        }
        self.operator_stations = new_operator_stations;
        self.operator_attention = new_operator_attention;

        self.num_ticks = new_num_ticks;
    }

    /// Whether the station still has an open slot at tick t (active < capacity).
    ///
    /// For the common capacity=1 case this is equivalent to the old binary
    /// "cell unoccupied" check. For capacity>1 stations it correctly reports
    /// free as long as at least one slot remains.
    pub fn is_station_free(&self, station: usize, t: usize) -> bool {
        if t >= self.num_ticks || station >= self.num_stations {
            return false;
        }
        let idx = station * self.num_ticks + t;
        self.station_active[idx] < self.station_capacity[station]
    }

    /// Count contiguous ticks starting at `t` where the station still has
    /// an open slot. Scans up to `max_ticks` cells or `num_ticks - t`,
    /// whichever is smaller. Returns 0 if `t` itself is already at capacity
    /// or out of bounds.
    ///
    /// This is the "forward available window" primitive used by the main-loop
    /// scoring filter to decide whether a candidate start tick is worth it.
    /// Operator availability is checked separately — callers intersect the
    /// two (station AND operator) to get the true work window.
    pub fn station_free_run_from(&self, station: usize, t: usize, max_ticks: usize) -> usize {
        if station >= self.num_stations || t >= self.num_ticks {
            return 0;
        }
        let scan = (self.num_ticks - t).min(max_ticks);
        let base = station * self.num_ticks + t;
        let cap = self.station_capacity[station];
        let mut run = 0usize;
        while run < scan {
            if self.station_active[base + run] >= cap {
                break;
            }
            run += 1;
        }
        run
    }

    /// Number of actions currently holding a slot on station at tick t.
    pub fn station_active_count(&self, station: usize, t: usize) -> u32 {
        if t >= self.num_ticks || station >= self.num_stations {
            return 0;
        }
        self.station_active[station * self.num_ticks + t]
    }

    /// Claim a station slot at tick t for an action.
    ///
    /// Contract (mirrors the existing permissive style of the grid):
    ///   - Calling twice with the same action_idx on the same cell is a
    ///     no-op (idempotent; matches the legacy overwrite-with-self).
    ///   - Calling on a cell that already holds `capacity` *distinct* actions
    ///     is a bug at the call site — the caller was expected to have
    ///     checked `is_station_free` first. Trips `debug_assert!` in dev;
    ///     silently drops in release to preserve the engine's no-panic
    ///     contract.
    ///   - `station_ticks` stores only the first action's idx as a
    ///     representative. For capacity>1, concurrent actions increment
    ///     the counter but do not overwrite the representative.
    pub fn assign_station(&mut self, station: usize, t: usize, action_idx: usize) {
        if t >= self.num_ticks || station >= self.num_stations {
            return;
        }
        let idx = station * self.num_ticks + t;
        if self.station_ticks[idx] == Some(action_idx) {
            return;
        }
        debug_assert!(
            self.station_active[idx] < self.station_capacity[station],
            "station {} at tick {} is at capacity ({}/{}): caller must check is_station_free first",
            station,
            t,
            self.station_active[idx],
            self.station_capacity[station],
        );
        if self.station_active[idx] >= self.station_capacity[station] {
            return;
        }
        self.station_active[idx] += 1;
        if self.station_ticks[idx].is_none() {
            self.station_ticks[idx] = Some(action_idx);
        }
    }

    /// Assign an operator at tick t to a station with given attention.
    ///
    /// Updates both `operator_stations` (the new source-of-truth for which
    /// stations the operator is on) and `operator_attention` (legacy
    /// fractional bookkeeping consumed by find_operators_for_station).
    /// If the operator is already assigned to this station at this tick,
    /// the station is not added twice (attention still accumulates — that
    /// matches the legacy behavior where the same station could be
    /// assigned multiple ticks during incremental scheduling).
    pub fn assign_operator(
        &mut self,
        operator: usize,
        t: usize,
        station: usize,
        attention: f64,
    ) {
        if t < self.num_ticks && operator < self.num_operators {
            // ADD attention (not set) — an operator can work on multiple stations
            // at the same tick (e.g., monitoring a masked station + active work on another)
            self.operator_attention[operator * self.num_ticks + t] += attention;

            // Track station occupancy (max 2 per tick — masked time pairing).
            // If both slots are full and the new station isn't already among
            // them, log and drop — this should be impossible under the
            // current scheduler but we don't want a panic in production.
            let slots = &mut self.operator_stations[operator * self.num_ticks + t];
            if slots[0] == Some(station) || slots[1] == Some(station) {
                return;
            }
            if slots[0].is_none() {
                slots[0] = Some(station);
            } else if slots[1].is_none() {
                slots[1] = Some(station);
            } else {
                eprintln!(
                    "[GRID] operator {} tick {} already has 2 stations ({:?}, {:?}); dropping {}",
                    operator, t, slots[0], slots[1], station
                );
            }
        }
    }

    /// Clear an operator's tick-t state entirely (attention reset to 0,
    /// both station slots cleared). Used by the caleur volant borrow
    /// machinery (P3b) to "steal" an operator from the run-phase action
    /// they were initially assigned to. After clearing, a fresh
    /// `assign_operator` call places them on the borrow target station.
    /// The borrow source action is expected to have its `borrow_until_tick`
    /// flagged so peremption is gated while the op is away.
    pub fn clear_operator_at_tick(&mut self, operator: usize, t: usize) {
        if t < self.num_ticks && operator < self.num_operators {
            self.operator_attention[operator * self.num_ticks + t] = 0.0;
            self.operator_stations[operator * self.num_ticks + t] = [None, None];
        }
    }

    /// Get remaining attention capacity for an operator at tick t
    pub fn operator_remaining_attention(&self, operator: usize, t: usize) -> f64 {
        if t >= self.num_ticks || operator >= self.num_operators {
            return 0.0;
        }
        let used = self.operator_attention[operator * self.num_ticks + t];
        (1.0 - used).max(0.0)
    }

    /// Stations the operator is currently assigned to at tick t.
    /// Returns up to 2 station indices; None entries are unused slots.
    pub fn operator_stations_at(&self, operator: usize, t: usize) -> [Option<usize>; 2] {
        if t >= self.num_ticks || operator >= self.num_operators {
            return [None, None];
        }
        self.operator_stations[operator * self.num_ticks + t]
    }

    /// How many stations the operator is on at tick t (0, 1, or 2).
    pub fn operator_load_count(&self, operator: usize, t: usize) -> usize {
        let slots = self.operator_stations_at(operator, t);
        slots.iter().filter(|s| s.is_some()).count()
    }

    /// Whether the operator has no assignments at tick t.
    pub fn operator_is_idle(&self, operator: usize, t: usize) -> bool {
        self.operator_load_count(operator, t) == 0
    }

    /// Get which action is assigned to a station at tick t
    pub fn station_action_at(&self, station: usize, t: usize) -> Option<usize> {
        if t >= self.num_ticks || station >= self.num_stations {
            return None;
        }
        self.station_ticks[station * self.num_ticks + t]
    }

    /// Fully vacate a station cell at tick t (all slots released).
    ///
    /// Resets both the representative action and the active counter. We vacate
    /// atomically because the grid does not track which individual slot
    /// belongs to which action when capacity>1 — there is nothing to
    /// selectively remove. Callers that need per-action removal would need
    /// the multi-occupant variant, which is out of scope as long as capacity
    /// remains 1 for every real station in production.
    pub fn clear_station(&mut self, station: usize, t: usize) {
        if t < self.num_ticks && station < self.num_stations {
            let idx = station * self.num_ticks + t;
            self.station_ticks[idx] = None;
            self.station_active[idx] = 0;
        }
    }

    /// Clear ALL operator assignments at tick t.
    pub fn clear_operator(&mut self, operator: usize, t: usize) {
        if t < self.num_ticks && operator < self.num_operators {
            self.operator_stations[operator * self.num_ticks + t] = [None, None];
            self.operator_attention[operator * self.num_ticks + t] = 0.0;
        }
    }

    /// Remove a single station assignment for an operator at tick t,
    /// leaving any other station the operator may have been on intact.
    /// Used by rollback in the Phase 2b concurrent groups model.
    pub fn unassign_operator_from_station(&mut self, operator: usize, t: usize, station: usize) {
        if t >= self.num_ticks || operator >= self.num_operators {
            return;
        }
        let slots = &mut self.operator_stations[operator * self.num_ticks + t];
        if slots[0] == Some(station) {
            slots[0] = None;
        }
        if slots[1] == Some(station) {
            slots[1] = None;
        }
        // If both slots are now empty, also reset the legacy attention.
        if slots[0].is_none() && slots[1].is_none() {
            self.operator_attention[operator * self.num_ticks + t] = 0.0;
        }
    }

}

#[cfg(test)]
mod operator_stations_tests {
    use super::*;

    #[test]
    fn idle_operator_starts_empty() {
        let grid = ScheduleGrid::new(2, 1, 10, 15);
        assert!(grid.operator_is_idle(0, 5));
        assert_eq!(grid.operator_load_count(0, 5), 0);
        assert_eq!(grid.operator_stations_at(0, 5), [None, None]);
    }

    #[test]
    fn assign_one_station_tracks_load() {
        let mut grid = ScheduleGrid::new(2, 1, 10, 15);
        grid.assign_operator(0, 5, 1, 0.5);
        assert!(!grid.operator_is_idle(0, 5));
        assert_eq!(grid.operator_load_count(0, 5), 1);
        assert_eq!(grid.operator_stations_at(0, 5), [Some(1), None]);
        // Legacy attention tracking still updated.
        assert_eq!(grid.operator_remaining_attention(0, 5), 0.5);
    }

    #[test]
    fn assign_two_stations_fills_both_slots() {
        let mut grid = ScheduleGrid::new(3, 1, 10, 15);
        grid.assign_operator(0, 5, 1, 0.5);
        grid.assign_operator(0, 5, 2, 0.3);
        assert_eq!(grid.operator_load_count(0, 5), 2);
        assert_eq!(grid.operator_stations_at(0, 5), [Some(1), Some(2)]);
    }

    #[test]
    fn reassigning_same_station_does_not_duplicate() {
        let mut grid = ScheduleGrid::new(2, 1, 10, 15);
        grid.assign_operator(0, 5, 1, 0.3);
        grid.assign_operator(0, 5, 1, 0.3);
        assert_eq!(grid.operator_load_count(0, 5), 1);
        // But attention still accumulates (legacy behavior).
        assert_eq!(grid.operator_remaining_attention(0, 5), 0.4);
    }

    #[test]
    fn clear_operator_wipes_both_slots_and_attention() {
        let mut grid = ScheduleGrid::new(3, 1, 10, 15);
        grid.assign_operator(0, 5, 1, 0.5);
        grid.assign_operator(0, 5, 2, 0.3);
        grid.clear_operator(0, 5);
        assert!(grid.operator_is_idle(0, 5));
        assert_eq!(grid.operator_remaining_attention(0, 5), 1.0);
    }

    #[test]
    fn grid_grow_preserves_operator_stations() {
        let mut grid = ScheduleGrid::new(2, 1, 5, 15);
        grid.assign_operator(0, 3, 1, 0.5);
        grid.grow(10);
        assert_eq!(grid.operator_stations_at(0, 3), [Some(1), None]);
        assert_eq!(grid.operator_remaining_attention(0, 3), 0.5);
        assert!(grid.operator_is_idle(0, 10));
    }
}

#[cfg(test)]
mod station_capacity_tests {
    use super::*;

    #[test]
    fn default_capacity_is_one() {
        let mut grid = ScheduleGrid::new(2, 1, 10, 15);
        grid.assign_station(0, 5, 42);
        assert!(!grid.is_station_free(0, 5));
        assert_eq!(grid.station_active_count(0, 5), 1);
    }

    /// Reproduces the Bertrand × Ryobi 528 bug: two distinct actions must
    /// not coexist on a capacity=1 station at the same tick. The caller
    /// check (via `is_station_free`) is the primary defense; the debug
    /// assertion in `assign_station` is the backstop.
    #[test]
    fn capacity_one_rejects_second_action_via_is_station_free() {
        let mut grid = ScheduleGrid::new(1, 1, 10, 15);
        grid.assign_station(0, 5, 7);
        assert!(!grid.is_station_free(0, 5));
        assert_eq!(grid.station_active_count(0, 5), 1);
        assert_eq!(grid.station_action_at(0, 5), Some(7));
    }

    #[test]
    #[should_panic(expected = "at capacity")]
    fn capacity_one_panics_on_conflicting_assign_in_debug() {
        let mut grid = ScheduleGrid::new(1, 1, 10, 15);
        grid.assign_station(0, 5, 7);
        grid.assign_station(0, 5, 8); // different action — must trip the guard
    }

    #[test]
    fn same_action_reassign_is_idempotent() {
        let mut grid = ScheduleGrid::new(1, 1, 10, 15);
        grid.assign_station(0, 5, 7);
        grid.assign_station(0, 5, 7); // same idx — no-op, no panic
        assert_eq!(grid.station_active_count(0, 5), 1);
    }

    #[test]
    fn capacity_two_admits_two_distinct_actions() {
        let mut grid = ScheduleGrid::new(1, 1, 10, 15);
        grid.init_station_capacities(&[2]);
        grid.assign_station(0, 5, 7);
        assert!(grid.is_station_free(0, 5));
        grid.assign_station(0, 5, 8);
        assert!(!grid.is_station_free(0, 5));
        assert_eq!(grid.station_active_count(0, 5), 2);
        // Representative is the first occupant.
        assert_eq!(grid.station_action_at(0, 5), Some(7));
    }

    #[test]
    fn clear_station_vacates_all_slots() {
        let mut grid = ScheduleGrid::new(1, 1, 10, 15);
        grid.init_station_capacities(&[2]);
        grid.assign_station(0, 5, 7);
        grid.assign_station(0, 5, 8);
        grid.clear_station(0, 5);
        assert!(grid.is_station_free(0, 5));
        assert_eq!(grid.station_active_count(0, 5), 0);
        assert_eq!(grid.station_action_at(0, 5), None);
    }

    #[test]
    fn station_free_run_from_stops_at_capacity_edge() {
        let mut grid = ScheduleGrid::new(1, 1, 10, 15);
        grid.init_station_capacities(&[2]);
        // Fully book tick 5 (2 actions, capacity reached), leave 6..10 free.
        grid.assign_station(0, 5, 7);
        grid.assign_station(0, 5, 8);
        assert_eq!(grid.station_free_run_from(0, 3, 10), 2); // ticks 3, 4 free
        assert_eq!(grid.station_free_run_from(0, 5, 10), 0); // 5 at capacity
        assert_eq!(grid.station_free_run_from(0, 6, 10), 4); // 6..9 free
    }

    #[test]
    fn grid_grow_preserves_station_active_counter() {
        let mut grid = ScheduleGrid::new(1, 1, 5, 15);
        grid.init_station_capacities(&[2]);
        grid.assign_station(0, 3, 7);
        grid.assign_station(0, 3, 8);
        grid.grow(10);
        assert_eq!(grid.station_active_count(0, 3), 2);
        assert!(!grid.is_station_free(0, 3));
        assert!(grid.is_station_free(0, 10));
    }

    #[test]
    fn init_capacity_clamps_zero_to_one() {
        let mut grid = ScheduleGrid::new(2, 1, 10, 15);
        grid.init_station_capacities(&[0, 3]);
        grid.assign_station(0, 5, 7);
        assert!(!grid.is_station_free(0, 5)); // 0 clamped to 1 → now full
        for idx in 0..3 {
            grid.assign_station(1, 5, 100 + idx);
        }
        assert_eq!(grid.station_active_count(1, 5), 3);
        assert!(!grid.is_station_free(1, 5));
    }
}
