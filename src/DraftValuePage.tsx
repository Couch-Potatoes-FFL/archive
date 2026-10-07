import { useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { archivePublicUrl } from "./data";
import type { DraftValueRow } from "./draftValue";
import "./draftValue.css";

type Props = {
  year: number;
  years: number[];
  rows: DraftValueRow[];
  onYearChange: (year: number) => void;
};

type SortKey = "pointsPerDollar" | "fantasyPoints" | "bidAmount";

const positions = ["All", "QB", "RB", "WR", "TE", "K", "D/ST"] as const;
const positionColors: Record<string, string> = {
  QB: "#176142", RB: "#a55324", WR: "#315e9a",
  TE: "#80518c", K: "#af3652", "D/ST": "#526675",
};
const number = (value: number, decimals = 2) =>
  value.toLocaleString(undefined, { maximumFractionDigits: decimals });

function positionOf(row: DraftValueRow) {
  const position = row.position?.toUpperCase().replace(/[^A-Z]/g, "") ?? "";
  return position === "DST" || position === "DEF" ? "D/ST" : (position || "—");
}

export default function DraftValuePage({ year, years, rows, onYearChange }: Props) {
  const [position, setPosition] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [includeKeepers, setIncludeKeepers] = useState(false);
  const [hovered, setHovered] = useState<{ id: string; left: number; top: number; below: boolean } | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; descending: boolean }>({
    key: "pointsPerDollar",
    descending: true,
  });

  const query = search.trim().toLocaleLowerCase();
  const filtered = rows.filter((row) =>
    (includeKeepers || !row.keeperStatus) &&
    (position === "All" || positionOf(row) === position) &&
    row.playerName.toLocaleLowerCase().includes(query),
  );
  const leaderboard = filtered.slice().sort((a, b) =>
    (sort.descending ? b[sort.key] - a[sort.key] : a[sort.key] - b[sort.key]) ||
    a.playerName.localeCompare(b.playerName),
  );
  const chartPositions = positions.slice(1).filter((value) => filtered.some((row) => positionOf(row) === value));
  const hoveredRow = filtered.find((row) => row.id === hovered?.id);
  const hoveredPhotoUrl = archivePublicUrl(hoveredRow?.photoUrl);

  const showTooltip = (row: DraftValueRow, circle: SVGCircleElement) => {
    const rect = circle.getBoundingClientRect();
    const below = rect.top < 140;
    setHovered({
      id: row.id,
      left: Math.max(8, Math.min(rect.right + 8, window.innerWidth - 248)),
      top: below ? rect.bottom + 10 : rect.top - 10,
      below,
    });
  };

  const maxCost = Math.max(10, Math.ceil(Math.max(...filtered.map((row) => row.bidAmount), 0) / 10) * 10);
  const maxPoints = Math.max(50, Math.ceil(Math.max(...filtered.map((row) => row.fantasyPoints), 0) / 50) * 50);
  const plot = { left: 68, top: 20, width: 696, height: 274 };
  const sortBy = (key: SortKey) => setSort((current) => ({
    key,
    descending: current.key === key ? !current.descending : true,
  }));
  const sortHeading = (label: string, key: SortKey) => (
    <th scope="col" className="draftValueNumber draftValueSortable" aria-sort={sort.key === key ? (sort.descending ? "descending" : "ascending") : "none"}>
      <button type="button" onClick={() => sortBy(key)}>
        {label}<span aria-hidden="true">{sort.key === key ? (sort.descending ? " ↓" : " ↑") : " ↕"}</span>
      </button>
    </th>
  );

  return (
    <>
      <section className="pageIntro draftValuePageIntro">
        <div>
          <h1>Draft value</h1>
          <p className="draftValueIntro">Auction cost vs. full-season fantasy points, including points scored after trades.</p>
        </div>
      </section>

      <section className="controlBand draftValueControls" aria-label="Draft value filters">
        <label>
          <span>Season</span>
          <select value={year} onChange={(event) => onYearChange(Number(event.target.value))}>
            {years.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <label>
          <span>Position</span>
          <select value={position} onChange={(event) => setPosition(event.target.value)}>
            {positions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <label>
          <span>Player</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search player name" />
        </label>
        <label className="draftValueKeeperFilter">
          <input type="checkbox" checked={includeKeepers} onChange={(event) => setIncludeKeepers(event.target.checked)} />
          <span>Include keepers</span>
        </label>
      </section>

      <section className="contentBand" aria-label="Auction cost and season points chart">
        <div className="sectionHeader">
          <h2>Cost vs season points</h2>
          <span className="pendingNote">{filtered.length} {filtered.length === 1 ? "player" : "players"}</span>
        </div>
        {filtered.length === 0 ? (
          <p className="emptyNote">No players match these filters.</p>
        ) : (
          <>
            <div className="draftValueChartWrap">
              <svg className="draftValueChart" viewBox="0 0 800 350" role="group" aria-label={`Auction cost versus season fantasy points for ${filtered.length} players in ${year}`}>
                <desc>Each dot is one drafted player. The horizontal axis shows auction cost in dollars, and the vertical axis shows season fantasy points.</desc>
                {[0, 1, 2, 3, 4].map((tick) => {
                  const y = plot.top + plot.height * (1 - tick / 4);
                  const x = plot.left + plot.width * tick / 4;
                  return (
                    <g key={tick} className="draftValueGrid">
                      <line x1={plot.left} x2={plot.left + plot.width} y1={y} y2={y} />
                      <line x1={x} x2={x} y1={plot.top} y2={plot.top + plot.height} />
                      <text x={plot.left - 12} y={y + 4} textAnchor="end">{number(maxPoints * tick / 4, 0)}</text>
                      <text x={x} y={plot.top + plot.height + 22} textAnchor="middle">${number(maxCost * tick / 4, 1)}</text>
                    </g>
                  );
                })}
                {filtered.map((row) => (
                  <circle
                    key={row.id}
                    className={row.keeperStatus ? "draftValueDot keeper" : "draftValueDot"}
                    style={{ fill: positionColors[positionOf(row)] ?? "var(--field)" }}
                    cx={plot.left + plot.width * row.bidAmount / maxCost}
                    cy={plot.top + plot.height * (1 - row.fantasyPoints / maxPoints)}
                    r="5"
                    tabIndex={0}
                    aria-label={`${row.playerName}, ${positionOf(row)}, ${number(row.fantasyPoints)} season points, $${number(row.bidAmount)} auction cost${row.keeperStatus ? ", keeper" : ""}`}
                    onPointerEnter={(event) => showTooltip(row, event.currentTarget)}
                    onPointerLeave={(event) => { if (document.activeElement !== event.currentTarget) setHovered(null); }}
                    onFocus={(event) => showTooltip(row, event.currentTarget)}
                    onBlur={(event) => { if (!event.currentTarget.matches(":hover")) setHovered(null); }}
                  />
                ))}
                <text className="draftValueAxisTitle" x={plot.left + plot.width / 2} y="342" textAnchor="middle">Auction cost ($)</text>
                <text className="draftValueAxisTitle" transform="translate(16 157) rotate(-90)" textAnchor="middle">Season fantasy points</text>
              </svg>
            </div>
            <div className="draftValueChartNote">
              <span>Each dot is a player. Hover or focus for details; all values appear below.</span>
              <div className="draftValueLegend" aria-label="Chart legend">
                <strong>Position:</strong>
                {chartPositions.map((value) => <span key={value}><i aria-hidden="true" style={{ backgroundColor: positionColors[value] }} />{value}</span>)}
                {includeKeepers && <span className="draftValueLegendKeeper"><i aria-hidden="true" />Keeper (orange ring)</span>}
              </div>
            </div>
          </>
        )}
      </section>

      {hovered && hoveredRow && createPortal(
        <div className={`draftValueTooltip${hovered.below ? " below" : ""}`} style={{ left: hovered.left, top: hovered.top }} role="tooltip">
          <span className="draftValueTooltipAvatar" aria-hidden="true">
            {positionOf(hoveredRow)}
            {hoveredPhotoUrl && <img key={hoveredRow.id} src={hoveredPhotoUrl} alt="" onError={(event) => { event.currentTarget.hidden = true; }} />}
          </span>
          <span>
            <strong>{hoveredRow.playerName} - {positionOf(hoveredRow)}</strong>
            {hoveredRow.keeperStatus && <small>Keeper</small>}
            <span><b>{number(hoveredRow.fantasyPoints)}</b> season points</span>
            <span>${number(hoveredRow.bidAmount)} cost · {number(hoveredRow.pointsPerDollar)} pts/$</span>
          </span>
        </div>, document.body,
      )}

      <section className="contentBand" aria-label="Draft value leaderboard">
        <div className="sectionHeader">
          <h2>Leaderboard</h2>
          <span className="pendingNote">Points per dollar = season points ÷ auction cost</span>
        </div>
        {leaderboard.length === 0 ? (
          <p className="emptyNote">No players match these filters.</p>
        ) : (
          <div className="draftValueTableWrap">
            <table className="draftValueTable">
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col">Player</th>
                  <th scope="col">Pos</th>
                  <th scope="col">Drafted by</th>
                  {sortHeading("Cost", "bidAmount")}
                  {sortHeading("Season points", "fantasyPoints")}
                  {sortHeading("PPD", "pointsPerDollar")}
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row, index) => (
                  <tr key={row.id}>
                    <td>{index + 1}</td>
                    <td><Link to={`/player/${encodeURIComponent(row.playerKey)}?fromYear=${year}`}>{row.playerName}</Link>{row.keeperStatus && <span className="draftValueKeeperBadge">Keeper</span>}</td>
                    <td>{positionOf(row)}</td>
                    <td>{row.draftedTeamName}</td>
                    <td className="draftValueNumber">${number(row.bidAmount)}</td>
                    <td className="draftValueNumber">{number(row.fantasyPoints)}</td>
                    <td className="draftValueNumber draftValueRatio">{number(row.pointsPerDollar)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
