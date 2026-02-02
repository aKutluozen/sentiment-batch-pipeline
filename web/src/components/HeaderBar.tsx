import { LiveSnapshot } from "../api";

type HeaderBarProps = {
  live: LiveSnapshot | null;
};

export default function HeaderBar({ live }: HeaderBarProps) {
  return (
    <header className="header">
      <div className="brand">
        <img src="/logo.png" alt="IQRush" className="logo" />
        <div>
          <h1>IQRush Dashboard</h1>
          <p>Realtime run telemetry + historical comparisons</p>
        </div>
      </div>
      <div className="status">
        <span className={`pill ${live?.status ?? "idle"}`}>{live?.status ?? "idle"}</span>
        <span className="mono">{live?.timestamp ?? "no live data"}</span>
      </div>
    </header>
  );
}
