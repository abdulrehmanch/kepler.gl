// SPDX-License-Identifier: MIT
// Copyright contributors to the kepler.gl project

export default {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        name: 'Central Park',
        type: 'Park',
        description: 'Famous urban park in Manhattan',
        visitors: '42000000',
        area: '3.41',
        latitude: 40.7829,
        longitude: -73.9654
      },
      geometry: {
        type: 'Point',
        coordinates: [-73.9654, 40.7829]
      }
    },
    {
      type: 'Feature',
      properties: {
        name: 'Golden Gate Park',
        type: 'Park',
        description: 'Urban park in San Francisco',
        visitors: '24000000',
        area: '4.1',
        latitude: 37.7694,
        longitude: -122.4862
      },
      geometry: {
        type: 'Point',
        coordinates: [-122.4862, 37.7694]
      }
    },
    {
      type: 'Feature',
      properties: {
        name: 'Griffith Park',
        type: 'Park',
        description: 'Large urban park in Los Angeles',
        visitors: '10000000',
        area: '4.31',
        latitude: 34.1365,
        longitude: -118.3004
      },
      geometry: {
        type: 'Point',
        coordinates: [-118.3004, 34.1365]
      }
    },
    {
      type: 'Feature',
      properties: {
        name: 'Millennium Park',
        type: 'Park',
        description: 'Public park in Chicago',
        visitors: '25000000',
        area: '0.24',
        latitude: 41.8826,
        longitude: -87.6226
      },
      geometry: {
        type: 'Point',
        coordinates: [-87.6226, 41.8826]
      }
    },
    {
      type: 'Feature',
      properties: {
        name: 'High Line',
        type: 'Park',
        description: 'Linear park in New York City',
        visitors: '8000000',
        area: '0.12',
        latitude: 40.7480,
        longitude: -74.0048
      },
      geometry: {
        type: 'Point',
        coordinates: [-74.0048, 40.7480]
      }
    }
  ]
};
