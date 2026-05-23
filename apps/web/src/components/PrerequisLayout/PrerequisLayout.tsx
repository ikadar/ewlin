import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { PrerequisSubmenu } from './PrerequisSubmenu';

export function PrerequisLayout() {
  return (
    <div className="flex flex-1 overflow-hidden">
      <PrerequisSubmenu />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}

export function PrerequisIndexRedirect() {
  const { search } = useLocation();
  return <Navigate to={{ pathname: '/prerequis/papier', search }} replace />;
}
