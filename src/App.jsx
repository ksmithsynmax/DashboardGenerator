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
  Select,
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
      fetch('/data/manifest.json').then((r) => r.json()),
      fetch('/data/maps.json')
        .then((r) => r.json())
        .catch(() => ({})),
      fetch('/data/dataset_map.json')
        .then((r) => r.json())
        .catch(() => ({})),
      fetch('/data/grain.json')
        .then((r) => r.json())
        .catch(() => null),
    ])
      .then(([m, maps, dsMap, grain]) => {
        setManifest(m)
        setMapConfigs(maps)
        setGrainData(grain)

        const dsEntries = Object.entries(m.datasets || {})
        const manifestLoads = dsEntries.map(([key, info]) => {
          const filePath = info.file.startsWith('/') ? info.file : `/${info.file}`
          return fetch(filePath)
            .then((r) => (r.ok ? r.json() : []))
            .then((data) => ({ key, data }))
            .catch(() => ({ key, data: [] }))
        })

        const mapDsLoads = Object.entries(dsMap).map(([dsId, fileName]) => {
          return fetch(`/data/${fileName}`)
            .then((r) => (r.ok ? r.json() : []))
            .then((data) => ({ dsId: parseInt(dsId), data }))
            .catch(() => ({ dsId: parseInt(dsId), data: [] }))
        })

        return Promise.all([Promise.all(manifestLoads), Promise.all(mapDsLoads)])
      })
      .then(([manifestResults, mapDsResults]) => {
        const ds = {}
        manifestResults.forEach(({ key, data }) => {
          ds[key] = data
        })
        setDatasets(ds)

        const mds = {}
        mapDsResults.forEach(({ dsId, data }) => {
          mds[dsId] = data
        })
        setMapDatasets(mds)

        setLoading(false)
      })
      .catch((err) => {
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
    return datasetRef.split('+').flatMap((k) => datasets[k.trim()] || [])
  }
  return datasets[datasetRef] || []
}

function stripEmojis(value) {
  if (typeof value !== 'string') return value
  return value
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\uFE0F/gu, '')
    .trim()
}

function toTitleCase(value) {
  if (typeof value !== 'string') return value
  return value.toLowerCase().replace(/\b([a-z])/g, (match) => match.toUpperCase())
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

function SatelliteIcon({ color = '#B8BCC4', size = 40 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4.68359 39.4335L4.7793 39.9227C4.52729 39.9725 4.2666 39.9999 4 39.9999C3.73304 39.9999 3.47205 39.9726 3.21973 39.9227L3.41309 38.9432C3.60189 38.9806 3.79849 38.9999 4 38.9999C4.20149 38.9999 4.39814 38.9806 4.58691 38.9432L4.68359 39.4335ZM1.50488 37.6659C1.7242 37.9935 2.0064 38.2757 2.33398 38.495L2.05469 38.91L2.05566 38.911L1.77734 39.3251C1.34124 39.033 0.965768 38.6578 0.673828 38.2216L1.50488 37.6659ZM6.91016 37.9442L7.1748 38.121L7.3252 38.2216C7.03325 38.6577 6.65773 39.0331 6.22168 39.3251L6.0625 39.0868L5.94434 38.911L5.66602 38.495C5.99341 38.2757 6.27591 37.9933 6.49512 37.6659L6.91016 37.9442ZM4 34.9999C4.55197 35.0001 4.99981 35.4479 5 35.9999C5 36.552 4.55209 36.9997 4 36.9999C3.44772 36.9999 3 36.5522 3 35.9999C3.00019 35.4478 3.44783 34.9999 4 34.9999ZM1.05664 35.413C1.01929 35.6018 1.00002 35.7984 1 35.9999C1 36.2014 1.0193 36.398 1.05664 36.5868L0.566406 36.6835L0.0761719 36.7792C0.026423 36.5272 0 36.2665 0 35.9999C1.77227e-05 35.7928 0.0155487 35.5891 0.0458984 35.3905L0.0761719 35.2196L1.05664 35.413ZM7.92285 35.2196C7.97276 35.4719 7.99998 35.7329 8 35.9999C8 36.2665 7.9726 36.5272 7.92285 36.7792L7.43359 36.6835L6.94336 36.5868C6.98068 36.398 7 36.2014 7 35.9999C6.99998 35.7984 6.98071 35.6018 6.94336 35.413L7.92285 35.2196ZM1.98047 32.9774L2.33398 33.5048C2.00655 33.724 1.72415 34.0065 1.50488 34.3339L0.878906 33.9149L0.673828 33.7772C0.965762 33.3413 1.34142 32.9656 1.77734 32.6737L1.98047 32.9774ZM6.22168 32.6737C6.65782 32.9656 7.03315 33.3412 7.3252 33.7772L7.12109 33.9149L6.49512 34.3339C6.27584 34.0064 5.99353 33.7241 5.66602 33.5048L6.01953 32.9774L6.22168 32.6737ZM4 31.9999C4.26654 31.9999 4.52735 32.0263 4.7793 32.0761L4.58691 33.0565C4.39814 33.0192 4.20149 32.9999 4 32.9999C3.79853 32.9999 3.60185 33.0192 3.41309 33.0565L3.21973 32.0761C3.47195 32.0262 3.73315 31.9999 4 31.9999ZM9.91895 22.7001C10.1434 22.5516 10.4477 22.5763 10.6455 22.7743C10.8427 22.9725 10.8679 23.2773 10.7197 23.5018L10.6455 23.5927C9.06056 25.1795 9.06109 27.7594 10.6455 29.3524L10.7969 29.497C12.3906 30.9374 14.8582 30.8889 16.3994 29.3524C16.6255 29.1265 16.9898 29.1264 17.2158 29.3524L17.2568 29.3925C17.4219 29.5901 17.438 29.8703 17.2988 30.0809L17.2246 30.1718C16.203 31.1945 14.8679 31.6989 13.5264 31.6991C12.1853 31.6991 10.8491 31.1871 9.82715 30.1708C7.79086 28.1311 7.79126 24.8139 9.82812 22.7743L9.91895 22.7001ZM12.0518 24.9589C12.271 24.8141 12.5649 24.8357 12.7627 25.0214L12.7686 25.0321L12.7861 25.0497C12.9833 25.2478 13.0085 25.5527 12.8604 25.7772L12.7861 25.8681C12.6056 26.0488 12.501 26.2914 12.501 26.5516C12.5012 26.8115 12.6058 27.0538 12.7861 27.2343L12.7871 27.2352C13.1583 27.598 13.7936 27.6003 14.1592 27.2343L14.25 27.16C14.4744 27.0117 14.7788 27.0363 14.9766 27.2343C15.1736 27.4324 15.1988 27.7373 15.0508 27.9618L14.9766 28.0526C14.574 28.4544 14.0422 28.6734 13.4688 28.6737C12.9667 28.6737 12.4963 28.5066 12.1172 28.1952L11.9609 28.0526C11.5596 27.6495 11.341 27.1172 11.3408 26.5429C11.3409 25.968 11.5584 25.4361 11.9609 25.0331L12.0518 24.9589ZM35.8984 0.679578C36.8036 -0.226506 38.3949 -0.226546 39.2998 0.679578L39.46 0.856335C39.8105 1.28471 39.9999 1.81795 40 2.37782C39.9998 3.0179 39.753 3.62323 39.2998 4.07704C38.8458 4.53155 38.2407 4.78482 37.6025 4.78505C37.1994 4.78499 36.8155 4.67564 36.4697 4.48915L36.3711 4.43641L33.7441 7.0663L33.6523 7.15907L33.7314 7.26259C35.2365 9.24505 35.1433 12.0682 33.4395 13.9413L33.2695 14.12L29.7539 17.6395L29.8594 17.746L31.2178 19.1054L31.3232 19.2118L31.9844 18.5507L32.1387 18.41C32.939 17.7568 34.1213 17.804 34.8672 18.5507L39.1992 22.8876C39.5675 23.2719 39.7686 23.7689 39.7686 24.2997C39.7684 24.7767 39.6076 25.2275 39.3076 25.5927L39.1699 25.744L37.0303 27.8856C36.6426 28.2737 36.1331 28.484 35.5889 28.4843C35.1128 28.4843 34.6625 28.3232 34.2979 28.0233L34.1465 27.8856L29.8467 23.5809C29.051 22.7843 29.051 21.4909 29.8467 20.6942L30.4014 20.1395L30.5068 20.0331L30.4014 19.9266L28.9365 18.4608L28.8311 18.5673L24.1504 23.2528C24.0347 23.3687 23.8916 23.4215 23.7383 23.4218C23.5891 23.4218 23.444 23.3647 23.3252 23.2528L22.3721 22.2987L22.3828 22.6766C22.4226 23.9824 21.982 25.3012 21.0566 26.3329L20.8652 26.535C20.7494 26.651 20.6056 26.7038 20.4521 26.704C20.3031 26.7039 20.1587 26.6468 20.04 26.535L13.4688 19.9569C13.2427 19.7305 13.2428 19.365 13.4688 19.1386L13.6709 18.9462C14.7016 18.0187 16.0181 17.5781 17.3223 17.6181L17.7002 17.6298L17.4336 17.3622L16.7471 16.6757C16.5211 16.4492 16.521 16.0837 16.7471 15.8573L21.4277 11.1718L21.5332 11.0653L20.0693 9.60048L19.9639 9.49403L19.3027 10.1552C18.9089 10.5494 18.384 10.7536 17.8604 10.7538C17.4017 10.7537 16.9443 10.602 16.5732 10.2968L16.4189 10.1552L12.1191 5.85048C11.7313 5.46217 11.5207 4.95138 11.5205 4.40614C11.5206 3.86071 11.7312 3.35023 12.1191 2.9618L14.2588 0.820203L14.4082 0.685437C15.1912 0.055455 16.4239 0.100666 17.1416 0.820203L21.4414 5.12489L21.5811 5.28016C22.1894 6.02798 22.1897 7.10868 21.5811 7.85634L21.4414 8.01161L20.7812 8.67274L20.8867 8.77919L22.2451 10.1386L22.3506 10.245L25.8672 6.7245L26.0449 6.55458C27.9162 4.84829 30.7357 4.75509 32.7158 6.26259L32.8203 6.34169L32.9121 6.24891L35.5391 3.61903L35.4863 3.52137C35.2998 3.17514 35.1906 2.79048 35.1904 2.38661C35.1904 1.73999 35.4368 1.14127 35.8975 0.678601L35.8984 0.679578ZM33.4277 19.1122C33.2267 19.1123 33.0342 19.1808 32.873 19.3085L32.8057 19.3661L30.6631 21.5116C30.3203 21.8552 30.3202 22.4103 30.6631 22.7538L34.9639 27.0585L35.0303 27.119C35.3754 27.4002 35.8835 27.3805 36.2051 27.0585L38.3447 24.9169L38.4053 24.8495C38.6198 24.5861 38.6577 24.2275 38.5215 23.9296H38.6084L34.0527 19.369C33.8852 19.2014 33.6555 19.1124 33.4277 19.1122ZM19.8408 19.7772C18.439 18.5485 16.3857 18.4376 14.8799 19.4677L14.7305 19.5702L20.4258 25.2714L20.5273 25.121L20.623 24.9725C21.5474 23.4747 21.4112 21.5132 20.2178 20.1552L20.0957 20.0214L19.9746 19.9003L19.8408 19.7772ZM32.2949 7.3827C30.7526 5.98791 28.3925 5.98832 26.8447 7.3827L26.6934 7.52626L18.085 16.1444L17.9795 16.2509L20.75 19.0253L20.7568 19.0302L20.7588 19.0331C20.7608 19.0347 20.7646 19.0372 20.7676 19.0399C20.7747 19.0465 20.7852 19.0564 20.7959 19.0663C20.8184 19.0872 20.8444 19.1118 20.8604 19.1278C20.8754 19.1429 20.89 19.1587 20.9062 19.1766C20.9222 19.1943 20.9417 19.216 20.9629 19.2372L23.7344 22.0116L23.8398 21.9052L32.5537 13.1825L32.5488 13.1776C33.9814 11.6352 33.9955 9.24375 32.5908 7.67958L32.4463 7.52723L32.2949 7.3827ZM15.7021 1.37196C15.5008 1.37197 15.3078 1.43932 15.1465 1.56727L15.0801 1.62587L15.0771 1.62782L12.9375 3.7704C12.5945 4.11399 12.5945 4.66901 12.9375 5.01259L17.2373 9.31727L17.3047 9.37782C17.6328 9.64514 18.1074 9.64008 18.4297 9.36219H18.4434L18.4873 9.31727L20.627 7.17567L20.6875 7.10927C20.9502 6.78719 20.9496 6.32229 20.6875 5.99989L20.627 5.93251L16.3271 1.62782C16.1596 1.46014 15.9299 1.37218 15.7021 1.37196ZM37.6064 1.12391C37.3164 1.12391 37.0378 1.22529 36.8174 1.40712L36.7266 1.49012C36.5302 1.68683 36.4048 1.94419 36.3711 2.22059H36.3594V2.37001C36.3596 2.70165 36.4921 3.01873 36.7256 3.25087L36.8184 3.33387C37.3007 3.72253 38.0473 3.69643 38.4863 3.24989L38.4854 3.24891C38.7163 3.01729 38.8514 2.70174 38.8516 2.37001C38.8515 2.03855 38.7175 1.72134 38.4844 1.48915C38.2531 1.25818 37.9376 1.12422 37.6064 1.12391Z"
        fill={color}
      />
    </svg>
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
    value = new Set(data.map((r) => r[field]).filter(Boolean)).size
  } else if (query === 'count_where' && component.filter) {
    value = data.filter((r) =>
      Object.entries(component.filter).every(([k, v]) => r[k] === v)
    ).length
  } else if (query.startsWith('avg:')) {
    const field = query.split(':')[1]
    const vals = data.map((r) => parseFloat(r[field])).filter((v) => !isNaN(v))
    value = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '—'
  } else if (query === 'avg' && component.field) {
    const vals = data.map((r) => parseFloat(r[component.field])).filter((v) => !isNaN(v))
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
      <Text size="32px" fw={600} mt={4} ta="center" c="#ffffff">
        {value}
      </Text>
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
        <Text fw={700} size="sm" mb="sm">
          {stripEmojis(component.title || component.id)}
        </Text>
        <Text size="xs" c="#888F9E">
          No data available ({data.length} rows, {columns.length} columns configured)
        </Text>
      </Card>
    )
  }

  const tableContent = (
    <>
      {component.title && (
        <Text fw={600} size="20px" c="#ffffff" mt={16} mb="sm">
          {stripEmojis(component.title)}
        </Text>
      )}
      <Box style={{ overflowX: 'auto' }}>
        <Table className="dashboard-table" style={{ fontSize: '13px' }}>
          <Table.Thead>
            <Table.Tr>
              {columns.map((col) => (
                <Table.Th key={col.key} style={{ fontSize: '11px', textTransform: 'uppercase' }}>
                  {col.label}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.slice(0, 50).map((row, i) => (
              <Table.Tr key={i}>
                {columns.map((col) => {
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
                      ) : val != null ? (
                        String(val)
                      ) : (
                        '—'
                      )}
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

  return (
    <Card shadow="sm" padding="md" radius="md" withBorder>
      {tableContent}
    </Card>
  )
}

// ─── Size Bin Table ───
function SizeBinTable({ component, data }) {
  const bins = component.size_bins || []
  const isMultiSource = (component.dataset || '').includes('+')
  const sources = isMultiSource ? (component.dataset || '').split('+').map((s) => s.trim()) : null
  const displayTitle = 'Size Class Distribution'

  // Build rows: if multi-source, show a Source column with counts per source
  const rows = []
  if (isMultiSource && sources) {
    const sourceLabels = { dataset_15: 'Dark', dataset_16: 'Unattributed' }
    // We need to know which items came from which dataset
    // Since resolveDataset flattens them, we tag by _source
    bins.forEach((bin) => {
      const matching = data.filter((r) => {
        const len = parseFloat(r.length)
        return !isNaN(len) && len >= bin.min && len <= bin.max
      })
      const darkCount = matching.filter(
        (r) => r.dark === true || r.dark === 1 || r.dark === '1' || r.dark === 'true'
      ).length
      const unattr = matching.length - darkCount
      if (darkCount > 0) rows.push({ label: bin.label, count: darkCount, source: 'Dark' })
      if (unattr > 0) rows.push({ label: bin.label, count: unattr, source: 'Unattributed' })
    })
  } else {
    bins.forEach((bin) => {
      const count = data.filter((r) => {
        const len = parseFloat(r.length)
        return !isNaN(len) && len >= bin.min && len <= bin.max
      }).length
      rows.push({ label: bin.label, count })
    })
  }

  const totalCount = rows.reduce((s, r) => s + r.count, 0)

  return (
    <Box>
      <Text fw={600} size="20px" c="#ffffff" mt={16} mb="sm">
        {displayTitle}
      </Text>
      <Table className="dashboard-table" style={{ fontSize: '13px' }}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ fontSize: '11px', width: isMultiSource ? '42%' : '70%' }}>
              SIZE CLASS
            </Table.Th>
            {isMultiSource && (
              <Table.Th style={{ fontSize: '11px', width: '28%' }}>SOURCE</Table.Th>
            )}
            <Table.Th
              style={{ fontSize: '11px', width: isMultiSource ? '30%' : '30%', textAlign: 'right' }}
            >
              COUNT
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((r, i) => (
            <Table.Tr key={i}>
              <Table.Td style={{ fontSize: '12px' }}>{r.label}</Table.Td>
              {isMultiSource && (
                <Table.Td style={{ fontSize: '12px' }}>
                  {(() => {
                    const source = String(r.source || '').toLowerCase()
                    const badgeStyle =
                      source === 'dark'
                        ? { backgroundColor: '#FFA500', color: '#111326' }
                        : source === 'unattributed'
                          ? { backgroundColor: '#F75349', color: '#111326' }
                          : source === 'light' || source === 'ais-light'
                            ? { backgroundColor: '#1CC86B', color: '#111326' }
                            : { backgroundColor: '#393C56', color: '#ffffff' }
                    return (
                      <Badge
                        className={`badge-keep-original ${
                          source === 'dark'
                            ? 'badge-dark'
                            : source === 'unattributed'
                              ? 'badge-unattributed'
                              : undefined
                        }`}
                        size="sm"
                        variant="filled"
                        styles={{ root: { ...badgeStyle, border: 'none' } }}
                      >
                        {r.source}
                      </Badge>
                    )
                  })()}
                </Table.Td>
              )}
              <Table.Td
                style={{ fontSize: '12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
              >
                {r.count.toLocaleString()}
              </Table.Td>
            </Table.Tr>
          ))}
          <Table.Tr style={{ borderTop: '1px solid var(--mantine-color-dark-4)' }}>
            <Table.Td style={{ fontSize: '12px', fontWeight: 700 }}>Total</Table.Td>
            {isMultiSource && <Table.Td />}
            <Table.Td
              style={{
                fontSize: '12px',
                fontWeight: 700,
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
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
      <Text fw={600} size="20px" c="#ffffff" mt={16} mb={4}>
        {displayTitle}
      </Text>
      {component.description && (
        <Text size="xs" c="#888F9E" mb="md">
          {stripEmojis(component.description)}
        </Text>
      )}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing={8}>
        {vessels.map((v, i) => (
          <Paper className="spoofing-vessel-card" key={i} p="sm" radius="md" withBorder>
            <Text fw={600} size="sm">
              {v.name || '—'}
            </Text>
            <Text size="xs" c="#888F9E">
              IMO: {v.imo || '—'}
            </Text>
            <Text size="xs" c="#888F9E">
              MMSI: {v.mmsi || '—'}
            </Text>
            <Text size="xs" c="#888F9E">
              Flag: {v.flag || '—'}
            </Text>
            <Text size="xs" c="#888F9E">
              Type: {v.type || '—'}
            </Text>
            {v.description && (
              <Text size="xs" mt={4}>
                {v.description}
              </Text>
            )}
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
  const fields = rawFields.map((f) => (typeof f === 'string' ? { key: f, label: f } : f))
  const imageField = component.image_field || 'image_url'
  const renderWithoutCard = shouldRenderWithoutCard(component)
  const displayTitle = toTitleCase(stripEmojis(component.title || '')).replace(/\bAis\b/g, 'AIS')

  if (!data.length) {
    return (
      <Card shadow="sm" padding="md" radius="md" withBorder>
        <Text fw={700} size="sm">
          {stripEmojis(component.title || 'Detections')}
        </Text>
        <Text size="xs" c="#888F9E" mt="sm">
          No detections to display
        </Text>
      </Card>
    )
  }

  const content = (
    <>
      <Group mb="sm" align="flex-end">
        <Text fw={600} size="20px" c="#ffffff" mt={16}>
          {displayTitle}
        </Text>
        <Badge
          size="sm"
          variant="filled"
          style={{
            marginTop: 16,
            backgroundColor: '#FFA500',
            color: '#111326',
            minHeight: 22,
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          {data.length} DETECTIONS
        </Badge>
      </Group>
      <SimpleGrid cols={{ base: 1, sm: 2, md: component.columns_per_row || 4 }} spacing={8}>
        {data.slice(0, 24).map((item, i) => (
          <Paper
            key={i}
            className="chip-detection-card"
            p="xs"
            radius="md"
            withBorder
            style={{ overflow: 'hidden' }}
          >
            <div style={{ position: 'relative' }}>
              {item[imageField] ? (
                <Image
                  src={item[imageField]}
                  h={140}
                  fit="cover"
                  radius={4}
                  mb="xs"
                  fallbackSrc="https://placehold.co/200x140/0a1929/475569?text=No+Image"
                />
              ) : (
                <div
                  style={{
                    height: 140,
                    background: '#0a1929',
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 6,
                  }}
                >
                  <Text size="xs" c="#475569">
                    No image available
                  </Text>
                </div>
              )}
              <Badge
                className="badge-dark"
                size="sm"
                variant="filled"
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  backgroundColor: '#FFA500',
                  color: '#111326',
                }}
              >
                DARK
              </Badge>
            </div>
            <Text fw={700} size="sm" c="white" truncate="end" mb={6}>
              {item.name || 'UNIDENTIFIED'}
            </Text>
            <Text size="xs" c="#888F9E" mt={2}>
              OID: {item.object_id}
            </Text>
            {fields
              .filter((f) => f.key !== 'name' && f.key !== 'object_id')
              .map((f) => (
                <Text key={f.key} size="xs" c="#888F9E" truncate="end">
                  <Text span c="#888F9E" size="xs">
                    {f.label}:{' '}
                  </Text>
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
function DetailPanel({ component, datasets, height, selectedId, selectedRow }) {
  const data = resolveDataset(component.dataset, datasets)
  const fallbackData = component.fallback_dataset
    ? resolveDataset(component.fallback_dataset, datasets)
    : []
  const allData = [...data, ...fallbackData]
  const rawFields = component.fields || []
  const fields = rawFields.map((f) => (typeof f === 'string' ? { key: f, label: f } : f))
  const imageField = component.image_field || 'image_url'
  const matchCol = component.match_column || 'object_id'
  const satelliteIconColor = component.icon_color || component?.placeholder?.icon_color || '#FFFFFF'

  const matchedItem =
    selectedId != null
      ? allData.find((row) => String(row[matchCol]) === String(selectedId)) || null
      : null
  const item = matchedItem || selectedRow || allData[0] || null
  const getFieldKey = (f) => String(f.key || '').toLowerCase()
  const latField = fields.find((f) => getFieldKey(f) === 'lat')
  const lonField = fields.find((f) => getFieldKey(f) === 'lon')
  const acquiredField = fields.find((f) => getFieldKey(f) === 'acquired')
  const orderedFields = [
    ...fields.filter((f) => !['lat', 'lon', 'acquired'].includes(getFieldKey(f))),
    ...(latField ? [latField] : []),
    ...(lonField ? [lonField] : []),
    ...(acquiredField ? [acquiredField] : []),
  ]

  if (!item) {
    const ph = component.placeholder || {}
    return (
      <Card
        className="detail-panel-card"
        shadow="sm"
        padding="md"
        radius="md"
        withBorder
        style={{ minHeight: height || 200, height: height || '100%' }}
      >
        <Text fw={700} size="sm" mb="md">
          {stripEmojis(component.title || 'Detection Chip')}
        </Text>
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <Box mb="sm" style={{ display: 'inline-flex' }}>
            <SatelliteIcon color={satelliteIconColor} />
          </Box>
          <Text size="xs" c="#888F9E">
            {ph.text || 'No detection data available'}
          </Text>
        </div>
      </Card>
    )
  }

  return (
    <Card
      className="detail-panel-card"
      shadow="sm"
      padding="md"
      radius="md"
      withBorder
      style={{ height: height || '100%' }}
    >
      <Group justify="space-between" mb="sm">
        <Text fw={700} size="sm">
          {stripEmojis(component.title || 'Detection Chip')}
        </Text>
        <Badge size="xs" variant="filled" style={{ backgroundColor: '#006CD7', color: '#ffffff' }}>
          OID: {item[matchCol]}
        </Badge>
      </Group>
      <div style={{ marginBottom: 12 }}>
        {item[imageField] ? (
          <Image
            src={item[imageField]}
            w="100%"
            h={140}
            fit="cover"
            radius={4}
            fallbackSrc="https://placehold.co/300x200/0a1929/475569?text=Image+Unavailable"
          />
        ) : (
          <div
            style={{
              height: 140,
              background: '#24263C',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px dashed #393C56',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <Box mb={4} style={{ display: 'inline-flex' }}>
                <SatelliteIcon color={satelliteIconColor} />
              </Box>
              <Text size="xs" c="#fff">
                Image unavailable
              </Text>
            </div>
          </div>
        )}
      </div>
      <SimpleGrid cols={2} spacing={{ base: 12, sm: 18 }}>
        {orderedFields.map((f) => (
          <Box key={f.key} mb={8}>
            <Text size="12px" c="#888F9E" mb={4}>
              {f.label}
            </Text>
            <Text
              size="13px"
              c="#ffffff"
              fw={400}
              lh={1.35}
              style={{ paddingBottom: 2 }}
              truncate="end"
            >
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
        <Text size="xs" c="#888F9E">
          Empty content: {component.id}
        </Text>
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
function MapComponent({ component, mapConfigs, mapDatasets, height = 560, onSelect }) {
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
          <Text size="sm" fw={600}>
            {stripEmojis(component.title || component.id)}
          </Text>
          <Text size="xs" c="#888F9E">
            Map config not found: {templateId || 'N/A'}
          </Text>
        </Stack>
      </Box>
    )
  }

  return (
    <Box>
      <Box style={{ borderRadius: 8, overflow: 'hidden' }}>
        <DeckMap mapConfig={mapConfig} datasets={mapDatasets} height={height} onSelect={onSelect} />
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
  const riskText = String(port.risk || '').toLowerCase()
  const riskBadgeStyle =
    riskText.includes('moderate') || riskText.includes('high')
      ? { backgroundColor: '#F75349', color: '#111326' }
      : riskText.includes('minimal')
        ? { backgroundColor: '#FFA500', color: '#111326' }
        : { backgroundColor: '#1CC86B', color: '#111326' }

  const content = (
    <>
      <Group justify="space-between" mb="sm">
        <Text fw={800} size="lg" c="#ffffff">{`${port.name} — 50km Detections`}</Text>
        <Badge
          className="badge-keep-original"
          size="sm"
          variant="filled"
          styles={{ root: { ...riskBadgeStyle, border: 'none' } }}
        >
          {port.risk}
        </Badge>
      </Group>
      <Text size="xs" c="#888F9E" mb="xs">
        {port.coords}
      </Text>
      <Text size="sm" c="#888F9E" mb="md">
        {port.description}
      </Text>
      <SimpleGrid cols={4} spacing="xs">
        {statItems.map((s) => (
          <Paper className="port-stat-card" key={s.label} p="xs" radius="md" withBorder ta="center">
            <Text size="xl" fw={800} c="#ffffff">
              {s.value}
            </Text>
            <Text size="10px" fw={700} c="#888F9E" tt="uppercase" mt={2}>
              {s.label}
            </Text>
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
        <Text fw={700} size="sm" c="#ffffff" mb="xs">
          {suspect.title}
        </Text>
        <Text size="sm" c="#888F9E">
          {suspect.empty_message || 'No suspects identified.'}
        </Text>
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
      <Text fw={700} size="sm" c="#ffffff" mb={4}>
        {suspect.title}
      </Text>
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
                  <Text span fw={700} c="#ffffff">
                    {v.risk}
                  </Text>
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
      <Text fw={800} size="lg" c="#ffffff" mb="md">
        Daily Intelligence Assessment — 15 May 2026
      </Text>
      <Stack gap="lg">
        {sections.map((s) => (
          <Box key={s.title}>
            <Text fw={700} size="sm" c="#ffffff" mb="xs">
              {s.title}
            </Text>
            <Stack gap={6}>
              {s.items.map((item, i) => (
                <Group key={i} gap="xs" align="flex-start" wrap="nowrap">
                  <Text c="#888F9E" size="sm" mt={1}>
                    •
                  </Text>
                  <Text size="sm" c="#888F9E" style={{ lineHeight: 1.6 }}>
                    {item}
                  </Text>
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
      <Card className="grain-header-card" shadow="sm" padding="lg" radius="md" withBorder>
        <Text fw={800} size="xl" c="#ffffff">
          {header.title}
        </Text>
        <Text size="sm" c="#888F9E" mt={4}>
          {header.subtitle}
        </Text>
      </Card>

      {/* Port sections */}
      {port_order.map((portKey) => {
        const port = ports[portKey]
        const suspect = suspects[portKey]
        if (!port) return null

        return (
          <Card key={portKey} shadow="sm" padding="lg" radius="md" withBorder>
            <PortCard port={port} withinCard />
            {port.map_id && mapConfigs[port.map_id] && (
              <Box mt={8}>
                <Box style={{ borderRadius: 8, overflow: 'hidden' }}>
                  <DeckMap
                    mapConfig={mapConfigs[port.map_id]}
                    datasets={mapDatasets}
                    height={450}
                  />
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
        <Text fw={700} size="sm" c="#ffffff" mb="xs">
          METHODOLOGY
        </Text>
        <Text size="xs" c="#888F9E" style={{ lineHeight: 1.6 }}>
          {methodology}
        </Text>
      </Card>

      {/* Assessment */}
      <AssessmentPanel assessment={assessment} />
    </Stack>
  )
}

// ─── Component Router ───
function RenderComponent({
  component,
  datasets,
  mapConfigs,
  mapDatasets,
  height,
  onSelect,
  selectedId,
  selectedRow,
}) {
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
      return (
        <MapComponent
          component={component}
          mapConfigs={mapConfigs}
          mapDatasets={mapDatasets}
          height={height}
          onSelect={onSelect}
        />
      )
    case 'detail_panel':
      return (
        <DetailPanel
          component={component}
          datasets={datasets}
          height={height}
          selectedId={selectedId}
          selectedRow={selectedRow}
        />
      )
    case 'port_card':
    case 'suspect_table':
    case 'assessment':
    case 'text':
    case 'methodology':
      return <HtmlCard component={component} />
    default:
      return (
        <Card shadow="sm" padding="sm" radius="md" withBorder>
          <Text size="xs" c="#888F9E">
            Unknown: {component.type} ({component.id})
          </Text>
        </Card>
      )
  }
}

// ─── Section Renderer ───
function Section({ section, datasets, mapConfigs, mapDatasets }) {
  const components = section.components || []
  const kpis = components.filter((c) => c.type === 'kpi')
  const others = components.filter((c) => c.type !== 'kpi')
  const titleText = toTitleCase(stripEmojis(section.title || ''))
  const hideOverviewTitle = titleText.startsWith('Daily Intelligence Overview')
  const hideAssessmentSection = titleText.startsWith('Daily Intelligence Assessment')

  if (hideAssessmentSection) return null

  const mapDetailHeight = 560
  // Group map + detail_panel into a side-by-side layout; keep size table full-width below
  const mapComp = others.find((c) => c.type === 'map')
  const detailPanel = others.find((c) => c.type === 'detail_panel')
  const sizeTable = others.find((c) => c.type === 'table' && c.size_bins)
  const hasMapDetailLayout = Boolean(mapComp && detailPanel)
  const hasMapOnlyLayout = Boolean(mapComp && !detailPanel)
  const [selectedDetailId, setSelectedDetailId] = useState(null)
  const [selectedDetailRow, setSelectedDetailRow] = useState(null)
  const detailMatchColumn = detailPanel?.match_column || mapComp?.on_click?.column || 'object_id'
  const mapSelectColumn = mapComp?.on_click?.column || detailMatchColumn
  const remainingComps = others.filter((c) => {
    if (c === mapComp || c === detailPanel || c === sizeTable) return false
    return true
  })

  return (
    <Box mb={8}>
      {section.title && !hideOverviewTitle && (
        <Box mb={14}>
          <Text fw={700} size="24px" c="#ffffff">
            {titleText}
          </Text>
        </Box>
      )}
      {kpis.length > 0 && (
        <SimpleGrid
          cols={{ base: 2, sm: 3, md: Math.min(kpis.length, 6) }}
          spacing={8}
          mb={
            hasMapDetailLayout || hasMapOnlyLayout || sizeTable || remainingComps.length > 0 ? 8 : 0
          }
        >
          {kpis.map((c) => (
            <RenderComponent
              key={c.id}
              component={c}
              datasets={datasets}
              mapConfigs={mapConfigs}
              mapDatasets={mapDatasets}
            />
          ))}
        </SimpleGrid>
      )}
      {hasMapDetailLayout && (
        <Box
          mb={sizeTable || remainingComps.length > 0 ? 8 : 0}
          style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}
        >
          <Box style={{ minHeight: mapDetailHeight }}>
            <RenderComponent
              component={mapComp}
              datasets={datasets}
              mapConfigs={mapConfigs}
              mapDatasets={mapDatasets}
              height={mapDetailHeight}
              onSelect={(row) => {
                setSelectedDetailId(row?.[mapSelectColumn] ?? null)
                setSelectedDetailRow(row || null)
              }}
            />
          </Box>
          <Box style={{ height: mapDetailHeight }}>
            <RenderComponent
              component={detailPanel}
              datasets={datasets}
              mapConfigs={mapConfigs}
              mapDatasets={mapDatasets}
              height={mapDetailHeight}
              selectedId={selectedDetailId != null ? selectedDetailId : null}
              selectedRow={selectedDetailRow}
            />
          </Box>
        </Box>
      )}
      {hasMapOnlyLayout && (
        <Box mb={sizeTable || remainingComps.length > 0 ? 8 : 0}>
          <RenderComponent
            component={mapComp}
            datasets={datasets}
            mapConfigs={mapConfigs}
            mapDatasets={mapDatasets}
            height={mapDetailHeight}
            onSelect={(row) => {
              setSelectedDetailId(row?.[mapSelectColumn] ?? null)
              setSelectedDetailRow(row || null)
            }}
          />
        </Box>
      )}
      {sizeTable && (
        <Box mb={remainingComps.length > 0 ? 8 : 0}>
          <RenderComponent
            component={sizeTable}
            datasets={datasets}
            mapConfigs={mapConfigs}
            mapDatasets={mapDatasets}
          />
        </Box>
      )}
      <Stack gap={8}>
        {remainingComps.map((c) => (
          <RenderComponent
            key={c.id}
            component={c}
            datasets={datasets}
            mapConfigs={mapConfigs}
            mapDatasets={mapDatasets}
          />
        ))}
      </Stack>
    </Box>
  )
}

// ─── App ───
export default function App() {
  const { manifest, datasets, mapConfigs, mapDatasets, grainData, loading } = useManifest()
  const [activeTab, setActiveTab] = useState('')
  const [selectedVersion, setSelectedVersion] = useState('v1')

  if (loading || !manifest) {
    return (
      <Box
        p="xl"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text size="lg" c="#888F9E">
            Loading dashboard data…
          </Text>
        </Stack>
      </Box>
    )
  }

  const pages = manifest.pages || []
  const isChipCutoffSection = (section) => {
    const sectionTitle = stripEmojis(String(section?.title || '')).toLowerCase()
    const sectionId = String(section?.id || '').toLowerCase()
    if (sectionTitle.includes('satellite detection chips') && sectionTitle.includes('dark vessels'))
      return true
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
      return visibleSections.map((section) => [section])
    }

    const firstGroup = visibleSections.slice(0, firstGroupEndIndex + 1)
    const remainingGroups = visibleSections
      .slice(firstGroupEndIndex + 1)
      .map((section) => [section])
    return [firstGroup, ...remainingGroups].filter((group) => group.length > 0)
  }
  const activeTabKey = activeTab || pages[0]?.key || 'weekly'
  const versionOptions = [
    { value: 'v1', label: 'Version 1 - Current' },
    { value: 'v2', label: 'Version 2 - Draft' },
  ]

  return (
    <AppShell padding="md">
      <AppShell.Main>
        <Container
          size="xl"
          className={selectedVersion === 'v2' ? 'dashboard-version-v2' : undefined}
        >
          <Group justify="flex-end" mb={8}>
            <Select
              value={selectedVersion}
              onChange={(value) => value && setSelectedVersion(value)}
              data={versionOptions}
              className="version-select"
              size="sm"
              w={280}
            />
          </Group>

          <Card
            className="dashboard-header-card"
            shadow="sm"
            padding="xl"
            radius="md"
            withBorder
            mb={8}
          >
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

          <Tabs
            className="dashboard-tabs"
            value={activeTabKey}
            onChange={(val) => val && setActiveTab(val)}
          >
            <Card shadow="sm" padding={0} radius="md" withBorder mb={8}>
              <Box px={32} pt={16} pb={16}>
                <Tabs.List mt={0} mb={0}>
                  {pages.map((p) => (
                    <Tabs.Tab key={p.key} value={p.key}>
                      {stripEmojis(p.label)}
                    </Tabs.Tab>
                  ))}
                </Tabs.List>
              </Box>
            </Card>

            {pages.map((page) => {
              const { inCardSections, outOfCardSections } = splitSectionsByChipCutoff(
                page.sections || []
              )
              const showGroupedCard = page.key !== 'grain' && inCardSections.length > 0
              const showPerSectionCards = page.key !== 'grain' && isWeeklyPage(page)

              return (
                <Tabs.Panel key={page.key} value={page.key}>
                  {page.key === 'grain' ? (
                    <GrainPage
                      grainData={grainData}
                      mapConfigs={mapConfigs}
                      mapDatasets={mapDatasets}
                    />
                  ) : (
                    <>
                      {showPerSectionCards ? (
                        <Stack gap={8}>
                          {getWeeklySectionCardGroups(page.sections || []).map(
                            (sectionGroup, i) => (
                              <Card key={i} shadow="sm" padding={32} radius="md" withBorder>
                                {sectionGroup.map((section, sectionIdx) => (
                                  <Section
                                    key={`${section.id || section.title || 'section'}-${sectionIdx}`}
                                    section={section}
                                    datasets={datasets}
                                    mapConfigs={mapConfigs}
                                    mapDatasets={mapDatasets}
                                  />
                                ))}
                              </Card>
                            )
                          )}
                        </Stack>
                      ) : (
                        showGroupedCard && (
                          <Card
                            shadow="sm"
                            padding={32}
                            radius="md"
                            withBorder
                            mb={outOfCardSections.length > 0 ? 8 : 0}
                          >
                            {inCardSections.map((section, i) => (
                              <Section
                                key={i}
                                section={section}
                                datasets={datasets}
                                mapConfigs={mapConfigs}
                                mapDatasets={mapDatasets}
                              />
                            ))}
                          </Card>
                        )
                      )}
                      {outOfCardSections.length > 0 && !showPerSectionCards && (
                        <Stack gap={8}>
                          {outOfCardSections.map((section, i) => (
                            <Section
                              key={`${i}-${section.title || section.id || 'section'}`}
                              section={section}
                              datasets={datasets}
                              mapConfigs={mapConfigs}
                              mapDatasets={mapDatasets}
                            />
                          ))}
                        </Stack>
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
