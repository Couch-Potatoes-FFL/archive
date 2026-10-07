import { useState } from "react";
import { Link } from "react-router-dom";
import { summarizeRivalry, type RivalryGame } from "./rivalries";
import "./rivalries.css";

type Props = { games: RivalryGame[] };

const score = (value: number) =>
  value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function RivalriesPage({ games }: Props) {
  const owners = Array.from(
    new Set(games.flatMap((game) => [game.homeOwner, game.awayOwner])),
  ).sort((a, b) => a.localeCompare(b));
  const [selected, setSelected] = useState({ a: "", b: "" });
  const ownerA = owners.includes(selected.a) ? selected.a : (owners[0] ?? "");
  const ownerB =
    owners.includes(selected.b) && selected.b !== ownerA
      ? selected.b
      : (owners.find((owner) => owner !== ownerA) ?? "");
  const rivalry = ownerA && ownerB ? summarizeRivalry(games, ownerA, ownerB) : undefined;
  const matchups = rivalry?.games.slice().sort((a, b) =>
    b.year - a.year || b.week - a.week || a.matchupKey.localeCompare(b.matchupKey),
  ) ?? [];

  return (
    <>
      <section className="pageIntro">
        <div>
          <p className="eyebrow">League history</p>
          <h1>Rivalries</h1>
          <p className="rivalryIntro">Scored regular season and postseason matchups in the archive.</p>
        </div>
      </section>

      {owners.length < 2 ? (
        <section className="contentBand" aria-label="Rivalries unavailable">
          <p className="emptyNote">No scored owner matchups are available yet.</p>
        </section>
      ) : (
        <>
          <section className="contentBand" aria-label="Choose owners">
            <div className="rivalrySelectors">
              <label>
                <span>First owner</span>
                <select
                  value={ownerA}
                  onChange={(event) =>
                    setSelected({
                      a: event.target.value,
                      b: event.target.value === ownerB ? ownerA : ownerB,
                    })
                  }
                >
                  {owners.map((owner) => (
                    <option key={owner} value={owner}>{owner}</option>
                  ))}
                </select>
              </label>
              <span className="rivalryVersus" aria-hidden="true">vs</span>
              <label>
                <span>Second owner</span>
                <select
                  value={ownerB}
                  onChange={(event) =>
                    setSelected({
                      a: event.target.value === ownerA ? ownerB : ownerA,
                      b: event.target.value,
                    })
                  }
                >
                  {owners.map((owner) => (
                    <option key={owner} value={owner}>{owner}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="contentBand" aria-label="Head-to-head summary">
            <div className="sectionHeader">
              <h2>{ownerA} vs {ownerB}</h2>
              <span className="pendingNote">
                {matchups.length} {matchups.length === 1 ? "game" : "games"}
              </span>
            </div>
            {rivalry && (
              <div className="rivalryStats">
                <div className="rivalryStat">
                  <span className="rivalryStatLabel">Record · {ownerA}</span>
                  <strong>{rivalry.winsA}–{rivalry.winsB}–{rivalry.ties}</strong>
                  <span className="rivalryStatDetail">Wins – losses – ties</span>
                </div>
                <div className="rivalryStat">
                  <span className="rivalryStatLabel">Total points</span>
                  <strong>{score(rivalry.pointsA)}–{score(rivalry.pointsB)}</strong>
                  <span className="rivalryStatDetail">{ownerA} – {ownerB}</span>
                </div>
              </div>
            )}
          </section>

          <section className="contentBand" aria-label="Matchup history">
            <div className="sectionHeader">
              <h2>Matchup history</h2>
            </div>
            {matchups.length === 0 ? (
              <p className="emptyNote">These owners have no scored matchups in the archive.</p>
            ) : (
              <ol className="rivalryGames">
                {matchups.map((game) => (
                  <li key={`${game.year}-${game.week}-${game.matchupKey}`}>
                    <Link className="rivalryGame" to={game.href}>
                      <span className="rivalryGameMeta">
                        <strong>{game.year} · Week {game.week}</strong>
                        {game.isPlayoff && <span className="rivalryPostseason">Postseason</span>}
                      </span>
                      <span className="rivalryGameTeams">
                        <span className={game.awayScore > game.homeScore ? "rivalryWinner" : undefined}>
                          <span className="rivalryTeamName">{game.awayTeamName} <small>({game.awayOwner}, away)</small></span>
                          <b>{score(game.awayScore)}</b>
                        </span>
                        <span className={game.homeScore > game.awayScore ? "rivalryWinner" : undefined}>
                          <span className="rivalryTeamName">{game.homeTeamName} <small>({game.homeOwner}, home)</small></span>
                          <b>{score(game.homeScore)}</b>
                        </span>
                      </span>
                      <span className="rivalryGameLink">View week →</span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </>
  );
}
