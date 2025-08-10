// SPDX-License-Identifier: MIT
// Copyright contributors to the kepler.gl project

import React, {useEffect, useMemo, useState} from 'react';
import useMapSaveRestore from '../map-save-restore';

const container: React.CSSProperties = {textAlign: 'left', marginTop: 10};
const row: React.CSSProperties = {display: 'flex', gap: 8, alignItems: 'center'};
const input: React.CSSProperties = {
  width: '100%',
  padding: '8px',
  borderRadius: 4,
  border: '1px solid #ccc',
  backgroundColor: '#f8f8f8',
  color: '#333'
};
const button: React.CSSProperties = {
  padding: '8px 12px',
  backgroundColor: '#29323C',
  color: 'white',
  border: '1px solid #555',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 13
};
const tabBtn = (active: boolean): React.CSSProperties => ({
  ...button,
  backgroundColor: active ? '#2E7CF6' : '#e0e0e0',
  color: active ? 'white' : '#333',
  border: 'none'
});

type MapWizardTabsProps = {
  layers: string[];
  isLayerLoading: boolean;
  selectedLayers: {[key: string]: boolean};
  onToggleLayer: (name: string) => void;
  onRefreshLayers: () => void;
  onAddSelectedLayers: () => void | Promise<void>;
  onLogout: () => void;
  onClose: () => void;
};

export default function MapWizardTabs({
  layers,
  isLayerLoading,
  selectedLayers,
  onToggleLayer,
  onRefreshLayers,
  onAddSelectedLayers,
  onLogout,
  onClose
}: MapWizardTabsProps) {
  const {listMaps, saveMapNew, saveMapOverride, restoreFromRecord} = useMapSaveRestore();

  const [active, setActive] = useState<'save' | 'layers' | 'restore' | 'account'>('restore');

  // shared
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // save specific
  const [mapName, setMapName] = useState('');
  const [maps, setMaps] = useState<any[] | null>(null);
  const [mapsLoading, setMapsLoading] = useState(false);
  const [overrideIdx, setOverrideIdx] = useState<number | null>(null);

  // restore specific
  const [restoreIdx, setRestoreIdx] = useState<number | null>(null);

  const overrideId = useMemo(() => {
    if (!maps || overrideIdx == null || overrideIdx < 0 || overrideIdx >= maps.length) return null;
    const sel = maps[overrideIdx] || {};
    return sel.id ?? sel.pk ?? sel.uuid ?? sel.map_id ?? null;
  }, [maps, overrideIdx]);

  const selectedRestore = useMemo(() => {
    if (!maps || restoreIdx == null || restoreIdx < 0 || restoreIdx >= maps.length) return null;
    return maps[restoreIdx];
  }, [maps, restoreIdx]);

  const refreshMaps = async () => {
    try {
      setMapsLoading(true);
      setError(null);
      const list = await listMaps();
      setMaps(list);
    } catch (e: any) {
      setError(e?.message || 'Failed to load maps');
    } finally {
      setMapsLoading(false);
    }
  };

  useEffect(() => {
    // preload list for save/restore tabs
    if (active !== 'layers' && !maps) {
      refreshMaps();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <div style={container}>
      {/* Tabs header */}
      <div style={{display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 10}}>
        <button style={tabBtn(active === 'restore')} onClick={() => setActive('restore')}>
          Load Existing Map
        </button>
        <button style={tabBtn(active === 'layers')} onClick={() => setActive('layers')}>
          Layers
        </button>
        <button style={tabBtn(active === 'save')} onClick={() => setActive('save')}>
          Save Map
        </button>
        <button style={tabBtn(active === 'account')} onClick={() => setActive('account')}>
          Account
        </button>
      </div>

      {/* Save tab */}
      {active === 'save' && (
        <div>
          <div style={{marginBottom: 8}}>
            <label htmlFor="mw-mapname" style={{display: 'block', marginBottom: 4}}>Map Name</label>
            <input
              id="mw-mapname"
              style={input}
              value={mapName}
              placeholder="Enter a name for this map"
              onChange={e => setMapName(e.target.value)}
            />
          </div>

          <div style={{...row, marginBottom: 8}}>
            <button
              style={{...button, backgroundColor: '#2e7d32'}}
              disabled={loading}
              onClick={async () => {
                setMessage(null);
                setError(null);
                try {
                  setLoading(true);
                  await saveMapNew(mapName);
                  setMessage('Map saved successfully.');
                } catch (e: any) {
                  setError(e?.message || 'Failed to save map');
                } finally {
                  setLoading(false);
                }
              }}
            >
              {loading ? 'Saving...' : 'Save New'}
            </button>

            <button style={{...button}} onClick={refreshMaps} disabled={mapsLoading}>
              {mapsLoading ? 'Refreshing...' : 'Refresh List'}
            </button>
          </div>

          <div style={{marginBottom: 8}}>
            <label htmlFor="mw-override" style={{display: 'block', marginBottom: 4}}>Override Existing</label>
            <select
              id="mw-override"
              style={{...input, padding: 6}}
              value={overrideIdx == null ? '' : overrideIdx}
              onChange={e => setOverrideIdx(e.target.value === '' ? null : Number(e.target.value))}
            >
              <option value="">Select a map...</option>
              {(maps || []).map((m: any, i: number) => (
                <option key={i} value={i}>
                  {(m?.map_name || m?.name || 'Untitled') + ` (${Array.isArray(m?.endpoints) ? m.endpoints.length : 0} layers)`}
                </option>
              ))}
            </select>
          </div>

          <div style={{...row, marginBottom: 8}}>
            <button
              style={{...button, backgroundColor: '#f57c00'}}
              disabled={loading || overrideId == null}
              onClick={async () => {
                setMessage(null);
                setError(null);
                if (overrideId == null) return;
                try {
                  setLoading(true);
                  await saveMapOverride(mapName, overrideId);
                  setMessage('Map overridden successfully.');
                } catch (e: any) {
                  setError(e?.message || 'Failed to override map');
                } finally {
                  setLoading(false);
                }
              }}
            >
              {loading ? 'Overriding...' : 'Override Selected'}
            </button>
          </div>

          {message && <div style={{color: '#2e7d32', marginTop: 6}}>{message}</div>}
          {error && <div style={{color: '#ff6b6b', marginTop: 6}}>{error}</div>}
        </div>
      )}

      {/* Layers tab */}
      {active === 'layers' && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10
            }}
          >
            <div>
              <h4 style={{margin: 0}}>Your Layers</h4>
              <p style={{margin: '5px 0 0 0', fontSize: 12, color: '#666', fontStyle: 'italic'}}>
                (Note: do not select more than 3 layers at a time)
              </p>
            </div>
            <button
              onClick={onRefreshLayers}
              style={{...button, padding: '5px 10px', backgroundColor: isLayerLoading ? '#7b7bba' : '#5555AA'}}
              disabled={isLayerLoading}
            >
              {isLayerLoading ? 'Refreshing...' : 'Refresh Layers'}
            </button>
          </div>

          {layers && layers.length > 0 ? (
            <>
              <ul
                style={{
                  listStyleType: 'none',
                  padding: 10,
                  backgroundColor: '#f8f8f8',
                  borderRadius: 4,
                  maxHeight: 250,
                  overflowY: 'auto'
                }}
              >
                {layers.map((layerName, index) => (
                  <li
                    key={`${layerName}-${index}`}
                    style={{
                      padding: '5px 0',
                      borderBottom: index < layers.length - 1 ? '1px solid #eee' : 'none',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div style={{display: 'flex', alignItems: 'center'}}>
                      <input
                        type="checkbox"
                        id={`mw-layer-${index}`}
                        name={layerName}
                        value={layerName}
                        checked={!!selectedLayers[layerName]}
                        onChange={() => onToggleLayer(layerName)}
                        style={{marginRight: 8}}
                      />
                      <label htmlFor={`mw-layer-${index}`}>{layerName}</label>
                    </div>
                  </li>
                ))}
              </ul>
              {
                // Always show the button; disable it if nothing selected or loading
              }
              <button
                onClick={onAddSelectedLayers}
                style={{
                  ...button,
                  backgroundColor:
                    isLayerLoading || !Object.values(selectedLayers).some(v => v)
                      ? '#9e9e9e'
                      : '#4CAF50',
                  width: '100%',
                  marginTop: 10,
                  cursor:
                    isLayerLoading || !Object.values(selectedLayers).some(v => v)
                      ? 'not-allowed'
                      : 'pointer'
                }}
                disabled={isLayerLoading || !Object.values(selectedLayers).some(v => v)}
              >
                {isLayerLoading ? 'Loading...' : 'Add Selected Layers to Map'}
              </button>
            </>
          ) : (
            <p style={{marginBottom: 20, color: '#888'}}>
              No layers found.
            </p>
          )}
        </div>
      )}

      {/* Restore tab */}
      {active === 'restore' && (
        <div>
          <div style={{...row, marginBottom: 8}}>
            <button style={{...button}} onClick={refreshMaps} disabled={mapsLoading}>
              {mapsLoading ? 'Refreshing...' : 'Refresh List'}
            </button>
          </div>

          <div style={{marginBottom: 8}}>
            <label htmlFor="mw-restore" style={{display: 'block', marginBottom: 4}}>
              Choose a map to restore
            </label>
            <select
              id="mw-restore"
              style={{...input, padding: 6}}
              value={restoreIdx == null ? '' : restoreIdx}
              onChange={e => setRestoreIdx(e.target.value === '' ? null : Number(e.target.value))}
            >
              <option value="">Select a map...</option>
              {(maps || []).map((m: any, i: number) => (
                <option key={i} value={i}>
                  {(m?.map_name || m?.name || 'Untitled') + ` (${Array.isArray(m?.endpoints) ? m.endpoints.length : 0} layers)`}
                </option>
              ))}
            </select>
          </div>

          <div style={{...row, marginBottom: 8}}>
            <button
              style={{...button, backgroundColor: '#1976d2'}}
              disabled={loading || !selectedRestore}
              onClick={async () => {
                if (!selectedRestore) return;
                setMessage(null);
                setError(null);
                try {
                  setLoading(true);
                  await restoreFromRecord(selectedRestore);
                  setMessage('Map restored successfully.');
                } catch (e: any) {
                  setError(e?.message || 'Failed to restore map');
                } finally {
                  setLoading(false);
                }
              }}
            >
              {loading ? 'Restoring...' : 'Restore'}
            </button>
          </div>

          {message && <div style={{color: '#2e7d32', marginTop: 6}}>{message}</div>}
          {error && <div style={{color: '#ff6b6b', marginTop: 6}}>{error}</div>}
        </div>
      )}

      {/* Account tab */}
      {active === 'account' && (
        <div>
          <div style={{...row, marginBottom: 8}}>
            <button style={{...button, backgroundColor: '#d9534f'}} onClick={onLogout}>Logout</button>
            <button style={{...button, backgroundColor: '#555'}} onClick={onClose}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
