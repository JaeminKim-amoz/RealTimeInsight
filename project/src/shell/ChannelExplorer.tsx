/**
 * ChannelExplorer (US-013) — left sidebar with search, filter chips,
 * favorites, and group tree. Visual port of public/app/shell.jsx
 * ChannelExplorer with class names per US-013 (`leftpane`, `channel-explorer`).
 */

import { useMemo, useState } from 'react';
import {
  ALL_CHANNELS,
  CHANNEL_GROUPS,
  searchChannels,
} from '../mock/channels';
import type { ChannelSummary, DragChannelPayload } from '../types/domain';

const FILTER_CHIPS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'analog', label: 'analog' },
  { id: 'discrete', label: 'discrete' },
  { id: 'spectrum', label: 'spectrum' },
  { id: 'alarmed', label: 'alarmed' },
  { id: 'favorite', label: 'favorite' },
  { id: 'good only', label: 'good only' },
  { id: 'map-capable', label: 'map-capable' },
  { id: 'video-linked', label: 'video-linked' },
];

function chipMatches(c: ChannelSummary, chip: string): boolean {
  switch (chip) {
    case 'analog':
      return c.channelType === 'analog';
    case 'discrete':
      return c.channelType === 'discrete';
    case 'spectrum':
      return c.channelType === 'spectrum';
    case 'alarmed':
      return c.alarmArmed === true;
    case 'favorite':
      return c.favorite === true;
    case 'good only':
      return c.qualityPolicy === 'good-crc-only';
    case 'map-capable':
      return c.group === 'Nav';
    case 'video-linked':
      return c.channelType === 'video-ref';
    default:
      return true;
  }
}

function passesAllChips(c: ChannelSummary, activeChips: ReadonlySet<string>): boolean {
  if (activeChips.size === 0) return true;
  for (const chip of activeChips) {
    if (!chipMatches(c, chip)) return false;
  }
  return true;
}

interface ChannelRowProps {
  channel: ChannelSummary;
  isFavorite: boolean;
}

function ChannelRow({ channel, isFavorite }: ChannelRowProps) {
  const onDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    const payload: DragChannelPayload = {
      kind: 'channel-drag',
      channelId: channel.channelId,
      displayName: channel.displayName,
      channelType: channel.channelType,
      unit: channel.unit,
    };
    if (e.dataTransfer) {
      e.dataTransfer.setData('application/x-channel', JSON.stringify(payload));
      e.dataTransfer.effectAllowed = 'copy';
    }
  };

  return (
    <div className="ch-row" draggable onDragStart={onDragStart}>
      <span className={`fav-star ${isFavorite ? 'on' : ''}`.trim()}>★</span>
      <span className={`ctype ${channel.channelType}`}>{channel.channelType}</span>
      <div className="ch-name-wrap">
        <span className="ch-name">{channel.displayName}</span>
        <span className="ch-sub">
          {channel.group}
          {channel.sampleRateHz != null ? ` · ${channel.sampleRateHz}Hz` : ''}
          {channel.alarmArmed ? ' · ALARM' : ''}
        </span>
      </div>
      {channel.unit ? <span className="ch-unit">{channel.unit}</span> : null}
      <span className="ch-id">#{channel.channelId}</span>
      <span className="drag-handle" aria-hidden>
        ⋮⋮
      </span>
      {channel.alarmArmed ? <span className="alarm-dot" /> : null}
    </div>
  );
}

export function ChannelExplorer() {
  const [query, setQuery] = useState('');
  const [activeChips, setActiveChips] = useState<Set<string>>(new Set());
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    power: true,
    hydraulic: true,
    pose: true,
    rf: true,
    nav: false,
    video: false,
  });

  const toggleChip = (id: string) => {
    setActiveChips((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const searchHits = useMemo(() => searchChannels(query), [query]);
  const matchedIds = useMemo(
    () => new Set(searchHits.map((c) => c.channelId)),
    [searchHits]
  );

  const channelPasses = (c: ChannelSummary): boolean =>
    matchedIds.has(c.channelId) && passesAllChips(c, activeChips);

  const totalMatched = useMemo(
    () => ALL_CHANNELS.filter(channelPasses).length,
    [matchedIds, activeChips]
  );

  const favorites = useMemo(
    () => ALL_CHANNELS.filter((c) => c.favorite === true && channelPasses(c)),
    [matchedIds, activeChips]
  );

  return (
    <div className="leftpane channel-explorer pane">
      <div className="pane-header">
        <span>Channel Explorer</span>
        <span className="count">
          {totalMatched} / {ALL_CHANNELS.length}
        </span>
      </div>

      <div className="searchbox">
        <input
          type="text"
          placeholder="search channels, group:, unit:, type:…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="kbd-hint">⌘K</span>
      </div>

      <div className="filter-chips">
        {FILTER_CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className={`chip ${activeChips.has(chip.id) ? 'on' : ''}`.trim()}
            onClick={() => toggleChip(chip.id)}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="tree">
        <div className="tree-section favorites-section">
          <div className="tree-section-header">Favorites</div>
          {favorites.map((ch) => (
            <ChannelRow key={`fav-${ch.channelId}`} channel={ch} isFavorite />
          ))}
        </div>

        <div className="tree-section all-section">
          <div className="tree-section-header">All Channels</div>
          {CHANNEL_GROUPS.map((g) => {
            const isOpen = openGroups[g.id] ?? false;
            const visible = g.children.filter(channelPasses);
            return (
              <div key={g.id} className="tree-group-wrap">
                <div
                  className={`tree-group ${isOpen ? 'open' : ''}`.trim()}
                  onClick={() => toggleGroup(g.id)}
                  role="button"
                  tabIndex={0}
                >
                  <span className="caret">▶</span>
                  <span>{g.name}</span>
                  <span className="grp-count">{visible.length}</span>
                </div>
                {isOpen
                  ? visible.map((ch) => (
                      <ChannelRow
                        key={ch.channelId}
                        channel={ch}
                        isFavorite={ch.favorite === true}
                      />
                    ))
                  : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
