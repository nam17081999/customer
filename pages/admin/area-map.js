import { useCallback, useEffect, useRef, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useAuth } from "@/lib/AuthContext";
import { OLD_ADMIN_AREA_BOUNDARIES } from "@/data/oldAdminAreaBoundaries";

const DISTRICT_COLORS = [
  "hsl(0, 70%, 50%)",
  "hsl(30, 70%, 50%)",
  "hsl(60, 70%, 45%)",
  "hsl(120, 60%, 45%)",
  "hsl(180, 60%, 45%)",
  "hsl(210, 70%, 55%)",
  "hsl(270, 60%, 55%)",
  "hsl(330, 70%, 50%)",
];

const DISTRICT_NAMES = [
  "Bắc Từ Liêm",
  "Cầu Giấy",
  "Đan Phượng",
  "Hoài Đức",
  "Nam Từ Liêm",
  "Phúc Thọ",
  "Quốc Oai",
  "Thạch Thất",
];

function buildDistrictColorMap() {
  const map = {};
  for (let i = 0; i < DISTRICT_NAMES.length; i++) {
    map[DISTRICT_NAMES[i]] = DISTRICT_COLORS[i % DISTRICT_COLORS.length];
  }
  return map;
}

function buildGeoJson() {
  const features = [];
  for (const entry of OLD_ADMIN_AREA_BOUNDARIES) {
    if (!DISTRICT_NAMES.includes(entry.district)) continue;
    features.push({
      type: "Feature",
      properties: {
        district: entry.district,
        ward: entry.ward,
        color: DISTRICT_COLORS[DISTRICT_NAMES.indexOf(entry.district)],
      },
      geometry: entry.geometry,
    });
  }
  return { type: "FeatureCollection", features };
}

function ColorLegend({ districtColorMap }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Quận / Huyện</p>
      {DISTRICT_NAMES.map((name) => (
        <div key={name} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-sm shrink-0"
            style={{ backgroundColor: districtColorMap[name] }}
          />
          <span className="text-xs text-gray-400">{name}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminAreaMap() {
  const router = useRouter();
  const { isAdmin, isAuthenticated, loading: authLoading } = useAuth() || {};
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [opacity, setOpacity] = useState(0.5);
  const [pageReady, setPageReady] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setPageReady(false);
      void router.replace("/login?from=/admin/area-map").catch((err) => {
        if (!err?.cancelled) console.error("Redirect to login failed:", err);
      });
      return;
    }
    if (!isAdmin) {
      setPageReady(false);
      void router.replace("/account").catch((err) => {
        if (!err?.cancelled) console.error("Redirect to account failed:", err);
      });
      return;
    }
    setPageReady(true);
  }, [authLoading, isAuthenticated, isAdmin, router]);

  useEffect(() => {
    if (!pageReady || mapRef.current) return;

    let map;
    async function init() {
      const maplibregl = await import("maplibre-gl");
      map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: {
          version: 8,
          glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "© OpenStreetMap",
            },
          },
          layers: [
            { id: "osm", type: "raster", source: "osm" },
          ],
        },
        center: [105.75, 21.08],
        zoom: 11,
      });

      map.on("load", () => {
        const geojson = buildGeoJson();

        map.addSource("wards", {
          type: "geojson",
          data: geojson,
        });

        map.addLayer({
          id: "wards-fill",
          type: "fill",
          source: "wards",
          paint: {
            "fill-color": ["get", "color"],
            "fill-opacity": 0.5,
          },
        });

        map.addLayer({
          id: "wards-outline",
          type: "line",
          source: "wards",
          paint: {
            "line-color": ["get", "color"],
            "line-width": 1.5,
            "line-opacity": 0.8,
          },
        });

        const popup = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
        });

        map.on("click", "wards-fill", (e) => {
          if (!e.features?.[0]) return;
          const props = e.features[0].properties;
          popup
            .setLngLat(e.lngLat)
            .setHTML(
              `<div style="font-size:13px;line-height:1.5">
                <strong>${props.ward}</strong><br/>
                <span style="color:#888">${props.district}</span>
              </div>`
            )
            .addTo(map);
        });

        map.on("mouseenter", "wards-fill", (e) => {
          map.getCanvas().style.cursor = "pointer";
          if (!e.features?.[0]) return;
          const props = e.features[0].properties;
          popup
            .setLngLat(e.lngLat)
            .setHTML(
              `<div style="font-size:13px;line-height:1.5">
                <strong>${props.ward}</strong><br/>
                <span style="color:#888">${props.district}</span>
              </div>`
            )
            .addTo(map);
        });
        map.on("mouseleave", "wards-fill", () => {
          map.getCanvas().style.cursor = "";
          popup.remove();
        });

        mapRef.current = map;
        setLoaded(true);
      });
    }
    init();

    return () => {
      if (map) map.remove();
      mapRef.current = null;
    };
  }, [pageReady]);

  useEffect(() => {
    if (!mapRef.current) return;
    const layer = mapRef.current.getLayer("wards-fill");
    if (layer) {
      mapRef.current.setPaintProperty("wards-fill", "fill-opacity", opacity);
    }
  }, [opacity]);

  const districtColorMap = buildDistrictColorMap();

  if (authLoading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-sm text-gray-400">Đang kiểm tra đăng nhập...</p>
      </div>
    );
  }

  if (!pageReady) return null;

  return (
    <>
      <Head>
        <title>Bản đồ địa bàn - Admin - NPP Hà Công</title>
      </Head>

      <div className="relative h-full w-full">
        <div ref={mapContainerRef} className="h-full w-full" />

        <div className="absolute top-3 right-3 z-10 flex flex-col gap-3">
          <div className="rounded-xl border border-gray-800 bg-gray-950/90 backdrop-blur-sm p-4 shadow-lg">
            <ColorLegend districtColorMap={districtColorMap} />
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-950/90 backdrop-blur-sm p-4 shadow-lg min-w-[180px]">
            <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block mb-2">
              Độ mờ
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Trong</span>
              <span>{Math.round(opacity * 100)}%</span>
              <span>Đậm</span>
            </div>
          </div>
        </div>

        {loaded && (
          <div className="absolute bottom-3 left-3 z-10 rounded-lg border border-gray-800 bg-gray-950/80 backdrop-blur-sm px-3 py-2 text-xs text-gray-400 shadow-lg">
            <span>{OLD_ADMIN_AREA_BOUNDARIES.filter((e) => DISTRICT_NAMES.includes(e.district)).length} xã/phường</span>
            <span className="mx-2">·</span>
            <span>{DISTRICT_NAMES.length} quận/huyện</span>
          </div>
        )}
      </div>
    </>
  );
}
