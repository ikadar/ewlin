use std::collections::HashMap;

use chrono::NaiveDate;

use crate::model::job::JobInput;

/// Compute LAST values for all tasks.
/// LAST[task] = the latest tick at which the task can START without making downstream tasks late.
/// Returns HashMap<task_id, LAST in ticks>.
pub fn compute_last_values(
    jobs: &[JobInput],
    tick_minutes: u32,
    start_date: NaiveDate,
) -> HashMap<String, u64> {
    let mut last_values: HashMap<String, u64> = HashMap::new();

    // Sort jobs by deadline DESC (jobs without deadline go last)
    let mut sorted_jobs: Vec<&JobInput> = jobs.iter().collect();
    sorted_jobs.sort_by(|a, b| {
        let da = a.deadline.as_deref().unwrap_or("9999-12-31");
        let db = b.deadline.as_deref().unwrap_or("9999-12-31");
        db.cmp(da) // DESC
    });

    for job in &sorted_jobs {
        let deadline_ticks = job
            .deadline
            .as_ref()
            .and_then(|d| parse_deadline_to_ticks(d, tick_minutes, start_date));

        for element in &job.elements {
            // Sort tasks by sequence_order
            let mut sorted_tasks = element.tasks.clone();
            sorted_tasks.sort_by_key(|t| t.sequence_order);

            // Walk backward through the task chain
            let mut next_last: Option<u64> = None;

            for task in sorted_tasks.iter().rev() {
                let total_ticks = minutes_to_ticks(task.total_minutes(), tick_minutes) as u64;

                let last = if let Some(successor_last) = next_last {
                    // LAST = LAST[successor] - task.total_ticks
                    successor_last.saturating_sub(total_ticks)
                } else if let Some(dl) = deadline_ticks {
                    // Last task in chain: LAST = deadline - total_ticks
                    dl.saturating_sub(total_ticks)
                } else {
                    // No deadline: use a very large value
                    u64::MAX / 2
                };

                last_values.insert(task.id.clone(), last);
                next_last = Some(last);
            }
        }
    }

    last_values
}

fn parse_deadline_to_ticks(deadline: &str, tick_minutes: u32, start_date: NaiveDate) -> Option<u64> {
    let minutes = parse_deadline_minutes(deadline, start_date)?;
    Some(minutes / tick_minutes as u64)
}

fn parse_deadline_minutes(deadline: &str, start_date: NaiveDate) -> Option<u64> {
    // Try "YYYY-MM-DDTHH:MM:SS"
    if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(deadline, "%Y-%m-%dT%H:%M:%S") {
        let days = (dt.date() - start_date).num_days();
        if days < 0 {
            return Some(0);
        }
        use chrono::Timelike;
        let minutes =
            days as u64 * 24 * 60 + dt.time().hour() as u64 * 60 + dt.time().minute() as u64;
        return Some(minutes);
    }
    // Try "YYYY-MM-DD"
    if let Ok(d) = chrono::NaiveDate::parse_from_str(deadline, "%Y-%m-%d") {
        let days = (d - start_date).num_days();
        if days < 0 {
            return Some(0);
        }
        return Some(days as u64 * 24 * 60 + 17 * 60); // 17:00 default
    }
    None
}

fn minutes_to_ticks(minutes: u32, tick_minutes: u32) -> u32 {
    if tick_minutes == 0 {
        return minutes;
    }
    (minutes + tick_minutes - 1) / tick_minutes
}
