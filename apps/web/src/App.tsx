import { useState } from 'react';
import { Sidebar, JobsList, JobDetailsPanel, DateStrip, SchedulingGrid } from './components';
import { getSnapshot } from './mock';

function App() {
  const snapshot = getSnapshot();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Find selected job
  const selectedJob = selectedJobId
    ? snapshot.jobs.find((j) => j.id === selectedJobId) || null
    : null;

  return (
    <div className="h-screen bg-zinc-950 text-zinc-100 flex overflow-hidden">
      <Sidebar />
      <JobsList
        jobs={snapshot.jobs}
        tasks={snapshot.tasks}
        lateJobs={snapshot.lateJobs}
        conflicts={snapshot.conflicts}
        selectedJobId={selectedJobId}
        onSelectJob={setSelectedJobId}
      />
      <JobDetailsPanel
        job={selectedJob}
        tasks={snapshot.tasks}
        assignments={snapshot.assignments}
        stations={snapshot.stations}
      />
      <DateStrip
        startDate={(() => {
          const today = new Date();
          today.setDate(today.getDate() - 6); // Start 6 days before today
          return today;
        })()}
        dayCount={21}
      />
      <SchedulingGrid
        stations={snapshot.stations}
        jobs={snapshot.jobs}
        tasks={snapshot.tasks}
        assignments={snapshot.assignments}
        selectedJobId={selectedJobId}
        onSelectJob={setSelectedJobId}
      />
    </div>
  );
}

export default App;
