export interface ChannelSummary {
  id: number;
  name: string;
  display: string;
  unit: string;
  type: string;
  rate: number;
  group?: string;
  groupId?: string;
}

export interface ChannelGroup {
  id: string;
  name: string;
  children: ChannelSummary[];
}

export const CHANNEL_GROUPS: ChannelGroup[];
export const ALL_CHANNELS: ChannelSummary[];
export function searchChannels(query: string): ChannelSummary[];
