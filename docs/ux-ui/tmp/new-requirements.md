## Improvements

### REQ-01
Focussing a job should have the same visual effect as dragging a task
(everything not from the job gets desaturated and the job tiles get a
glow)

### REQ-02
Add a close « X » to the top right of the job details column

### REQ-03
And also allow a second click on a job in the job selection column
to unselect it (therefore closing the job details column)

### REQ-04
Add a horizontal nav bar

### REQ-05
Button for quick placement mode

### REQ-06
Zoom mode with task granularity

### REQ-07
Job progression visualization
1 dot per job task
Empty if not placed
Gray if placed but not completed
Green if placed and completed
Red if placed, not completed and in the past (i.e. late)

Instead of dots, segments
Below 30 minutes per task, standard size
Over 30 minutes per task, proportional rounded corner divs

The goal is to be able to, at at glance get a feel of the size of the
jobs and actions

### REQ-08
Once a user is dragging a tile from the scheduling, its landing start
should be materialized clearly by a white line similar to the one that
appear in quick placement mode

### REQ-09
The drag and drop should also be only possible vertically

### REQ-10
Timeline compaction should be for a given time horizon
Next 4 hours
Next 8 hours
Next 24 hours

It should be for all columns left to right
Given its nature it should actually be in the top navbar

Compaction should happen starting at the current time

Tasks in progress at the current time are immobile and only
tasks after them are compacted

### REQ-11
We should be able to set a dry time that doesn't not appear as a
column

Its only effect should be on the precedence rules for printing and its
next task

If we say drying is 4 hours then precedence is end of printing +
4 hours instead of end of printing simply (for example)

Visually it simply relies on the same feedback as other violations

If possible we could add a « +4h drying » when displaying the
printing precedence horizontal bar in the column of the station
following the printing in the task list.

## Issues

### REQ-12
Precedence rule violation should be allowed

Yellow glow for all the tiles that belong to a precedence conflict
task

The job is automatically positioned in the problems section

### REQ-13
Precedence violations and lateness should affect a job in terms of
appearance and position in the job list column (they currently don't)

### REQ-14
Day navigation issues
Clicking on a day doesn't move the scheduling area to said day
Scrolling the scheduling area doesn't pass to the next day or previous day
I don't see the day column behaviours

### REQ-15
Highlighting departure date of the selected job

### REQ-16
Highlighting days where tasks are scheduled for the selected job

### REQ-17
Scrolling the schedule doesn't extend the background
Perhaps we should introduce virtual scrolling ?

### REQ-18
I don't see machine group capacity limits

### REQ-19
I don't see outsourcing columns
They should appear like stations do except they should allow for
unlimited parallel tasks (which look like parallel meetings do on
calendar apps)

### REQ-20
We are missing the similarities feature
Implement the similarity algorithm for the printing press at least.
Same paper type
Same paper weight
Same paper sheet size
Same inking