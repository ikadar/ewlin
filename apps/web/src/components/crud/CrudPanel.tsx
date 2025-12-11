import { cn } from '../../lib/utils';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { setActivePanel } from '../../store/uiSlice';
import { Card, CardHeader, CardContent } from '../common/Card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../common/Tabs';
import { Button } from '../common/Button';
import { StationList } from './StationList';
import { ProviderList } from './ProviderList';
import { JobList } from './JobList';
import { Plus } from 'lucide-react';

interface CrudPanelProps {
  className?: string;
}

export function CrudPanel({ className }: CrudPanelProps) {
  const activePanel = useAppSelector((state) => state.ui.activePanel);
  const dispatch = useAppDispatch();

  const handleTabChange = (value: string) => {
    dispatch(setActivePanel(value as 'stations' | 'providers' | 'jobs'));
  };

  return (
    <Card className={cn('flex flex-col h-full', className)}>
      <Tabs
        value={activePanel ?? 'jobs'}
        onValueChange={handleTabChange}
        className="flex flex-col h-full"
      >
        <CardHeader className="py-2 px-4 border-b">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="stations">Stations</TabsTrigger>
              <TabsTrigger value="providers">Providers</TabsTrigger>
              <TabsTrigger value="jobs">Jobs</TabsTrigger>
            </TabsList>
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-0">
          <TabsContent value="stations" className="h-full m-0">
            <StationList className="h-full" />
          </TabsContent>
          <TabsContent value="providers" className="h-full m-0">
            <ProviderList className="h-full" />
          </TabsContent>
          <TabsContent value="jobs" className="h-full m-0">
            <JobList className="h-full" />
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}
