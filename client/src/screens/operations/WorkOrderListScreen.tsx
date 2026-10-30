/**
 * D-Fence — the old Work Order List path (11.2.25). The Dispatches list replaced it: a work order
 * is now read inside the dispatch that holds its crew and vehicle. Old links land there.
 */
import { useEffect } from 'react';
import { ScreenProps } from '../ScreenProps';

export function WorkOrderListScreen(props: ScreenProps): JSX.Element {
  useEffect(() => props.onNavigate('/ops/dispatches'), []);
  return <section data-screen="WOList"><p>Opening dispatches...</p></section>;
}
