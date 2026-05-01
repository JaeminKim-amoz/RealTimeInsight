//! PCM frame generator — produces a stream of CRC-valid PCM frames at a
//! calibrated frame rate so a UDP sender can hit a target line rate (e.g.
//! 10 Mbps) without further computation.
//!
//! Builds frames directly using the existing primitives in [`super`]
//! (sync-pattern placement, [`crc16_ccitt`], [`frame_to_bits`],
//! [`bits_to_bytes`]). It does *not* go through `create_test_frame` because
//! that helper hardcodes word indices specific to the 640-word default
//! profile and would panic for shorter frames.
//!
//! Each call to [`PcmGenerator::step`] returns the next frame's raw words;
//! [`PcmGenerator::step_bytes`] returns the byte-packed form ready for
//! `tokio::net::UdpSocket::send_to`.

use super::{bits_to_bytes, crc16_ccitt, frame_to_bits, words_to_bytes, PcmProfile};

/// Generates an unbounded sequence of CRC-valid PCM frames at a calibrated
/// frame rate matching `bitrate_mbps`.
#[derive(Debug, Clone)]
pub struct PcmGenerator {
    pub profile: PcmProfile,
    pub channel_ids: Vec<u32>,
    pub bitrate_mbps: f64,
    pub counter: u32,
    /// Calibration: bytes_per_frame derived from profile.
    pub bytes_per_frame: usize,
    /// Calibration: target frame_rate_hz to hit `bitrate_mbps`.
    pub frame_rate_hz: f64,
}

impl PcmGenerator {
    /// Builds a generator for the given profile and target line rate.
    ///
    /// `bytes_per_frame` is `(frame_words * word_bits)` rounded up to the
    /// nearest byte. `frame_rate_hz` is `bitrate_bps / bits_per_frame` so
    /// each frame carries exactly the configured number of payload bits.
    pub fn new(profile: PcmProfile, channel_ids: Vec<u32>, bitrate_mbps: f64) -> Self {
        let bits_per_frame = profile.frame_words * profile.word_bits;
        let bytes_per_frame = bits_per_frame.div_ceil(8);
        let bitrate_bps = bitrate_mbps * 1.0e6;
        let frame_rate_hz = if bits_per_frame == 0 {
            0.0
        } else {
            bitrate_bps / bits_per_frame as f64
        };

        Self {
            profile,
            channel_ids,
            bitrate_mbps,
            counter: 0,
            bytes_per_frame,
            frame_rate_hz,
        }
    }

    /// Calibrated rate the generator targets, in Hz.
    pub fn target_frame_rate_hz(&self) -> f64 {
        self.frame_rate_hz
    }

    /// Produces the next frame as raw words (suitable for `frame_to_bits`).
    /// Each call increments the internal counter so consecutive frames carry
    /// distinct sequence numbers.
    ///
    /// Frame layout:
    /// - words[0..2]: 32-bit frame counter (big-endian split)
    /// - words[2]:    subcommutation byte | static marker (0x5A)
    /// - words[3..crc_word_index]: payload (rotated channel id values)
    /// - words[crc_word_index]:   CRC-16/CCITT over preceding bytes
    /// - words[sync_word_start_index..+2]: sync pattern (top 16 + bottom 16)
    pub fn step(&mut self) -> Vec<u16> {
        let profile = &self.profile;
        let counter = self.counter;
        let mut words = vec![0u16; profile.frame_words];

        // Header: 32-bit counter split across the first two words.
        words[0] = (counter >> 16) as u16;
        words[1] = (counter & 0xFFFF) as u16;

        // Subcommutation: low N bits of counter, plus a fixed marker for parity
        // with the existing `create_test_frame` shape (decoder samples expect
        // the subcom in the low byte of words[2]).
        let subcom = counter & ((1u32 << profile.subcommutation_mask_bits) - 1);
        words[2] = ((subcom << 8) as u16) | 0x5A;

        // Payload: rotate over channel_ids so each frame embeds a fingerprint
        // of the channel it represents. Skip header words and the CRC/sync
        // slots so we don't trample reserved positions.
        if !self.channel_ids.is_empty() {
            for (slot_index, word_slot) in (3..profile.crc_word_index).enumerate() {
                if word_slot == profile.sync_word_start_index
                    || word_slot == profile.sync_word_start_index + 1
                {
                    continue;
                }
                let channel = self.channel_ids[slot_index % self.channel_ids.len()];
                let value = (channel as u16).wrapping_add((counter & 0xFFFF) as u16);
                let masked = value & word_mask(profile.word_bits);
                words[word_slot] = masked;
            }
        }

        // Sync pattern occupies two words at sync_word_start_index.
        if profile.sync_word_start_index + 1 < profile.frame_words {
            words[profile.sync_word_start_index] = (profile.sync_pattern >> 16) as u16;
            words[profile.sync_word_start_index + 1] =
                (profile.sync_pattern & 0xFFFF) as u16;
        }

        // CRC over all words preceding crc_word_index, treating each word as
        // big-endian 2 bytes (matches `decode_frame_words`).
        words[profile.crc_word_index] = crc16_ccitt(
            &words_to_bytes(&words, 0, profile.crc_word_index),
            profile.crc_initial,
            profile.crc_xor_out,
        );

        self.counter = self.counter.wrapping_add(1);
        words
    }

    /// Same as [`Self::step`] but returns the bit-packed bytes ready for UDP.
    pub fn step_bytes(&mut self) -> Vec<u8> {
        let words = self.step();
        let bits = frame_to_bits(&words, 0, &self.profile);
        bits_to_bytes(&bits)
    }
}

fn word_mask(word_bits: usize) -> u16 {
    if word_bits >= 16 {
        u16::MAX
    } else {
        ((1u32 << word_bits) - 1) as u16
    }
}
