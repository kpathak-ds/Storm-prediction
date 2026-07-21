export interface RadarFrame {
  path: string;
  time: number;
}

let cachedRadarFrames: { frames: RadarFrame[]; generated: number } | null = null;
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes cache for radar timeline frames

export async function fetchRadarFrames(): Promise<RadarFrame[]> {
  const now = Date.now();
  if (cachedRadarFrames && now - cachedRadarFrames.generated < CACHE_TTL) {
    return cachedRadarFrames.frames;
  }

  try {
    const response = await fetch('https://api.rainviewer.com/public/weather-maps.json');
    if (!response.ok) throw new Error("RainViewer API error");
    const json = await response.json();
    
    // Extract past and present radar frames
    const frames: RadarFrame[] = [];
    if (json.radar && json.radar.past) {
      json.radar.past.forEach((f: any) => {
        frames.push({ path: f.path, time: f.time });
      });
    }
    if (json.radar && json.radar.nowcast) {
      json.radar.nowcast.forEach((f: any) => {
        frames.push({ path: f.path, time: f.time });
      });
    }

    cachedRadarFrames = { frames, generated: now };
    return frames;
  } catch (err) {
    console.error("Failed to fetch radar frames: ", err);
    return [];
  }
}
