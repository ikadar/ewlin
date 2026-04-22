/// Dynamic schedule grid that grows as needed.
///
/// Uses flat Vec storage with manual 2D indexing:
/// - station_ticks[station * num_ticks + tick] = Some(action_idx) if occupied
/// - operator_stations[operator * num_ticks + tick] = which stations the
///   operator is currently assigned to (max 2 per tick — masked time pairing)
/// - operator_attention[operator * num_ticks + tick] = total attention given
///
/// `operator_stations` and `operator_attention` are kept in sync by
/// assign_operator/clear_operator. The attention sum is the legacy gating
/// mechanism (still consulted by find_operators_for_station). The stations
/// array is the new source of truth that Phase 2b will switch the algorithm
/// over to (concurrent groups model).
pub struct ScheduleGrid {
    pub num_stations: usize,
    pub num_operators: usize,
    pub num_ticks: usize,
    pub tick_minutes: u32,
    /// station_ticks[station * num_ticks + tick] -> Option<action_idx>
    station_ticks: Vec<Option<usize>>,
    /// operator_stations[operator * num_ticks + tick] -> stations the
    /// operator is on at this tick. Capped at 2 (the masked time max).
    operator_stations: Vec<[Option<usize>; 2]>,
    /// operator_attention[operator * num_ticks + tick] -> attention level
    operator_attention: Vec<f64>,
    /// group_active[group * num_ticks + tick] -> active station count in that group
    num_groups: usize,
    group_active: Vec<u32>,
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
            operator_stations: vec![[None, None]; num_operators * num_ticks],
            operator_attention: vec![0.0; num_operators * num_ticks],
            num_groups: 0,
            group_active: Vec::new(),
        }
    }

    /// Grow the grid by additional_ticks, appending None/0.0 for new slots.
    /// We must rebuild the flat arrays since the stride (num_ticks) changes.
    pub fn grow(&mut self, additional_ticks: usize) {
        let old_num_ticks = self.num_ticks;
        let new_num_ticks = old_num_ticks + additional_ticks;

        // Rebuild station_ticks
        let mut new_station_ticks = vec![None; self.num_stations * new_num_ticks];
        for s in 0..self.num_stations {
            for t in 0..old_num_ticks {
                new_station_ticks[s * new_num_ticks + t] = self.station_ticks[s * old_num_ticks + t];
            }
        }
        self.station_ticks = new_station_ticks;

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

        // Rebuild group_active
        if self.num_groups > 0 {
            let mut new_group_active = vec![0u32; self.num_groups * new_num_ticks];
            for g in 0..self.num_groups {
                for t in 0..old_num_ticks {
                    new_group_active[g * new_num_ticks + t] = self.group_active[g * old_num_ticks + t];
                }
            }
            self.group_active = new_group_active;
        }

        self.num_ticks = new_num_ticks;
    }

    /// Check if a station is free at tick t
    pub fn is_station_free(&self, station: usize, t: usize) -> bool {
        if t >= self.num_ticks || station >= self.num_stations {
            return false;
        }
        self.station_ticks[station * self.num_ticks + t].is_none()
    }

    /// Count contiguous ticks starting at `t` where the station is free.
    /// Scans up to `max_ticks` cells or `num_ticks - t`, whichever is smaller.
    /// Returns 0 if `t` itself is occupied / out of bounds.
    ///
    /// This is the "forward available window" primitive used by the main-loop
    /// scoring filter to decide whether a candidate start tick is worth it.
    /// Operator availability is checked separately — callers intersect the
    /// two (station AND operator) to get the true work window.
    pub fn station_free_run_from(&self, station: usize, t: usize, max_ticks: usize) -> usize {
        if station >= self.num_stations || t >= self.num_ticks {
            return 0;
        }
        let cap = (self.num_ticks - t).min(max_ticks);
        let base = station * self.num_ticks + t;
        let mut run = 0usize;
        while run < cap {
            if self.station_ticks[base + run].is_some() {
                break;
            }
            run += 1;
        }
        run
    }

    /// Assign a station at tick t to an action
    pub fn assign_station(&mut self, station: usize, t: usize, action_idx: usize) {
        if t < self.num_ticks && station < self.num_stations {
            self.station_ticks[station * self.num_ticks + t] = Some(action_idx);
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

    /// Clear a station assignment at tick t
    pub fn clear_station(&mut self, station: usize, t: usize) {
        if t < self.num_ticks && station < self.num_stations {
            self.station_ticks[station * self.num_ticks + t] = None;
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

    /// Initialize group tracking with the given number of groups.
    pub fn init_groups(&mut self, num_groups: usize) {
        self.num_groups = num_groups;
        self.group_active = vec![0u32; num_groups * self.num_ticks];
    }

    /// Get the number of active stations in a group at tick t.
    pub fn group_active_count(&self, group: usize, t: usize) -> u32 {
        if group >= self.num_groups || t >= self.num_ticks {
            return 0;
        }
        self.group_active[group * self.num_ticks + t]
    }

    /// Increment the active count for a group at tick t.
    pub fn increment_group(&mut self, group: usize, t: usize) {
        if group < self.num_groups && t < self.num_ticks {
            self.group_active[group * self.num_ticks + t] += 1;
        }
    }

    /// Decrement the active count for a group at tick t.
    pub fn decrement_group(&mut self, group: usize, t: usize) {
        if group < self.num_groups && t < self.num_ticks {
            self.group_active[group * self.num_ticks + t] =
                self.group_active[group * self.num_ticks + t].saturating_sub(1);
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
