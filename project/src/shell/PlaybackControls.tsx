/**
 * PlaybackControls (US-2-003) — replay-mode transport chrome.
 *
 * Renders inside TopBar when `appMode === 'replay'`. Provides:
 *   - Transport buttons (jump-to-start / -1s / play-pause / +1s / jump-to-end)
 *   - Rate selector (0.25× / 0.5× / 1× / 2× / 4×)
 *   - Scrub slider bound to RECORDING_DURATION_NS
 *   - Read-only MM:SS.mmm time display (current / total)
 *
 * Prototype CSS classNames preserved verbatim:
 *   .replay-controls / .scrub-slider / .transport-btn / .rate-selector / .time-display
 */

import { useSessionStore } from '../store/sessionStore';
import { RECORDING_DURATION_NS } from '../mock/recording';
import { formatTimeNs } from '../utils/time';

const RATE_OPTIONS = [0.25, 0.5, 1, 2, 4] as const;
const ONE_SECOND_NS = 1_000_000_000;

function clampNs(ns: number): string {
  if (!Number.isFinite(ns) || ns < 0) return '0';
  if (ns > RECORDING_DURATION_NS) return String(RECORDING_DURATION_NS);
  return String(Math.round(ns));
}

export function PlaybackControls() {
  const playback = useSessionStore((s) => s.playback);
  const togglePlay = useSessionStore((s) => s.togglePlay);
  const setRate = useSessionStore((s) => s.setRate);
  const seekTo = useSessionStore((s) => s.seekTo);

  const currentNs = Number(playback.currentTimeNs);

  const onJumpStart = () => seekTo('0');
  const onJumpEnd = () => seekTo(String(RECORDING_DURATION_NS));
  const onStepBack = () => seekTo(clampNs(currentNs - ONE_SECOND_NS));
  const onStepForward = () => seekTo(clampNs(currentNs + ONE_SECOND_NS));
  const onTogglePlay = () => togglePlay();

  const onScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    seekTo(clampNs(Number(e.target.value)));
  };

  const onRateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = Number(e.target.value);
    if (Number.isFinite(v) && v > 0) setRate(v);
  };

  return (
    <div className="replay-controls" data-testid="replay-controls">
      <div className="transport">
        <button
          type="button"
          className="transport-btn jump-start"
          onClick={onJumpStart}
          aria-label="Jump to start"
          title="Jump to start"
        >
          ⏮
        </button>
        <button
          type="button"
          className="transport-btn step-back"
          onClick={onStepBack}
          aria-label="Step back 1 second"
          title="-1s"
        >
          ⏪
        </button>
        <button
          type="button"
          className={`transport-btn play-pause${playback.isPlaying ? ' playing' : ''}`}
          onClick={onTogglePlay}
          aria-label={playback.isPlaying ? 'Pause' : 'Play'}
          aria-pressed={playback.isPlaying}
          title={playback.isPlaying ? 'Pause' : 'Play'}
        >
          ⏯
        </button>
        <button
          type="button"
          className="transport-btn step-forward"
          onClick={onStepForward}
          aria-label="Step forward 1 second"
          title="+1s"
        >
          ⏩
        </button>
        <button
          type="button"
          className="transport-btn jump-end"
          onClick={onJumpEnd}
          aria-label="Jump to end"
          title="Jump to end"
        >
          ⏭
        </button>
      </div>

      <select
        className="rate-selector"
        aria-label="Playback rate"
        value={playback.rate}
        onChange={onRateChange}
      >
        {RATE_OPTIONS.map((r) => (
          <option key={r} value={r}>
            {r}x
          </option>
        ))}
      </select>

      <input
        type="range"
        className="scrub-slider"
        aria-label="Playback scrub"
        min={0}
        max={RECORDING_DURATION_NS}
        step={1_000_000}
        value={Number.isFinite(currentNs) ? currentNs : 0}
        onChange={onScrub}
      />

      <span className="time-display mono">
        {formatTimeNs(playback.currentTimeNs)}
        {' / '}
        {formatTimeNs(String(RECORDING_DURATION_NS))}
      </span>
    </div>
  );
}
