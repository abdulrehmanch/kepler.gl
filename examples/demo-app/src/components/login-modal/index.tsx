// SPDX-License-Identifier: MIT
// Copyright contributors to the kepler.gl project

import React, {useState} from 'react';
import {css} from 'styled-components';
import {toggleModal, addDataToMap, loadFiles} from '@kepler.gl/actions';
import {useDispatch} from 'react-redux';
import {filesToDataPayload} from '@kepler.gl/processors';
// We no longer need to import processGeojson as we'll use the default file handlers

// Define a custom modal ID for the login modal
export const LOGIN_MODAL_ID = 'loginModal';

// Define a CSS style for the login modal
export const smallModalCss = css`
  width: 40%;
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

// Dynamically choose the base URL based on the build environment
// If yarn build is called (production), use the live backend, otherwise use localhost
let baseUrl = 'http://localhost:8000';
if (process.env.NODE_ENV === 'production') {
  baseUrl = 'https://gridmaps.geosoftsolution.com';
}
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
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userLayers, setUserLayers] = useState<Array<{
    id: number;
    allowed_layers: {layer_name: string}[];
  }> | null>(null);
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);
  const [isLayerLoading, setIsLayerLoading] = useState(false);

  // Function to fetch user layers
  const fetchUserLayers = async (token: string) => {
    try {
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
        setUserLayers(data);

        // Store layers in localStorage with the required format
        if (data && data[0] && data[0].allowed_layers) {
          // Get existing layers from localStorage
          const existingLayersStr = localStorage.getItem('userLayers');
          const existingLayers = existingLayersStr ? JSON.parse(existingLayersStr) : {};

          // Update or add each layer
          data[0].allowed_layers.forEach((layer: {layer_name: string}) => {
            // Preserve addedToMap status if the layer already exists, otherwise set to false
            const addedToMap = existingLayers[layer.layer_name]
              ? existingLayers[layer.layer_name].addedToMap
              : false;

            existingLayers[layer.layer_name] = {
              user_layer: layer.layer_name,
              addedToMap
            };
          });

          // Save back to localStorage
          localStorage.setItem('userLayers', JSON.stringify(existingLayers));
        }
      } else {
        console.error('Failed to fetch user layers:', await response.text());
      }
    } catch (error) {
      console.error('Error fetching user layers:', error);
    } finally {
      setIsLayerLoading(false);
    }
  };

  // Function to load saved layers from localStorage
  const loadSavedLayers = () => {
    try {
      const userLayersStr = localStorage.getItem('userLayers');
      if (!userLayersStr) {
        console.log('No saved layers found in localStorage');
        return;
      }

      const savedLayers = JSON.parse(userLayersStr);
      if (!savedLayers || typeof savedLayers !== 'object') {
        console.log('Invalid userLayers format in localStorage');
        return;
      }

      console.log('Loading saved layers from localStorage:', savedLayers);

      // Track layers that need to be added
      const layersToAdd = [];

      // Check each layer
      for (const layerName in savedLayers) {
        const layer = savedLayers[layerName];
        if (layer && layer.addedToMap === true) {
          console.log(`Layer ${layerName} was previously added to map, will restore it`);
          // @ts-ignore
          layersToAdd.push(layerName);
        }
      }

      // Add layers sequentially to avoid overwhelming the system
      if (layersToAdd.length > 0) {
        console.log(`Found ${layersToAdd.length} layers to restore`);

        // Add first layer immediately, then add others with a delay
        const addLayersSequentially = async () => {
          for (let i = 0; i < layersToAdd.length; i++) {
            try {
              await handleAddLayer(layersToAdd[i]);
              // Small delay between adding layers
              if (i < layersToAdd.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            } catch (error) {
              console.error(`Error adding layer ${layersToAdd[i]}:`, error);
            }
          }
        };

        addLayersSequentially();
      }
    } catch (error) {
      console.error('Error loading saved layers:', error);
    }
  };

  // Check if user is already logged in on component mount
  React.useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      setIsLoggedIn(true);
      fetchUserLayers(token).then(r => {
        console.log('User layers updated', r);
        // Load saved layers after fetching user layers
        loadSavedLayers();
      });
    }
  }, []);

  // Logout function
  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userLayers');
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
  const handleAddLayer = async (layerName: string = selectedLayer) => {
    const layerUrl = `${baseUrl}/be/serve-layer/?layer_name=${layerName}`;

    // Set loading state to true before starting the fetch
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

          // Return the action object directly instead of dispatching it

          // Update localStorage to mark this layer as added to map
          if (layerName) {
            try {
              const userLayersStr = localStorage.getItem('userLayers');
              if (userLayersStr) {
                const userLayers = JSON.parse(userLayersStr);
                if (userLayers[layerName]) {
                  userLayers[layerName].addedToMap = true;
                  localStorage.setItem('userLayers', JSON.stringify(userLayers));
                  console.log(`Updated localStorage: ${layerName} marked as added to map`);
                }
              }
            } catch (storageError) {
              console.error('Error updating localStorage:', storageError);
            }
          }

          return toggleModal(null);
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
          <h3 style={{textAlign: 'center', marginBottom: '20px'}}>Welcome</h3>
          <p style={{marginBottom: '20px'}}>You are logged in successfully.</p>

          {/* Display user layers if available */}
          {userLayers &&
          userLayers[0] &&
          userLayers[0].allowed_layers &&
          userLayers[0].allowed_layers.length > 0 ? (
            <div style={{marginBottom: '20px', textAlign: 'left'}}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '10px'
                }}
              >
                <h4 style={{margin: 0}}>Your Layers:</h4>
                <button
                  onClick={() => {
                    const token = localStorage.getItem('authToken');
                    if (token) {
                      fetchUserLayers(token);
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
                  maxHeight: '150px',
                  overflowY: 'auto'
                }}
              >
                {userLayers[0].allowed_layers.map((layer, index) => (
                  <li
                    key={index}
                    style={{
                      padding: '5px 0',
                      borderBottom:
                        index < userLayers[0].allowed_layers.length - 1 ? '1px solid #eee' : 'none',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div style={{display: 'flex', alignItems: 'center'}}>
                      <input
                        type="radio"
                        id={`layer-${index}`}
                        name="selectedLayer"
                        value={layer.layer_name}
                        checked={selectedLayer === layer.layer_name}
                        onChange={() => setSelectedLayer(layer.layer_name)}
                        style={{marginRight: '8px'}}
                      />
                      <label htmlFor={`layer-${index}`}>{layer.layer_name}</label>
                    </div>
                  </li>
                ))}
              </ul>
              {selectedLayer && (
                <button
                  onClick={async () => handleAddLayer()}
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
                  {isLayerLoading ? 'Loading...' : 'Add to Map'}
                </button>
              )}
            </div>
          ) : (
            <p style={{marginBottom: '20px', color: '#888'}}>
              {userLayers === null ? 'Loading your layers...' : 'No layers found.'}
            </p>
          )}

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
          <h3 style={{textAlign: 'center', marginBottom: '20px'}}>Login</h3>

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
