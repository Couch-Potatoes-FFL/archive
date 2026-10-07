import { Link } from "react-router-dom";
import { formatOwnerNames } from "./data";
import type { ScheduleLuckRow } from "./scheduleLuck";
import "./scheduleLuck.css";

type Props = {
  year: number;
  years: number[];
  rows: ScheduleLuckRow[];
  onYearChange: (year: number) => void;
};

const decimal = (value: number) =>
  value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const signedDecimal = (value: number) => `${value > 0 ? "+" : ""}${decimal(value)}`;
const record = (wins: number, losses: number, ties: number) =>
  `${wins}–${losses}–${ties}`;
const luckTone = (value: number) =>
  value > 0 ? "positive" : value < 0 ? "negative" : "neutral";

export default function ScheduleLuckPage({ year, years, rows, onYearChange }: Props) {
  const ranked = rows.slice().sort((a, b) =>
    b.winsAboveExpected - a.winsAboveExpected || a.teamName.localeCompare(b.teamName),
  );
  const scale = Math.max(0.01, ...ranked.map((row) => Math.abs(row.winsAboveExpected)));

  return (
    <>
      <section className="pageIntro">
        <div>
          <p className="eyebrow">League history</p>
          <h1>Schedule Luck</h1>
        </div>
      </section>

      <section className="contentBand luckOverview" aria-label="Season and method">
        <label className="luckSeasonSelector">
          <span>Season</span>
          <select
            value={year}
            onChange={(event) => onYearChange(Number(event.target.value))}
            disabled={years.length === 0}
          >
            {years.slice().sort((a, b) => b - a).map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <div className="luckMethod">
          <h2>How it works</h2>
          <p>
            Each week, compare a team&apos;s score with every other team&apos;s. Its
            expected wins for that week are its average all-play win equivalents:
            one for a win, half for a tie, and zero for a loss. Schedule luck is
            actual win equivalents minus expected wins, summed across complete,
            scored regular season weeks.
          </p>
          <p>
            Positive means a friendlier schedule; negative means a tougher one.
            Actual records use weekly scores and may differ from official
            standings when games are tied.
          </p>
        </div>
      </section>

      <section className="contentBand" aria-label="Wins above expected chart">
        <div className="sectionHeader">
          <h2>Wins above expected</h2>
          <span className="pendingNote">{ranked.length} teams</span>
        </div>
        {ranked.length === 0 ? (
          <p className="emptyNote">No complete, scored regular season weeks are available for {year}.</p>
        ) : (
          <>
            <div className="luckScale" aria-hidden="true">
              <span>Tougher schedule</span>
              <span>0</span>
              <span>Friendlier schedule</span>
            </div>
            <ol className="luckBars">
              {ranked.map((row) => (
                <li className="luckBarRow" key={row.teamKey}>
                  <Link className="luckBarTeam" to={`/season/${year}/team/${row.teamKey}`}>
                    {row.teamName}
                  </Link>
                  <span className="luckBarTrack" aria-hidden="true">
                    <span
                      className={`luckBarFill ${luckTone(row.winsAboveExpected)}`}
                      style={{ width: `${Math.abs(row.winsAboveExpected) / scale * 50}%` }}
                    />
                  </span>
                  <strong className={`luckBarValue ${luckTone(row.winsAboveExpected)}`}>
                    {signedDecimal(row.winsAboveExpected)}
                  </strong>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>

      {ranked.length > 0 && (
        <section className="contentBand" aria-label="Schedule luck leaderboard">
          <div className="sectionHeader">
            <h2>Leaderboard</h2>
          </div>
          <div className="tableWrap luckTableWrap" role="region" aria-label="Scrollable schedule luck leaderboard" tabIndex={0}>
            <table className="luckTable">
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col">Team</th>
                  <th scope="col">Actual W–L–T</th>
                  <th scope="col">All-play W–L–T</th>
                  <th scope="col">Expected wins</th>
                  <th scope="col">Wins above expected</th>
                  <th scope="col">Points for</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((row, index) => (
                  <tr key={row.teamKey}>
                    <td>{index + 1}</td>
                    <td>
                      <Link className="luckTableTeam" to={`/season/${year}/team/${row.teamKey}`}>
                        {row.teamName}
                      </Link>
                      <small>{formatOwnerNames(row.ownerNames)}</small>
                    </td>
                    <td>{record(row.actualWins, row.actualLosses, row.actualTies)}</td>
                    <td>{record(row.allPlayWins, row.allPlayLosses, row.allPlayTies)}</td>
                    <td>{decimal(row.expectedWins)}</td>
                    <td className={row.winsAboveExpected < 0 ? "luckNegative" : row.winsAboveExpected > 0 ? "luckPositive" : undefined}>
                      {signedDecimal(row.winsAboveExpected)}
                    </td>
                    <td>{decimal(row.pointsFor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
