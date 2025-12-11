import { useState } from 'react';
import { cn } from '../../lib/utils';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { setActivePanel } from '../../store/uiSlice';
import { Card, CardHeader, CardTitle, CardContent } from '../common/Card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../common/Tabs';
import { Button } from '../common/Button';
import { OperatorList } from './OperatorList';
import { EquipmentList } from './EquipmentList';
import { JobList } from './JobList';
import { Plus } from 'lucide-react';

interface CrudPanelProps {
  className?: string;
}

export function CrudPanel({ className }: CrudPanelProps) {
  const activePanel = useAppSelector((state) => state.ui.activePanel);
  const dispatch = useAppDispatch();

  const handleTabChange = (value: string) => {
    dispatch(setActivePanel(value as 'operators' | 'equipment' | 'jobs'));
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
              <TabsTrigger value="operators">Operators</TabsTrigger>
              <TabsTrigger value="equipment">Equipment</TabsTrigger>
              <TabsTrigger value="jobs">Jobs</TabsTrigger>
            </TabsList>
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-0">
          <TabsContent value="operators" className="h-full m-0">
            <OperatorList className="h-full" />
          </TabsContent>
          <TabsContent value="equipment" className="h-full m-0">
            <EquipmentList className="h-full" />
          </TabsContent>
          <TabsContent value="jobs" className="h-full m-0">
            <JobList className="h-full" />
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}
