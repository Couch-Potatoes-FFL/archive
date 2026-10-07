import { Link } from "react-router-dom";
import { formatNumber } from "./data";
import type { OwnerCareer, OwnerSeason } from "./ownerCareers";
import "./ownerCareers.css";

const record = (wins: number, losses: number, ties: number) =>
  `${wins}–${losses}–${ties}`;

const seasonCount = (career: OwnerCareer) =>
  new Set(career.seasons.map((season) => season.year)).size;

const finish = (season: OwnerSeason) => {
  if (season.finalStanding === undefined) {
    return season.year === new Date().getFullYear() ? "In progress" : "Finish unavailable";
  }
  const suffix = season.finalStanding % 100 >= 11 && season.finalStanding % 100 <= 13
    ? "th"
    : (["th", "st", "nd", "rd"][season.finalStanding % 10] ?? "th");
  return `${season.finalStanding}${suffix} place`;
};

export function OwnerIndexPage({ careers }: { careers: OwnerCareer[] }) {
  return (
    <>
      <section className="pageIntro">
        <div>
          <p className="eyebrow">League history</p>
          <h1>Owner careers</h1>
          <p className="ownerIntro">
            Regular-season records and points cover 2012 through the current season.
            Championship history also includes 2006–11.
          </p>
        </div>
      </section>

      <section className="contentBand" aria-label="All owners">
        <div className="sectionHeader">
          <h2>All owners</h2>
          <span className="pendingNote">{careers.length} owners</span>
        </div>
        {careers.length === 0 ? (
          <p className="emptyNote">No owner history is available.</p>
        ) : (
          <ul className="ownerIndexGrid">
            {careers.map((career) => (
              <li key={career.name}>
                <Link className="ownerIndexCard" to={`/owner/${encodeURIComponent(career.name)}`}>
                  <strong>{career.name}</strong>
                  <span>{seasonCount(career)} {seasonCount(career) === 1 ? "season" : "seasons"} · {career.titles.length} {career.titles.length === 1 ? "title" : "titles"}</span>
                  <span>{career.seasons.length ? `${record(career.wins, career.losses, career.ties)} regular season` : "Historical titles only"}</span>
                  <span className="ownerCardArrow" aria-hidden="true">View career →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export function OwnerCareerPage({ career }: { career: OwnerCareer }) {
  const seasons = career.seasons.slice().sort((a, b) =>
    b.year - a.year || a.teamName.localeCompare(b.teamName),
  );
  const titles = career.titles.slice().sort((a, b) => b.year - a.year);
  const hasSeasonStats = seasons.length > 0;

  return (
    <>
      <section className="pageIntro">
        <div>
          <p className="eyebrow">Owner career</p>
          <h1>{career.name}</h1>
          <p className="ownerIntro">
            Regular-season records and points cover 2012 through the current season.
            Championship history also includes 2006–11.
          </p>
        </div>
      </section>

      <section className="contentBand" aria-label={`${career.name} career summary`}>
        <div className="sectionHeader"><h2>Career summary</h2></div>
        <dl className="ownerStats">
          <div><dt>Seasons</dt><dd>{seasonCount(career)}</dd></div>
          <div><dt>Regular-season W–L–T</dt><dd>{hasSeasonStats ? record(career.wins, career.losses, career.ties) : "—"}</dd></div>
          <div><dt>Points for</dt><dd>{hasSeasonStats ? formatNumber(career.pointsFor, 2) : "—"}</dd></div>
          <div><dt>Points against</dt><dd>{hasSeasonStats ? formatNumber(career.pointsAgainst, 2) : "—"}</dd></div>
          <div><dt>Championships</dt><dd>{titles.length}</dd></div>
        </dl>
      </section>

      <section className="contentBand" aria-label="Championship history">
        <div className="sectionHeader"><h2>Championships</h2></div>
        {titles.length === 0 ? (
          <p className="emptyNote">No championships recorded.</p>
        ) : (
          <ol className="ownerTitles">
            {titles.map((title) => (
              <li key={`${title.year}-${title.teamName}`}>
                {title.href ? (
                  <Link to={title.href}>{title.year} · {title.teamName} <span aria-hidden="true">→</span></Link>
                ) : (
                  <span>{title.year} · {title.teamName}</span>
                )}
                {!title.href && <small>Historical result</small>}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="contentBand" aria-label="Season timeline">
        <div className="sectionHeader">
          <h2>Season timeline</h2>
          <span className="pendingNote">Newest first</span>
        </div>
        {seasons.length === 0 ? (
          <p className="emptyNote">Team season details begin in 2012.</p>
        ) : (
          <ol className="ownerTimeline">
            {seasons.map((season) => (
              <li key={`${season.year}-${season.teamKey}`}>
                <Link className="ownerSeasonCard" to={`/season/${season.year}/team/${season.teamKey}`}>
                  <span className="ownerSeasonYear">{season.year}</span>
                  <span className="ownerSeasonTeam">
                    <strong>{season.teamName}</strong>
                    <small>{finish(season)}</small>
                  </span>
                  <span className="ownerSeasonRecord">
                    <strong>{record(season.wins, season.losses, season.ties)}</strong>
                    <small>Regular season</small>
                  </span>
                  <span className="ownerSeasonPoints">
                    <strong>{formatNumber(season.pointsFor, 2)} PF</strong>
                    <small>{formatNumber(season.pointsAgainst, 2)} PA</small>
                  </span>
                  <span className="ownerCardArrow" aria-hidden="true">View team →</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
