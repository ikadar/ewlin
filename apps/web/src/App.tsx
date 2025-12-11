import { Provider } from 'react-redux';
import { store } from './store';
import { SchedulingPage } from './pages/SchedulingPage';

function App() {
  return (
    <Provider store={store}>
      <div className="min-h-screen bg-background">
        <SchedulingPage />
      </div>
    </Provider>
  );
}

export default App;
