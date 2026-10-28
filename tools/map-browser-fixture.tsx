import React from 'react';
import { createRoot } from 'react-dom/client';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { SingaporeMap } from '../client/src/components/SingaporeMap';
import '../client/styles.css';
L.Map.addInitHook(function () { (window as any).testMap = this; });
const root = createRoot(document.getElementById('root')!);
const cluster = { clusterId: 'one', locality: 'Road task', tier: 'High', tierLabel: 'High priority', caseSize: 1,
  ring: [[103.84, 1.32], [103.85, 1.32], [103.85, 1.33], [103.84, 1.32]] as Array<[number, number]> };
const route = { teamId: 'Central', color: '#2563EB', label: 'Road route',
  coordinates: [{ latitude: 1.32, longitude: 103.84 }, { latitude: 1.33, longitude: 103.85 }],
  waypoints: [{ label: 'HQ', point: { latitude: 1.32, longitude: 103.84 }, isHq: true },
    { label: 'Task', point: { latitude: 1.33, longitude: 103.85 }, priority: 'High', pestType: 'Rat' }] };
(window as any).renderMap = ({ empty = false, selected = null, viewKey = '' } = {}) => root.render(
  <SingaporeMap label="browser-test" clusters={empty ? [] : [{ ...cluster }]} routes={empty ? [] : [{ ...route }]}
    selectedClusterId={selected} viewKey={viewKey} showClusterBadges={false} onSelectCluster={() => {}} />);
(window as any).renderMap({ empty: true });
