const assert = require('assert');

const { CHANNEL_GROUPS, ALL_CHANNELS, searchChannels } = require('../../../src/mock/channels.js');

assert.ok(CHANNEL_GROUPS.length >= 5, 'channel metadata includes core groups');
assert.ok(ALL_CHANNELS.some((channel) => channel.id === 8001 && channel.group === 'PCM Receiver'));
assert.ok(ALL_CHANNELS.some((channel) => channel.id === 1205 && channel.unit === 'bar'));
assert.ok(searchChannels('hyd').some((channel) => channel.id === 1205));
assert.ok(searchChannels('8001').some((channel) => channel.name === 'frame_counter'));
assert.ok(searchChannels('').length === ALL_CHANNELS.length);

console.log('Channel metadata tests passed');
