// SPDX-License-Identifier: MIT
// Copyright contributors to the kepler.gl project

import React, {useState} from 'react';
import {css} from 'styled-components';
import {toggleModal, addDataToMap, loadFiles} from '@kepler.gl/actions';
import {useDispatch} from 'react-redux';
import {filesToDataPayload} from '@kepler.gl/processors';
import {baseUrl} from '../../config';
import useMapSaveRestore from '../map-save-restore';
// We no longer need to import processGeojson as we'll use the default file handlers

// Define a custom modal ID for the login modal
export const LOGIN_MODAL_ID = 'loginModal';

// Define a CSS style for the login modal
export const smallModalCss = css`
  width: 60%;
  padding: 40px 40px 32px 40px;
`;

// Input field styles
const inputStyle = {
  width: '100%',
  padding: '10px',
  marginBottom: '15px',
  borderRadius: '4px',
  border: '1px solid #ccc',
  fontSize: '14px',
  backgroundColor: '#f8f8f8',
  color: '#333'
};

// Button styles
const buttonStyle = {
  padding: '10px 15px',
  backgroundColor: '#29323C',
  color: 'white',
  border: '1px solid #555',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '14px',
  marginTop: '10px',
  width: '100%'
};

// Error message style
const errorStyle = {
  color: '#ff6b6b',
  fontSize: '14px',
  marginBottom: '15px',
  textAlign: 'left' as const
};

// Form container style
const formContainerStyle = {
  textAlign: 'left' as const,
  marginTop: '20px'
};

// Real API login endpoint function
const loginEndpoint = async (
  username: string,
  password: string
): Promise<{
  success: boolean;
  message?: string;
  token?: string;
}> => {
  try {
    const response = await fetch(`${baseUrl}/be/api-token-auth/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({username, password})
    });

    const data = await response.json();

    if (response.ok && data.token) {
      // Store the token in localStorage for future API calls
      localStorage.setItem('authToken', data.token);
      return {
        success: true,
        token: data.token
      };
    } else {
      return {
        success: false,
        message: data.non_field_errors?.[0] || data.detail || 'Invalid username or password'
      };
    }
  } catch (error) {
    console.error('API call error:', error);
    return {
      success: false,
      message: 'Network error. Please check your connection and try again.'
    };
  }
};

// Create login modal component with form fields
const LoginModal = () => {
  const dispatch = useDispatch();
  const {saveMap, restoreMap} = useMapSaveRestore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userLayers, setUserLayers] = useState<Array<{
    id: number;
    datasets: string[];
    user?: number;
  }> | null>(null);
  const [selectedLayers, setSelectedLayers] = useState<{[key: string]: boolean}>({});
  const [isLayerLoading, setIsLayerLoading] = useState(false);
  const [mapName, setMapName] = useState('');

  // Function to check if a layer is already added to map
  const isLayerAddedToMap = (layerName: string): boolean => {
    // Local persistence of added-to-map status has been removed.
    // Always return false to avoid showing a persisted checkmark.
    return false;
  };

  // Helper to normalize user-layers payload to always have datasets: string[]
  const normalizeUserLayers = (
    raw: any
  ): Array<{id: number; datasets: string[]; user?: number}> => {
    if (!raw) return [] as any;
    try {
      const arr = Array.isArray(raw) ? raw : [raw];
      return arr.map((item: any) => {
        if (!item) return item;
        const datasets: string[] = Array.isArray(item.datasets)
          ? item.datasets
          : Array.isArray(item.allowed_layers)
          ? item.allowed_layers
              .map((l: any) => (typeof l === 'string' ? l : l?.layer_name))
              .filter(Boolean)
          : [];
        return {
          id: typeof item.id === 'number' ? item.id : 0,
          user: typeof item.user === 'number' ? item.user : undefined,
          datasets
        };
      });
    } catch (e) {
      console.error('Failed to normalize user layers:', e);
      return [] as any;
    }
  };

  // Function to fetch user layers
  const fetchUserLayers = async (token: string, refresh = false) => {
    try {
      console.log('Fetching user layers...');
      setIsLayerLoading(true);
      const response = await fetch(`${baseUrl}/be/api/user-layers/`, {
        method: 'GET',
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('User layers:', data);
        const normalized = normalizeUserLayers(data);
        setUserLayers(normalized);
      } else {
        console.error('Failed to fetch user layers:', await response.text());
      }
    } catch (error) {
      console.error('Error fetching user layers:', error);
    } finally {
      setIsLayerLoading(false);
    }
  };

  // Check if user is already logged in on component mount
  React.useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      setIsLoggedIn(true);
      fetchUserLayers(token).then(r => {
        console.log('User layers updated', r);
      });
    }
  }, []);

  // Logout function
  const handleLogout = () => {
    localStorage.removeItem('authToken');
    setIsLoggedIn(false);
    setUserLayers(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Form validation
    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    if (!password) {
      setError('Password is required');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Call login endpoint
      const response = await loginEndpoint(username, password);

      if (response.success) {
        // On successful login
        setIsLoggedIn(true);
        setError('');
        // Fetch user layers with the new token
        if (response.token) {
          fetchUserLayers(response.token);
        }
      } else {
        // Show error message
        setError(response.message || 'Login failed');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  // @ts-ignore
  const handleAddLayer = async (layerName: string) => {
    const layerUrl = `${baseUrl}/be/api/serve-layer/?layer_name=${layerName}`;

    // Set the loading state to true before starting the fetch
    setIsLayerLoading(true);

    try {
      // Fetch from API
      console.log(`Fetching data from: ${layerUrl}`);

      // Get the auth token from localStorage
      const token = localStorage.getItem('authToken');

      const response = await fetch(layerUrl, {
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.statusText}`);
      }

      // Determine file type (parquet or geojson)
      const isParquet = response.headers.get('Content-Type')?.includes('application/octet-stream');

      let file;

      try {
        if (isParquet) {
          // Handle parquet file - read as blob
          const blob = await response.blob();

          // Create a File object from the Blob
          file = new File([blob], `${layerName}.parquet`, {
            type: 'application/octet-stream'
          });

          console.log('Processing parquet file');
        } else {
          // Handle GeoJSON file - parse as JSON
          const geojsonData = await response.json();

          // Convert the GeoJSON data to a File object
          const blob = new Blob([JSON.stringify(geojsonData)], {
            type: 'application/json'
          });

          // Create a File object from the Blob
          file = new File([blob], `${layerName}.geojson`, {
            type: 'application/json'
          });

          console.log('Processing GeoJSON file');
        }
      } catch (processingError) {
        console.error('Error processing file:', processingError);

        // If parquet processing fails, try fallback to GeoJSON
        if (isParquet) {
          console.log('Parquet processing failed, trying GeoJSON fallback');
          try {
            // Clone the response for a second attempt
            const clonedResponse = await fetch(layerUrl, {
              headers: {
                Authorization: `Token ${token}`,
                'Content-Type': 'application/json'
              }
            });

            if (!clonedResponse.ok) {
              throw new Error(`Failed to fetch data: ${clonedResponse.statusText}`);
            }

            const geojsonData = await clonedResponse.json();

            // Convert the GeoJSON data to a File object
            const blob = new Blob([JSON.stringify(geojsonData)], {
              type: 'application/json'
            });

            // Create a File object from the Blob
            file = new File([blob], `${layerName}.geojson`, {
              type: 'application/json'
            });

            console.log('Fallback to GeoJSON successful');
          } catch (fallbackError) {
            console.error('Fallback also failed:', fallbackError);
            throw new Error('Could not load data in any format. Please try a different layer.');
          }
        } else {
          // Re-throw the original error if not a parquet file
          throw processingError;
        }
      }

      // Use the default file handlers to process the file
      dispatch(
        loadFiles([file], fileCache => {
          // Convert file cache to data payloads
          const payloads = filesToDataPayload(fileCache);

          // Add data to map with centerMap option
          payloads.forEach(payload => {
            dispatch(
              addDataToMap({
                ...payload,
                options: {
                  ...payload.options,
                  centerMap: true
                }
              })
            );
          });

          // Don't close the modal after adding a layer
          return null;
        })
      );
    } catch (error) {
      console.error('Error adding layer to map:', error);
      // @ts-ignore
      alert(`Failed to add layer to map: ${error.message}`);
    } finally {
      // Set loading state back to false when operation completes
      setIsLayerLoading(false);
    }
  };

  return (
    <div style={{padding: '20px'}}>
      {isLoggedIn ? (
        // Logged in state - show user layers and logout button
        <div style={{textAlign: 'center'}}>
          <h3 style={{textAlign: 'center', marginBottom: '10px', fontSize: '16px'}}>Welcome</h3>
          <p style={{marginBottom: '10px', fontSize: '14px'}}>You are logged in successfully.</p>

          {/* Display user layers if available */}
          {userLayers &&
          userLayers[0] &&
          userLayers[0].datasets &&
          userLayers[0].datasets.length > 0 ? (
            <div style={{marginBottom: '20px', textAlign: 'left'}}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '10px'
                }}
              >
                <div>
                  <h4 style={{margin: 0}}>Your Layers:</h4>
                  <p
                    style={{
                      margin: '5px 0 0 0',
                      fontSize: '12px',
                      color: '#666',
                      fontStyle: 'italic'
                    }}
                  >
                    (Note: do not select more than 3 layers at a time)
                  </p>
                </div>
                <button
                  onClick={() => {
                    const token = localStorage.getItem('authToken');
                    if (token) {
                      fetchUserLayers(token, true);
                    }
                  }}
                  style={{
                    padding: '5px 10px',
                    backgroundColor: isLayerLoading ? '#7b7bba' : '#5555AA',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: isLayerLoading ? 'wait' : 'pointer',
                    fontSize: '12px',
                    opacity: isLayerLoading ? 0.7 : 1
                  }}
                  disabled={isLayerLoading}
                >
                  {isLayerLoading ? 'Refreshing...' : 'Refresh Layers'}
                </button>
              </div>
              <ul
                style={{
                  listStyleType: 'none',
                  padding: '10px',
                  backgroundColor: '#f8f8f8',
                  borderRadius: '4px',
                  maxHeight: '250px',
                  overflowY: 'auto'
                }}
              >
                {userLayers[0].datasets.map((layerName, index) => (
                  <li
                    key={index}
                    style={{
                      padding: '5px 0',
                      borderBottom:
                        index < userLayers[0].datasets.length - 1 ? '1px solid #eee' : 'none',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div style={{display: 'flex', alignItems: 'center'}}>
                      <input
                        type="checkbox"
                        id={`layer-${index}`}
                        name={layerName}
                        value={layerName}
                        checked={!!selectedLayers[layerName]}
                        onChange={() => {
                          setSelectedLayers(prev => ({
                            ...prev,
                            [layerName]: !prev[layerName]
                          }));
                        }}
                        style={{marginRight: '8px'}}
                      />
                      <label htmlFor={`layer-${index}`}>
                        {layerName}
                        {isLayerAddedToMap(layerName) && (
                          <span style={{marginLeft: '5px', color: '#4CAF50'}}>✓</span>
                        )}
                      </label>
                    </div>
                  </li>
                ))}
              </ul>
              {Object.values(selectedLayers).some(selected => selected) && (
                <button
                  onClick={async () => {
                    // Get all selected layer names
                    const layersToAdd = Object.keys(selectedLayers).filter(
                      layerName => selectedLayers[layerName]
                    );

                    // Add each selected layer sequentially
                    for (const layerName of layersToAdd) {
                      await handleAddLayer(layerName);
                    }
                  }}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: isLayerLoading ? '#7bba7f' : '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: isLayerLoading ? 'wait' : 'pointer',
                    fontSize: '14px',
                    marginTop: '10px',
                    width: '100%',
                    opacity: isLayerLoading ? 0.7 : 1
                  }}
                  disabled={isLayerLoading}
                >
                  {isLayerLoading ? 'Loading...' : 'Add Selected Layers to Map'}
                </button>
              )}
            </div>
          ) : (
            <p style={{marginBottom: '20px', color: '#888'}}>
              {userLayers === null ? 'Loading your layers...' : 'No layers found.'}
            </p>
          )}

          <div style={{marginTop: '10px'}}>
            <label htmlFor="map-name" style={{display: 'block', marginBottom: '5px', fontSize: '14px'}}>
              Map Name
            </label>
            <input
              id="map-name"
              type="text"
              value={mapName}
              onChange={e => setMapName(e.target.value)}
              style={inputStyle}
              placeholder="Enter a name for this map"
            />
          </div>

          <div style={{display: 'flex', gap: '10px', marginTop: '10px', marginBottom: '10px'}}>
            <button
              type="button"
              onClick={() => saveMap(mapName)}
              style={{
                ...buttonStyle,
                backgroundColor: '#2e7d32',
                marginBottom: 0,
                width: '50%'
              }}
            >
              Save Map
            </button>
            <button
              type="button"
              onClick={restoreMap}
              style={{
                ...buttonStyle,
                backgroundColor: '#1976d2',
                marginBottom: 0,
                width: '50%'
              }}
            >
              Restore Map
            </button>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            style={{
              ...buttonStyle,
              backgroundColor: '#d9534f',
              marginBottom: '10px'
            }}
          >
            Logout
          </button>

          <button
            type="button"
            onClick={() => dispatch(toggleModal(null))}
            style={{
              ...buttonStyle,
              backgroundColor: '#555'
            }}
          >
            Close
          </button>
        </div>
      ) : (
        // Not logged in state - show login form
        <>
          <h3 style={{textAlign: 'center', marginBottom: '10px', fontSize: '16px'}}>Login</h3>

          {error && <div style={errorStyle}>{error}</div>}

          <form onSubmit={handleSubmit} style={formContainerStyle}>
            <div>
              <label
                htmlFor="username"
                style={{display: 'block', marginBottom: '5px', fontSize: '14px'}}
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                style={inputStyle}
                placeholder="Enter your username"
                disabled={loading}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                style={{display: 'block', marginBottom: '5px', fontSize: '14px'}}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={inputStyle}
                placeholder="Enter your password"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              style={{
                ...buttonStyle,
                opacity: loading ? 0.7 : 1,
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
              disabled={loading}
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>

            <button
              type="button"
              onClick={() => dispatch(toggleModal(null))}
              style={{
                ...buttonStyle,
                backgroundColor: '#555',
                marginTop: '10px'
              }}
              disabled={loading}
            >
              Cancel
            </button>
          </form>

          <div
            style={{
              marginTop: '15px',
              fontSize: '12px',
              textAlign: 'center' as const,
              color: '#888'
            }}
          >
            <p>Demo credentials: username: "demo", password: "password"</p>
          </div>
        </>
      )}
    </div>
  );
};

export default LoginModal;
