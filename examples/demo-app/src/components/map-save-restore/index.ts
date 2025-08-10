// SPDX-License-Identifier: MIT
// Copyright contributors to the kepler.gl project

import {useCallback} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import KeplerGlSchema from '@kepler.gl/schemas';
import {addDataToMap, loadFiles} from '@kepler.gl/actions';
import {filesToDataPayload} from '@kepler.gl/processors';
import {baseUrl} from '../../config';

// Simple localStorage keys
const LOCAL_STORAGE_KEY = 'keplergl_demo_saved_map_v1';

/**
 * useMapSaveRestore
 * A tiny helper hook to save and restore the current kepler.gl map (id: "map").
 * - saveMap: POST config (without datasets) to backend and include endpoints array.
 * - restoreMap: restore from localStorage (kept for convenience/demo purposes).
 */
export const useMapSaveRestore = () => {
  const dispatch = useDispatch();

  // Pull the reducer state for the specific kepler.gl instance id
  const mapState = useSelector((state: any) => state?.demo?.keplerGl?.map);

  // Build config (without datasets) and endpoints from current mapState
  const buildConfigAndEndpoints = useCallback(() => {
    if (!mapState) {
      throw new Error('Map state not available');
    }
    const config = KeplerGlSchema.getConfigToSave(mapState);
    const datasetsObj = mapState?.visState?.datasets || {};
    const endpoints: string[] = Array.from(
      new Set(
        Object.values(datasetsObj)
          .map((ds: any) => {
            const label: string = ds?.label || ds?.dataContainer?.props?.label || '';
            if (!label) return null;
            const name = label.replace(/\.(parquet|geojson|json|csv)$/i, '');
            return `${baseUrl}/be/api/serve-layer/?layer_name=${encodeURIComponent(name)}`;
          })
          .filter(Boolean) as string[]
      )
    );
    return {config, endpoints};
  }, [mapState]);

  // Programmatic APIs (no prompts/alerts), to be used by the modal wizard UI
  const listMaps = useCallback(async (): Promise<any[]> => {
    const token = localStorage.getItem('authToken');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${baseUrl}/be/api/maps/`, {
      method: 'GET',
      headers: {Authorization: `Token ${token}`, 'Content-Type': 'application/json'}
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Failed to fetch maps: ${res.status} ${res.statusText}`);
    }
    const maps = await res.json();
    return Array.isArray(maps) ? maps : [];
  }, []);

  const saveMapNew = useCallback(
    async (mapName: string): Promise<void> => {
      if (!mapName || !mapName.trim()) throw new Error('Map name is required');
      const token = localStorage.getItem('authToken');
      if (!token) throw new Error('Not authenticated');
      const {config, endpoints} = buildConfigAndEndpoints();
      const res = await fetch(`${baseUrl}/be/api/maps/`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Authorization: `Token ${token}`},
        body: JSON.stringify({map_name: mapName.trim(), map_config: config, endpoints})
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to save map: ${res.status} ${res.statusText}`);
      }
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({config}));
      } catch {}
    },
    [buildConfigAndEndpoints]
  );

  const saveMapOverride = useCallback(
    async (mapName: string, overrideId: string | number): Promise<void> => {
      if (!mapName || !mapName.trim()) throw new Error('Map name is required');
      if (overrideId === undefined || overrideId === null)
        throw new Error('Override id is required');
      const token = localStorage.getItem('authToken');
      if (!token) throw new Error('Not authenticated');
      const {config, endpoints} = buildConfigAndEndpoints();
      const putUrl = `${baseUrl}/be/api/maps/${encodeURIComponent(String(overrideId))}/`;
      const res = await fetch(putUrl, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json', Authorization: `Token ${token}`},
        body: JSON.stringify({map_name: mapName.trim(), map_config: config, endpoints})
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to override map: ${res.status} ${res.statusText}`);
      }
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({config}));
      } catch {}
    },
    [buildConfigAndEndpoints]
  );

  const restoreFromRecord = useCallback(
    async (record: any): Promise<void> => {
      const token = localStorage.getItem('authToken');
      if (!token) throw new Error('Not authenticated');
      if (!record) throw new Error('No map record provided');
      const endpoints: string[] = Array.isArray(record.endpoints)
        ? record.endpoints.filter((e: any) => typeof e === 'string')
        : [];
      const mapConfig = record.map_config || record.config || null;

      const extractLayerName = (url: string): string => {
        try {
          const u = new URL(url);
          const fromParam = u.searchParams.get('layer_name');
          if (fromParam) return fromParam;
          const path = u.pathname.split('/').filter(Boolean);
          return path[path.length - 1] || 'layer';
        } catch {
          return 'layer';
        }
      };

      const buildGeojsonUrl = (url: string): string => {
        try {
          const u = new URL(url);
          if (!u.searchParams.get('format')) {
            u.searchParams.set('format', 'geojson');
          }
          return u.toString();
        } catch {
          return url.includes('?') ? `${url}&format=geojson` : `${url}?format=geojson`;
        }
      };

      const loadEndpoint = async (endpoint: string) => {
        const layerName = extractLayerName(endpoint);
        let file: File | null = null;
        try {
          const parquetRes = await fetch(endpoint, {headers: {Authorization: `Token ${token}`}});
          if (!parquetRes.ok) throw new Error(`Failed parquet fetch: ${parquetRes.status}`);
          const blob = await parquetRes.blob();
          file = new File([blob], `${layerName}.parquet`, {type: 'application/octet-stream'});
        } catch {
          try {
            const geojsonUrl = buildGeojsonUrl(endpoint);
            const res = await fetch(geojsonUrl, {headers: {Authorization: `Token ${token}`}});
            if (!res.ok) {
              const text = await res.text();
              throw new Error(text || `Failed geojson fetch: ${res.status}`);
            }
            const blob = await res.blob();
            file = new File([blob], `${layerName}.geojson`, {type: 'application/json'});
          } catch (fallbackError) {
            console.error('Failed to load endpoint', endpoint, fallbackError);
            return;
          }
        }
        if (!file) return;
        dispatch(
          loadFiles([file], fileCache => {
            const payloads = filesToDataPayload(fileCache);
            payloads.forEach(payload => {
              dispatch(
                addDataToMap({
                  ...payload,
                  options: {...payload.options, centerMap: true, autoCreateLayers: true}
                })
              );
            });
            return null;
          })
        );
      };

      for (const ep of endpoints) {
        // eslint-disable-next-line no-await-in-loop
        await loadEndpoint(ep);
      }

      if (mapConfig) {
        const loaded = KeplerGlSchema.load(undefined, mapConfig);
        if (loaded?.config) {
          dispatch(
            addDataToMap({config: loaded.config, options: {centerMap: true, keepExistingConfig: true}})
          );
        }
      }
    },
    [dispatch]
  );

  const saveMap = useCallback(
    async (mapName?: string) => {
      try {
        if (!mapState) {
          // eslint-disable-next-line no-alert
          alert('Nothing to save: map state not available.');
          return;
        }
        if (!mapName || !mapName.trim()) {
          // eslint-disable-next-line no-alert
          alert('Please enter a map name before saving.');
          return;
        }

        // Extract config only (no datasets)
        const config = KeplerGlSchema.getConfigToSave(mapState);

        // Build endpoints array from current datasets loaded in the map
        const datasetsObj = mapState?.visState?.datasets || {};
        const endpoints: string[] = Array.from(
          new Set(
            Object.values(datasetsObj)
              .map((ds: any) => {
                const label: string = ds?.label || ds?.dataContainer?.props?.label || '';
                if (!label) return null;
                // Strip common file extensions to get the layer name
                const name = label.replace(/\.(parquet|geojson|json|csv)$/i, '');
                return `${baseUrl}/be/api/serve-layer/?layer_name=${encodeURIComponent(name)}`;
              })
              .filter(Boolean) as string[]
          )
        );

        const token = localStorage.getItem('authToken');
        if (!token) {
          // eslint-disable-next-line no-alert
          alert('You must be logged in to save the map to server.');
          return;
        }

        // Ask user whether to save a new map or override an existing one
        const saveChoice = window.prompt(
          'Save options:\n- Enter N to save as a NEW map\n- Enter O to OVERRIDE an existing map',
          'N'
        );
        const choice = (saveChoice || 'N').trim().toUpperCase();

        let res: Response | null = null;

        if (choice === 'O') {
          // Override existing: fetch map list and select one
          const listRes = await fetch(`${baseUrl}/be/api/maps/`, {
            method: 'GET',
            headers: {
              Authorization: `Token ${token}`,
              'Content-Type': 'application/json'
            }
          });
          if (!listRes.ok) {
            const text = await listRes.text();
            throw new Error(text || `Failed to fetch maps: ${listRes.status} ${listRes.statusText}`);
          }
          const maps = await listRes.json();
          if (!Array.isArray(maps) || maps.length === 0) {
            alert('No maps found on server to override. Saving as a new map instead.');
          } else {
            const listStr = maps
              .map(
                (m: any, i: number) =>
                  `${i + 1}. ${m?.map_name || m?.name || 'Untitled'} (${Array.isArray(m?.endpoints) ? m.endpoints.length : 0} layers)`
              )
              .join('\n');
            const sel = window.prompt(`Select a map to OVERRIDE by number:\n${listStr}\nEnter number:`, '1');
            if (sel) {
              const idx = Number.parseInt(sel, 10) - 1;
              if (!Number.isNaN(idx) && idx >= 0 && idx < maps.length) {
                const selected = maps[idx] || {};
                const selectedId = selected.id ?? selected.pk ?? selected.uuid ?? selected.map_id;
                if (selectedId === undefined || selectedId === null) {
                  alert('Selected map has no identifiable id. Saving as a new map instead.');
                } else {
                  const putUrl = `${baseUrl}/be/api/maps/${encodeURIComponent(String(selectedId))}/`;
                  res = await fetch(putUrl, {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Token ${token}`
                    },
                    body: JSON.stringify({
                      map_name: mapName.trim(),
                      map_config: config,
                      endpoints
                    })
                  });
                }
              } else {
                alert('Invalid selection. Saving as a new map instead.');
              }
            } else {
              // user cancelled selection -> treat as cancel
              alert('Override canceled. No changes saved.');
              return;
            }
          }
        }

        // If not overriding or override not performed, default to creating a new map
        if (!res) {
          res = await fetch(`${baseUrl}/be/api/maps/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Token ${token}`
            },
            body: JSON.stringify({
              map_name: mapName.trim(),
              map_config: config, // save config as-is in map_config field
              endpoints // array of endpoints
            })
          });
        }

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `Failed to save map: ${res.status} ${res.statusText}`);
        }

        // Optionally keep a local backup for restore
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({config}));
        } catch (e) {
          // ignore local backup errors
        }

        // eslint-disable-next-line no-alert
        alert('Map configuration saved to server successfully.');
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error('Failed to save map to server:', err);
        // eslint-disable-next-line no-alert
        alert(`Failed to save map: ${err?.message || err}`);
      }
    },
    [mapState]
  );

  const restoreMap = useCallback(async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        alert('You must be logged in to restore maps from server.');
        return;
      }

      // 1) Fetch list of maps
      const res = await fetch(`${baseUrl}/be/api/maps/`, {
        method: 'GET',
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to fetch maps: ${res.status} ${res.statusText}`);
      }
      const maps = await res.json();
      if (!Array.isArray(maps) || maps.length === 0) {
        alert('No saved maps found on the server.');
        return;
      }

      // 2) Prompt user to select a map (minimal UI change)
      const listStr = maps
        .map(
          (m: any, i: number) =>
            `${i + 1}. ${m?.map_name || m?.name || 'Untitled'} (${
              Array.isArray(m?.endpoints) ? m.endpoints.length : 0
            } layers)`
        )
        .join('\n');
      const sel = window.prompt(`Select a map by number:\n${listStr}\nEnter number:`, '1');
      if (!sel) return;
      const idx = Number.parseInt(sel, 10) - 1;
      if (Number.isNaN(idx) || idx < 0 || idx >= maps.length) {
        alert('Invalid selection.');
        return;
      }
      const selected = maps[idx] || {};

      const endpoints: string[] = Array.isArray(selected.endpoints)
        ? selected.endpoints.filter((e: any) => typeof e === 'string')
        : [];
      const mapConfig = selected.map_config || selected.config || null;

      // Helper to extract layer name from endpoint URL
      const extractLayerName = (url: string): string => {
        try {
          const u = new URL(url);
          const fromParam = u.searchParams.get('layer_name');
          if (fromParam) return fromParam;
          const path = u.pathname.split('/').filter(Boolean);
          return path[path.length - 1] || 'layer';
        } catch {
          return 'layer';
        }
      };

      // Helper to build geojson fallback URL
      const buildGeojsonUrl = (url: string): string => {
        try {
          const u = new URL(url);
          if (!u.searchParams.get('format')) {
            u.searchParams.set('format', 'geojson');
          }
          return u.toString();
        } catch {
          // naive fallback
          return url.includes('?') ? `${url}&format=geojson` : `${url}?format=geojson`;
        }
      };

      // Helper to load a single endpoint
      const loadEndpoint = async (endpoint: string) => {
        const layerName = extractLayerName(endpoint);
        let file: File | null = null;
        try {
          // Try parquet first
          const parquetRes = await fetch(endpoint, {
            headers: {
              Authorization: `Token ${token}`
            }
          });
          if (!parquetRes.ok) {
            throw new Error(`Failed parquet fetch: ${parquetRes.status}`);
          }
          const blob = await parquetRes.blob();
          file = new File([blob], `${layerName}.parquet`, {type: 'application/octet-stream'});
        } catch (processingError) {
          // Fallback to GeoJSON
          try {
            const geojsonUrl = buildGeojsonUrl(endpoint);
            const res = await fetch(geojsonUrl, {
              headers: {
                Authorization: `Token ${token}`
              }
            });
            if (!res.ok) {
              const text = await res.text();
              throw new Error(text || `Failed geojson fetch: ${res.status}`);
            }
            const blob = await res.blob();
            file = new File([blob], `${layerName}.geojson`, {type: 'application/json'});
          } catch (fallbackError) {
            console.error('Failed to load endpoint', endpoint, fallbackError);
            // Continue with next endpoint
            return;
          }
        }

        if (!file) return;

        // Use default file handlers to process and add to map
        dispatch(
          loadFiles([file], fileCache => {
            const payloads = filesToDataPayload(fileCache);
            payloads.forEach(payload => {
              dispatch(
                addDataToMap({
                  ...payload,
                  options: {
                    ...payload.options,
                    centerMap: true,
                    autoCreateLayers: true
                  }
                })
              );
            });
            return null; // keep modal open
          })
        );
      };

      // 3) Load all endpoints sequentially
      for (const ep of endpoints) {
        // eslint-disable-next-line no-await-in-loop
        await loadEndpoint(ep);
      }

      // 4) Apply map config
      if (mapConfig) {
        const loaded = KeplerGlSchema.load(undefined, mapConfig);
        if (loaded?.config) {
          dispatch(
            addDataToMap({
              config: loaded.config,
              options: {centerMap: true, keepExistingConfig: true}
            })
          );
        }
      }

      alert('Map restored successfully.');
    } catch (err: any) {
      console.error('Failed to restore map:', err);
      alert(`Failed to restore map: ${err?.message || err}`);
    }
  }, [dispatch]);

  return {saveMap, restoreMap, listMaps, saveMapNew, saveMapOverride, restoreFromRecord};
};

export default useMapSaveRestore;
