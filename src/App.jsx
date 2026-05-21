import { useState, useEffect } from 'react'
import {
  AppShell,
  Tabs,
  Card,
  Group,
  Stack,
  Text,
  Title,
  Badge,
  Table,
  Image,
  SimpleGrid,
  Box,
  Container,
  Paper,
  Loader,
  ThemeIcon,
  Divider,
  List,
} from '@mantine/core'
import '@mantine/core/styles.css'
import './App.css'
import DeckMap from './DeckMap'
import SynMaxLogo from './assets/icons/SynMaxLogo.svg'

// ─── Data Loading ───
function useManifest() {
  const [manifest, setManifest] = useState(null)
  const [datasets, setDatasets] = useState({})
  const [mapConfigs, setMapConfigs] = useState({})
  const [mapDatasets, setMapDatasets] = useState({})
  const [grainData, setGrainData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/data/manifest.json').then(r => r.json()),
      fetch('/data/maps.json').then(r => r.json()).catch(() => ({})),
      fetch('/data/dataset_map.json').then(r => r.json()).catch(() => ({})),
      fetch('/data/grain.json').then(r => r.json()).catch(() => null),
    ]).then(([m, maps, dsMap, grain]) => {
      setManifest(m)
      setMapConfigs(maps)
      setGrainData(grain)

      const dsEntries = Object.entries(m.datasets || {})
      const manifestLoads = dsEntries.map(([key, info]) => {
        const filePath = info.file.startsWith('/') ? info.file : `/${info.file}`
        return fetch(filePath)
          .then(r => r.ok ? r.json() : [])
          .then(data => ({ key, data }))
          .catch(() => ({ key, data: [] }))
      })

      const mapDsLoads = Object.entries(dsMap).map(([dsId, fileName]) => {
        return fetch(`/data/${fileName}`)
          .then(r => r.ok ? r.json() : [])
          .then(data => ({ dsId: parseInt(dsId), data }))
          .catch(() => ({ dsId: parseInt(dsId), data: [] }))
      })

      return Promise.all([Promise.all(manifestLoads), Promise.all(mapDsLoads)])
    }).then(([manifestResults, mapDsResults]) => {
      const ds = {}
      manifestResults.forEach(({ key, data }) => { ds[key] = data })
      setDatasets(ds)

      const mds = {}
      mapDsResults.forEach(({ dsId, data }) => { mds[dsId] = data })
      setMapDatasets(mds)

      setLoading(false)
    }).catch(err => {
      console.error('Failed to load:', err)
      setLoading(false)
    })
  }, [])

  return { manifest, datasets, mapConfigs, mapDatasets, grainData, loading }
}

// Helper: resolve dataset
function resolveDataset(datasetRef, datasets) {
  if (!datasetRef) return []
  if (datasetRef.includes('+')) {
    return datasetRef.split('+').flatMap(k => datasets[k.trim()] || [])
  }
  return datasets[datasetRef] || []
}

function stripEmojis(value) {
  if (typeof value !== 'string') return value
  return value.replace(/\p{Extended_Pictographic}/gu, '').replace(/\uFE0F/gu, '').trim()
}

function toTitleCase(value) {
  if (typeof value !== 'string') return value
  return value
    .toLowerCase()
    .replace(/\b([a-z])/g, (match) => match.toUpperCase())
}

function removeDateFromSubtitle(value) {
  if (typeof value !== 'string') return value
  return value
    .replace(/\s*[•-]\s*\d{1,2}\s+[a-z]{3,9}\s+\d{4}\s*$/i, '')
    .replace(/\s*[•-]\s*\d{4}-\d{2}-\d{2}\s*$/i, '')
    .trim()
}

function getFlagCode(row, val) {
  const raw = row.flag_short_code || row.flag_code || val
  if (typeof raw !== 'string') return null
  const code = raw.trim().toLowerCase()
  return /^[a-z]{2}$/.test(code) ? code : null
}

function shouldRenderWithoutCard(component) {
  const title = stripEmojis(String(component?.title || component?.id || '')).toLowerCase()
  return (
    title.includes('dark satellite detections') ||
    title.includes('spoofing events') ||
    (title.includes('satellite detection chips') && title.includes('dark vessels'))
  )
}

// ─── KPI Card ───
function KpiCard({ component, datasets }) {
  const data = resolveDataset(component.dataset, datasets)
  let value = '—'

  const query = component.query || ''
  if (query === 'count') {
    value = data.length
  } else if (query.startsWith('count_distinct:')) {
    const field = query.split(':')[1]
    value = new Set(data.map(r => r[field]).filter(Boolean)).size
  } else if (query === 'count_where' && component.filter) {
    value = data.filter(r => Object.entries(component.filter).every(([k, v]) => r[k] === v)).length
  } else if (query.startsWith('avg:')) {
    const field = query.split(':')[1]
    const vals = data.map(r => parseFloat(r[field])).filter(v => !isNaN(v))
    value = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '—'
  } else if (query === 'avg' && component.field) {
    const vals = data.map(r => parseFloat(r[component.field])).filter(v => !isNaN(v))
    value = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '—'
  }

  return (
    <Card className="kpi-card" shadow="sm" padding="lg" radius="md" withBorder>
      <Text
        size="xs"
        c="#888F9E"
        tt="uppercase"
        fw={600}
        ta="center"
        style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
      >
        {stripEmojis(component.label)}
      </Text>
      <Text size="32px" fw={600} mt={4} ta="center" c="#ffffff">{value}</Text>
    </Card>
  )
}

// ─── Detection Table ───
function DetectionTable({ component, datasets }) {
  const data = resolveDataset(component.dataset, datasets)
  const columns = component.columns || []
  const renderWithoutCard = shouldRenderWithoutCard(component)

  if (component.size_bins) {
    return <SizeBinTable component={component} data={data} />
  }

  if (!columns.length || !data.length) {
    return (
      <Card shadow="sm" padding="md" radius="md" withBorder>
        <Text fw={700} size="sm" mb="sm">{stripEmojis(component.title || component.id)}</Text>
        <Text size="xs" c="#888F9E">No data available ({data.length} rows, {columns.length} columns configured)</Text>
      </Card>
    )
  }

  const tableContent = (
    <>
      {component.title && <Text fw={600} size="20px" c="#ffffff" mt={16} mb="sm">{stripEmojis(component.title)}</Text>}
      <Box style={{ overflowX: 'auto' }}>
        <Table className="dashboard-table" style={{ fontSize: '13px' }}>
          <Table.Thead>
            <Table.Tr>
              {columns.map(col => (
                <Table.Th key={col.key} style={{ fontSize: '11px', textTransform: 'uppercase' }}>{col.label}</Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.slice(0, 50).map((row, i) => (
              <Table.Tr key={i}>
                {columns.map(col => {
                  let val = row[col.key]
                  if (col.round && typeof val === 'number') val = val.toFixed(col.round)
                  const isFlagColumn = /flag/i.test(col.key) || /flag/i.test(col.label || '')
                  const flagCode = isFlagColumn ? getFlagCode(row, val) : null
                  return (
                    <Table.Td key={col.key} style={{ fontSize: '12px' }}>
                      {isFlagColumn && flagCode ? (
                        <Box style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <img
                            src={`https://flagcdn.com/${flagCode}.svg`}
                            alt=""
                            width={16}
                            height={12}
                            style={{ display: 'block', borderRadius: 1 }}
                          />
                          <span>{val != null ? String(val) : '—'}</span>
                        </Box>
                      ) : val != null ? String(val) : '—'}
                    </Table.Td>
                  )
                })}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Box>
    </>
  )

  if (renderWithoutCard) {
    return <Box>{tableContent}</Box>
  }

  return <Card shadow="sm" padding="md" radius="md" withBorder>{tableContent}</Card>
}

// ─── Size Bin Table ───
function SizeBinTable({ component, data }) {
  const bins = component.size_bins || []
  const isMultiSource = (component.dataset || '').includes('+')
  const sources = isMultiSource ? (component.dataset || '').split('+').map(s => s.trim()) : null
  const displayTitle = 'Size Class Distribution'

  // Build rows: if multi-source, show a Source column with counts per source
  const rows = []
  if (isMultiSource && sources) {
    const sourceLabels = { dataset_15: 'Dark', dataset_16: 'Unattributed' }
    // We need to know which items came from which dataset
    // Since resolveDataset flattens them, we tag by _source
    bins.forEach(bin => {
      const matching = data.filter(r => {
        const len = parseFloat(r.length)
        return !isNaN(len) && len >= bin.min && len <= bin.max
      })
      const darkCount = matching.filter(r => r.dark === true || r.dark === 1 || r.dark === '1' || r.dark === 'true').length
      const unattr = matching.length - darkCount
      if (darkCount > 0) rows.push({ label: bin.label, count: darkCount, source: 'Dark' })
      if (unattr > 0) rows.push({ label: bin.label, count: unattr, source: 'Unattributed' })
    })
  } else {
    bins.forEach(bin => {
      const count = data.filter(r => {
        const len = parseFloat(r.length)
        return !isNaN(len) && len >= bin.min && len <= bin.max
      }).length
      rows.push({ label: bin.label, count })
    })
  }

  const totalCount = rows.reduce((s, r) => s + r.count, 0)

  return (
    <Box>
      <Text fw={600} size="20px" c="#ffffff" mt={16} mb="sm">{displayTitle}</Text>
      <Table className="dashboard-table" style={{ fontSize: '13px' }}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ fontSize: '11px', width: isMultiSource ? '42%' : '70%' }}>SIZE CLASS</Table.Th>
            {isMultiSource && <Table.Th style={{ fontSize: '11px', width: '28%' }}>SOURCE</Table.Th>}
            <Table.Th style={{ fontSize: '11px', width: isMultiSource ? '30%' : '30%', textAlign: 'right' }}>COUNT</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((r, i) => (
            <Table.Tr key={i}>
              <Table.Td style={{ fontSize: '12px' }}>{r.label}</Table.Td>
              {isMultiSource && (
                <Table.Td style={{ fontSize: '12px' }}>
                  <Badge
                    size="xs"
                    variant="filled"
                    style={
                      r.source === 'Dark'
                        ? { backgroundColor: '#FFA500', color: '#111326' }
                        : { backgroundColor: '#F75349', color: '#111326' }
                    }
                  >
                    {r.source}
                  </Badge>
                </Table.Td>
              )}
              <Table.Td style={{ fontSize: '12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {r.count.toLocaleString()}
              </Table.Td>
            </Table.Tr>
          ))}
          <Table.Tr style={{ borderTop: '1px solid var(--mantine-color-dark-4)' }}>
            <Table.Td style={{ fontSize: '12px', fontWeight: 700 }}>Total</Table.Td>
            {isMultiSource && <Table.Td />}
            <Table.Td style={{ fontSize: '12px', fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {totalCount.toLocaleString()}
            </Table.Td>
          </Table.Tr>
        </Table.Tbody>
      </Table>
    </Box>
  )
}

// ─── Spoofing Summary ───
function SpoofingSummary({ component }) {
  const vessels = component.vessels || []
  const displayTitle = toTitleCase(stripEmojis(component.title || ''))
  const content = (
    <>
      <Text fw={600} size="20px" c="#ffffff" mt={16} mb={4}>{displayTitle}</Text>
      {component.description && <Text size="xs" c="#888F9E" mb="md">{stripEmojis(component.description)}</Text>}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing={8}>
        {vessels.map((v, i) => (
          <Paper className="spoofing-vessel-card" key={i} p="sm" radius="md" withBorder>
            <Text fw={600} size="sm">{v.name || '—'}</Text>
            <Text size="xs" c="#888F9E">IMO: {v.imo || '—'}</Text>
            <Text size="xs" c="#888F9E">MMSI: {v.mmsi || '—'}</Text>
            <Text size="xs" c="#888F9E">Flag: {v.flag || '—'}</Text>
            <Text size="xs" c="#888F9E">Type: {v.type || '—'}</Text>
            {v.description && <Text size="xs" mt={4}>{v.description}</Text>}
          </Paper>
        ))}
      </SimpleGrid>
    </>
  )

  if (shouldRenderWithoutCard(component)) {
    return <Box>{content}</Box>
  }

  return (
    <Card shadow="sm" padding="md" radius="md" withBorder>
      {content}
    </Card>
  )
}

// ─── Chip Grid (Satellite Detection Cards) ───
function ChipGrid({ component, datasets }) {
  const data = resolveDataset(component.dataset, datasets)
  const rawFields = component.fields || ['name', 'imo', 'mmsi', 'ship_type', 'flag_short_code']
  const fields = rawFields.map(f => typeof f === 'string' ? { key: f, label: f } : f)
  const imageField = component.image_field || 'image_url'
  const renderWithoutCard = shouldRenderWithoutCard(component)
  const displayTitle = toTitleCase(stripEmojis(component.title || '')).replace(/\bAis\b/g, 'AIS')

  if (!data.length) {
    return (
      <Card shadow="sm" padding="md" radius="md" withBorder>
        <Text fw={700} size="sm">{stripEmojis(component.title || 'Detections')}</Text>
        <Text size="xs" c="#888F9E" mt="sm">No detections to display</Text>
      </Card>
    )
  }

  const content = (
    <>
      <Group mb="sm" align="flex-end">
        <Text fw={600} size="20px" c="#ffffff" mt={16}>{displayTitle}</Text>
        <Badge size="sm" variant="filled"
          style={{
            marginTop: 16,
            backgroundColor: '#FFA500',
            color: '#111326',
            minHeight: 22,
            display: 'inline-flex',
            alignItems: 'center',
          }}>
          {data.length} DETECTIONS
        </Badge>
      </Group>
      <SimpleGrid cols={{ base: 1, sm: 2, md: component.columns_per_row || 4 }} spacing={8}>
        {data.slice(0, 24).map((item, i) => (
          <Paper key={i} className="chip-detection-card" p="xs" radius="md" withBorder
            style={{ overflow: 'hidden' }}>
            <div style={{ position: 'relative' }}>
              {item[imageField] ? (
                <Image src={item[imageField]} h={140} fit="cover" radius={4} mb="xs"
                  fallbackSrc="https://placehold.co/200x140/0a1929/475569?text=No+Image" />
              ) : (
                <div style={{ height: 140, background: '#0a1929', borderRadius: 6, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                  <Text size="xs" c="#475569">No image available</Text>
                </div>
              )}
              <Badge size="xs" variant="filled"
                style={{ position: 'absolute', top: 6, right: 6, backgroundColor: '#FFA500', color: '#111326' }}>
                DARK
              </Badge>
            </div>
            <Text fw={700} size="sm" c="white" truncate="end" mb={6}>
              {item.name || 'UNIDENTIFIED'}
            </Text>
            <Text size="xs" c="#888F9E" mt={2}>OID: {item.object_id}</Text>
            {fields.filter(f => f.key !== 'name' && f.key !== 'object_id').map(f => (
              <Text key={f.key} size="xs" c="#888F9E" truncate="end">
                <Text span c="#888F9E" size="xs">{f.label}: </Text>
                <Text span c="white" size="xs">
                  {item[f.key] != null ? String(item[f.key]) + (f.suffix || '') : '—'}
                </Text>
              </Text>
            ))}
          </Paper>
        ))}
      </SimpleGrid>
    </>
  )

  if (renderWithoutCard) {
    return <Box>{content}</Box>
  }

  return (
    <Card shadow="sm" padding="md" radius="md" withBorder>
      {content}
    </Card>
  )
}

// ─── Detail Panel (Satellite Detection Chip) ───
function DetailPanel({ component, datasets, height }) {
  const data = resolveDataset(component.dataset, datasets)
  const fallbackData = component.fallback_dataset ? resolveDataset(component.fallback_dataset, datasets) : []
  const allData = [...data, ...fallbackData]
  const rawFields = component.fields || []
  const fields = rawFields.map(f => typeof f === 'string' ? { key: f, label: f } : f)
  const imageField = component.image_field || 'image_url'
  const matchCol = component.match_column || 'object_id'

  // In the standalone app we don't have dashboard params, so show first item as preview
  // or let parent pass selectedId
  const item = allData.length > 0 ? allData[0] : null
  const getFieldKey = (f) => String(f.key || '').toLowerCase()
  const latField = fields.find(f => getFieldKey(f) === 'lat')
  const lonField = fields.find(f => getFieldKey(f) === 'lon')
  const acquiredField = fields.find(f => getFieldKey(f) === 'acquired')
  const orderedFields = [
    ...fields.filter(f => !['lat', 'lon', 'acquired'].includes(getFieldKey(f))),
    ...(latField ? [latField] : []),
    ...(lonField ? [lonField] : []),
    ...(acquiredField ? [acquiredField] : []),
  ]

  if (!item) {
    const ph = component.placeholder || {}
    return (
      <Card className="detail-panel-card" shadow="sm" padding="md" radius="md" withBorder style={{ minHeight: height || 200, height: height || '100%' }}>
        <Text fw={700} size="sm" mb="md">{stripEmojis(component.title || 'Detection Chip')}</Text>
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <Text size="xl" mb="sm">{ph.icon || '🛰'}</Text>
          <Text size="xs" c="#888F9E">{ph.text || 'No detection data available'}</Text>
        </div>
      </Card>
    )
  }

  return (
    <Card className="detail-panel-card" shadow="sm" padding="md" radius="md" withBorder style={{ height: height || '100%' }}>
      <Group justify="space-between" mb="sm">
        <Text fw={700} size="sm">{stripEmojis(component.title || 'Detection Chip')}</Text>
        <Badge
          size="xs"
          variant="filled"
          style={{ backgroundColor: '#006CD7', color: '#ffffff' }}
        >
          OID: {item[matchCol]}
        </Badge>
      </Group>
      <div style={{ marginBottom: 12 }}>
        {item[imageField] ? (
          <Image src={item[imageField]} w="100%" h={140} fit="cover" radius={4}
            fallbackSrc="https://placehold.co/300x200/0a1929/475569?text=Image+Unavailable" />
        ) : (
          <div style={{ height: 140, background: '#0a1929', borderRadius: 4, display: 'flex',
            alignItems: 'center', justifyContent: 'center', border: '1px dashed #334155' }}>
            <div style={{ textAlign: 'center' }}>
              <Text size="xl" mb={4}>📡</Text>
              <Text size="xs" c="#475569">Image unavailable</Text>
            </div>
          </div>
        )}
      </div>
      <SimpleGrid cols={2} spacing={{ base: 12, sm: 18 }}>
        {orderedFields.map(f => (
          <Box key={f.key} mb={8}>
            <Text size="12px" c="#888F9E" mb={4}>
              {f.label}
            </Text>
            <Text size="13px" c="#ffffff" fw={400} truncate="end">
              {item[f.key] != null
                ? (getFieldKey(f) === 'name'
                  ? toTitleCase(String(item[f.key]))
                  : String(item[f.key])) + (f.suffix || '')
                : 'N/A'}
            </Text>
          </Box>
        ))}
      </SimpleGrid>
    </Card>
  )
}

// ─── HTML Content Card ───
function HtmlCard({ component }) {
  const html = component.html || ''
  if (!html) {
    return (
      <Card shadow="sm" padding="md" radius="md" withBorder>
        <Text size="xs" c="#888F9E">Empty content: {component.id}</Text>
      </Card>
    )
  }
  return (
    <Card shadow="sm" padding="md" radius="md" withBorder>
      <div className="html-content-card" dangerouslySetInnerHTML={{ __html: stripEmojis(html) }} />
    </Card>
  )
}

// ─── Map Component (real Deck.gl) ───
function MapComponent({ component, mapConfigs, mapDatasets, height = 560 }) {
  const templateId = component.template_id
  const mapConfig = templateId ? mapConfigs[templateId] : null

  if (!mapConfig) {
    return (
      <Box
        p="xl"
        style={{
          minHeight: 400,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Stack align="center" gap="xs">
          <Text size="sm" fw={600}>{stripEmojis(component.title || component.id)}</Text>
          <Text size="xs" c="#888F9E">Map config not found: {templateId || 'N/A'}</Text>
        </Stack>
      </Box>
    )
  }

  return (
    <Box>
      <Box style={{ borderRadius: 8, overflow: 'hidden' }}>
        <DeckMap mapConfig={mapConfig} datasets={mapDatasets} height={height} />
      </Box>
    </Box>
  )
}

// ═══════════════════════════════════════════════════
// GRAIN PAGE COMPONENTS
// ═══════════════════════════════════════════════════

// ─── Port Card ───
function PortCard({ port, withinCard = false }) {
  const statItems = [
    { label: 'DARK', value: port.stats.dark, color: '#f87171' },
    { label: 'UNATTRIBUTED', value: port.stats.unattributed, color: '#fb923c' },
    { label: 'AIS-LIGHT', value: port.stats.ais_light, color: '#4ade80' },
    { label: 'TOTAL', value: port.stats.total, color: '#e2e8f0' },
  ]

  const content = (
    <>
      <Group justify="space-between" mb="sm">
        <Text fw={800} size="lg" c="#ffffff">{`${port.name} — 50km Detections`}</Text>
        <Badge
          size="lg"
          variant="light"
          color={port.risk_color === '#4ade80' ? 'green' : port.risk_color === '#fbbf24' ? 'yellow' : 'blue'}
          styles={{ root: { border: `1px solid ${port.risk_color}40` } }}
        >
          {port.risk}
        </Badge>
      </Group>
      <Text size="xs" c="#888F9E" mb="xs">{port.coords}</Text>
      <Text size="sm" c="#888F9E" mb="md">{port.description}</Text>
      <SimpleGrid cols={4} spacing="xs">
        {statItems.map(s => (
          <Paper className="port-stat-card" key={s.label} p="xs" radius="md" withBorder ta="center">
            <Text size="xl" fw={800} c="#ffffff">{s.value}</Text>
            <Text size="10px" fw={700} c="#888F9E" tt="uppercase" mt={2}>{s.label}</Text>
          </Paper>
        ))}
      </SimpleGrid>
    </>
  )

  if (withinCard) {
    return <Box>{content}</Box>
  }

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      {content}
    </Card>
  )
}

// ─── Suspect Table ───
function SuspectTable({ suspect, withinCard = false }) {
  if (!suspect.vessels || suspect.vessels.length === 0) {
    const emptyContent = (
      <>
        <Text fw={700} size="sm" c="#4ade80" mb="xs">{suspect.title}</Text>
        <Text size="sm" c="#888F9E">{suspect.empty_message || 'No suspects identified.'}</Text>
      </>
    )

    if (withinCard) {
      return <Box>{emptyContent}</Box>
    }

    return (
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        {emptyContent}
      </Card>
    )
  }

  const tableContent = (
    <>
      <Text fw={700} size="sm" c="#fbbf24" mb={4}>{suspect.title}</Text>
      <Text size="xs" c="#888F9E" mb="sm">
        Unattributed & dark cargo vessels 90–200m within 50km • Ranked by risk score
      </Text>
      <Box style={{ overflowX: 'auto' }}>
        <Table className="dashboard-table" style={{ fontSize: '13px' }}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ fontSize: '11px' }}>#</Table.Th>
              <Table.Th style={{ fontSize: '11px' }}>VESSEL</Table.Th>
              <Table.Th style={{ fontSize: '11px' }}>IMO</Table.Th>
              <Table.Th style={{ fontSize: '11px' }}>FLAG</Table.Th>
              <Table.Th style={{ fontSize: '11px' }}>SIZE</Table.Th>
              <Table.Th style={{ fontSize: '11px' }}>POSITION</Table.Th>
              <Table.Th style={{ fontSize: '11px' }}>RISK</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {suspect.vessels.map((v, i) => (
              <Table.Tr key={i}>
                <Table.Td style={{ fontSize: '12px', fontWeight: 600 }}>{v.rank}</Table.Td>
                <Table.Td style={{ fontSize: '12px', fontWeight: 600 }}>{v.name}</Table.Td>
                <Table.Td style={{ fontSize: '12px', color: '#888F9E' }}>{v.imo}</Table.Td>
                <Table.Td style={{ fontSize: '12px', color: '#888F9E' }}>{v.flag}</Table.Td>
                <Table.Td style={{ fontSize: '12px', color: '#888F9E' }}>{v.size}</Table.Td>
                <Table.Td style={{ fontSize: '12px', color: '#888F9E' }}>{v.position}</Table.Td>
                <Table.Td style={{ fontSize: '12px' }}>
                  <Text span fw={700} c={v.risk >= 40 ? '#fbbf24' : '#fb923c'}>{v.risk}</Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Box>
    </>
  )

  if (withinCard) {
    return <Box>{tableContent}</Box>
  }

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      {tableContent}
    </Card>
  )
}

// ─── Assessment Panel ───
function AssessmentPanel({ assessment }) {
  const sections = [
    { title: 'KEY FINDINGS', items: assessment.key_findings },
    { title: 'GRAIN SMUGGLING RISK', items: assessment.grain_risk },
    { title: 'REGIONAL OVERVIEW', items: assessment.regional_overview },
  ]

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Text fw={800} size="lg" c="#ffffff" mb="md">Daily Intelligence Assessment — 15 May 2026</Text>
      <Stack gap="lg">
        {sections.map(s => (
          <Box key={s.title}>
            <Text fw={700} size="sm" c="#ffffff" mb="xs">{s.title}</Text>
            <Stack gap={6}>
              {s.items.map((item, i) => (
                <Group key={i} gap="xs" align="flex-start" wrap="nowrap">
                  <Text c="#888F9E" size="sm" mt={1}>•</Text>
                  <Text size="sm" c="#e2e8f0" style={{ lineHeight: 1.6 }}>{item}</Text>
                </Group>
              ))}
            </Stack>
          </Box>
        ))}
      </Stack>
    </Card>
  )
}

// ─── Grain Page ───
function GrainPage({ grainData, mapConfigs, mapDatasets }) {
  if (!grainData) {
    return (
      <Card shadow="sm" padding="xl" radius="md" withBorder>
        <Text c="#888F9E">No grain data loaded.</Text>
      </Card>
    )
  }

  const { header, ports, port_order, suspects, assessment, methodology } = grainData

  return (
    <Stack gap={8}>
      {/* Header */}
      <Card shadow="sm" padding="lg" radius="md" withBorder
        style={{ background: 'linear-gradient(135deg, var(--mantine-color-dark-6) 0%, var(--mantine-color-dark-7) 100%)' }}>
        <Text fw={800} size="xl" c="#fbbf24">{header.title}</Text>
        <Text size="sm" c="#888F9E" mt={4}>{header.subtitle}</Text>
      </Card>

      {/* Port sections */}
      {port_order.map(portKey => {
        const port = ports[portKey]
        const suspect = suspects[portKey]
        if (!port) return null

        return (
          <Card key={portKey} shadow="sm" padding="lg" radius="md" withBorder>
            <PortCard port={port} withinCard />
            {port.map_id && mapConfigs[port.map_id] && (
              <Box mt={8}>
                <Box style={{ borderRadius: 8, overflow: 'hidden' }}>
                  <DeckMap mapConfig={mapConfigs[port.map_id]} datasets={mapDatasets} height={450} />
                </Box>
              </Box>
            )}
            <Box mt={8}>
              <SuspectTable suspect={suspect} withinCard />
            </Box>
          </Card>
        )
      })}

      {/* Methodology */}
      <Card shadow="sm" padding="md" radius="md" withBorder>
        <Text fw={700} size="sm" c="#888F9E" mb="xs">METHODOLOGY</Text>
        <Text size="xs" c="#888F9E" style={{ lineHeight: 1.6 }}>{methodology}</Text>
      </Card>

      {/* Assessment */}
      <AssessmentPanel assessment={assessment} />
    </Stack>
  )
}

// ─── Component Router ───
function RenderComponent({ component, datasets, mapConfigs, mapDatasets, height }) {
  switch (component.type) {
    case 'kpi':
      return <KpiCard component={component} datasets={datasets} />
    case 'table':
      return <DetectionTable component={component} datasets={datasets} />
    case 'spoofing_summary':
      return <SpoofingSummary component={component} />
    case 'chip_grid':
      return <ChipGrid component={component} datasets={datasets} />
    case 'map':
      return <MapComponent component={component} mapConfigs={mapConfigs} mapDatasets={mapDatasets} height={height} />
    case 'detail_panel':
      return <DetailPanel component={component} datasets={datasets} height={height} />
    case 'port_card':
    case 'suspect_table':
    case 'assessment':
    case 'text':
    case 'methodology':
      return <HtmlCard component={component} />
    default:
      return (
        <Card shadow="sm" padding="sm" radius="md" withBorder>
          <Text size="xs" c="#888F9E">Unknown: {component.type} ({component.id})</Text>
        </Card>
      )
  }
}

// ─── Section Renderer ───
function Section({ section, datasets, mapConfigs, mapDatasets }) {
  const components = section.components || []
  const kpis = components.filter(c => c.type === 'kpi')
  const others = components.filter(c => c.type !== 'kpi')
  const titleText = toTitleCase(stripEmojis(section.title || ''))
  const hideOverviewTitle = titleText.startsWith('Daily Intelligence Overview')
  const hideAssessmentSection = titleText.startsWith('Daily Intelligence Assessment')

  if (hideAssessmentSection) return null

  const mapDetailHeight = 560
  // Group map + detail_panel into a side-by-side layout; keep size table full-width below
  const mapComp = others.find(c => c.type === 'map')
  const detailPanel = others.find(c => c.type === 'detail_panel')
  const sizeTable = others.find(c => c.type === 'table' && c.size_bins)
  const hasMapDetailLayout = Boolean(mapComp && detailPanel)
  const hasMapOnlyLayout = Boolean(mapComp && !detailPanel)
  const remainingComps = others.filter(c => {
    if (c === mapComp || c === detailPanel || c === sizeTable) return false
    return true
  })

  return (
    <Box mb={8}>
      {section.title && !hideOverviewTitle && (
        <Box mb={14}>
          <Text fw={700} size="24px" c="#ffffff">{titleText}</Text>
        </Box>
      )}
      {kpis.length > 0 && (
        <SimpleGrid cols={{ base: 2, sm: 3, md: Math.min(kpis.length, 6) }} spacing={8}
          mb={(hasMapDetailLayout || hasMapOnlyLayout || sizeTable || remainingComps.length > 0) ? 8 : 0}>
          {kpis.map(c => <RenderComponent key={c.id} component={c} datasets={datasets}
            mapConfigs={mapConfigs} mapDatasets={mapDatasets} />)}
        </SimpleGrid>
      )}
      {hasMapDetailLayout && (
        <Box mb={(sizeTable || remainingComps.length > 0) ? 8 : 0}
          style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
          <Box style={{ minHeight: mapDetailHeight }}>
            <RenderComponent component={mapComp} datasets={datasets}
              mapConfigs={mapConfigs} mapDatasets={mapDatasets} height={mapDetailHeight} />
          </Box>
          <Box style={{ height: mapDetailHeight }}>
            <RenderComponent component={detailPanel} datasets={datasets}
              mapConfigs={mapConfigs} mapDatasets={mapDatasets} height={mapDetailHeight} />
          </Box>
        </Box>
      )}
      {hasMapOnlyLayout && (
        <Box mb={(sizeTable || remainingComps.length > 0) ? 8 : 0}>
          <RenderComponent component={mapComp} datasets={datasets}
            mapConfigs={mapConfigs} mapDatasets={mapDatasets} height={mapDetailHeight} />
        </Box>
      )}
      {sizeTable && (
        <Box mb={remainingComps.length > 0 ? 8 : 0}>
          <RenderComponent component={sizeTable} datasets={datasets}
            mapConfigs={mapConfigs} mapDatasets={mapDatasets} />
        </Box>
      )}
      <Stack gap={8}>
        {remainingComps.map(c => <RenderComponent key={c.id} component={c} datasets={datasets}
          mapConfigs={mapConfigs} mapDatasets={mapDatasets} />)}
      </Stack>
    </Box>
  )
}

// ─── App ───
export default function App() {
  const { manifest, datasets, mapConfigs, mapDatasets, grainData, loading } = useManifest()
  const [activeTab, setActiveTab] = useState('')

  if (loading || !manifest) {
    return (
      <Box p="xl" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text size="lg" c="#888F9E">Loading dashboard data…</Text>
        </Stack>
      </Box>
    )
  }

  const pages = manifest.pages || []
  const isChipCutoffSection = (section) => {
    const sectionTitle = stripEmojis(String(section?.title || '')).toLowerCase()
    const sectionId = String(section?.id || '').toLowerCase()
    if (sectionTitle.includes('satellite detection chips') && sectionTitle.includes('dark vessels')) return true
    if (sectionId.includes('detection-chips')) return true

    const components = Array.isArray(section?.components) ? section.components : []
    return components.some((comp) => {
      if (comp?.type !== 'chip_grid') return false
      const compTitle = stripEmojis(String(comp?.title || '')).toLowerCase()
      return compTitle.includes('satellite detection chips') && compTitle.includes('dark vessels')
    })
  }
  const splitSectionsByChipCutoff = (sections = []) => {
    const cutoffIndex = sections.findIndex(isChipCutoffSection)
    return {
      inCardSections: cutoffIndex >= 0 ? sections.slice(0, cutoffIndex + 1) : sections,
      outOfCardSections: cutoffIndex >= 0 ? sections.slice(cutoffIndex + 1) : [],
    }
  }
  const isWeeklyPage = (page) => {
    const key = String(page?.key || '').toLowerCase()
    const label = stripEmojis(String(page?.label || '')).toLowerCase()
    return key === 'weekly' || label.includes('weekly intelligence')
  }
  const shouldRenderSectionCard = (section) => {
    const titleText = toTitleCase(stripEmojis(section?.title || ''))
    return !titleText.startsWith('Daily Intelligence Assessment')
  }
  const getWeeklySectionCardGroups = (sections = []) => {
    const visibleSections = sections.filter(shouldRenderSectionCard)
    const firstGroupEndIndex = visibleSections.findIndex(isChipCutoffSection)

    if (firstGroupEndIndex < 0) {
      return visibleSections.map(section => [section])
    }

    const firstGroup = visibleSections.slice(0, firstGroupEndIndex + 1)
    const remainingGroups = visibleSections.slice(firstGroupEndIndex + 1).map(section => [section])
    return [firstGroup, ...remainingGroups].filter(group => group.length > 0)
  }
  const activeTabKey = activeTab || pages[0]?.key || 'weekly'

  return (
    <AppShell padding="md">
      <AppShell.Main>
        <Container size="xl">
          <Card className="dashboard-header-card" shadow="sm" padding="xl" radius="md" withBorder mb={8}>
            <Box className="dashboard-header-top">
              <Image
                src={SynMaxLogo}
                alt="SynMax Theia"
                className="dashboard-header-logo"
                fit="contain"
              />
              <Badge className="dashboard-header-badge" variant="filled">
                {stripEmojis(manifest.classification)} - {manifest.date}
              </Badge>
            </Box>
            <Text className="dashboard-header-subtitle">
              {stripEmojis(removeDateFromSubtitle(manifest.subtitle))}
            </Text>
            <Title order={1} className="dashboard-header-title">
              {toTitleCase(stripEmojis(manifest.title))}
            </Title>
          </Card>

          <Tabs className="dashboard-tabs" value={activeTabKey} onChange={(val) => val && setActiveTab(val)}>
            <Card shadow="sm" padding={0} radius="md" withBorder mb={8}>
              <Box px={32} pt={16} pb={16}>
                <Tabs.List mt={0} mb={0}>
                  {pages.map(p => <Tabs.Tab key={p.key} value={p.key}>{stripEmojis(p.label)}</Tabs.Tab>)}
                </Tabs.List>
              </Box>
            </Card>

            {pages.map(page => {
              const { inCardSections, outOfCardSections } = splitSectionsByChipCutoff(page.sections || [])
              const showGroupedCard = page.key !== 'grain' && inCardSections.length > 0
              const showPerSectionCards = page.key !== 'grain' && isWeeklyPage(page)

              return (
                <Tabs.Panel key={page.key} value={page.key}>
                  {page.key === 'grain' ? (
                    <GrainPage grainData={grainData} mapConfigs={mapConfigs} mapDatasets={mapDatasets} />
                  ) : (
                    <>
                      {showPerSectionCards ? (
                        <Stack gap={8}>
                          {getWeeklySectionCardGroups(page.sections || []).map((sectionGroup, i) => (
                            <Card key={i} shadow="sm" padding={32} radius="md" withBorder>
                              {sectionGroup.map((section, sectionIdx) => (
                                <Section key={`${section.id || section.title || 'section'}-${sectionIdx}`} section={section} datasets={datasets}
                                  mapConfigs={mapConfigs} mapDatasets={mapDatasets} />
                              ))}
                            </Card>
                          ))}
                        </Stack>
                      ) : showGroupedCard && (
                        <Card shadow="sm" padding={32} radius="md" withBorder mb={outOfCardSections.length > 0 ? 8 : 0}>
                          {inCardSections.map((section, i) => (
                            <Section key={i} section={section} datasets={datasets}
                              mapConfigs={mapConfigs} mapDatasets={mapDatasets} />
                          ))}
                        </Card>
                      )}
                      {outOfCardSections.length > 0 && (
                        !showPerSectionCards && (
                        <Stack gap={8}>
                          {outOfCardSections.map((section, i) => (
                            <Section key={`${i}-${section.title || section.id || 'section'}`} section={section} datasets={datasets}
                              mapConfigs={mapConfigs} mapDatasets={mapDatasets} />
                          ))}
                        </Stack>
                        )
                      )}
                    </>
                  )}
                </Tabs.Panel>
              )
            })}
          </Tabs>
        </Container>
      </AppShell.Main>
    </AppShell>
  )
}
