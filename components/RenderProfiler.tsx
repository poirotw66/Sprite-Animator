import React, { Profiler } from 'react';
import { useRenderProfiler } from '../hooks/useRenderProfiler';

export interface RenderProfilerProps {
  id: string;
  children: React.ReactNode;
}

export const RenderProfiler: React.FC<RenderProfilerProps> = ({ id, children }) => {
  const onRender = useRenderProfiler(id);

  if (!import.meta.env.DEV) {
    return <>{children}</>;
  }

  return (
    <Profiler id={id} onRender={onRender}>
      {children}
    </Profiler>
  );
};