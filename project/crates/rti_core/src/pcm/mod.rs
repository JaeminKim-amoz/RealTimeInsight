#[derive(Debug, Clone)]
pub struct PcmProfile {
    pub sync_pattern: u32,
    pub sync_width_bits: usize,
    pub sync_placement: SyncPlacement,
    pub frame_words: usize,
    pub word_bits: usize,
    pub crc_word_index: usize,
    pub sync_word_start_index: usize,
    pub subcommutation_mask_bits: u8,
    pub crc_initial: u16,
    pub crc_xor_out: u16,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SyncPlacement {
    Leading,
    Trailing,
}

#[derive(Debug, Clone, PartialEq)]
pub struct DecodedSample {
    pub channel_id: u32,
    pub value: f64,
    pub raw: u32,
    pub timestamp: f64,
    pub quality_flags: Vec<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct DecodedFrame {
    pub words: Vec<u16>,
    pub frame_counter: u32,
    pub subcommutation: u32,
    pub crc_ok: bool,
    pub expected_crc: u16,
    pub stored_crc: u16,
    pub quality_flags: Vec<String>,
    pub samples: Vec<DecodedSample>,
    pub bit_offset: usize,
    pub sync_offset: usize,
}

#[derive(Debug, Clone, PartialEq)]
pub struct DecodeStats {
    pub sync_matches: usize,
    pub good_frames: usize,
    pub bad_frames: usize,
}

#[derive(Debug, Clone, PartialEq)]
pub struct DecodeResult {
    pub frames: Vec<DecodedFrame>,
    pub bad_frames: Vec<DecodedFrame>,
    pub stats: DecodeStats,
}

impl Default for PcmProfile {
    fn default() -> Self {
        Self {
            sync_pattern: 0xFE6B_2840,
            sync_width_bits: 32,
            sync_placement: SyncPlacement::Trailing,
            frame_words: 640,
            word_bits: 16,
            crc_word_index: 637,
            sync_word_start_index: 638,
            subcommutation_mask_bits: 4,
            crc_initial: 0xFFFF,
            crc_xor_out: 0x0000,
        }
    }
}

pub fn crc16_ccitt(bytes: &[u8], initial: u16, xor_out: u16) -> u16 {
    let mut crc = initial;
    for byte in bytes {
        crc ^= (*byte as u16) << 8;
        for _ in 0..8 {
            crc = if crc & 0x8000 != 0 {
                (crc << 1) ^ 0x1021
            } else {
                crc << 1
            };
        }
    }
    crc ^ xor_out
}

pub fn words_to_bytes(words: &[u16], start_word: usize, end_word_exclusive: usize) -> Vec<u8> {
    let mut bytes = Vec::with_capacity((end_word_exclusive - start_word) * 2);
    for word in &words[start_word..end_word_exclusive] {
        bytes.push((word >> 8) as u8);
        bytes.push((word & 0xFF) as u8);
    }
    bytes
}

pub fn bits_from_words(words: &[u16], word_bits: usize) -> Vec<u8> {
    let mut bits = Vec::with_capacity(words.len() * word_bits);
    for word in words {
        for bit in (0..word_bits).rev() {
            bits.push(((word >> bit) & 1) as u8);
        }
    }
    bits
}

pub fn bits_to_bytes(bits: &[u8]) -> Vec<u8> {
    let mut bytes = vec![0u8; bits.len().div_ceil(8)];
    for (index, bit) in bits.iter().enumerate() {
        bytes[index / 8] |= (*bit & 1) << (7 - (index % 8));
    }
    bytes
}

pub fn bits_from_bytes(bytes: &[u8]) -> Vec<u8> {
    let mut bits = Vec::with_capacity(bytes.len() * 8);
    for byte in bytes {
        for bit in (0..8).rev() {
            bits.push((byte >> bit) & 1);
        }
    }
    bits
}

pub fn read_bits(bits: &[u8], offset: usize, width: usize) -> u32 {
    let mut value = 0u32;
    for index in 0..width {
        value = (value << 1) | (bits.get(offset + index).copied().unwrap_or(0) as u32);
    }
    value
}

pub fn find_sync_offsets(bits: &[u8], pattern: u32, width: usize) -> Vec<usize> {
    let mut offsets = Vec::new();
    if bits.len() < width || width == 0 || width > 32 {
        return offsets;
    }

    let target = if width == 32 {
        pattern
    } else {
        pattern >> (32 - width)
    } as u64;
    let mask = if width == 32 {
        u32::MAX as u64
    } else {
        (1u64 << width) - 1
    };

    let mut window = 0u64;
    for (index, bit) in bits.iter().enumerate() {
        window = ((window << 1) | ((*bit & 1) as u64)) & mask;
        if index + 1 >= width && window == target {
            offsets.push(index + 1 - width);
        }
    }
    offsets
}

pub fn decode_bitstream(bits: &[u8], profile: &PcmProfile) -> DecodeResult {
    let frame_bits = profile.frame_words * profile.word_bits;
    let sync_offsets = find_sync_offsets(bits, profile.sync_pattern, profile.sync_width_bits);
    let mut frames = Vec::new();
    let mut bad_frames = Vec::new();

    for sync_offset in &sync_offsets {
        let start = match profile.sync_placement {
            SyncPlacement::Trailing => {
                let before_sync = profile.sync_word_start_index * profile.word_bits;
                if *sync_offset < before_sync {
                    continue;
                }
                sync_offset - before_sync
            }
            SyncPlacement::Leading => *sync_offset,
        };
        if start + frame_bits > bits.len() {
            continue;
        }

        let mut words = Vec::with_capacity(profile.frame_words);
        for word_index in 0..profile.frame_words {
            words.push(read_bits(bits, start + word_index * profile.word_bits, profile.word_bits) as u16);
        }

        if words[profile.sync_word_start_index] != (profile.sync_pattern >> 16) as u16 {
            continue;
        }
        if words[profile.sync_word_start_index + 1] != (profile.sync_pattern & 0xFFFF) as u16 {
            continue;
        }

        let mut decoded = decode_frame_words(words, profile);
        decoded.bit_offset = start;
        decoded.sync_offset = *sync_offset;
        if decoded.crc_ok {
            frames.push(decoded);
        } else {
            bad_frames.push(decoded);
        }
    }

    DecodeResult {
        stats: DecodeStats {
            sync_matches: sync_offsets.len(),
            good_frames: frames.len(),
            bad_frames: bad_frames.len(),
        },
        frames,
        bad_frames,
    }
}

pub fn decode_bytes(bytes: &[u8], profile: &PcmProfile) -> DecodeResult {
    decode_bitstream(&bits_from_bytes(bytes), profile)
}

pub fn decode_frame_words(words: Vec<u16>, profile: &PcmProfile) -> DecodedFrame {
    let expected_crc = crc16_ccitt(
        &words_to_bytes(&words, 0, profile.crc_word_index),
        profile.crc_initial,
        profile.crc_xor_out,
    );
    let stored_crc = words[profile.crc_word_index];
    let frame_counter = ((words[0] as u32) << 16) | words[1] as u32;
    let subcommutation = frame_counter & ((1u32 << profile.subcommutation_mask_bits) - 1);
    let crc_ok = expected_crc == stored_crc;
    let quality_flags = if crc_ok {
        vec!["sync-lock".to_string(), "crc-ok".to_string()]
    } else {
        vec!["sync-lock".to_string(), "crc-fail".to_string()]
    };
    let samples = if crc_ok {
        extract_samples(&words, frame_counter, subcommutation, &quality_flags)
    } else {
        Vec::new()
    };
    DecodedFrame {
        words,
        frame_counter,
        subcommutation,
        crc_ok,
        expected_crc,
        stored_crc,
        quality_flags,
        samples,
        bit_offset: 0,
        sync_offset: 0,
    }
}

fn decode_signed(raw: u16, bits: u8) -> i32 {
    let sign = 1i32 << (bits - 1);
    let value = raw as i32;
    if value & sign != 0 {
        value - (1i32 << bits)
    } else {
        value
    }
}

fn sample(
    channel_id: u32,
    value: f64,
    raw: u32,
    timestamp: f64,
    quality_flags: &[String],
) -> DecodedSample {
    DecodedSample {
        channel_id,
        value,
        raw,
        timestamp,
        quality_flags: quality_flags.to_vec(),
    }
}

pub fn extract_samples(
    words: &[u16],
    frame_counter: u32,
    subcommutation: u32,
    quality_flags: &[String],
) -> Vec<DecodedSample> {
    let timestamp = 182.2 + frame_counter as f64 / 30.0;
    let at = |index: usize| words[index] as u32;
    vec![
        sample(8001, frame_counter as f64, frame_counter, timestamp, quality_flags),
        sample(8004, subcommutation as f64, subcommutation, timestamp, quality_flags),
        sample(8005, 0.0, 0, timestamp, quality_flags),
        sample(8006, 1.0, 1, timestamp, quality_flags),
        sample(1001, at(4) as f64 * 0.004_882, at(4), timestamp, quality_flags),
        sample(1002, at(5) as f64 * 0.01, at(5), timestamp, quality_flags),
        sample(1205, decode_signed(words[8], 16) as f64 * 0.25 - 100.0, at(8), timestamp, quality_flags),
        sample(1206, decode_signed(words[9], 16) as f64 * 0.25 - 100.0, at(9), timestamp, quality_flags),
        sample(2210, decode_signed(words[10], 16) as f64 * 0.01, at(10), timestamp, quality_flags),
        sample(2211, decode_signed(words[11], 16) as f64 * 0.01, at(11), timestamp, quality_flags),
        sample(2212, decode_signed(words[12], 16) as f64 * 0.01, at(12), timestamp, quality_flags),
        sample(5002, decode_signed(words[64], 16) as f64 * 0.5, at(64), timestamp, quality_flags),
        sample(5003, at(65) as f64 * 0.1, at(65), timestamp, quality_flags),
    ]
}

pub fn create_test_frame(counter: u32, corrupt_crc: bool, profile: &PcmProfile) -> Vec<u16> {
    let mut words = vec![0u16; profile.frame_words];
    words[0] = (counter >> 16) as u16;
    words[1] = (counter & 0xFFFF) as u16;
    words[2] = (((counter & ((1 << profile.subcommutation_mask_bits) - 1)) << 8) as u16) | 0x5A;
    words[4] = ((28.0 / 0.004882) as u16).wrapping_add((counter & 0xF) as u16);
    words[5] = ((42.0 / 0.01) as u16).wrapping_add((counter & 0xF) as u16);
    words[8] = 0x04CC;
    words[9] = 0x04B0;
    words[10] = 0x000A;
    words[11] = 0x000B;
    words[12] = 0x000C;
    words[64] = 0xFF84;
    words[65] = 0x00B4;

    words[profile.sync_word_start_index] = (profile.sync_pattern >> 16) as u16;
    words[profile.sync_word_start_index + 1] = (profile.sync_pattern & 0xFFFF) as u16;
    words[profile.crc_word_index] = crc16_ccitt(
        &words_to_bytes(&words, 0, profile.crc_word_index),
        profile.crc_initial,
        profile.crc_xor_out,
    );
    if corrupt_crc {
        words[profile.crc_word_index] ^= 0x0001;
    }
    words
}

pub fn frame_to_bits(words: &[u16], bit_slip: usize, profile: &PcmProfile) -> Vec<u8> {
    let mut bits = Vec::new();
    for i in 0..bit_slip {
        bits.push((i & 1) as u8);
    }
    bits.extend(bits_from_words(words, profile.word_bits));
    bits
}
