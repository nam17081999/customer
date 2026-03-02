import { useEffect, useRef, useState } from "react";

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export default function TestMap() {
  const mapRef = useRef(null);
  const [status, setStatus] = useState("Đang tải Google Maps...");

  useEffect(() => {
    // Load Google Maps script
    if (window.google?.maps?.Map) {
      initMap();
      return;
    }

    const callbackName = "__initTestMap";
    window[callbackName] = () => {
      delete window[callbackName];
      initMap();
    };

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      setStatus("❌ Lỗi tải script Google Maps");
    };
    document.head.appendChild(script);

    function initMap() {
      try {
        const map = new window.google.maps.Map(mapRef.current, {
          center: { lat: 10.7769, lng: 106.7009 },
          zoom: 14,
          mapTypeControl: false,
        });

        new window.google.maps.Marker({
          position: { lat: 10.7769, lng: 106.7009 },
          map,
          title: "Hồ Chí Minh",
        });

        setStatus("✅ Google Maps đã tải thành công!");
      } catch (err) {
        setStatus("❌ Lỗi khởi tạo map: " + err.message);
      }
    }
  }, []);

  return (
    <div style={{ fontFamily: "sans-serif" }}>
      <div
        style={{
          padding: "12px 20px",
          background: "#111",
          color: "#fff",
          fontSize: 16,
        }}
      >
        <strong>Test Google Maps</strong> — {status}
      </div>
      <div
        ref={mapRef}
        style={{ width: "100%", height: "calc(100vh - 48px)" }}
      />
    </div>
  );
}
