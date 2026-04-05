/// Dynamic schedule grid that grows as needed.
///
/// Uses flat Vec storage with manual 2D indexing:
/// - station_ticks[station * num_ticks + tick] = Some(action_idx) if occupied
/// - operator_station[operator * num_ticks + tick] = Some(station_idx) if assigned
/// - operator_attention[operator * num_ticks + tick] = attention level given
pub struct ScheduleGrid {
    pub num_stations: usize,
    pub num_operators: usize,
    pub num_ticks: usize,
    pub tick_minutes: u32,
    /// station_ticks[station * num_ticks + tick] -> Option<action_idx>
    station_ticks: Vec<Option<usize>>,
    /// operator_station[operator * num_ticks + tick] -> Option<station_idx>
    operator_station: Vec<Option<usize>>,
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
            operator_station: vec![None; num_operators * num_ticks],
            operator_attention: vec![0.0; num_operators * num_ticks],
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

        // Rebuild operator_station
        let mut new_operator_station = vec![None; self.num_operators * new_num_ticks];
        let mut new_operator_attention = vec![0.0; self.num_operators * new_num_ticks];
        for o in 0..self.num_operators {
            for t in 0..old_num_ticks {
                new_operator_station[o * new_num_ticks + t] =
                    self.operator_station[o * old_num_ticks + t];
                new_operator_attention[o * new_num_ticks + t] =
                    self.operator_attention[o * old_num_ticks + t];
            }
        }
        self.operator_station = new_operator_station;
        self.operator_attention = new_operator_attention;

        self.num_ticks = new_num_ticks;
    }

    /// Check if a station is free at tick t
    pub fn is_station_free(&self, station: usize, t: usize) -> bool {
        if t >= self.num_ticks || station >= self.num_stations {
            return false;
        }
        self.station_ticks[station * self.num_ticks + t].is_none()
    }

    /// Assign a station at tick t to an action
    pub fn assign_station(&mut self, station: usize, t: usize, action_idx: usize) {
        if t < self.num_ticks && station < self.num_stations {
            self.station_ticks[station * self.num_ticks + t] = Some(action_idx);
        }
    }

    /// Assign an operator at tick t to a station with given attention
    pub fn assign_operator(
        &mut self,
        operator: usize,
        t: usize,
        _station: usize,
        attention: f64,
    ) {
        if t < self.num_ticks && operator < self.num_operators {
            // ADD attention (not set) — an operator can work on multiple stations
            // at the same tick (e.g., monitoring a masked station + active work on another)
            self.operator_attention[operator * self.num_ticks + t] += attention;
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

    /// Clear operator assignments at tick t
    pub fn clear_operator(&mut self, operator: usize, t: usize) {
        if t < self.num_ticks && operator < self.num_operators {
            self.operator_station[operator * self.num_ticks + t] = None;
            self.operator_attention[operator * self.num_ticks + t] = 0.0;
        }
    }
}
