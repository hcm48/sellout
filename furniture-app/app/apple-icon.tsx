import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        background: "#1C1917",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#F7F5F1",
        fontSize: 120,
        fontWeight: 700,
        fontFamily: "serif",
      }}
    >
      C
    </div>,
    { ...size }
  );
}
