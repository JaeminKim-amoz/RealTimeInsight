/**
 * ChannelMappingEditor (US-2-004c) — FULL.
 *
 * Spreadsheet-style editor over the slice-2 channel taxonomy. Inline cell
 * editing (click → input → blur/Enter commits, marks workspace dirty),
 * search filter (top), Add Row form, Delete Row with confirm modal,
 * Import/Export CSV stubs (placeholder messages — slice-3 wires real file IO).
 */

import { useMemo, useState } from 'react';
import { Modal } from './Modal';
import { ALL_CHANNELS } from '../mock/channels';
import { useWorkspaceStore } from '../store/workspaceStore';
import type { ChannelSummary, ChannelType, QualityPolicy } from '../types/domain';

interface ChannelMappingEditorProps {
  isOpen: boolean;
  onClose: () => void;
}

interface RowDraft {
  channelId: number;
  name: string;
  displayName: string;
  group: string;
  channelType: ChannelType;
  sampleRateHz: number;
  qualityPolicy: QualityPolicy;
  formula: string;
}

const COLUMNS: ReadonlyArray<{ key: keyof RowDraft; label: string; editable: boolean }> = [
  { key: 'channelId', label: 'channelId', editable: false },
  { key: 'name', label: 'name', editable: true },
  { key: 'displayName', label: 'displayName', editable: true },
  { key: 'group', label: 'group', editable: true },
  { key: 'channelType', label: 'channelType', editable: true },
  { key: 'sampleRateHz', label: 'sampleRateHz', editable: true },
  { key: 'qualityPolicy', label: 'qualityPolicy', editable: true },
  { key: 'formula', label: 'formula', editable: true },
];

function toRowDraft(c: ChannelSummary): RowDraft {
  return {
    channelId: c.channelId,
    name: c.name,
    displayName: c.displayName,
    group: c.group,
    channelType: c.channelType,
    sampleRateHz: c.sampleRateHz ?? 0,
    qualityPolicy: c.qualityPolicy,
    formula: 'raw',
  };
}

export function ChannelMappingEditor({ isOpen, onClose }: ChannelMappingEditorProps) {
  const [rows, setRows] = useState<RowDraft[]>(() => ALL_CHANNELS.map(toRowDraft));
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<{ id: number; col: keyof RowDraft } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState('');
  const [addGroup, setAddGroup] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.displayName.toLowerCase().includes(q) ||
        r.group.toLowerCase().includes(q) ||
        r.channelType.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const startEdit = (id: number, col: keyof RowDraft) => {
    const row = rows.find((r) => r.channelId === id);
    if (!row) return;
    setEditing({ id, col });
    setEditValue(String(row[col]));
  };

  const commitEdit = () => {
    if (!editing) return;
    setRows((cur) =>
      cur.map((r) => {
        if (r.channelId !== editing.id) return r;
        const next: RowDraft = { ...r };
        if (editing.col === 'sampleRateHz') {
          const n = Number(editValue);
          next.sampleRateHz = Number.isFinite(n) ? n : 0;
        } else if (editing.col === 'channelId') {
          // Non-editable.
        } else if (editing.col === 'channelType') {
          next.channelType = editValue as RowDraft['channelType'];
        } else if (editing.col === 'qualityPolicy') {
          next.qualityPolicy = editValue as RowDraft['qualityPolicy'];
        } else if (editing.col === 'name') {
          next.name = editValue;
        } else if (editing.col === 'displayName') {
          next.displayName = editValue;
        } else if (editing.col === 'group') {
          next.group = editValue;
        } else if (editing.col === 'formula') {
          next.formula = editValue;
        }
        return next;
      })
    );
    useWorkspaceStore.getState().markDirty();
    setEditing(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditValue('');
  };

  const handleDelete = (id: number) => {
    setRows((cur) => cur.filter((r) => r.channelId !== id));
    useWorkspaceStore.getState().markDirty();
    setConfirmDelete(null);
  };

  const handleAddSubmit = () => {
    if (!addName.trim() || !addGroup.trim()) return;
    const nextId = Math.max(...rows.map((r) => r.channelId), 0) + 1;
    const newRow: RowDraft = {
      channelId: nextId,
      name: addName.trim(),
      displayName: addName.trim(),
      group: addGroup.trim(),
      channelType: 'analog',
      sampleRateHz: 100,
      qualityPolicy: 'good-crc-only',
      formula: 'raw',
    };
    setRows((cur) => [...cur, newRow]);
    useWorkspaceStore.getState().markDirty();
    setShowAdd(false);
    setAddName('');
    setAddGroup('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="channel-mapping-editor" ariaLabel="Channel Mapping Editor">
      <div className="modal-hd">
        <span>Channel Mapping Editor</span>
        <button type="button" onClick={onClose} className="modal-close" aria-label="Close">
          ×
        </button>
      </div>

      <div className="cme-toolbar">
        <input
          type="text"
          className="mf-input cme-search"
          placeholder="Search name / displayName / group / type…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="cme-search"
        />
        <button type="button" className="tb-btn" onClick={() => setShowAdd(true)} data-testid="cme-add-btn">
          + Add Row
        </button>
        <button
          type="button"
          className="tb-btn"
          onClick={() => setMessage('Import CSV — coming in slice 3.')}
          data-testid="cme-import-csv"
        >
          Import CSV
        </button>
        <button
          type="button"
          className="tb-btn"
          onClick={() => setMessage('Export CSV — coming in slice 3.')}
          data-testid="cme-export-csv"
        >
          Export CSV
        </button>
      </div>

      {message && (
        <div className="cme-message" data-testid="cme-message" role="status">
          {message}
        </div>
      )}

      {showAdd && (
        <div className="cme-add-form" data-testid="cme-add-form">
          <input
            className="mf-input"
            placeholder="name (required)"
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            data-testid="cme-add-name"
          />
          <input
            className="mf-input"
            placeholder="group (required)"
            value={addGroup}
            onChange={(e) => setAddGroup(e.target.value)}
            data-testid="cme-add-group"
          />
          <button type="button" className="tb-btn primary" onClick={handleAddSubmit} data-testid="cme-add-submit">
            Add
          </button>
          <button type="button" className="tb-btn" onClick={() => setShowAdd(false)} data-testid="cme-add-cancel">
            Cancel
          </button>
        </div>
      )}

      <div className="modal-body cme-body">
        <table className="cme-sheet">
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
              <th>actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.channelId} data-testid={`cme-row-${row.channelId}`}>
                {COLUMNS.map((col) => {
                  const isEditing = editing && editing.id === row.channelId && editing.col === col.key;
                  return (
                    <td
                      key={col.key}
                      className={`cme-cell ${col.editable ? 'editable' : ''}`}
                      data-testid={`cme-cell-${row.channelId}-${String(col.key)}`}
                      onClick={() => col.editable && startEdit(row.channelId, col.key)}
                    >
                      {isEditing ? (
                        <input
                          className="mf-input cme-edit-input"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              commitEdit();
                            } else if (e.key === 'Escape') {
                              cancelEdit();
                            }
                          }}
                          autoFocus
                          data-testid={`cme-edit-${row.channelId}-${String(col.key)}`}
                        />
                      ) : (
                        String(row[col.key])
                      )}
                    </td>
                  );
                })}
                <td>
                  <button
                    type="button"
                    className="tb-btn"
                    onClick={() => setConfirmDelete(row.channelId)}
                    data-testid={`cme-delete-${row.channelId}`}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="cme-empty">
                  No channels match “{search}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {confirmDelete !== null && (
        <div className="cme-confirm" data-testid="cme-confirm-modal">
          <p>Delete channel {confirmDelete}?</p>
          <button
            type="button"
            className="tb-btn primary"
            onClick={() => handleDelete(confirmDelete)}
            data-testid="cme-confirm-delete"
          >
            Confirm
          </button>
          <button
            type="button"
            className="tb-btn"
            onClick={() => setConfirmDelete(null)}
            data-testid="cme-cancel-delete"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="modal-footer">
        <button type="button" className="tb-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
