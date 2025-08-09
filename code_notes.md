Approach 2: Implement a Layer State Synchronization FunctionCreate a function that checks the actual state of the map and updates localStorage accordingly:
```ts
// Function to synchronize localStorage with actual map state
const syncLayerStateWithMap = (keplerGlState) => {
  try {
    // Get the current layers in the map from Kepler.gl state
    const currentMapLayers = keplerGlState.visState.layers.map(layer => layer.id);

    // Get layers from localStorage
    const userLayersStr = localStorage.getItem('userLayers');
    if (userLayersStr) {
      const userLayers = JSON.parse(userLayersStr);

      // Update addedToMap status based on actual map state
      Object.keys(userLayers).forEach(layerName => {
        // Check if this layer exists in the current map layers
        const isInMap = currentMapLayers.includes(layerName);
        userLayers[layerName].addedToMap = isInMap;
      });

      // Save back to localStorage
      localStorage.setItem('userLayers', JSON.stringify(userLayers));
      console.log('Synchronized layer status with actual map state');
    }
  } catch (error) {
    console.error('Error synchronizing layer status:', error);
  }
};
```
