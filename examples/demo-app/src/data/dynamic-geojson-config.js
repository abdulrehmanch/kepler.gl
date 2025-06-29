// SPDX-License-Identifier: MIT
// Copyright contributors to the kepler.gl project

export default {
  version: 'v1',
  config: {
    visState: {
      filters: [],
      layers: [
        {
          id: 'dynamic-parks',
          type: 'point',
          config: {
            dataId: 'dynamic-parks-data',
            label: 'Famous Parks',
            color: [255, 140, 0],
            columns: {
              lat: 'latitude',
              lng: 'longitude',
              altitude: null
            },
            isVisible: true,
            visConfig: {
              radius: 20,
              fixedRadius: false,
              opacity: 0.8,
              outline: true,
              thickness: 2,
              colorRange: {
                name: 'Global Warming',
                type: 'sequential',
                category: 'Uber',
                colors: ['#5A1846', '#900C3F', '#C70039', '#E3611C', '#F1920E', '#FFC300']
              },
              radiusRange: [0, 50],
              filled: true
            }
          },
          visualChannels: {
            colorField: {
              name: 'visitors',
              type: 'integer'
            },
            colorScale: 'quantile',
            sizeField: {
              name: 'area',
              type: 'real'
            },
            sizeScale: 'sqrt'
          }
        }
      ],
      interactionConfig: {
        tooltip: {
          fieldsToShow: {
            'dynamic-parks-data': [
              {
                name: 'name',
                format: null
              },
              {
                name: 'type',
                format: null
              },
              {
                name: 'description',
                format: null
              },
              {
                name: 'visitors',
                format: null
              },
              {
                name: 'area',
                format: null
              }
            ]
          },
          enabled: true
        },
        brush: {
          size: 0.5,
          enabled: false
        }
      },
      layerBlending: 'normal'
    },
    mapState: {
      bearing: 0,
      dragRotate: false,
      latitude: 39.0,
      longitude: -98.0,
      pitch: 0,
      zoom: 3,
      isSplit: false
    },
    mapStyle: {
      styleType: 'dark',
      topLayerGroups: {},
      visibleLayerGroups: {},
      threeDBuildingColor: [9.19, 17.47, 37.25],
      mapStyles: {}
    }
  }
};
