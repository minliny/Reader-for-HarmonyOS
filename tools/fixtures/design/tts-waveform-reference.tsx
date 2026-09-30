const TEAL = "#2f6373";
const WAVEFORM_CSS = `
        @keyframes wb {
          from { transform: scaleY(0.4); }
          to   { transform: scaleY(1.15); }
        }
`;

function EqualiserBar({ playing }: { playing: boolean }) {
  const bars = [7, 13, 9, 18, 12, 22, 15, 10, 20, 14, 8, 17, 11, 21, 13, 9, 16, 12, 19, 10, 14, 8, 15, 11];
  return (
    <div className="flex items-center justify-between h-[26px] w-full">
      {bars.map((h, i) => (
        <div
          key={i}
          className="rounded-full"
          style={{
            width: 2.5,
            height: playing ? h : 4,
            background: playing ? TEAL : "rgba(180,166,151,0.42)",
            opacity: playing ? 0.75 + (i % 3) * 0.12 : 1,
            transformOrigin: "center",
            animation: playing ? `wb ${0.65 + (i % 5) * 0.11}s ease-in-out ${i * 0.03}s infinite alternate` : "none",
            transition: "height 0.3s ease, background 0.35s ease",
          }}
        />
      ))}
    </div>
  );
}
