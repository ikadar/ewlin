import { Sidebar } from './components';

function App() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex">
      <Sidebar />
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-2">Flux Scheduler</h1>
          <p className="text-zinc-500">Ready for new implementation</p>
        </div>
      </main>
    </div>
  );
}

export default App;
