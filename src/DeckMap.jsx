import { useEffect, useState, useMemo } from 'react';
import { Box, Text, LoadingOverlay } from '@mantine/core';
import { Map } from 'react-map-gl/maplibre';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer, IconLayer } from '@deck.gl/layers';
import DarkIcon from './assets/icons/DarkIcon.svg';
import UnattributedIcon from './assets/icons/UnattributedIcon.svg';
import LightIcon from './assets/icons/LightIcon.svg';
import SpoofingPositionIcon from './assets/icons/SpoofingPositionIcon.svg';
import STSUnattributeUnattributedIcon from './assets/icons/STSUnattributeUnattributedIcon.svg';
import STSLightIcon from './assets/icons/STSLightIcon.svg';
import STSLightLightIcon from './assets/icons/STSLightLightIcon.svg';
import STSLightUnattributeIcon from './assets/icons/STSLightUnattributeIcon.svg';
import STSDarkDarkIcon from './assets/icons/STSDarkDarkIcon.svg';
import STSDarkUnattributedIcon from './assets/icons/STSDarkUnattributedIcon.svg';
import STSLightDarkIcon from './assets/icons/STSLightDarkIcon.svg';

// Color mapping for layer types
const LAYER_COLORS = {
  det_dark: [255, 60, 60, 220],       // red
  det_unattributed: [100, 160, 255, 180], // blue
  det_light: [80, 220, 120, 180],      // green
  det_spoofed_pos: [255, 180, 40, 220],  // orange
  det_sts_cluster: [255, 100, 255, 220], // magenta
  det_sts_uu: [255, 100, 255, 200],
  det_sts_ll: [200, 100, 255, 200],
  det_sts_ul: [255, 140, 200, 200],
  det_sts_lu: [200, 140, 255, 200],
  det_sts_dd: [255, 60, 120, 200],
  det_sts_du: [220, 80, 160, 200],
  det_sts_ud: [180, 100, 200, 200],
  default: [150, 150, 150, 180],
};

// Suspect badge colors
const SUSPECT_COLORS = {
  1: [255, 215, 0, 255],    // gold
  2: [192, 192, 192, 255],  // silver
  3: [205, 127, 50, 255],   // bronze
  4: [120, 180, 255, 255],  // blue
  5: [180, 120, 255, 255],  // purple
};

const ICON_BY_TYPE = {
  det_dark: DarkIcon,
  det_unattributed: UnattributedIcon,
  det_light: LightIcon,
  det_spoofed_pos: SpoofingPositionIcon,
  det_sts_cluster: STSLightLightIcon,
  det_sts_uu: STSUnattributeUnattributedIcon,
  det_sts_ll: STSLightLightIcon,
  det_sts_lu: STSLightUnattributeIcon,
  det_sts_dd: STSDarkDarkIcon,
  det_sts_du: STSDarkUnattributedIcon,
  det_sts_ul: STSLightDarkIcon,
};

function getLayerColor(style) {
  const iconType = style?.icon_type || '';
  return LAYER_COLORS[iconType] || LAYER_COLORS.default;
}

function getLayerIcon(style) {
  const iconType = style?.icon_type || '';
  return ICON_BY_TYPE[iconType] || null;
}

function applyFilter(data, filterExpr) {
  if (!filterExpr || !data) return data;
  // Parse simple expressions like "rank == 1" or "sts_icon == 'det_sts_uu'"
  const match = filterExpr.match(/^(\w+)\s*==\s*(.+)$/);
  if (!match) return data;
  const [, field, rawVal] = match;
  const val = rawVal.replace(/['"]/g, '');
  return data.filter(d => String(d[field]) === val);
}

export default function DeckMap({ mapConfig, datasets, height = 500, onSelect }) {
  const [tooltip, setTooltip] = useState(null);

  const viewState = useMemo(() => ({
    longitude: mapConfig?.initial_view_state?.longitude || 38,
    latitude: mapConfig?.initial_view_state?.latitude || 43,
    zoom: mapConfig?.initial_view_state?.zoom || 5,
    pitch: mapConfig?.initial_view_state?.pitch || 0,
    bearing: mapConfig?.initial_view_state?.bearing || 0,
  }), [mapConfig]);

  const layers = useMemo(() => {
    if (!mapConfig?.layers) return [];
    
    return mapConfig.layers.map((layerCfg) => {
      const datasetId = layerCfg.dataset_id;
      let data = datasets[datasetId] || [];
      
      // Apply filter
      if (layerCfg.filter_expression) {
        data = applyFilter(data, layerCfg.filter_expression);
      }
      
      const latField = layerCfg.latitude_field || 'lat';
      const lonField = layerCfg.longitude_field || 'lon';
      const isSuspect = layerCfg.layer_id?.includes('suspect');
      const suspectRank = isSuspect ? parseInt(layerCfg.filter_expression?.match(/\d+/)?.[0] || '0') : 0;
      const color = isSuspect 
        ? (SUSPECT_COLORS[suspectRank] || LAYER_COLORS.default)
        : getLayerColor(layerCfg.style);
      const iconUrl = isSuspect ? null : getLayerIcon(layerCfg.style);
      
      const radius = isSuspect ? 800 : 
        (layerCfg.style?.icon_type?.includes('sts') ? 600 : 400);

      if (iconUrl) {
        return new IconLayer({
          id: layerCfg.layer_id,
          data,
          getPosition: d => [
            parseFloat(d[lonField]) || 0,
            parseFloat(d[latField]) || 0
          ],
          getIcon: () => ({
            url: iconUrl,
            width: 64,
            height: 64,
            anchorY: 32,
          }),
          sizeUnits: 'pixels',
          getSize: 20,
          sizeMinPixels: 14,
          sizeMaxPixels: 28,
          pickable: true,
          autoHighlight: true,
          highlightColor: [255, 255, 255, 80],
        });
      }

      return new ScatterplotLayer({
        id: layerCfg.layer_id,
        data,
        getPosition: d => [
          parseFloat(d[lonField]) || 0, 
          parseFloat(d[latField]) || 0
        ],
        getRadius: radius,
        getFillColor: color,
        getLineColor: isSuspect ? [255, 255, 255, 255] : [0, 0, 0, 0],
        lineWidthMinPixels: isSuspect ? 2 : 0,
        stroked: isSuspect,
        radiusMinPixels: isSuspect ? 8 : 4,
        radiusMaxPixels: isSuspect ? 20 : 12,
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 255, 255, 80],
      });
    });
  }, [mapConfig, datasets]);

  const onHover = (info) => {
    if (info.object) {
      const layerCfg = mapConfig?.layers?.find(l => l.layer_id === info.layer?.id);
      const fields = layerCfg?.interaction?.tooltip_fields || [];
      setTooltip({
        x: info.x,
        y: info.y,
        object: info.object,
        fields,
      });
    } else {
      setTooltip(null);
    }
  };

  const onClick = (info) => {
    if (!info?.object || typeof onSelect !== 'function') return;
    onSelect(info.object);
  };

  if (!mapConfig) {
    return (
      <Box style={{ height, background: '#1a1b2e', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Text c="#888F9E">Map not available</Text>
      </Box>
    );
  }

  return (
    <Box style={{ height, position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
      <DeckGL
        initialViewState={viewState}
        controller={true}
        layers={layers}
        onHover={onHover}
        onClick={onClick}
        style={{ borderRadius: 8 }}
      >
        <Map
          mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
          attributionControl={false}
          style={{ width: '100%', height: '100%' }}
        />
      </DeckGL>
      
      {tooltip && (
        <div style={{
          position: 'absolute',
          left: tooltip.x + 10,
          top: tooltip.y + 10,
          background: '#181926',
          border: '1px solid #393C56',
          borderRadius: 6,
          padding: '8px 12px',
          pointerEvents: 'none',
          zIndex: 10,
          maxWidth: 300,
        }}>
          {tooltip.fields.map(field => (
            <div key={field} style={{ fontSize: 12, color: '#e2e8f0', marginBottom: 2 }}>
              <span style={{ color: '#888F9E' }}>{field}: </span>
              <span>{String(tooltip.object[field] ?? '—')}</span>
            </div>
          ))}
        </div>
      )}
      
      {/* Legend */}
      <div style={{
        position: 'absolute',
        bottom: 12,
        left: 12,
        background: '#181926',
        border: '1px solid #393C56',
        borderRadius: 6,
        padding: '8px 12px',
        zIndex: 5,
      }}>
        {mapConfig.layers
          .filter(l => !l.layer_id?.includes('suspect'))
          .filter((l, i, arr) => arr.findIndex(x => x.style?.icon_type === l.style?.icon_type) === i)
          .map(l => {
            const color = getLayerColor(l.style);
            const iconUrl = getLayerIcon(l.style);
            return (
              <div key={l.layer_id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                {iconUrl ? (
                  <img
                    src={iconUrl}
                    alt=""
                    width={12}
                    height={12}
                    style={{ display: 'block' }}
                  />
                ) : (
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: `rgba(${color[0]},${color[1]},${color[2]},${color[3]/255})`,
                  }} />
                )}
                <span style={{ fontSize: 11, color: '#888F9E' }}>{l.name}</span>
              </div>
            );
          })}
      </div>
    </Box>
  );
}
