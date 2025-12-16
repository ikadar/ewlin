import { useState } from 'react';
import { Sidebar, JobsList } from './components';
import { getSnapshot } from './mock';

function App() {
  const snapshot = getSnapshot();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex">
      <Sidebar />
      <JobsList
        jobs={snapshot.jobs}
        tasks={snapshot.tasks}
        lateJobs={snapshot.lateJobs}
        conflicts={snapshot.conflicts}
        selectedJobId={selectedJobId}
        onSelectJob={setSelectedJobId}
      />
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-2">Flux Scheduler</h1>
          <p className="text-zinc-500">
            {selectedJobId
              ? `Selected: ${snapshot.jobs.find((j) => j.id === selectedJobId)?.reference || selectedJobId}`
              : 'Select a job from the list'}
          </p>
        </div>
      </main>
    </div>
  );
}

export default App;
