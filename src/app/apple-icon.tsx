import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const heart = [
  "031000130",
  "111101111",
  "111111111",
  "112111211",
  "011212110",
  "001222100",
  "000121000",
  "000010000",
];

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: "#f2eee6" }}>
      <div style={{ display: "flex", width: 108, height: 96, flexWrap: "wrap" }}>
        {heart.flatMap((row, rowIndex) => [...row].map((tone, columnIndex) => (
          <div key={`${rowIndex}-${columnIndex}`} style={{ width: 12, height: 12, background: tone === "1" ? "#ff5c45" : tone === "2" ? "#171512" : tone === "3" ? "#ffd84a" : "transparent" }} />
        )))}
      </div>
    </div>,
    size,
  );
}
