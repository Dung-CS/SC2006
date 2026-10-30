/**
 * D-Fence — React mount for `createScoreBreakdown`, so the opened task view prints the same stored
 * figures as the planner did. Nothing is re-derived here; an empty explanation says so in words.
 */
import { useEffect, useRef } from 'react';
import { createScoreBreakdown } from './TaskScoreCallout';
import type { TaskScoreExplanation } from '../../../src/presentation/TaskScoreExplanation';

export function ScoreBreakdown(props: { explanation?: TaskScoreExplanation | null }): JSX.Element {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    host.current?.replaceChildren(createScoreBreakdown(props.explanation ?? undefined));
  }, [props.explanation]);
  return <div data-part="score-breakdown-host" ref={host} />;
}
