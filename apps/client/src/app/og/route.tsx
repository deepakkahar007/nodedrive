import { ImageResponse } from "next/og";

export function GET() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        padding: 64,
        background: "#f6f8fc",
        color: "#17233d",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ display: "flex", flex: 1, flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 38,
              height: 38,
              border: "3px solid #3d63f5",
              borderRadius: 11,
            }}
          />
          <span style={{ fontSize: 25, fontWeight: 700 }}>NodeDrive</span>
        </div>
        <div
          style={{
            display: "flex",
            maxWidth: 570,
            marginTop: 72,
            fontSize: 66,
            lineHeight: 1.06,
            fontWeight: 700,
            letterSpacing: -3,
          }}
        >
          A home for every team file.
        </div>
        <p
          style={{
            maxWidth: 480,
            marginTop: 24,
            color: "#68768d",
            fontSize: 23,
          }}
        >
          Upload, organize, and share work from one place.
        </p>
      </div>
      <div
        style={{
          display: "flex",
          width: 390,
          alignSelf: "center",
          flexDirection: "column",
          padding: 26,
          borderRadius: 24,
          background: "#17233d",
          color: "white",
        }}
      >
        <span style={{ color: "#b8f4d5", fontSize: 16 }}>DESIGN TEAM</span>
        <span style={{ marginTop: 12, fontSize: 27, fontWeight: 700 }}>
          Shared workspace
        </span>
        {[
          ["Product launch", "12 files"],
          ["Brand guidelines.pdf", "Updated today"],
          ["Campaign plan.xlsx", "820 KB"],
        ].map(([name, detail]) => (
          <div
            key={name}
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 22,
              paddingTop: 17,
              borderTop: "1px solid #34415a",
              color: "#eef3fc",
              fontSize: 16,
            }}
          >
            <span>{name}</span>
            <span style={{ color: "#aeb9cc" }}>{detail}</span>
          </div>
        ))}
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
