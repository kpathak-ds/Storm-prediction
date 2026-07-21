export interface GisLayerDef {
  id: string;
  name: string;
  sub?: string;
  url?: string;
  type: 'xyz' | 'wms' | 'gibs' | 'wayback';
  overlay?: boolean;
  gibsId?: string;
  gibsMatrix?: string;
  gibsExt?: string;
  gibsMnz?: number;
  wmsLayer?: string;
  opacity?: number;
}

export interface GisGroup {
  group: string;
  layers: GisLayerDef[];
}

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/";

export const GIS_CATALOG: GisGroup[] = [
  {
    group: "🛰️ Satellite & High-Res Imagery",
    layers: [
      { id: "esri_img", name: "ESRI World Imagery", sub: "global ~0.5–1 m", type: "xyz", url: ESRI + "World_Imagery/MapServer/tile/{z}/{y}/{x}" },
      { id: "goog_sat", name: "Google Satellite", sub: "global imagery", type: "xyz", url: "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" },
      { id: "goog_hyb", name: "Google Hybrid", sub: "satellite + labels", type: "xyz", url: "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" },
      { id: "eox_s2_2023", name: "Sentinel-2 cloudless 2023 (EOX)", sub: "10 m RGB mosaic", type: "wms", url: "https://tiles.maps.eox.at/wms", wmsLayer: "s2cloudless-2023" },
      { id: "eox_s2_2022", name: "Sentinel-2 cloudless 2022 (EOX)", sub: "10 m RGB mosaic", type: "wms", url: "https://tiles.maps.eox.at/wms", wmsLayer: "s2cloudless-2022" },
      { id: "eox_s2_2021", name: "Sentinel-2 cloudless 2021 (EOX)", sub: "10 m RGB mosaic", type: "wms", url: "https://tiles.maps.eox.at/wms", wmsLayer: "s2cloudless-2021" },
      { id: "eox_s2_2020", name: "Sentinel-2 cloudless 2020 (EOX)", sub: "10 m RGB mosaic", type: "wms", url: "https://tiles.maps.eox.at/wms", wmsLayer: "s2cloudless-2020" },
      { id: "eox_s2_2019", name: "Sentinel-2 cloudless 2019 (EOX)", sub: "10 m RGB mosaic", type: "wms", url: "https://tiles.maps.eox.at/wms", wmsLayer: "s2cloudless-2019" },
    ]
  },
  {
    group: "🕰️ Historical Imagery",
    layers: [
      { id: "wayback", name: "ESRI Wayback", sub: "historical imagery", type: "wayback" }
    ]
  },
  {
    group: "🗺️ Topographic & Street",
    layers: [
      { id: "esri_topo", name: "ESRI World Topo", sub: "topo basemap", type: "xyz", url: ESRI + "World_Topo_Map/MapServer/tile/{z}/{y}/{x}" },
      { id: "opentopo", name: "OpenTopoMap", sub: "contours + relief", type: "xyz", url: "https://a.tile.opentopomap.org/{z}/{x}/{y}.png" },
      { id: "esri_street", name: "ESRI World Street", sub: "streets basemap", type: "xyz", url: ESRI + "World_Street_Map/MapServer/tile/{z}/{y}/{x}" },
      { id: "osm", name: "OpenStreetMap", sub: "openstreetmap standard", type: "xyz", url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png" },
      { id: "osm_hot", name: "OSM Humanitarian", sub: "HOT streets", type: "xyz", url: "https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png" },
      { id: "cyclosm", name: "CyclOSM", sub: "terrain-aware cycling", type: "xyz", url: "https://a.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png" },
      { id: "carto_dark", name: "Carto Dark", sub: "black backdrop", type: "xyz", url: "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png" },
      { id: "carto_light", name: "Carto Light", sub: "white backdrop", type: "xyz", url: "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png" },
    ]
  },
  {
    group: "⛰️ Terrain, Elevation & Relief",
    layers: [
      { id: "esri_hill", name: "ESRI World Hillshade", sub: "DEM relief", type: "xyz", url: ESRI + "Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}" },
      { id: "esri_hilld", name: "ESRI Hillshade (Dark)", sub: "dark DEM relief", type: "xyz", url: ESRI + "Elevation/World_Hillshade_Dark/MapServer/tile/{z}/{y}/{x}" },
      { id: "esri_relief", name: "ESRI Shaded Relief", sub: "terrain base", type: "xyz", url: ESRI + "World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}" },
      { id: "esri_terr", name: "ESRI Terrain Base", sub: "terrain contours", type: "xyz", url: ESRI + "World_Terrain_Base/MapServer/tile/{z}/{y}/{x}" },
      { id: "esri_phys", name: "ESRI Physical Map", sub: "macro physical terrain", type: "xyz", url: ESRI + "World_Physical_Map/MapServer/tile/{z}/{y}/{x}" },
      { id: "eox_terr", name: "EOX Terrain", sub: "global DEM mosaic", type: "wms", url: "https://tiles.maps.eox.at/wms", wmsLayer: "terrain" },
      { id: "eox_terrl", name: "EOX Terrain Light", sub: "light DEM mosaic", type: "wms", url: "https://tiles.maps.eox.at/wms", wmsLayer: "terrain-light" },
      { id: "aws_terr", name: "AWS Terrarium (raw DEM)", sub: "elevation-encoded RGB", type: "xyz", url: "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png" },
      { id: "aws_norm", name: "AWS Normal Map", sub: "aspect shading", type: "xyz", url: "https://s3.amazonaws.com/elevation-tiles-prod/normal/{z}/{x}/{y}.png" },
      { id: "gibs_aster", name: "ASTER GDEM Shaded Relief", sub: "NASA GIBS 30m", type: "gibs", gibsId: "ASTER_GDEM_Greyscale_Shaded_Relief", gibsMatrix: "GoogleMapsCompatible_Level12", gibsExt: "jpeg", gibsMnz: 12 },
    ]
  },
  {
    group: "🌡️ NASA GIBS WMTS Bands (2000→now)",
    layers: [
      { id: "gibs_modis_tc", name: "MODIS Terra True Color", sub: "RGB daily", type: "gibs", gibsId: "MODIS_Terra_CorrectedReflectance_TrueColor", gibsMatrix: "GoogleMapsCompatible_Level9", gibsExt: "jpg", gibsMnz: 9 },
      { id: "gibs_modis_721", name: "MODIS Terra SWIR (7-2-1)", sub: "false-colour mineral", type: "gibs", gibsId: "MODIS_Terra_CorrectedReflectance_Bands721", gibsMatrix: "GoogleMapsCompatible_Level9", gibsExt: "jpg", gibsMnz: 9 },
      { id: "gibs_modis_367", name: "MODIS Terra (3-6-7)", sub: "snow/ice discrim.", type: "gibs", gibsId: "MODIS_Terra_CorrectedReflectance_Bands367", gibsMatrix: "GoogleMapsCompatible_Level9", gibsExt: "jpg", gibsMnz: 9 },
      { id: "gibs_aqua_tc", name: "MODIS Aqua True Color", sub: "RGB daily (PM pass)", type: "gibs", gibsId: "MODIS_Aqua_CorrectedReflectance_TrueColor", gibsMatrix: "GoogleMapsCompatible_Level9", gibsExt: "jpg", gibsMnz: 9 },
      { id: "gibs_viirs_tc", name: "VIIRS SNPP True Color", sub: "375 m daily", type: "gibs", gibsId: "VIIRS_SNPP_CorrectedReflectance_TrueColor", gibsMatrix: "GoogleMapsCompatible_Level9", gibsExt: "jpg", gibsMnz: 9 },
      { id: "gibs_viirs_n20", name: "VIIRS NOAA-20 True Color", sub: "375 m daily", type: "gibs", gibsId: "VIIRS_NOAA20_CorrectedReflectance_TrueColor", gibsMatrix: "GoogleMapsCompatible_Level9", gibsExt: "jpg", gibsMnz: 9 },
      { id: "gibs_viirs_m113", name: "VIIRS SNPP SWIR", sub: "false-colour SWIR", type: "gibs", gibsId: "VIIRS_SNPP_CorrectedReflectance_BandsM11-I2-I1", gibsMatrix: "GoogleMapsCompatible_Level9", gibsExt: "jpg", gibsMnz: 9 },
      { id: "gibs_lst_day", name: "Land Surface Temp — Day", sub: "thermal MODIS", type: "gibs", gibsId: "MODIS_Terra_Land_Surface_Temp_Day", gibsMatrix: "GoogleMapsCompatible_Level7", gibsExt: "png", gibsMnz: 7 },
      { id: "gibs_lst_night", name: "Land Surface Temp — Night", sub: "thermal MODIS", type: "gibs", gibsId: "MODIS_Terra_Land_Surface_Temp_Night", gibsMatrix: "GoogleMapsCompatible_Level7", gibsExt: "png", gibsMnz: 7 },
      { id: "gibs_ndvi", name: "MODIS NDVI (8-day)", sub: "vegetation index", type: "gibs", gibsId: "MODIS_Terra_NDVI_8Day", gibsMatrix: "GoogleMapsCompatible_Level9", gibsExt: "png", gibsMnz: 9 },
      { id: "gibs_evi", name: "MODIS EVI (8-day)", sub: "enhanced veg index", type: "gibs", gibsId: "MODIS_Terra_EVI_8Day", gibsMatrix: "GoogleMapsCompatible_Level9", gibsExt: "png", gibsMnz: 9 },
      { id: "gibs_fires", name: "VIIRS Thermal Anomalies", sub: "fire / hot pixels", type: "gibs", gibsId: "VIIRS_SNPP_Thermal_Anomalies_375m_All", gibsMatrix: "GoogleMapsCompatible_Level7", gibsExt: "png", gibsMnz: 7 },
      { id: "gibs_blackmarble", name: "VIIRS Black Marble", sub: "night lights", type: "gibs", gibsId: "VIIRS_Black_Marble", gibsMatrix: "GoogleMapsCompatible_Level8", gibsExt: "png", gibsMnz: 8 },
    ]
  },
  {
    group: "🌳 Land Cover & Vegetation",
    layers: [
      { id: "esa_wc21", name: "ESA WorldCover 2021", sub: "10 m global land cover", type: "wms", url: "https://services.terrascope.be/wms/v2", wmsLayer: "WORLDCOVER_2021_MAP" },
      { id: "esa_wc20", name: "ESA WorldCover 2020", sub: "10 m global land cover", type: "wms", url: "https://services.terrascope.be/wms/v2", wmsLayer: "WORLDCOVER_2020_MAP" },
      { id: "gibs_landwater", name: "MODIS Land/Water Mask", sub: "NASA GIBS", type: "gibs", gibsId: "OSM_Land_Water_Map", gibsMatrix: "GoogleMapsCompatible_Level12", gibsExt: "png", gibsMnz: 12 },
    ]
  },
  {
    group: "🏷️ Reference Overlays",
    layers: [
      { id: "esri_bound", name: "ESRI Boundaries & Places", sub: "labels overlay", type: "xyz", url: ESRI + "Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", overlay: true },
      { id: "esri_trans", name: "ESRI Transportation", sub: "roads overlay", type: "xyz", url: ESRI + "Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}", overlay: true },
      { id: "carto_lbl", name: "Carto Labels Only", sub: "place labels", type: "xyz", url: "https://a.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}.png", overlay: true },
      { id: "eox_overlay", name: "EOX Overlay (Bright)", sub: "borders & places", type: "wms", url: "https://tiles.maps.eox.at/wms", wmsLayer: "overlay_bright" },
    ]
  }
];
