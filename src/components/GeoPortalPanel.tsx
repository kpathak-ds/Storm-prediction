import { useState, useEffect, useRef } from 'react';
import { FolderOpen, Calendar, Trash2, Sliders, HelpCircle, X, Map, FileUp, PlusCircle } from 'lucide-react';
import { GIS_CATALOG, type GisLayerDef } from '../api/gisCatalog';

export interface UploadedKml {
  id: string;
  name: string;
  geojson: any;
  color: string;
  visible: boolean;
  opacity: number;
}

interface GeoPortalPanelProps {
  onClose: () => void;
  activeGisLayers: Record<string, { visible: boolean; opacity: number }>;
  onToggleGisLayer: (id: string, visible: boolean) => void;
  onGisOpacityChange: (id: string, opacity: number) => void;
  gibsDate: string;
  onGibsDateChange: (date: string) => void;
  waybackRel: string;
  onWaybackRelChange: (rel: string) => void;
  uploadedKmls: UploadedKml[];
  onAddKml: (kml: UploadedKml) => void;
  onRemoveKml: (id: string) => void;
  onUpdateKmlProps: (id: string, props: Partial<UploadedKml>) => void;
  measuring: boolean;
  onToggleMeasuring: () => void;
}

const PALETTE = ['#ff2d2d', '#3fb1ff', '#5fa05f', '#f0a429', '#c678dd', '#ff9e64', '#56d4bb', '#e06c75'];

export default function GeoPortalPanel({
  onClose: _onClose,
  activeGisLayers,
  onToggleGisLayer,
  onGisOpacityChange,
  gibsDate,
  onGibsDateChange,
  waybackRel,
  onWaybackRelChange,
  uploadedKmls,
  onAddKml,
  onRemoveKml,
  onUpdateKmlProps,
  measuring,
  onToggleMeasuring,
}: GeoPortalPanelProps) {
  const [activeTab, setActiveTab] = useState<'layers' | 'kml' | 'add'>('layers');
  const [filterQuery, setFilterQuery] = useState('');
  const [waybackReleases, setWaybackReleases] = useState<{ rel: string; date: string }[]>([]);
  const [customLayers, setCustomLayers] = useState<GisLayerDef[]>([]);
  const [showModal, setShowModal] = useState(false);

  // Form states for adding custom XYZ/WMS
  const [addType, setAddType] = useState<'xyz' | 'wms'>('xyz');
  const [addName, setAddName] = useState('');
  const [addUrl, setAddUrl] = useState('');
  const [addWmsLayers, setAddWmsLayers] = useState('');
  const [shId, setShId] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load ESRI Wayback configuration
  useEffect(() => {
    fetch('https://s3-us-west-2.amazonaws.com/config.maptiles.arcgis.com/waybackconfig.json')
      .then(r => r.json())
      .then(cfg => {
        const items = Object.keys(cfg).map(k => {
          const t = cfg[k].itemTitle || cfg[k].itemURL || '';
          const m = t.match(/(\d{4}-\d{2}-\d{2})/);
          return { rel: k, date: m ? m[1] : t };
        }).filter(x => /\d{4}-\d{2}-\d{2}/.test(x.date)).sort((a, b) => b.date.localeCompare(a.date));
        setWaybackReleases(items);
        if (items.length && !waybackRel) {
          onWaybackRelChange(items[0].rel);
        }
      })
      .catch(() => console.error("Wayback config loading failed"));
  }, []);

  const handleKmlUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    processFiles(e.target.files);
  };

  const processFiles = (files: FileList) => {
    Array.from(files).forEach(file => {
      const isJson = /\.(geojson|json)$/i.test(file.name);
      const isGpx = /\.gpx$/i.test(file.name);
      const reader = new FileReader();

      reader.onload = () => {
        try {
          const text = reader.result as string;
          let geojson: any = null;

          if (isJson) {
            geojson = JSON.parse(text);
          } else if (isGpx) {
            geojson = parseGpxToGeoJson(text);
          } else {
            geojson = parseKmlToGeoJson(text);
          }

          if (!geojson || !geojson.features || !geojson.features.length) {
            alert(`No valid spatial features found in ${file.name}`);
            return;
          }

          const id = 'kml_' + Date.now() + Math.random().toString(36).substring(2, 6);
          const color = PALETTE[uploadedKmls.length % PALETTE.length];
          onAddKml({
            id,
            name: file.name,
            geojson,
            color,
            visible: true,
            opacity: 1
          });
        } catch (err: any) {
          alert(`Error reading file: ${err.message}`);
        }
      };
      reader.readAsText(file);
    });
  };

  const parseKmlToGeoJson = (kmlText: string) => {
    const parser = new DOMParser();
    const xml = parser.parseFromString(kmlText, 'text/xml');
    const features: any[] = [];

    const placemarks = xml.getElementsByTagName('Placemark');
    for (let i = 0; i < placemarks.length; i++) {
      const pm = placemarks[i];
      const name = pm.getElementsByTagName('name')?.[0]?.textContent || `Feature ${i + 1}`;
      
      const coordNodes = pm.getElementsByTagName('coordinates');
      if (coordNodes.length > 0) {
        const coordStr = coordNodes[0].textContent || '';
        const pairs = coordStr.trim().split(/\s+/);
        const coords = pairs.map(p => {
          const parts = p.split(',').map(Number);
          return [parts[0], parts[1]]; // [lng, lat]
        }).filter(p => !isNaN(p[0]) && !isNaN(p[1]));

        if (coords.length === 1) {
          features.push({
            type: 'Feature',
            properties: { name },
            geometry: { type: 'Point', coordinates: coords[0] }
          });
        } else if (coords.length > 1) {
          features.push({
            type: 'Feature',
            properties: { name },
            geometry: { type: 'LineString', coordinates: coords }
          });
        }
      }
    }
    return { type: 'FeatureCollection', features };
  };

  const parseGpxToGeoJson = (gpxText: string) => {
    const parser = new DOMParser();
    const xml = parser.parseFromString(gpxText, 'text/xml');
    const features: any[] = [];

    const trkpts = xml.getElementsByTagName('trkpt');
    const coords: number[][] = [];
    for (let i = 0; i < trkpts.length; i++) {
      const pt = trkpts[i];
      const lat = parseFloat(pt.getAttribute('lat') || '');
      const lng = parseFloat(pt.getAttribute('lon') || '');
      if (!isNaN(lat) && !isNaN(lng)) {
        coords.push([lng, lat]);
      }
    }

    if (coords.length > 0) {
      features.push({
        type: 'Feature',
        properties: { name: xml.getElementsByTagName('name')?.[0]?.textContent || 'GPX Track' },
        geometry: { type: 'LineString', coordinates: coords }
      });
    }
    return { type: 'FeatureCollection', features };
  };

  const handleAddCustomLayer = () => {
    if (!addUrl) {
      alert("Please enter a tile or WMS URL");
      return;
    }
    const name = addName.trim() || 'Custom Layer';
    const newLyr: GisLayerDef = {
      id: 'custom_' + Date.now(),
      name,
      sub: addType.toUpperCase() + ' (Custom)',
      url: addUrl,
      type: addType,
      wmsLayer: addType === 'wms' ? addWmsLayers : undefined
    };
    setCustomLayers([...customLayers, newLyr]);
    setAddName('');
    setAddUrl('');
    setAddWmsLayers('');
    alert(`Successfully registered "${name}" under custom layers!`);
  };

  const handleAddSentinelHub = () => {
    if (!shId) {
      alert("Please enter your Sentinel Hub instance ID");
      return;
    }
    const base = 'https://services.sentinel-hub.com/ogc/wms/' + shId.trim();
    const bands = [
      { id: 'sh_tc_' + Date.now(), name: 'S2 · True Color', wl: 'TRUE-COLOR' },
      { id: 'sh_fc_' + Date.now(), name: 'S2 · False Color', wl: 'FALSE-COLOR' },
      { id: 'sh_swir_' + Date.now(), name: 'S2 · SWIR 12-8A-4', wl: 'SWIR' },
      { id: 'sh_ndvi_' + Date.now(), name: 'S2 · NDVI', wl: 'NDVI' }
    ];

    const mapped = bands.map(b => ({
      id: b.id,
      name: b.name,
      sub: 'Sentinel Hub WMS',
      type: 'wms' as const,
      url: base,
      wmsLayer: b.wl
    }));

    setCustomLayers([...customLayers, ...mapped]);
    setShId('');
    alert("Added 4 Sentinel Hub WMS band layers!");
  };

  const loadAoiBoundary = () => {
    const AOI = {
      type: "Feature",
      properties: { name: "GAD_SECOND_02 boundary", stroke: "#ffffff", "stroke-width": 2, "fill-opacity": 0 },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [80.406252, 19.553723], [80.403837, 19.549392], [80.403944, 19.543846],
          [80.409615, 19.533661], [80.464021, 19.522325], [80.499582, 19.526729],
          [80.569673, 19.560900], [80.569014, 19.570637], [80.547715, 19.575745],
          [80.537448, 19.590471], [80.489038, 19.565945], [80.478524, 19.551088],
          [80.438955, 19.553292], [80.438880, 19.553292], [80.415850, 19.560200],
          [80.406252, 19.553723]
        ]]
      }
    };

    onAddKml({
      id: 'aoi_boundary',
      name: "GAD_SECOND_02 boundary (built-in)",
      geojson: { type: 'FeatureCollection', features: [AOI] },
      color: '#ffffff',
      visible: true,
      opacity: 1
    });
  };

  const filteredCatalog = GIS_CATALOG.concat(customLayers.length ? [{ group: "➕ My Custom Layers", layers: customLayers }] : []).map(g => {
    const matching = g.layers.filter(l => l.name.toLowerCase().includes(filterQuery.toLowerCase()) || (l.sub && l.sub.toLowerCase().includes(filterQuery.toLowerCase())));
    return { ...g, layers: matching };
  }).filter(g => g.layers.length > 0);

  return (
    <div className="flex flex-col text-slate-200 pointer-events-auto p-1">
      {/* Top Toolbar Action Buttons */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-800 shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
          GIS Layer Catalog
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onToggleMeasuring()}
            className={`px-2 py-1 rounded-lg border text-xs transition-all ${measuring ? 'bg-amber-500 border-amber-600 text-slate-950 font-bold scale-105' : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-white'}`}
            title="Measure distance"
          >
            📏 {measuring ? 'Measuring ON' : 'Measure'}
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="p-1.5 rounded-lg bg-slate-800/40 border border-slate-700/60 text-slate-400 hover:text-white"
            title="Geospatial help info"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 shrink-0 bg-slate-950/20">
        {([
          { key: 'layers' as const, label: 'Basemaps', icon: Map },
          { key: 'kml' as const, label: 'My KML', icon: FileUp },
          { key: 'add' as const, label: 'Add Custom', icon: PlusCircle },
        ]).map(t => {
          const Icon = t.icon;
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex-1 py-2.5 flex flex-col items-center gap-1 border-b-2 transition-all ${
                isActive
                  ? 'text-amber-500 border-amber-500 bg-amber-500/5'
                  : 'text-slate-500 border-transparent hover:text-slate-300 hover:bg-slate-800/30'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="text-[9px] font-black uppercase tracking-widest font-mono leading-none">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Date controls in header */}
      <div className="px-4 py-2 bg-slate-950/30 border-b border-slate-800/80 flex gap-2 items-center shrink-0">
        <Calendar className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        <input
          type="date"
          value={gibsDate}
          onChange={e => onGibsDateChange(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-[10px] text-white outline-none focus:border-amber-500 font-mono flex-1"
          title="Date selector for NASA GIBS WMTS"
        />
        {waybackReleases.length > 0 && (
          <select
            value={waybackRel}
            onChange={e => onWaybackRelChange(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded px-1 py-0.5 text-[10px] text-white outline-none focus:border-amber-500 font-mono w-[110px]"
            title="ESRI Wayback Release version selector"
          >
            {waybackReleases.slice(0, 40).map((w: any) => (
              <option key={w.rel} value={w.rel}>Wayback {w.date}</option>
            ))}
          </select>
        )}
      </div>

      {/* Content Panes */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {activeTab === 'layers' && (
          <div className="flex flex-col gap-3">
            <input
              placeholder="Search / filter catalog layers..."
              value={filterQuery}
              onChange={e => setFilterQuery(e.target.value)}
              className="bg-slate-950/50 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-amber-500/80 font-mono shrink-0"
            />
            <div className="flex flex-col gap-3">
              {filteredCatalog.map(g => (
                <div key={g.group} className="flex flex-col gap-1">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono border-b border-slate-800/60 pb-0.5 mb-1">
                    {g.group}
                  </span>
                  <div className="flex flex-col gap-1">
                    {g.layers.map(l => {
                      const active = activeGisLayers[l.id]?.visible ?? false;
                      const opacity = activeGisLayers[l.id]?.opacity ?? 1.0;
                      return (
                        <div key={l.id} className={`flex items-center gap-3 px-2 py-1.5 rounded-lg border transition-all ${active ? 'bg-amber-500/5 border-amber-500/20' : 'bg-slate-900/10 border-transparent hover:bg-slate-900/50'}`}>
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={e => onToggleGisLayer(l.id, e.target.checked)}
                            className="accent-amber-500 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0 flex flex-col cursor-pointer" onClick={() => onToggleGisLayer(l.id, !active)}>
                            <span className={`text-[11px] font-bold truncate ${active ? 'text-amber-400' : 'text-slate-300'}`}>{l.name}</span>
                            {l.sub && <span className="text-[9px] text-slate-500 truncate mt-0.5">{l.sub}</span>}
                          </div>
                          {active && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Sliders className="w-3 h-3 text-slate-500" />
                              <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={opacity}
                                onChange={e => onGisOpacityChange(l.id, parseFloat(e.target.value))}
                                className="w-12 h-1 accent-amber-500 bg-slate-800 rounded-lg cursor-pointer"
                                title="Adjust layer opacity"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'kml' && (
          <div className="flex flex-col gap-3">
            {/* Drag & drop mock zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700/60 hover:border-amber-500/80 rounded-xl p-6 text-center cursor-pointer transition-all bg-slate-950/20 flex flex-col items-center gap-2"
            >
              <FolderOpen className="w-8 h-8 text-amber-500/70" />
              <span className="text-xs font-bold text-slate-300">Drag & Drop track files here</span>
              <span className="text-[9px] text-slate-500 uppercase font-mono font-bold mt-1">supports .kml, .kmz, .geojson, .gpx</span>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".kml,.kmz,.geojson,.json,.gpx"
                onChange={handleKmlUpload}
                className="hidden"
              />
            </div>

            <button
              onClick={loadAoiBoundary}
              className="w-full py-2 bg-slate-900 border border-slate-800 hover:border-amber-500/50 text-[10px] font-black uppercase text-slate-300 rounded-lg tracking-wider transition-all"
            >
              ＋ Load GAD_SECOND_02 Boundary (Built-in)
            </button>

            <div className="flex flex-col gap-1.5 mt-2">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">Loaded GIS Tracks</span>
              {uploadedKmls.length === 0 ? (
                <span className="text-[10px] text-slate-500 text-center font-bold py-6">No custom spatial boundaries uploaded yet.</span>
              ) : (
                uploadedKmls.map(k => (
                  <div key={k.id} className="flex items-center gap-2.5 px-3 py-2 bg-slate-950/40 border border-slate-800 rounded-xl">
                    <input
                      type="checkbox"
                      checked={k.visible}
                      onChange={e => onUpdateKmlProps(k.id, { visible: e.target.checked })}
                      className="accent-amber-500 cursor-pointer"
                    />
                    <span className="w-3.5 h-3.5 rounded border border-black/40 shrink-0 cursor-pointer" style={{ backgroundColor: k.color }} />
                    <span className="flex-1 text-[11px] font-bold text-slate-300 truncate" title={k.name}>{k.name}</span>
                    <button
                      onClick={() => onRemoveKml(k.id)}
                      className="p-1 rounded text-slate-500 hover:text-red-400 transition-colors shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'add' && (
          <div className="flex flex-col gap-3 text-xs">
            <div className="flex flex-col gap-2 p-3 bg-slate-950/20 border border-slate-800/80 rounded-xl">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider font-mono">Custom Tile Service Loader</span>
              
              <div className="flex flex-col gap-1">
                <label className="text-[9px] text-slate-500 uppercase font-mono">Service Type</label>
                <select
                  value={addType}
                  onChange={e => setAddType(e.target.value as any)}
                  className="bg-slate-900 border border-slate-800 rounded px-2 py-1 outline-none focus:border-amber-500 text-white font-mono text-xs"
                >
                  <option value="xyz">XYZ Web Tiles</option>
                  <option value="wms">WMS Mapping Service</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] text-slate-500 uppercase font-mono">Display Name</label>
                <input
                  placeholder="e.g. Sentinel SWIR"
                  value={addName}
                  onChange={e => setAddName(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded px-2 py-1.5 outline-none focus:border-amber-500 text-white font-mono text-xs"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] text-slate-500 uppercase font-mono">Service URL</label>
                <input
                  placeholder={addType === 'wms' ? "https://.../wms" : "https://.../{z}/{x}/{y}.png"}
                  value={addUrl}
                  onChange={e => setAddUrl(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded px-2 py-1.5 outline-none focus:border-amber-500 text-white font-mono text-xs"
                />
              </div>

              {addType === 'wms' && (
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-slate-500 uppercase font-mono">WMS Layer Names</label>
                  <input
                    placeholder="e.g. TRUE-COLOR-S2L2A"
                    value={addWmsLayers}
                    onChange={e => setAddWmsLayers(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded px-2 py-1.5 outline-none focus:border-amber-500 text-white font-mono text-xs"
                  />
                </div>
              )}

              <button
                onClick={handleAddCustomLayer}
                className="mt-1 py-2 bg-amber-500 border border-amber-600 text-slate-950 font-black uppercase text-[10px] tracking-wider rounded-lg hover:scale-[1.02] active:scale-95 transition-all"
              >
                ＋ Register Layer
              </button>
            </div>

            <div className="flex flex-col gap-2 p-3 bg-slate-950/20 border border-slate-800/80 rounded-xl">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider font-mono">Sentinel Hub WMS Bands Loader</span>
              
              <div className="flex flex-col gap-1">
                <label className="text-[9px] text-slate-500 uppercase font-mono">Instance ID (Free)</label>
                <input
                  placeholder="Paste Sentinel Hub instance ID"
                  value={shId}
                  onChange={e => setShId(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded px-2 py-1.5 outline-none focus:border-amber-500 text-white font-mono text-xs"
                />
              </div>

              <button
                onClick={handleAddSentinelHub}
                className="mt-1 py-2 bg-slate-900 border border-slate-800 hover:border-amber-500/50 text-[10px] font-black uppercase text-slate-300 rounded-lg tracking-wider transition-all"
              >
                ＋ Register Sentinel Hub bands
              </button>
              <p className="text-[9px] text-slate-500 leading-normal mt-1">
                Add standard Sentinel-2 bands (TRUE-COLOR, FALSE-COLOR, SWIR, NDVI) using your free Sentinel Hub dashboard account.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Info Help Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-5 pointer-events-auto">
          <div className="bg-[#0f121d] border border-slate-800 rounded-2xl max-w-lg w-full p-6 text-slate-300 flex flex-col gap-4 shadow-2xl relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg bg-slate-900 border border-slate-800 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            
            <h2 className="text-base font-extrabold tracking-wide uppercase text-amber-500 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-amber-500" />
              Bands & Sources GIS Guide
            </h2>
            <div className="flex flex-col gap-3 text-xs leading-relaxed overflow-y-auto max-h-[350px] pr-2 scrollbar-thin">
              <div className="flex flex-col gap-1">
                <span className="font-bold text-white">How to evaluate storms and geology:</span>
                <p className="text-slate-400">
                  Toggle any layer from the Basemaps & Bands tab. Blend multiple layers (e.g. <b>ASTER Hillshade over MODIS SWIR</b>) using opacity sliders to trace structural ridges.
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <span className="font-bold text-white">MODIS & VIIRS SWIR (7-2-1 / M11-I2-I1):</span>
                <p className="text-slate-400">
                  Particularly useful for lithological discrimination and mapping minerals like hematite/iron oxide, which separate clearly from dense vegetative cover in infrared bands.
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <span className="font-bold text-white">Time Series Mosaics:</span>
                <p className="text-slate-400">
                  Select historical dates in the top header. **ESRI Wayback** provides high-res imagery back to ~2014, while **NASA GIBS** tracks MODIS archive reflectances daily back to 2000.
                </p>
              </div>
            </div>
            
            <div className="border-t border-slate-800/80 pt-4 flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-amber-500 border border-amber-600 text-slate-950 font-black uppercase text-xs rounded-lg transition-all hover:scale-105"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
